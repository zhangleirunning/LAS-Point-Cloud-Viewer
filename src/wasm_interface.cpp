/**
 * @file wasm_interface.cpp
 * @brief WebAssembly interface for JavaScript integration
 * 
 * This module provides the bridge between C++ point cloud processing code
 * and JavaScript rendering code. It exports functions that can be called
 * from JavaScript to:
 * - Load and parse LAS files
 * - Build spatial indices
 * - Query visible points with frustum culling and LOD
 * - Manage memory lifecycle
 * 
 * Memory management:
 * - JavaScript passes file data by copying to WASM heap
 * - C++ allocates and owns point cloud and octree data
 * - JavaScript receives pointers to WASM memory for zero-copy access
 * - freeLASData() must be called to prevent memory leaks
 * 
 * Data flow:
 * 1. JavaScript: Read file as ArrayBuffer
 * 2. JavaScript: Copy to WASM memory
 * 3. C++: Parse LAS file (loadLASFile)
 * 4. C++: Build spatial index (buildSpatialIndex)
 * 5. JavaScript: Query visible points each frame (queryVisiblePoints)
 * 6. JavaScript: Read point data from WASM memory
 * 7. JavaScript: Upload to GPU and render
 * 8. C++: Clean up when done (freeLASData)
 */

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

#include "las_parser.h"
#include "spatial_index.h"
#include <memory>
#include <cstring>
#include <cstdint>
#include <cstdio>

/**
 * @brief Global state for current point cloud and spatial index
 * 
 * These globals maintain the state of the currently loaded point cloud.
 * Only one point cloud can be loaded at a time. Loading a new file
 * automatically frees the previous data.
 * 
 * @note Using globals is acceptable here because:
 * - WASM runs in a single-threaded environment
 * - Only one point cloud is active at a time
 * - Simplifies the JavaScript interface (no handle management)
 */
namespace {
    std::unique_ptr<LASHeader> g_header;        ///< Current file header
    std::unique_ptr<std::vector<LASPoint>> g_points;  ///< Current point cloud
    std::unique_ptr<SpatialIndex> g_spatial_index;    ///< Current spatial index
}

extern "C" {

#ifdef __EMSCRIPTEN__
    #define WASM_EXPORT EMSCRIPTEN_KEEPALIVE
#else
    #define WASM_EXPORT  ///< Empty macro for native builds (testing)
#endif

/**
 * @brief Load and parse a LAS file from memory
 * 
 * This is the main entry point for loading point cloud data. It:
 * 1. Frees any previously loaded data
 * 2. Parses the LAS file header
 * 3. Extracts all point records
 * 4. Stores data in global state
 * 
 * JavaScript usage:
 * @code
 * const fileData = new Uint8Array(await file.arrayBuffer());
 * const dataPtr = Module._malloc(fileData.length);
 * Module.HEAPU8.set(fileData, dataPtr);
 * const headerPtr = Module._loadLASFile(dataPtr, fileData.length);
 * if (headerPtr === 0) {
 *     console.error("Failed to load LAS file");
 * } else {
 *     // Read header metadata from WASM memory
 *     const pointCount = Module.HEAPU32[headerPtr >> 2];
 *     // ...
 * }
 * Module._free(dataPtr);
 * @endcode
 * 
 * @param data Pointer to LAS file data in WASM memory
 * @param size Size of the data in bytes
 * @return Pointer to LASHeader in WASM memory, or 0 on error
 * 
 * @note The returned pointer is valid until the next call to loadLASFile or freeLASData
 * @note JavaScript must free the input data pointer after this call
 */
WASM_EXPORT
uintptr_t loadLASFile(const uint8_t* data, uint32_t size) {
    // Free any existing data first
    g_header.reset();
    g_points.reset();
    g_spatial_index.reset();
    
    // Parse header
    LASParser parser;
    auto header_result = parser.parseHeader(data, size);
    
    if (header_result.isErr()) {
        // Return 0 to indicate error
        return 0;
    }
    
    // Store header
    g_header = std::make_unique<LASHeader>(header_result.value());
    
    // Parse points
    auto points_result = parser.parsePoints(data, size, *g_header);
    
    if (points_result.isErr()) {
        // Clean up and return error
        g_header.reset();
        return 0;
    }
    
    // Store points
    g_points = std::make_unique<std::vector<LASPoint>>(std::move(points_result.value()));
    
    // Return pointer to header (cast to uintptr_t for JavaScript)
    return reinterpret_cast<uintptr_t>(g_header.get());
}

/**
 * @brief Get pointer to point data array
 * 
 * Returns a pointer to the array of parsed points. JavaScript can read
 * this memory directly for zero-copy data transfer.
 * 
 * JavaScript usage:
 * @code
 * const countPtr = Module._malloc(4);
 * const pointsPtr = Module._getPointData(countPtr);
 * const count = Module.HEAPU32[countPtr >> 2];
 * 
 * // Read point data (each LASPoint is 16 bytes: 3 floats + 3 bytes + 2 bytes + 1 byte + padding)
 * const pointsView = new DataView(Module.HEAPU8.buffer, pointsPtr);
 * for (let i = 0; i < count; i++) {
 *     const offset = i * 16;
 *     const x = pointsView.getFloat32(offset + 0, true);
 *     const y = pointsView.getFloat32(offset + 4, true);
 *     const z = pointsView.getFloat32(offset + 8, true);
 *     const r = pointsView.getUint8(offset + 12);
 *     const g = pointsView.getUint8(offset + 13);
 *     const b = pointsView.getUint8(offset + 14);
 *     // ...
 * }
 * Module._free(countPtr);
 * @endcode
 * 
 * @param out_count Pointer to uint32_t where point count will be written
 * @return Pointer to point array in WASM memory, or 0 if no data loaded
 * 
 * @note The returned pointer is valid until the next call to loadLASFile or freeLASData
 * @note JavaScript must free the out_count pointer after reading
 */
WASM_EXPORT
uintptr_t getPointData(uint32_t* out_count) {
    if (!g_points || !out_count) {
        if (out_count) {
            *out_count = 0;
        }
        return 0;
    }
    
    *out_count = static_cast<uint32_t>(g_points->size());
    return reinterpret_cast<uintptr_t>(g_points->data());
}

/**
 * @brief Build spatial index (octree) from loaded point cloud
 * 
 * Constructs an octree spatial index for efficient frustum culling and LOD.
 * Must be called after loadLASFile and before queryVisiblePoints.
 * 
 * Construction time depends on point count:
 * - 1M points: ~100ms
 * - 10M points: ~1-2 seconds
 * 
 * JavaScript usage:
 * @code
 * // After loading file
 * Module._buildSpatialIndex();
 * // Now ready to query visible points
 * @endcode
 * 
 * @note This function does nothing if no point cloud is loaded
 * @note The spatial index is automatically freed when loading a new file or calling freeLASData
 */
WASM_EXPORT
void buildSpatialIndex() {
    if (!g_points) {
        return;
    }
    
    // Create and build spatial index
    g_spatial_index = std::make_unique<SpatialIndex>();
    g_spatial_index->build(*g_points, 10);  // Max depth of 10
}

/**
 * @brief Query visible points using frustum culling and LOD
 * 
 * Returns indices of points that are visible from the current camera view.
 * Applies frustum culling to skip points outside the view, and LOD to
 * reduce point density at distance.
 * 
 * This function should be called every frame with the current camera frustum.
 * 
 * JavaScript usage:
 * @code
 * // Extract frustum planes from view-projection matrix
 * const frustumPlanes = new Float32Array(24); // 6 planes × 4 coefficients
 * extractFrustumPlanes(viewProjMatrix, frustumPlanes);
 * 
 * // Copy frustum to WASM memory
 * const frustumPtr = Module._malloc(24 * 4);
 * Module.HEAPF32.set(frustumPlanes, frustumPtr >> 2);
 * 
 * // Query visible points
 * const countPtr = Module._malloc(4);
 * const indicesPtr = Module._queryVisiblePoints(
 *     frustumPtr,
 *     cameraDistance,
 *     1000000,  // max 1M points
 *     countPtr
 * );
 * 
 * const visibleCount = Module.HEAPU32[countPtr >> 2];
 * const indices = new Uint32Array(
 *     Module.HEAPU32.buffer,
 *     indicesPtr,
 *     visibleCount
 * );
 * 
 * // Use indices to extract point data...
 * 
 * Module._free(frustumPtr);
 * Module._free(countPtr);
 * @endcode
 * 
 * @param frustum_planes Pointer to 24 floats (6 planes × 4 coefficients [a,b,c,d])
 * @param camera_distance Distance from camera to scene center (for LOD)
 * @param max_points Maximum number of points to return (performance budget)
 * @param out_count Pointer to uint32_t where result count will be written
 * @return Pointer to array of point indices in WASM memory, or 0 on error
 * 
 * @note The returned pointer is valid until the next call to queryVisiblePoints
 * @note The indices refer to positions in the point array from getPointData
 * @note JavaScript must free the frustum_planes and out_count pointers after use
 */
WASM_EXPORT
uintptr_t queryVisiblePoints(const float* frustum_planes, 
                            float camera_distance,
                            uint32_t max_points,
                            uint32_t* out_count) {
    if (!g_spatial_index || !g_points || !frustum_planes || !out_count) {
        if (out_count) {
            *out_count = 0;
        }
        return 0;
    }
    
    // Build Frustum structure from planes
    Frustum frustum;
    std::memcpy(frustum.planes, frustum_planes, sizeof(frustum.planes));
    
    // Query spatial index with LOD
    static std::vector<uint32_t> result_indices;
    result_indices = g_spatial_index->queryFrustumLOD(frustum, camera_distance, max_points);
    
    *out_count = static_cast<uint32_t>(result_indices.size());
    
    if (result_indices.empty()) {
        return 0;
    }
    
    return reinterpret_cast<uintptr_t>(result_indices.data());
}

/**
 * @brief Free all allocated LAS data and spatial index
 * 
 * Releases all memory associated with the current point cloud, including:
 * - LAS header
 * - Point data array
 * - Spatial index (octree)
 * 
 * Should be called:
 * - Before loading a new file (optional, loadLASFile does this automatically)
 * - When done with the point cloud to free memory
 * - Before closing the application
 * 
 * JavaScript usage:
 * @code
 * // When done with point cloud
 * Module._freeLASData();
 * @endcode
 * 
 * @note After calling this, all pointers returned by previous calls are invalid
 * @note It is safe to call this multiple times
 */
WASM_EXPORT
void freeLASData() {
    g_header.reset();
    g_points.reset();
    g_spatial_index.reset();
}

} // extern "C"

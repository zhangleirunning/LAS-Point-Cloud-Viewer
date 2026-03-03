// WebAssembly Interface implementation
// This file contains the WASM exported functions for JavaScript integration

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

#include "las_parser.h"
#include "spatial_index.h"
#include <memory>
#include <cstring>
#include <cstdint>

// Global state for current point cloud and spatial index
namespace {
    std::unique_ptr<LASHeader> g_header;
    std::unique_ptr<std::vector<LASPoint>> g_points;
    std::unique_ptr<SpatialIndex> g_spatial_index;
}

extern "C" {

#ifdef __EMSCRIPTEN__
    #define WASM_EXPORT EMSCRIPTEN_KEEPALIVE
#else
    #define WASM_EXPORT
#endif

/**
 * Load and parse a LAS file from memory
 * @param data Pointer to LAS file data in WASM memory
 * @param size Size of the data in bytes
 * @return Pointer to LASHeader in WASM memory, or 0 on error
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
 * Get pointer to point data array
 * @param out_count Pointer to uint32_t where point count will be written
 * @return Pointer to point array in WASM memory, or 0 if no data loaded
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
 * Build spatial index (octree) from loaded point cloud
 * Must be called after loadLASFile
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
 * Query visible points using frustum culling and LOD
 * @param frustum_planes Pointer to 24 floats (6 planes × 4 coefficients)
 * @param camera_distance Distance from camera to scene center
 * @param max_points Maximum number of points to return
 * @param out_count Pointer to uint32_t where result count will be written
 * @return Pointer to array of point indices in WASM memory, or 0 on error
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
 * Free all allocated LAS data and spatial index
 * Should be called before loading a new file or when done
 */
WASM_EXPORT
void freeLASData() {
    g_header.reset();
    g_points.reset();
    g_spatial_index.reset();
}

} // extern "C"

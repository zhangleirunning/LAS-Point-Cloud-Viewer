# Design Document: LAS Point Cloud Viewer

## Overview

The LAS Point Cloud Viewer is a browser-based 3D visualization application that demonstrates Modern C++ expertise, 3D graphics programming, and computational geometry skills. The system consists of a C++ core compiled to WebAssembly for high-performance LAS file parsing and spatial indexing, paired with a WebGL-based renderer for interactive 3D visualization.

The architecture follows a clear separation between data processing (C++/WASM) and presentation (JavaScript/WebGL), enabling efficient handling of large point cloud datasets while maintaining smooth interactive frame rates.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (JavaScript)                  │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │   UI Layer     │  │   Renderer   │  │  Camera Control │ │
│  │  - File Upload │  │  - WebGL 2.0 │  │  - Orbit/Pan    │ │
│  │  - Statistics  │  │  - Shaders   │  │  - Zoom         │ │
│  └────────┬───────┘  └──────┬───────┘  └────────┬────────┘ │
│           │                  │                    │          │
│           └──────────────────┼────────────────────┘          │
│                              │                               │
│  ┌───────────────────────────┴──────────────────────────┐   │
│  │           JavaScript Glue Layer                      │   │
│  │  - WASM Module Loading                               │   │
│  │  - Memory Management                                 │   │
│  │  - Data Transfer (Typed Arrays)                      │   │
│  └───────────────────────────┬──────────────────────────┘   │
└────────────────────────────────┼───────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │  WebAssembly Module     │
                    │  (Compiled from C++)    │
                    │                         │
                    │  ┌──────────────────┐   │
                    │  │   LAS Parser     │   │
                    │  │  - Header Read   │   │
                    │  │  - Point Extract │   │
                    │  │  - Coord Transform│  │
                    │  └────────┬─────────┘   │
                    │           │             │
                    │  ┌────────┴─────────┐   │
                    │  │  Spatial Index   │   │
                    │  │  - Octree        │   │
                    │  │  - Frustum Query │   │
                    │  │  - LOD Selection │   │
                    │  └──────────────────┘   │
                    └─────────────────────────┘
```

### Component Interaction Flow

1. **File Loading**: User selects LAS file → JavaScript reads as ArrayBuffer → Passes to WASM
2. **Parsing**: WASM LAS_Parser extracts points → Builds Spatial_Index → Returns metadata
3. **Rendering Loop**: JavaScript queries WASM for visible points → Transfers to GPU → WebGL renders
4. **Interaction**: User input updates camera → Frustum changes → New query to WASM → Re-render

## Components and Interfaces

### 1. LAS Parser (C++)

**Responsibility**: Parse LAS format files and extract point cloud data.

**Key Classes**:

```cpp
class LASHeader {
public:
    uint32_t point_count;
    double min_x, min_y, min_z;
    double max_x, max_y, max_z;
    double scale_x, scale_y, scale_z;
    double offset_x, offset_y, offset_z;
    uint8_t point_format;
    uint16_t point_record_length;
};

class LASPoint {
public:
    float x, y, z;           // World coordinates
    uint8_t r, g, b;         // RGB color
    uint16_t intensity;      // Intensity value
    uint8_t classification;  // Point classification
};

class LASParser {
public:
    // Parse LAS file from memory buffer
    Result<LASHeader> parseHeader(const uint8_t* data, size_t size);
    
    // Extract all points from file
    Result<std::vector<LASPoint>> parsePoints(
        const uint8_t* data, 
        size_t size,
        const LASHeader& header
    );
    
private:
    // Apply coordinate scaling and offset transformations
    void transformCoordinates(int32_t raw_x, int32_t raw_y, int32_t raw_z,
                             const LASHeader& header,
                             float& out_x, float& out_y, float& out_z);
    
    // Parse point based on format type
    LASPoint parsePointRecord(const uint8_t* record, uint8_t format);
};
```

**Interface to JavaScript**:
```cpp
// Exported WASM functions
extern "C" {
    // Returns pointer to header struct in WASM memory
    EMSCRIPTEN_KEEPALIVE
    uint32_t loadLASFile(const uint8_t* data, uint32_t size);
    
    // Returns pointer to point array in WASM memory
    EMSCRIPTEN_KEEPALIVE
    uint32_t getPointData(uint32_t* out_count);
    
    // Free allocated memory
    EMSCRIPTEN_KEEPALIVE
    void freeLASData();
}
```

### 2. Spatial Index (C++)

**Responsibility**: Organize points hierarchically for efficient spatial queries.

**Key Classes**:

```cpp
struct BoundingBox {
    float min_x, min_y, min_z;
    float max_x, max_y, max_z;
    
    bool contains(float x, float y, float z) const;
    bool intersects(const BoundingBox& other) const;
};

struct Frustum {
    float planes[6][4];  // 6 planes: left, right, top, bottom, near, far
    
    bool intersects(const BoundingBox& box) const;
};

class OctreeNode {
public:
    BoundingBox bounds;
    std::vector<uint32_t> point_indices;  // Indices into global point array
    std::unique_ptr<OctreeNode> children[8];
    uint32_t depth;
    
    bool isLeaf() const { return children[0] == nullptr; }
};

class SpatialIndex {
public:
    // Build octree from point cloud
    void build(const std::vector<LASPoint>& points, uint32_t max_depth = 10);
    
    // Query points visible in frustum with LOD
    std::vector<uint32_t> queryFrustum(
        const Frustum& frustum,
        float camera_distance,
        uint32_t max_points
    ) const;
    
    // Get bounding box of entire point cloud
    BoundingBox getBounds() const { return root_->bounds; }
    
private:
    std::unique_ptr<OctreeNode> root_;
    const std::vector<LASPoint>* points_;
    
    // Recursively build octree
    void buildRecursive(OctreeNode* node, 
                       const std::vector<uint32_t>& indices,
                       uint32_t current_depth,
                       uint32_t max_depth);
    
    // Recursively query with LOD
    void queryRecursive(const OctreeNode* node,
                       const Frustum& frustum,
                       float camera_distance,
                       std::vector<uint32_t>& results,
                       uint32_t max_points) const;
    
    // Calculate LOD skip factor based on distance
    uint32_t calculateLODSkip(float distance, uint32_t depth) const;
};
```

**Interface to JavaScript**:
```cpp
extern "C" {
    // Build spatial index from loaded points
    EMSCRIPTEN_KEEPALIVE
    void buildSpatialIndex();
    
    // Query visible points (returns pointer to index array)
    EMSCRIPTEN_KEEPALIVE
    uint32_t queryVisiblePoints(
        const float* frustum_planes,  // 24 floats (6 planes × 4 coefficients)
        float camera_distance,
        uint32_t max_points,
        uint32_t* out_count
    );
}
```

### 3. WebGL Renderer (JavaScript)

**Responsibility**: Render point cloud using GPU acceleration.

**Key Components**:

```javascript
class PointCloudRenderer {
    constructor(canvas) {
        this.gl = canvas.getContext('webgl2');
        this.program = null;
        this.vao = null;
        this.positionBuffer = null;
        this.colorBuffer = null;
        this.pointCount = 0;
    }
    
    // Initialize shaders and buffers
    initialize() {
        this.program = this.createShaderProgram();
        this.vao = this.gl.createVertexArray();
        this.positionBuffer = this.gl.createBuffer();
        this.colorBuffer = this.gl.createBuffer();
    }
    
    // Upload point data to GPU
    updatePointData(positions, colors, count) {
        // positions: Float32Array of XYZ coordinates
        // colors: Uint8Array of RGB values
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.DYNAMIC_DRAW);
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, colors, this.gl.DYNAMIC_DRAW);
        
        this.pointCount = count;
    }
    
    // Render frame
    render(viewMatrix, projectionMatrix) {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        this.gl.useProgram(this.program);
        
        // Set uniforms
        this.gl.uniformMatrix4fv(this.viewLoc, false, viewMatrix);
        this.gl.uniformMatrix4fv(this.projLoc, false, projectionMatrix);
        
        // Draw points
        this.gl.bindVertexArray(this.vao);
        this.gl.drawArrays(this.gl.POINTS, 0, this.pointCount);
    }
}
```

**Vertex Shader**:
```glsl
#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_color;

uniform mat4 u_view;
uniform mat4 u_projection;

out vec3 v_color;

void main() {
    gl_Position = u_projection * u_view * vec4(a_position, 1.0);
    gl_PointSize = 2.0;
    v_color = a_color / 255.0;
}
```

**Fragment Shader**:
```glsl
#version 300 es
precision highp float;

in vec3 v_color;
out vec4 fragColor;

void main() {
    fragColor = vec4(v_color, 1.0);
}
```

### 4. Camera Controller (JavaScript)

**Responsibility**: Handle user input and manage camera transformations.

```javascript
class CameraController {
    constructor() {
        this.position = [0, 0, 5];
        this.target = [0, 0, 0];
        this.up = [0, 1, 0];
        this.distance = 5;
        this.azimuth = 0;    // Horizontal rotation
        this.elevation = 30; // Vertical rotation
    }
    
    // Handle mouse drag for orbit
    onMouseDrag(deltaX, deltaY, button) {
        if (button === 0) { // Left button - orbit
            this.azimuth += deltaX * 0.5;
            this.elevation = Math.max(-89, Math.min(89, this.elevation + deltaY * 0.5));
            this.updatePosition();
        } else if (button === 2) { // Right button - pan
            this.pan(deltaX, deltaY);
        }
    }
    
    // Handle mouse wheel for zoom
    onMouseWheel(delta) {
        this.distance *= (1 + delta * 0.001);
        this.distance = Math.max(0.1, Math.min(100, this.distance));
        this.updatePosition();
    }
    
    // Calculate camera position from spherical coordinates
    updatePosition() {
        const rad_azimuth = this.azimuth * Math.PI / 180;
        const rad_elevation = this.elevation * Math.PI / 180;
        
        this.position[0] = this.target[0] + this.distance * Math.cos(rad_elevation) * Math.sin(rad_azimuth);
        this.position[1] = this.target[1] + this.distance * Math.sin(rad_elevation);
        this.position[2] = this.target[2] + this.distance * Math.cos(rad_elevation) * Math.cos(rad_azimuth);
    }
    
    // Get view matrix
    getViewMatrix() {
        return mat4.lookAt(this.position, this.target, this.up);
    }
    
    // Extract frustum planes from view-projection matrix
    getFrustumPlanes(viewProjMatrix) {
        // Extract 6 planes from combined matrix
        // Returns Float32Array of 24 values
    }
}
```

### 5. Application Controller (JavaScript)

**Responsibility**: Coordinate between WASM module, renderer, and UI.

```javascript
class PointCloudViewer {
    constructor(canvas) {
        this.wasmModule = null;
        this.renderer = new PointCloudRenderer(canvas);
        this.camera = new CameraController();
        this.stats = { fps: 0, pointCount: 0, visiblePoints: 0 };
    }
    
    // Initialize WASM module
    async initialize() {
        this.wasmModule = await loadWASM();
        this.renderer.initialize();
        this.startRenderLoop();
    }
    
    // Load LAS file
    async loadFile(file) {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Copy to WASM memory
        const dataPtr = this.wasmModule._malloc(uint8Array.length);
        this.wasmModule.HEAPU8.set(uint8Array, dataPtr);
        
        // Parse file
        const headerPtr = this.wasmModule._loadLASFile(dataPtr, uint8Array.length);
        const header = this.readHeader(headerPtr);
        
        // Build spatial index
        this.wasmModule._buildSpatialIndex();
        
        // Center camera on point cloud
        this.camera.target = [
            (header.min_x + header.max_x) / 2,
            (header.min_y + header.max_y) / 2,
            (header.min_z + header.max_z) / 2
        ];
        
        this.wasmModule._free(dataPtr);
        this.updateUI(header);
    }
    
    // Render loop
    renderFrame() {
        const viewMatrix = this.camera.getViewMatrix();
        const projMatrix = this.camera.getProjectionMatrix();
        const frustumPlanes = this.camera.getFrustumPlanes(
            mat4.multiply(projMatrix, viewMatrix)
        );
        
        // Query visible points from WASM
        const maxPoints = 1000000;
        const frustumPtr = this.copyToWASM(frustumPlanes);
        let countPtr = this.wasmModule._malloc(4);
        
        const indicesPtr = this.wasmModule._queryVisiblePoints(
            frustumPtr,
            this.camera.distance,
            maxPoints,
            countPtr
        );
        
        const visibleCount = this.wasmModule.HEAPU32[countPtr >> 2];
        
        // Get point data and upload to GPU
        const positions = this.extractPositions(indicesPtr, visibleCount);
        const colors = this.extractColors(indicesPtr, visibleCount);
        
        this.renderer.updatePointData(positions, colors, visibleCount);
        this.renderer.render(viewMatrix, projMatrix);
        
        this.stats.visiblePoints = visibleCount;
        this.updateStats();
        
        this.wasmModule._free(frustumPtr);
        this.wasmModule._free(countPtr);
    }
}
```

## Data Models

### LAS File Format Structure

The LAS format consists of:
1. **Public Header Block**: Metadata about the file and point cloud
2. **Variable Length Records** (optional): Additional metadata
3. **Point Data Records**: Array of point records

**Point Format 2** (RGB):
- X, Y, Z: 32-bit integers (scaled coordinates)
- Intensity: 16-bit unsigned integer
- Return Number, Number of Returns, Scan Direction, Edge of Flight Line: Bit fields
- Classification: 8-bit unsigned integer
- Scan Angle Rank: 8-bit signed integer
- User Data: 8-bit unsigned integer
- Point Source ID: 16-bit unsigned integer
- Red, Green, Blue: 16-bit unsigned integers

### Memory Layout

**Structure-of-Arrays (SoA) for Cache Efficiency**:

```cpp
struct PointCloudData {
    std::vector<float> positions_x;
    std::vector<float> positions_y;
    std::vector<float> positions_z;
    std::vector<uint8_t> colors_r;
    std::vector<uint8_t> colors_g;
    std::vector<uint8_t> colors_b;
    std::vector<uint16_t> intensity;
    std::vector<uint8_t> classification;
    uint32_t count;
};
```

This layout improves cache performance when:
- Querying spatial index (only need XYZ)
- Transferring to GPU (positions and colors separate)
- Applying LOD (can skip elements in arrays)

### Octree Structure

**Node Organization**:
- Each node represents a cubic region of 3D space
- Maximum 8 children (octants): -X-Y-Z, +X-Y-Z, -X+Y-Z, +X+Y-Z, -X-Y+Z, +X-Y+Z, -X+Y+Z, +X+Y+Z
- Leaf nodes store point indices
- Maximum depth prevents over-subdivision

**Subdivision Criteria**:
- Split if node contains > threshold points (e.g., 1000)
- Stop at maximum depth (e.g., 10 levels)
- Ensures balanced tree for uniform point distributions


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: LAS Header Parsing Round-Trip

*For any* valid LAS file with known metadata (point count, bounds, scale, offset), parsing the header should extract metadata that matches the original values within floating-point precision.

**Validates: Requirements 1.1**

### Property 2: Point Data Extraction Completeness

*For any* valid LAS file with N points, parsing should extract exactly N points, and each point should have all required attributes (XYZ coordinates, RGB colors, intensity, classification) populated.

**Validates: Requirements 1.2, 1.4**

### Property 3: Coordinate Transformation Correctness

*For any* raw integer coordinates and scale/offset parameters, applying the LAS coordinate transformation should produce world coordinates that satisfy: `world_coord = raw_coord * scale + offset`.

**Validates: Requirements 1.3**

### Property 4: Invalid File Rejection

*For any* file with invalid magic bytes, incorrect header size, or corrupted structure, the parser should return an error result without crashing or producing invalid data.

**Validates: Requirements 1.5, 12.1, 12.4**

### Property 5: WASM Data Transfer Integrity

*For any* point cloud data passed from JavaScript to WASM and back, the returned data should be identical to the input (round-trip property).

**Validates: Requirements 2.2, 2.3**

### Property 6: Memory Leak Prevention

*For any* sequence of load-parse-free operations, the total WASM heap size should return to its initial state after freeing, indicating no memory leaks.

**Validates: Requirements 2.4**

### Property 7: Octree Spatial Partitioning

*For any* point cloud, after building the octree, every point should be reachable through the tree structure, and each point should be in a leaf node whose bounding box contains that point's coordinates.

**Validates: Requirements 3.1, 3.4, 11.3**

### Property 8: Spatial Query Correctness

*For any* bounding box or frustum query, all returned points should be within the query region, and no points within the query region should be missing (assuming no LOD filtering).

**Validates: Requirements 3.2, 11.2**

### Property 9: Incremental Construction Equivalence

*For any* point cloud, building the octree incrementally (adding points in batches) should produce a tree that returns the same query results as building from all points at once.

**Validates: Requirements 3.5**

### Property 10: LOD Distance Relationship

*For any* two camera positions at different distances from the same region, the query at greater distance should return fewer or equal points than the query at closer distance.

**Validates: Requirements 4.1, 4.5**

### Property 11: Camera Frustum Update Consistency

*For any* camera movement, the visible point set should change to reflect the new frustum, and points outside the new frustum should not be included.

**Validates: Requirements 4.2, 6.5**

### Property 12: Color Data Preservation

*For any* point cloud with RGB data, the colors uploaded to the GPU should match the colors from the LAS file for all visible points.

**Validates: Requirements 5.2**

### Property 13: Camera Orbit Behavior

*For any* initial camera state and left-mouse drag delta, the camera should rotate around the target point, maintaining constant distance from the target.

**Validates: Requirements 6.1**

### Property 14: Camera Pan Behavior

*For any* initial camera state and right-mouse drag delta, both the camera position and target should move by the same offset in the view plane.

**Validates: Requirements 6.2**

### Property 15: Camera Zoom Behavior

*For any* initial camera state and scroll delta, the camera distance from target should change proportionally, and the target point should remain unchanged.

**Validates: Requirements 6.3**

### Property 16: Camera Constraint Enforcement

*For any* extreme user input (very large drag or scroll values), the camera distance should remain within valid bounds (e.g., 0.1 to 1000 units), and elevation should remain within [-89°, 89°].

**Validates: Requirements 6.4**

### Property 17: UI Metadata Display Accuracy

*For any* loaded LAS file, the displayed metadata (point count, bounds, file size) should match the actual file properties.

**Validates: Requirements 8.2**

### Property 18: Statistics Update Consistency

*For any* rendered frame, the displayed visible point count should match the actual number of points sent to the GPU.

**Validates: Requirements 8.4**

### Property 19: Color Mode Application

*For any* point cloud and selected color mode (RGB, elevation, intensity, classification), all rendered points should be colored according to the selected mode's mapping function.

**Validates: Requirements 8.5**

### Property 20: Bounding Box Containment

*For any* set of points, the calculated bounding box should contain all points, and no smaller axis-aligned box should contain all points (tightness property).

**Validates: Requirements 11.1**

### Property 21: 3D Transformation Correctness

*For any* point and transformation matrix (view or projection), applying the transformation should produce results consistent with standard 3D graphics math (e.g., translation, rotation, perspective division).

**Validates: Requirements 11.5**

### Property 22: Edge Case Robustness

*For any* edge case input (empty point cloud, single point, all points at same location), the system should handle it gracefully without crashing and produce valid (possibly empty) output.

**Validates: Requirements 12.5**

## Error Handling

### Error Categories

1. **File Format Errors**
   - Invalid magic bytes (not "LASF")
   - Unsupported version
   - Corrupted header
   - Truncated file
   - **Strategy**: Return `Result<T, Error>` types with descriptive error messages

2. **Memory Errors**
   - Allocation failure
   - Out of bounds access
   - **Strategy**: Use RAII and smart pointers; check allocation results

3. **WebAssembly Errors**
   - Module load failure
   - Function binding errors
   - **Strategy**: Provide fallback UI message; graceful degradation

4. **Rendering Errors**
   - WebGL context creation failure
   - Shader compilation errors
   - **Strategy**: Display error in UI; provide diagnostic information

### Error Handling Patterns

**C++ Side**:
```cpp
template<typename T, typename E>
class Result {
public:
    static Result Ok(T value) { return Result(std::move(value)); }
    static Result Err(E error) { return Result(std::move(error)); }
    
    bool isOk() const { return has_value_; }
    bool isErr() const { return !has_value_; }
    
    const T& value() const { return value_; }
    const E& error() const { return error_; }
    
private:
    bool has_value_;
    std::optional<T> value_;
    std::optional<E> error_;
};

// Usage
Result<LASHeader, std::string> parseHeader(const uint8_t* data, size_t size) {
    if (size < 227) {
        return Result::Err("File too small to contain LAS header");
    }
    
    if (memcmp(data, "LASF", 4) != 0) {
        return Result::Err("Invalid LAS magic bytes");
    }
    
    LASHeader header;
    // ... parse header ...
    
    return Result::Ok(header);
}
```

**JavaScript Side**:
```javascript
async function loadFile(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const result = wasmModule.loadLASFile(arrayBuffer);
        
        if (result.error) {
            showError(`Failed to load file: ${result.error}`);
            return;
        }
        
        updateUI(result.data);
    } catch (e) {
        showError(`Unexpected error: ${e.message}`);
        console.error(e);
    }
}
```

## Testing Strategy

### Dual Testing Approach

This project will use both unit tests and property-based tests to ensure comprehensive correctness:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs

Both types of tests are complementary and necessary. Unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across a wide input space.

### Property-Based Testing

**Framework**: We will use **Catch2** with **RapidCheck** for C++ property-based testing.

**Configuration**:
- Each property test will run a minimum of 100 iterations
- Each test will be tagged with a comment referencing the design property
- Tag format: `// Feature: las-point-cloud-viewer, Property N: [property text]`

**Example Property Test**:
```cpp
#include <catch2/catch.hpp>
#include <rapidcheck/catch.h>

// Feature: las-point-cloud-viewer, Property 3: Coordinate Transformation Correctness
TEST_CASE("Coordinate transformation correctness") {
    rc::prop("transformed coordinates satisfy formula", []() {
        // Generate random raw coordinates and scale/offset
        auto raw_x = *rc::gen::inRange(-2147483648, 2147483647);
        auto raw_y = *rc::gen::inRange(-2147483648, 2147483647);
        auto raw_z = *rc::gen::inRange(-2147483648, 2147483647);
        
        auto scale_x = *rc::gen::inRange(0.001, 1.0);
        auto scale_y = *rc::gen::inRange(0.001, 1.0);
        auto scale_z = *rc::gen::inRange(0.001, 1.0);
        
        auto offset_x = *rc::gen::inRange(-1000.0, 1000.0);
        auto offset_y = *rc::gen::inRange(-1000.0, 1000.0);
        auto offset_z = *rc::gen::inRange(-1000.0, 1000.0);
        
        // Apply transformation
        float world_x, world_y, world_z;
        transformCoordinates(raw_x, raw_y, raw_z,
                           scale_x, scale_y, scale_z,
                           offset_x, offset_y, offset_z,
                           world_x, world_y, world_z);
        
        // Verify formula
        float expected_x = raw_x * scale_x + offset_x;
        float expected_y = raw_y * scale_y + offset_y;
        float expected_z = raw_z * scale_z + offset_z;
        
        RC_ASSERT(std::abs(world_x - expected_x) < 0.0001);
        RC_ASSERT(std::abs(world_y - expected_y) < 0.0001);
        RC_ASSERT(std::abs(world_z - expected_z) < 0.0001);
    });
}
```

### Unit Testing

**Framework**: Catch2 for C++, Jest for JavaScript

**Focus Areas**:
- Specific LAS file format examples (known good files)
- Edge cases: empty files, single point, boundary values
- Error conditions: corrupted headers, invalid formats
- Integration points: WASM-JavaScript interface

**Example Unit Test**:
```cpp
#include <catch2/catch.hpp>

TEST_CASE("Parse valid LAS 1.2 header") {
    // Load known good LAS file
    std::vector<uint8_t> data = loadTestFile("test_data/sample.las");
    
    LASParser parser;
    auto result = parser.parseHeader(data.data(), data.size());
    
    REQUIRE(result.isOk());
    
    const auto& header = result.value();
    REQUIRE(header.point_count == 1000);
    REQUIRE(header.min_x == Approx(0.0));
    REQUIRE(header.max_x == Approx(100.0));
}

TEST_CASE("Reject file with invalid magic bytes") {
    std::vector<uint8_t> data(227, 0);
    // Set invalid magic bytes
    data[0] = 'X';
    data[1] = 'Y';
    data[2] = 'Z';
    data[3] = 'W';
    
    LASParser parser;
    auto result = parser.parseHeader(data.data(), data.size());
    
    REQUIRE(result.isErr());
    REQUIRE(result.error().find("magic") != std::string::npos);
}
```

### JavaScript Testing

**Framework**: Jest with jsdom for DOM testing

**Focus Areas**:
- UI interactions and updates
- WASM module integration
- Camera controller behavior
- Rendering pipeline

**Example Test**:
```javascript
describe('CameraController', () => {
    test('orbit maintains distance from target', () => {
        const camera = new CameraController();
        camera.target = [0, 0, 0];
        camera.distance = 10;
        camera.updatePosition();
        
        const initialDistance = vec3.distance(camera.position, camera.target);
        
        // Simulate orbit
        camera.onMouseDrag(50, 30, 0); // Left button
        
        const finalDistance = vec3.distance(camera.position, camera.target);
        
        expect(finalDistance).toBeCloseTo(initialDistance, 5);
    });
});
```

### Test Coverage Goals

- **C++ Core**: 90%+ line coverage for parsing and spatial indexing
- **JavaScript**: 80%+ coverage for application logic
- **Property Tests**: All 22 correctness properties implemented
- **Integration Tests**: End-to-end file load and render workflow

### Performance Testing

While not part of automated tests, manual performance validation should verify:
- 10M point file loads in < 5 seconds
- 30+ FPS with 1M visible points
- Memory usage scales linearly with point count
- No memory leaks over extended use

## Implementation Notes

### Build Configuration

**CMakeLists.txt** (C++):
```cmake
cmake_minimum_required(VERSION 3.15)
project(LASPointCloudViewer)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Emscripten-specific settings
if(EMSCRIPTEN)
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -s WASM=1 -s ALLOW_MEMORY_GROWTH=1")
    set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -O3 -s ASSERTIONS=0")
    set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} -g -s ASSERTIONS=1")
endif()

# Source files
add_executable(las_viewer
    src/las_parser.cpp
    src/spatial_index.cpp
    src/wasm_interface.cpp
)

# Tests
enable_testing()
add_subdirectory(tests)
```

### Key Algorithms

**Octree Construction** (O(n log n) average case):
1. Calculate bounding box of all points
2. Create root node with this bounding box
3. For each point, insert into tree:
   - If node is leaf and has < threshold points, add to node
   - If node is leaf and has ≥ threshold points, subdivide
   - If node is internal, recursively insert into appropriate child octant
4. Stop subdivision at maximum depth

**Frustum Culling**:
1. Extract 6 planes from view-projection matrix
2. For each octree node:
   - Test bounding box against all 6 planes
   - If completely outside any plane, skip node
   - If completely inside all planes, add all points
   - If intersecting, recursively test children
3. Apply LOD: skip points based on distance and depth

**LOD Selection**:
```
skip_factor = max(1, floor(distance / (base_distance * 2^depth)))
```
- Closer nodes: skip_factor = 1 (all points)
- Distant nodes: skip_factor > 1 (sample points)

### Performance Optimizations

1. **Memory Layout**: Structure-of-Arrays for cache efficiency
2. **SIMD**: Use Emscripten SIMD intrinsics for coordinate transformation
3. **GPU Upload**: Use `bufferSubData` for partial updates instead of full buffer replacement
4. **Frustum Culling**: Early exit when node is completely outside frustum
5. **Point Budget**: Limit total points per frame to maintain frame rate
6. **Web Workers**: Consider offloading octree queries to worker thread (future enhancement)

This design provides a solid foundation for demonstrating C++ expertise, 3D graphics knowledge, and understanding of performance-critical geospatial applications—all key requirements for the Esri position.

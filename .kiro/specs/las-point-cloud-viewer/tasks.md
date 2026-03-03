# Implementation Plan: LAS Point Cloud Viewer

## Overview

This implementation plan breaks down the LAS Point Cloud Viewer into discrete coding tasks. The approach follows an incremental development strategy: build core C++ parsing and spatial indexing first, compile to WebAssembly, then add the JavaScript rendering layer, and finally integrate everything with UI and camera controls. Each task builds on previous work, ensuring continuous integration and early validation.

## Current Status

The project structure and build system are complete. The next phase is implementing the core C++ functionality (LAS parser and spatial index), followed by the WASM interface, and then the JavaScript/WebGL rendering layer.

## Tasks

- [x] 1. Set up project structure and build system
  - Create directory structure (src/, tests/, web/, cmake/)
  - Set up CMakeLists.txt for C++ compilation with Emscripten
  - Configure build scripts for both native (testing) and WASM (production) targets
  - Add Catch2 and RapidCheck as test dependencies
  - Create basic README with build instructions
  - Create basic HTML/CSS structure for web interface
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 8.1_

- [x] 2. Implement LAS file parser (C++)
  - [x] 2.1 Create LAS data structures (LASHeader, LASPoint)
    - Define structs for header and point data
    - Implement Result<T, E> error handling type
    - _Requirements: 1.1, 1.2_

  - [x] 2.2 Implement header parsing
    - Read and validate magic bytes ("LASF")
    - Extract metadata (point count, bounds, scale, offset, point format)
    - Validate header size and version
    - _Requirements: 1.1, 12.4_

  - [x] 2.3 Implement point record parsing
    - Parse XYZ coordinates with scale/offset transformation
    - Extract RGB color values
    - Extract intensity and classification
    - Support LAS point format 2 (RGB)
    - _Requirements: 1.2, 1.3_

  - [x] 2.4 Write property test for coordinate transformation
    - **Property 3: Coordinate Transformation Correctness**
    - **Validates: Requirements 1.3**

  - [x] 2.5 Write property test for header parsing
    - **Property 1: LAS Header Parsing Round-Trip**
    - **Validates: Requirements 1.1**

  - [x] 2.6 Write property test for point extraction
    - **Property 2: Point Data Extraction Completeness**
    - **Validates: Requirements 1.2, 1.4**

  - [x] 2.7 Write unit tests for error handling
    - Test invalid magic bytes
    - Test truncated files
    - Test corrupted headers
    - _Requirements: 1.5, 12.1_

- [x] 3. Implement spatial indexing with octree (C++)
  - [x] 3.1 Create octree data structures
    - Define BoundingBox struct with intersection methods
    - Define OctreeNode class with children array
    - Define SpatialIndex class interface
    - _Requirements: 3.1_

  - [x] 3.2 Implement bounding box calculations
    - Calculate tight bounding box from point set
    - Implement box-box intersection test
    - Implement point-in-box test
    - _Requirements: 11.1_

  - [x] 3.3 Implement octree construction
    - Build root node from point cloud bounds
    - Implement recursive subdivision (8 octants)
    - Apply subdivision threshold (e.g., 1000 points per leaf)
    - Enforce maximum depth limit
    - _Requirements: 3.1, 3.4, 11.3_

  - [x] 3.4 Write property test for octree spatial partitioning
    - **Property 7: Octree Spatial Partitioning**
    - **Validates: Requirements 3.1, 3.4, 11.3**

  - [x] 3.5 Write property test for bounding box containment
    - **Property 20: Bounding Box Containment**
    - **Validates: Requirements 11.1**

  - [x] 3.6 Write unit tests for octree edge cases
    - Test empty point cloud
    - Test single point
    - Test all points at same location
    - _Requirements: 12.5_

- [x] 4. Implement frustum culling and spatial queries (C++)
  - [x] 4.1 Create Frustum data structure
    - Define 6 planes (left, right, top, bottom, near, far)
    - Implement plane-point distance calculation
    - Implement frustum-box intersection test
    - _Requirements: 11.2_

  - [x] 4.2 Implement spatial query with frustum culling
    - Recursive octree traversal
    - Test each node's bounding box against frustum
    - Collect point indices from visible leaf nodes
    - _Requirements: 3.2, 11.2_

  - [x] 4.3 Implement LOD (Level-of-Detail) selection
    - Calculate skip factor based on camera distance and node depth
    - Apply point sampling in distant nodes
    - Enforce maximum point budget per query
    - _Requirements: 4.1, 4.5_

  - [x] 4.4 Write property test for spatial query correctness
    - **Property 8: Spatial Query Correctness**
    - **Validates: Requirements 3.2, 11.2**

  - [x] 4.5 Write property test for LOD distance relationship
    - **Property 10: LOD Distance Relationship**
    - **Validates: Requirements 4.1, 4.5**

  - [x] 4.6 Write property test for frustum update consistency
    - **Property 11: Camera Frustum Update Consistency**
    - **Validates: Requirements 4.2, 6.5**

- [x] 5. Checkpoint - Ensure C++ core tests pass
  - Run all C++ unit tests and property tests
  - Verify no memory leaks with valgrind or sanitizers
  - Ensure code compiles without warnings (-Wall -Wextra)
  - Ask the user if questions arise

- [x] 6. Implement WebAssembly interface (C++)
  - [x] 6.1 Create WASM exported functions
    - Implement `loadLASFile(data, size)` - returns header pointer
    - Implement `getPointData(out_count)` - returns point array pointer
    - Implement `buildSpatialIndex()` - constructs octree
    - Implement `queryVisiblePoints(frustum, distance, max_points, out_count)` - returns indices
    - Implement `freeLASData()` - cleanup memory
    - Use `EMSCRIPTEN_KEEPALIVE` macro for exports
    - _Requirements: 2.1, 2.2_

  - [x] 6.2 Implement memory management for WASM
    - Use global state for current point cloud and octree
    - Implement proper cleanup in `freeLASData()`
    - Ensure no memory leaks across load/free cycles
    - _Requirements: 2.4_

  - [x] 6.3 Write property test for WASM data transfer integrity
    - **Property 5: WASM Data Transfer Integrity**
    - **Validates: Requirements 2.2, 2.3**

  - [x] 6.4 Write property test for memory leak prevention
    - **Property 6: Memory Leak Prevention**
    - **Validates: Requirements 2.4**

- [ ] 7. Set up web application structure (JavaScript/HTML)
  - [ ] 7.1 Create HTML page with canvas and UI elements
    - Add file upload input
    - Add canvas for WebGL rendering
    - Add metadata display area (point count, bounds, file size)
    - Add statistics display (FPS, visible points)
    - Add loading progress indicator
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ] 7.2 Create JavaScript module structure
    - Set up ES6 modules for clean organization
    - Create main application controller class
    - Set up WASM module loading with Emscripten glue code
    - _Requirements: 2.1_

  - [ ] 7.3 Implement WASM integration layer
    - Load WASM module asynchronously
    - Create JavaScript wrappers for WASM functions
    - Implement typed array data transfer (zero-copy where possible)
    - Handle WASM initialization errors gracefully
    - _Requirements: 2.2, 2.3, 7.3, 12.3_

- [ ] 8. Implement WebGL renderer (JavaScript)
  - [ ] 8.1 Create WebGL context and shader program
    - Initialize WebGL 2.0 context
    - Compile vertex and fragment shaders for point rendering
    - Create shader program and link
    - Handle shader compilation errors
    - _Requirements: 5.1_

  - [ ] 8.2 Set up vertex buffers and attributes
    - Create VAO (Vertex Array Object)
    - Create position buffer (XYZ coordinates)
    - Create color buffer (RGB values)
    - Configure vertex attributes
    - _Requirements: 5.2_

  - [ ] 8.3 Implement render loop
    - Clear color and depth buffers
    - Set view and projection matrices as uniforms
    - Enable depth testing
    - Draw points using `gl.drawArrays(gl.POINTS, ...)`
    - _Requirements: 5.5_

  - [ ] 8.4 Implement dynamic point data updates
    - Update position and color buffers each frame
    - Use `bufferData` or `bufferSubData` for GPU upload
    - Handle variable point counts efficiently
    - _Requirements: 5.2_

  - [ ]* 8.5 Write unit test for color data preservation
    - **Property 12: Color Data Preservation**
    - **Validates: Requirements 5.2**

- [ ] 9. Implement camera controller (JavaScript)
  - [ ] 9.1 Create camera state management
    - Store camera position, target, up vector
    - Store spherical coordinates (distance, azimuth, elevation)
    - Implement view matrix calculation (lookAt)
    - Implement projection matrix calculation (perspective)
    - _Requirements: 5.3_

  - [ ] 9.2 Implement mouse input handlers
    - Handle left-button drag for orbit rotation
    - Handle right-button drag for panning
    - Handle mouse wheel for zoom
    - Prevent default browser behaviors
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 9.3 Implement camera constraints
    - Clamp distance to valid range (0.1 to 1000)
    - Clamp elevation to [-89°, 89°] to prevent gimbal lock
    - Validate all camera state updates
    - _Requirements: 6.4_

  - [ ] 9.4 Implement frustum extraction
    - Calculate view-projection matrix
    - Extract 6 frustum planes from matrix
    - Return as Float32Array for WASM interface
    - _Requirements: 6.5_

  - [ ]* 9.5 Write property tests for camera behaviors
    - **Property 13: Camera Orbit Behavior**
    - **Property 14: Camera Pan Behavior**
    - **Property 15: Camera Zoom Behavior**
    - **Property 16: Camera Constraint Enforcement**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [ ] 10. Integrate file loading and rendering pipeline
  - [ ] 10.1 Implement file upload handler
    - Read file as ArrayBuffer
    - Copy data to WASM memory
    - Call WASM `loadLASFile()` function
    - Parse returned header metadata
    - Display metadata in UI
    - Handle file loading errors
    - _Requirements: 8.1, 8.2, 12.1_

  - [ ] 10.2 Implement spatial index building
    - Call WASM `buildSpatialIndex()` after file load
    - Show progress indicator during build
    - Center camera on point cloud bounds
    - _Requirements: 3.1_

  - [ ] 10.3 Implement render loop integration
    - Request animation frame loop
    - Query WASM for visible points each frame
    - Transfer point data to renderer
    - Update camera and render
    - Calculate and display FPS
    - _Requirements: 4.2, 8.4_

  - [ ]* 10.4 Write integration tests for file load workflow
    - Test complete load-parse-build-render pipeline
    - Verify UI updates correctly
    - Test error handling for invalid files
    - _Requirements: 8.2, 12.1_

- [ ] 11. Checkpoint - Ensure basic rendering works
  - Test with sample LAS file
  - Verify points render correctly with colors
  - Verify camera controls work (orbit, pan, zoom)
  - Verify LOD system reduces points at distance
  - Ask the user if questions arise

- [ ] 12. Implement color visualization modes (optional enhancement)
  - [ ] 12.1 Add color mode selector to UI
    - Add dropdown or radio buttons for color modes
    - Options: RGB, Elevation, Intensity, Classification
    - _Requirements: 8.5_

  - [ ] 12.2 Implement color mapping functions
    - RGB mode: use original colors
    - Elevation mode: map Z coordinate to color gradient
    - Intensity mode: map intensity to grayscale
    - Classification mode: map classification codes to distinct colors
    - _Requirements: 8.5_

  - [ ] 12.3 Update renderer to apply color modes
    - Modify color buffer generation based on selected mode
    - Update colors when mode changes
    - _Requirements: 8.5_

  - [ ]* 12.4 Write property test for color mode application
    - **Property 19: Color Mode Application**
    - **Validates: Requirements 8.5**

- [ ] 13. Implement error handling and edge cases
  - [ ]* 13.1 Write property test for invalid file rejection
    - **Property 4: Invalid File Rejection**
    - **Validates: Requirements 1.5, 12.1, 12.4**

  - [ ]* 13.2 Write property test for edge case robustness
    - **Property 22: Edge Case Robustness**
    - **Validates: Requirements 12.5**

  - [ ] 13.3 Add user-friendly error messages
    - Display errors in UI instead of console
    - Provide actionable error messages
    - Handle all error paths gracefully
    - _Requirements: 12.1, 12.3_

- [ ] 14. Performance optimization and validation
  - [ ] 14.1 Optimize WASM compilation flags
    - Enable -O3 optimization for release builds
    - Enable SIMD if beneficial
    - Minimize WASM binary size
    - _Requirements: 2.5, 7.1_

  - [ ] 14.2 Profile and optimize hot paths
    - Profile octree queries
    - Optimize coordinate transformations
    - Minimize GPU uploads
    - _Requirements: 7.2, 7.4, 7.5_

  - [ ] 14.3 Validate performance targets
    - Test with 10M point file (should load in < 5 seconds)
    - Test rendering with 1M visible points (should maintain 30+ FPS)
    - Verify memory usage is reasonable
    - _Requirements: 7.1, 7.2_

- [ ] 15. Final polish and documentation
  - [ ] 15.1 Add code documentation
    - Document all public APIs with comments
    - Add algorithm explanations for complex code
    - Document WASM interface clearly
    - _Requirements: 9.3_

  - [ ] 15.2 Create comprehensive README
    - Add project overview and goals
    - Add build instructions for all platforms
    - Add usage instructions
    - List dependencies and how to install them
    - Add screenshots or demo GIF
    - _Requirements: 10.4_

  - [ ] 15.3 Set up local development server
    - Create simple HTTP server script (Python or Node.js)
    - Add instructions to README
    - _Requirements: 10.5_

  - [ ] 15.4 Final code review and cleanup
    - Ensure code follows Modern C++ best practices
    - Remove debug code and commented-out sections
    - Verify all tests pass
    - Check for compiler warnings
    - _Requirements: 9.1, 9.5_

- [ ] 16. Final checkpoint - Complete system validation
  - Run full test suite (unit + property tests)
  - Test with multiple LAS files of varying sizes
  - Verify all requirements are met
  - Prepare demo for portfolio/interview
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and provide opportunities for user feedback
- Property tests validate universal correctness properties across many inputs
- Unit tests validate specific examples and edge cases
- The implementation follows a bottom-up approach: core C++ → WASM interface → JavaScript rendering → UI integration
- This project demonstrates Modern C++, 3D graphics, computational geometry, and performance optimization skills relevant to the Esri ArcGIS Pro 3D Analysis position

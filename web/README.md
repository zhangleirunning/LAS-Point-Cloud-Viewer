# LAS Point Cloud Viewer - Web Application

This directory contains the web-based frontend for the LAS Point Cloud Viewer.

## Structure

### HTML/CSS
- `index.html` - Main HTML page with canvas and UI elements
- `style.css` - Styling for the application

### JavaScript Modules
- `main.js` - Application entry point and initialization
- `PointCloudViewer.js` - Main application controller
- `UIController.js` - UI management and updates
- `WASMLoader.js` - WebAssembly module loading and integration
- `wasm-stub.js` - Development stub for WASM (temporary)

## Features Implemented (Task 7)

### 7.1 HTML Page with Canvas and UI Elements ✓
- File upload input with custom styling
- WebGL canvas for rendering
- Metadata display area (point count, bounds, file size)
- Statistics display (FPS, visible points, camera distance)
- Loading progress indicator with spinner and progress bar
- Error message display
- Camera controls hint overlay

### 7.2 JavaScript Module Structure ✓
- ES6 module organization
- `PointCloudViewer` class - main application controller
- `UIController` class - UI management
- Clean separation of concerns
- Proper initialization flow

### 7.3 WASM Integration Layer ✓
- Asynchronous WASM module loading
- JavaScript wrappers for WASM functions:
  - `loadLASFile()` - Parse LAS file
  - `getPointData()` - Get point data
  - `buildSpatialIndex()` - Build octree
  - `queryVisiblePoints()` - Frustum culling query
  - `freeLASData()` - Memory cleanup
- Typed array data transfer (zero-copy where possible)
- Error handling for WASM initialization failures
- Memory management utilities

## Development

### Running Locally

Start a local HTTP server:

```bash
# Python 3
python3 -m http.server 8080 --directory web

# Node.js (if you have http-server installed)
npx http-server web -p 8080
```

Then open http://localhost:8080 in your browser.

### WASM Stub

Currently using `wasm-stub.js` for development. This provides a fake implementation of the WASM interface for testing the JavaScript layer.

**To use the actual WASM:**
1. Build the C++ code to WASM using Emscripten (see root README)
2. Replace `wasm-stub.js` reference in `index.html` with the Emscripten-generated glue code
3. Ensure the `.wasm` file is in the same directory

## Requirements Validated

This implementation satisfies the following requirements:

- **Requirement 8.1**: File upload interface ✓
- **Requirement 8.2**: Metadata display (point count, bounds, file size) ✓
- **Requirement 8.3**: Loading progress indicator ✓
- **Requirement 8.4**: Real-time statistics display (FPS, visible points) ✓
- **Requirement 2.1**: JavaScript-callable WASM interface ✓
- **Requirement 2.2**: Efficient data transfer with typed arrays ✓
- **Requirement 2.3**: Zero-copy techniques where possible ✓
- **Requirement 7.3**: Error handling for WASM failures ✓
- **Requirement 12.3**: Graceful error handling ✓

## Next Steps

The following tasks will build on this foundation:

- **Task 8**: Implement WebGL renderer
- **Task 9**: Implement camera controller
- **Task 10**: Integrate file loading and rendering pipeline

## Architecture

```
main.js
  ├─> PointCloudViewer (application controller)
  │     ├─> WASMLoader (WASM integration)
  │     ├─> Renderer (task 8)
  │     └─> Camera (task 9)
  └─> UIController (UI management)
```

## Error Handling

The application handles errors gracefully at multiple levels:

1. **WASM Loading**: Timeout and initialization errors
2. **File Loading**: Invalid files, parsing errors
3. **Memory**: Allocation failures
4. **UI**: User-friendly error messages with auto-dismiss

All errors are logged to console and displayed to the user.

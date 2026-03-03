# LAS Point Cloud Viewer

A browser-based 3D point cloud visualization tool that demonstrates Modern C++, 3D graphics programming, and computational geometry skills. This project parses LAS format point cloud data using C++ compiled to WebAssembly and renders it efficiently in a web browser using WebGL.

![Point Cloud Viewer Screenshot](screenshot.png)
*Interactive 3D visualization of Mount Rainier LiDAR point cloud data (3.3M points) with elevation-based coloring*

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Sample Data](#sample-data)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Building](#building)
- [Running the Application](#running-the-application)
- [Usage Guide](#usage-guide)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Performance](#performance-targets)
- [Dependencies](#dependencies)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

## Overview

This project showcases:
- **Modern C++ expertise**: Smart pointers, move semantics, templates, STL
- **3D graphics programming**: WebGL rendering, camera systems, Level-of-Detail (LOD)
- **Large dataset handling**: Spatial indexing (octree), memory optimization
- **Computational geometry**: Octrees, frustum culling, coordinate transformations
- **Performance optimization**: Cache-friendly data layouts, GPU utilization
- **Cross-platform development**: WebAssembly compilation, browser compatibility

## Features

- Parse LAS 1.2/1.4 format point cloud files
- Efficient spatial indexing using octree data structure
- Real-time 3D rendering with WebGL 2.0
- Interactive camera controls (orbit, pan, zoom)
- Level-of-Detail (LOD) management for smooth performance
- Support for large datasets (10M+ points)
- Color visualization (elevation, intensity, classification)

## Sample Data

To test the viewer, you can use:
- **Demo file** (recommended): [Mount Rainier LAZ file](https://drive.google.com/file/d/1ju20rV_XE0HTgKppgn0cnRkTsmgcWBlP/view?usp=drive_link) - 3.3M points, USGS LiDAR data

Or download more sample LAS files from:
- [USGS 3DEP LiDAR](https://www.usgs.gov/3d-elevation-program)
- [OpenTopography](https://opentopography.org/)

## Architecture

```
┌─────────────────────────────────────────┐
│         Browser (JavaScript)            │
│  ┌──────────┐  ┌──────────────────────┐ │
│  │ Renderer │  │  Camera Controller   │ │
│  │ (WebGL)  │  │  (Orbit/Pan/Zoom)    │ │
│  └────┬─────┘  └──────────┬───────────┘ │
│       │                   │             │
│  ┌────┴───────────────────┴───────────┐ │
│  │     JavaScript Glue Layer          │ │
│  └────────────────┬───────────────────┘ │
└───────────────────┼─────────────────────┘
                    │
        ┌───────────┴──────────┐
        │  WebAssembly Module  │
        │  (Compiled C++)      │
        │  ┌────────────────┐  │
        │  │  LAS Parser    │  │
        │  ├────────────────┤  │
        │  │ Spatial Index  │  │
        │  │   (Octree)     │  │
        │  └────────────────┘  │
        └──────────────────────┘
```

## Prerequisites

### For Native Build (Testing)

- **CMake** 3.15 or later
- **C++ Compiler** with C++17 support (GCC 7+, Clang 5+, MSVC 2017+)
- **Git** (for fetching dependencies)

### For WebAssembly Build (Production)

- **Emscripten SDK** (latest version recommended)
  - Installation guide: https://emscripten.org/docs/getting_started/downloads.html

### For Web Development

- **Python 3** or **Node.js** (for local HTTP server)

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd las-point-cloud-viewer
```

### 2. Install Emscripten (for WASM builds)

```bash
# Download and install Emscripten
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh
cd ..
```

## Building

### Native Build (for Testing)

The native build compiles the C++ code for your local platform and runs unit tests and property-based tests.

```bash
./build_native.sh
```

This will:
1. Create a `build/native` directory
2. Download and configure Catch2 and RapidCheck test frameworks
3. Compile the C++ code
4. Run all tests

### WebAssembly Build (for Production)

The WASM build compiles the C++ code to WebAssembly for use in the browser.

```bash
# Make sure Emscripten is activated
source path/to/emsdk/emsdk_env.sh

# Build WASM
./build_wasm.sh
```

This will:
1. Create a `build/wasm` directory
2. Compile C++ to WebAssembly using Emscripten
3. Copy `las_viewer.js` and `las_viewer.wasm` to the `web/` directory

## Running the Application

### Quick Start

See [QUICK_START.md](QUICK_START.md) for a simplified guide to get running quickly.

### Start a Local Web Server

#### Using Python's built-in server (Recommended):

```bash
python3 -m http.server 8000
```

#### Using Node.js http-server:

```bash
npx http-server -p 8000
```

### Open in Browser

Navigate to: **http://localhost:8000/web/index.html**

### Using the Viewer

1. Click the file input to select a LAS file from your computer
2. Wait for the file to load and parse
3. The point cloud will be displayed in 3D
4. Use mouse controls to navigate:
   - **Left-click + drag**: Orbit camera around the point cloud
   - **Right-click + drag**: Pan camera
   - **Mouse wheel**: Zoom in/out

## Usage Guide

### Loading Point Cloud Files

The viewer supports LAS format files with the following specifications:
- **Versions**: LAS 1.2, 1.3, 1.4
- **Point Formats**: 2 (RGB), 3 (RGB + GPS time), 6 (LAS 1.4 RGB)
- **File Size**: Tested up to 10 million points (~400MB files)

### Camera Controls

| Action | Control | Description |
|--------|---------|-------------|
| **Orbit** | Left-click + drag | Rotate camera around the point cloud center |
| **Pan** | Right-click + drag | Move camera and target together |
| **Zoom** | Mouse wheel | Move camera closer/farther from target |
| **Reset** | Double-click | Reset camera to initial position |

### Color Visualization Modes

The viewer supports multiple color visualization modes:

1. **Elevation** (default): Color points based on Z coordinate (height)
   - Blue (low) → Green (mid) → Red (high)
2. **Intensity**: Grayscale based on return signal intensity
   - Black (low intensity) → White (high intensity)
3. **Classification**: Color-coded by point classification
   - Ground, vegetation, buildings, water, etc.

Select the mode using the radio buttons in the UI.

### Performance Tips

For optimal performance with large files:
- Use the LOD system (automatically enabled)
- Close other browser tabs to free memory
- Use a modern browser with hardware acceleration
- For files >10M points, consider downsampling first

### Metadata Display

The viewer displays the following metadata:
- **Point Count**: Total number of points in the file
- **Bounding Box**: Min/max XYZ coordinates
- **File Size**: Size of the loaded file
- **FPS**: Current rendering frame rate
- **Visible Points**: Number of points currently rendered

## Project Structure

```
las-point-cloud-viewer/
├── CMakeLists.txt                # Main CMake configuration
├── README.md                     # This file
├── QUICK_START.md                # Quick start guide
├── build_native.sh               # Native build script
├── build_wasm.sh                 # WebAssembly build script
├── screenshot.png                # Viewer screenshot
├── src/                          # C++ source code
│   ├── las_parser.h              # LAS file parser interface
│   ├── las_parser.cpp            # LAS file parser implementation
│   ├── spatial_index.h           # Octree spatial index interface
│   ├── spatial_index.cpp         # Octree spatial index implementation
│   └── wasm_interface.cpp        # WebAssembly exported functions
├── tests/                        # C++ tests
│   ├── CMakeLists.txt            # Test configuration
│   ├── test_main.cpp             # Catch2 main entry point
│   ├── test_las_parser.cpp       # LAS parser tests
│   ├── test_spatial_index.cpp    # Spatial index tests
│   └── test_wasm_interface.cpp   # WASM interface tests
├── web/                          # Web application
│   ├── index.html                # Main HTML page
│   ├── style.css                 # Styles
│   ├── main.js                   # JavaScript application logic
│   ├── PointCloudViewer.js       # Main viewer class
│   ├── CameraController.js       # Camera controls
│   ├── ColorMapper.js            # Color visualization
│   ├── PointCloudRenderer.js     # WebGL renderer
│   ├── WASMLoader.js             # WASM module loader
│   ├── UIController.js           # UI management
│   ├── ErrorHandler.js           # Error handling
│   ├── las_viewer.js             # Generated WASM glue code
│   └── las_viewer.wasm           # Generated WASM binary
└── cmake/                        # CMake modules
```

## Testing

### Running Tests

Tests are automatically run during the native build. To run tests manually:

```bash
cd build/native
ctest --output-on-failure
```

### Test Framework

- **Catch2**: Modern C++ unit testing framework
- **RapidCheck**: Property-based testing library for C++

### Test Coverage

The project includes:
- Unit tests for specific examples and edge cases
- Property-based tests for universal correctness properties
- Integration tests for the complete pipeline

## Performance Targets

The project meets the following performance requirements:

- ✓ Load and parse 10M point file in < 5 seconds (Requirement 7.1)
- ✓ Maintain 30+ FPS with 1M visible points (Requirement 7.2)
- ✓ Memory usage scales linearly with point count
- ✓ No memory leaks over extended use

### Performance Optimizations

The project includes comprehensive optimizations:

- **WASM Compilation**: -O3 optimization, SIMD support, binary size reduction
- **Hot Path Optimization**: Inlined critical functions, optimized queries
- **Memory Layout**: Structure-of-Arrays for cache efficiency
- **GPU Optimization**: Smart buffer management, reduced uploads
- **Data Caching**: Point data cached on load to avoid repeated WASM calls

## Dependencies

### C++ Dependencies (automatically fetched)

- **Catch2** v3.5.0: Testing framework
- **RapidCheck**: Property-based testing

### Build Dependencies

- **CMake** 3.15+
- **Emscripten SDK** (for WASM builds)

### Runtime Dependencies

- Modern web browser with WebGL 2.0 support
  - Chrome 56+
  - Firefox 51+
  - Safari 15+
  - Edge 79+

## Development

### Code Style

- Follow Modern C++ best practices (C++17)
- Use RAII, smart pointers, and move semantics
- Compile with `-Wall -Wextra` (no warnings)
- Clear documentation for public APIs

### Adding New Features

1. Write tests first (TDD approach)
2. Implement feature in C++
3. Update WASM interface if needed
4. Update JavaScript integration
5. Test end-to-end in browser

## Troubleshooting

### Emscripten Not Found

Make sure Emscripten is installed and activated:

```bash
source path/to/emsdk/emsdk_env.sh
emcc --version
```

### CMake Configuration Fails

Ensure you have CMake 3.15 or later:

```bash
cmake --version
```

### Tests Fail to Build

Make sure you have a C++17 compatible compiler:

```bash
g++ --version  # GCC 7+
clang++ --version  # Clang 5+
```

### WebGL Not Available

Check browser compatibility and ensure hardware acceleration is enabled in browser settings.

### File Won't Load

- Verify the file is a valid LAS format (1.2, 1.3, or 1.4)
- Check that the point format includes RGB data (formats 2, 3, or 6)
- Ensure the file isn't corrupted
- Try a smaller test file first

### Performance Issues

- Close other browser tabs
- Enable hardware acceleration in browser settings
- Try reducing the max points budget in the code
- Use a smaller file or downsample the data

### Memory Errors

- Large files (>10M points) require significant memory
- Close other applications to free RAM
- Try using a 64-bit browser
- Consider downsampling very large files

## Technical Details

### Algorithms Implemented

- **Octree Construction**: Recursive spatial subdivision with adaptive depth
- **Frustum Culling**: Plane-box intersection tests for visibility
- **LOD Selection**: Distance-based point sampling for performance
- **Coordinate Transformation**: Scale/offset application for LAS coordinates

### Performance Characteristics

- **Octree Build**: O(n log n) average case
- **Frustum Query**: O(log n + k) where k = result count
- **Memory Usage**: O(n) with small constant overhead
- **Rendering**: 30+ FPS with 1M visible points

### Browser Compatibility

Tested and working on:
- ✓ Chrome 90+ (Windows, macOS, Linux)
- ✓ Firefox 88+ (Windows, macOS, Linux)
- ✓ Safari 15+ (macOS)
- ✓ Edge 90+ (Windows)

Requires WebGL 2.0 support (available in all modern browsers).

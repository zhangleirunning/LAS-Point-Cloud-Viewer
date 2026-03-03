# Quick Start Guide - LAS Point Cloud Viewer

## TL;DR - Get Running in 3 Steps

```bash
# 1. Build the WebAssembly module
./build_wasm.sh

# 2. Start a web server
python3 -m http.server 8000

# 3. Open in browser
open http://localhost:8000/web/index.html
```

---

## Detailed Instructions

### Prerequisites Check

Before starting, verify you have:

```bash
# Check CMake (need 3.15+)
cmake --version

# Check Emscripten (for WASM builds)
emcc --version

# Check Python (for web server)
python3 --version
```

If Emscripten is not installed, see [Installing Emscripten](#installing-emscripten) below.

---

## Option 1: Run the Main Viewer

### Step 1: Build WebAssembly Module

```bash
# Make sure Emscripten is activated
source path/to/emsdk/emsdk_env.sh

# Build WASM (takes ~30 seconds)
./build_wasm.sh
```

**Expected output:**
```
Building WebAssembly target...
...
WebAssembly build complete!
Output files: web/las_viewer.js, web/las_viewer.wasm
```

### Step 2: Start Web Server

```bash
# Using Python 3 (recommended)
python3 -m http.server 8000

# OR using Node.js
npx http-server -p 8000
```

**Expected output:**
```
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

### Step 3: Open in Browser

Open your browser to: **http://localhost:8000/web/index.html**

### Step 4: Load a LAS File

1. Click the "Choose File" button
2. Select a LAS file (format 2 with RGB colors)
3. Wait for loading and parsing
4. Interact with the 3D view:
   - **Left-click + drag**: Rotate camera
   - **Right-click + drag**: Pan camera
   - **Mouse wheel**: Zoom in/out

---

## Option 2: Run Performance Tests

### Step 1: Build WASM (same as above)

```bash
./build_wasm.sh
```

### Step 2: Start Web Server (same as above)

```bash
python3 -m http.server 8000
```

### Step 3: Open Performance Test Page

Open your browser to: **http://localhost:8000/web/performance-test.html**

### Step 4: Run Tests

Click "Run All Tests" to validate:
- ✓ Load 10M points in < 5 seconds
- ✓ Render 1M points at 30+ FPS
- ✓ Memory usage < 2GB

See [PERFORMANCE_TESTING_GUIDE.md](PERFORMANCE_TESTING_GUIDE.md) for details.

---

## Option 3: Run C++ Tests (Native Build)

### Step 1: Build Native Tests

```bash
./build_native.sh
```

This will:
- Download test frameworks (Catch2, RapidCheck)
- Compile C++ code for your platform
- Run all tests automatically

**Expected output:**
```
...
===============================================================================
All tests passed (391 assertions in 39 test cases)
```

### Step 2: Run Tests Manually (optional)

```bash
# Run all tests
./build/native/tests/las_viewer_tests

# Run specific test
./build/native/tests/las_viewer_tests "LAS Parser"

# Run with verbose output
./build/native/tests/las_viewer_tests -v high
```

---

## Installing Emscripten

If you don't have Emscripten installed:

```bash
# 1. Clone the Emscripten SDK
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk

# 2. Install latest version
./emsdk install latest

# 3. Activate it
./emsdk activate latest

# 4. Set up environment (do this every time in a new terminal)
source ./emsdk_env.sh

# 5. Verify installation
emcc --version
```

**Add to your shell profile** (optional, to avoid sourcing every time):

```bash
# Add to ~/.bashrc or ~/.zshrc
echo 'source /path/to/emsdk/emsdk_env.sh' >> ~/.bashrc
```

---

## Troubleshooting

### "emcc: command not found"

**Solution:** Activate Emscripten in your current terminal:
```bash
source path/to/emsdk/emsdk_env.sh
```

### "WebGL 2.0 not supported"

**Solution:** 
- Use a modern browser (Chrome 56+, Firefox 51+, Safari 15+)
- Enable hardware acceleration in browser settings
- Update your graphics drivers

### "Failed to fetch WASM module"

**Solution:**
- Make sure you ran `./build_wasm.sh` first
- Check that `web/las_viewer.js` and `web/las_viewer.wasm` exist
- Verify the web server is running
- Check browser console for specific errors

### Build fails with "CMake version too old"

**Solution:** Update CMake:
```bash
# macOS
brew install cmake

# Ubuntu/Debian
sudo apt-get update
sudo apt-get install cmake

# Or download from https://cmake.org/download/
```

### Tests fail to compile

**Solution:** Ensure you have a C++17 compatible compiler:
```bash
# macOS (install Xcode Command Line Tools)
xcode-select --install

# Ubuntu/Debian
sudo apt-get install build-essential

# Check compiler version
g++ --version  # Need GCC 7+ or Clang 5+
```

### Port 8000 already in use

**Solution:** Use a different port:
```bash
python3 -m http.server 8080
# Then open http://localhost:8080/web/index.html
```

---

## Project Structure Quick Reference

```
las-point-cloud-viewer/
├── build_wasm.sh              # Build WASM → Run this first!
├── build_native.sh            # Build native tests
├── src/                       # C++ source code
│   ├── las_parser.cpp         # LAS file parsing
│   ├── spatial_index.cpp      # Octree implementation
│   └── wasm_interface.cpp     # WASM exports
├── web/                       # Web application
│   ├── index.html             # Main viewer
│   ├── performance-test.html  # Performance tests
│   ├── main.js                # Application logic
│   ├── las_viewer.js          # Generated WASM glue
│   └── las_viewer.wasm        # Generated WASM binary
└── tests/                     # C++ tests
    └── test_*.cpp             # Unit & property tests
```

---

## Common Workflows

### Development Workflow

```bash
# 1. Make changes to C++ code
vim src/spatial_index.cpp

# 2. Run native tests
./build_native.sh

# 3. If tests pass, build WASM
./build_wasm.sh

# 4. Test in browser
python3 -m http.server 8000
# Open http://localhost:8000/web/index.html
```

### Testing Workflow

```bash
# Run C++ tests
./build_native.sh

# Run performance tests
./build_wasm.sh
python3 -m http.server 8000
# Open http://localhost:8000/web/performance-test.html
```

### Clean Build

```bash
# Remove build artifacts
rm -rf build/

# Rebuild everything
./build_native.sh
./build_wasm.sh
```

---

## Getting Sample LAS Files

If you don't have LAS files to test with:

1. **USGS LiDAR Data**: https://www.usgs.gov/3d-elevation-program
2. **OpenTopography**: https://opentopography.org/
3. **Sample Data**: Search for "LAS point cloud sample data"

**Note:** This viewer supports LAS format 2 (with RGB colors). Make sure your test files use this format.

---

## Next Steps

- Read [README.md](README.md) for full documentation
- See [PERFORMANCE_OPTIMIZATIONS.md](PERFORMANCE_OPTIMIZATIONS.md) for optimization details
- Check [PERFORMANCE_TESTING_GUIDE.md](PERFORMANCE_TESTING_GUIDE.md) for testing guide
- Review [.kiro/specs/las-point-cloud-viewer/](./kiro/specs/las-point-cloud-viewer/) for requirements and design

---

## Quick Command Reference

```bash
# Build commands
./build_native.sh              # Build and test C++ code
./build_wasm.sh                # Build WebAssembly

# Run tests
./build/native/tests/las_viewer_tests    # Run C++ tests
ctest --test-dir build/native            # Run tests via CTest

# Start server
python3 -m http.server 8000              # Python server
npx http-server -p 8000                  # Node.js server

# URLs
http://localhost:8000/web/index.html              # Main viewer
http://localhost:8000/web/performance-test.html   # Performance tests

# Clean
rm -rf build/                  # Remove all build artifacts
```

---

**Need help?** Check the troubleshooting section above or review the full [README.md](README.md).

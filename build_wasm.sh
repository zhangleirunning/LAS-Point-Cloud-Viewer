#!/bin/bash
# Build script for WebAssembly (production) target

set -e

echo "Building WebAssembly target..."

# Check if Emscripten is available
if ! command -v emcc &> /dev/null; then
    echo "Error: Emscripten not found. Please install and activate Emscripten SDK."
    echo "Visit: https://emscripten.org/docs/getting_started/downloads.html"
    exit 1
fi

# Create build directory
mkdir -p build/wasm
cd build/wasm

# Configure with Emscripten
emcmake cmake ../.. -DCMAKE_BUILD_TYPE=Release

# Build
cmake --build .

# Copy output to web directory
echo "Copying WASM files to web directory..."
cp las_viewer.js las_viewer.wasm ../../web/

echo "WebAssembly build complete!"
echo "Output files: web/las_viewer.js, web/las_viewer.wasm"

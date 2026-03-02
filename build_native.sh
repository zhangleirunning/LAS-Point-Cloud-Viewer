#!/bin/bash
# Build script for native (testing) target

set -e

echo "Building native target for testing..."

# Create build directory
mkdir -p build/native
cd build/native

# Configure with CMake
cmake ../..

# Build
cmake --build .

# Run tests
echo "Running tests..."
ctest --output-on-failure

echo "Native build complete!"

#!/bin/bash
# Check WASM memory configuration

echo "Checking WASM memory configuration..."
echo ""

if [ -f "web/las_viewer.js" ]; then
    echo "=== Checking las_viewer.js for memory settings ==="
    echo ""
    
    # Check for INITIAL_MEMORY
    if grep -q "INITIAL_MEMORY" web/las_viewer.js; then
        echo "✓ INITIAL_MEMORY found in las_viewer.js"
        grep "INITIAL_MEMORY" web/las_viewer.js | head -1
    else
        echo "✗ INITIAL_MEMORY not found in las_viewer.js"
    fi
    
    # Check for MAXIMUM_MEMORY
    if grep -q "MAXIMUM_MEMORY" web/las_viewer.js; then
        echo "✓ MAXIMUM_MEMORY found in las_viewer.js"
        grep "MAXIMUM_MEMORY" web/las_viewer.js | head -1
    else
        echo "✗ MAXIMUM_MEMORY not found in las_viewer.js"
    fi
    
    # Check for memory growth
    if grep -q "wasmMemory" web/las_viewer.js; then
        echo "✓ wasmMemory found in las_viewer.js"
    else
        echo "✗ wasmMemory not found in las_viewer.js"
    fi
    
    echo ""
    echo "=== File sizes ==="
    ls -lh web/las_viewer.js web/las_viewer.wasm
    
    echo ""
    echo "=== Checking for exported functions ==="
    if grep -q "loadLASFile" web/las_viewer.js; then
        echo "✓ loadLASFile export found"
    else
        echo "✗ loadLASFile export NOT found"
    fi
    
else
    echo "Error: web/las_viewer.js not found. Please build first."
    exit 1
fi

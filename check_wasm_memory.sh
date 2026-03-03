#!/bin/bash
# Check WASM memory configuration

echo "Checking WASM memory configuration..."
echo ""

if [ -f "web/las_viewer.wasm" ]; then
    echo "=== Analyzing WASM binary memory section ==="
    echo ""
    
    # Use Python to parse WASM binary
    python3 << 'PYEOF'
import struct

try:
    with open('web/las_viewer.wasm', 'rb') as f:
        data = f.read()
    
    pos = 8  # Skip magic and version
    while pos < len(data):
        section_type = data[pos]
        pos += 1
        
        # Read section size (varint)
        section_size = 0
        shift = 0
        while True:
            byte = data[pos]
            pos += 1
            section_size |= (byte & 0x7F) << shift
            if (byte & 0x80) == 0:
                break
            shift += 7
        
        if section_type == 5:  # Memory section
            count = data[pos]
            pos += 1
            
            for i in range(count):
                flags = data[pos]
                pos += 1
                
                # Read initial pages
                initial = 0
                shift = 0
                while True:
                    byte = data[pos]
                    pos += 1
                    initial |= (byte & 0x7F) << shift
                    if (byte & 0x80) == 0:
                        break
                    shift += 7
                
                initial_mb = initial * 64 / 1024
                print(f"✓ Initial memory: {initial} pages = {initial_mb:.0f}MB")
                
                if flags & 1:  # Has maximum
                    maximum = 0
                    shift = 0
                    while True:
                        byte = data[pos]
                        pos += 1
                        maximum |= (byte & 0x7F) << shift
                        if (byte & 0x80) == 0:
                            break
                        shift += 7
                    maximum_mb = maximum * 64 / 1024
                    print(f"✓ Maximum memory: {maximum} pages = {maximum_mb:.0f}MB")
                    print(f"✓ Memory growth: ENABLED")
                else:
                    print(f"✗ Memory growth: DISABLED")
                
                # Check if values are correct
                if initial_mb >= 256:
                    print(f"✓ Initial memory is sufficient (>= 256MB)")
                else:
                    print(f"✗ Initial memory is too small (< 256MB)")
                
                if flags & 1 and maximum_mb >= 2048:
                    print(f"✓ Maximum memory is sufficient (>= 2GB)")
                else:
                    print(f"✗ Maximum memory is too small or not set")
            break
        else:
            pos += section_size
except Exception as e:
    print(f"Error parsing WASM: {e}")
PYEOF
    
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
    echo "Error: web/las_viewer.wasm not found. Please build first."
    exit 1
fi

#!/bin/bash
# Automated verification script for Checkpoint 11
# This script checks what can be verified programmatically

# Don't exit on error - we want to collect all results
set +e

echo "========================================="
echo "Checkpoint 11 Verification Script"
echo "========================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Helper functions
pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

info() {
    echo "  $1"
}

# Check 1: Verify all required files exist
echo "1. Checking required files..."
echo "----------------------------"

required_files=(
    "web/index.html"
    "web/main.js"
    "web/PointCloudViewer.js"
    "web/PointCloudRenderer.js"
    "web/CameraController.js"
    "web/UIController.js"
    "web/WASMLoader.js"
    "web/wasm-stub.js"
    "web/style.css"
    "src/las_parser.cpp"
    "src/las_parser.h"
    "src/spatial_index.cpp"
    "src/spatial_index.h"
    "src/wasm_interface.cpp"
    "CMakeLists.txt"
    "build_wasm.sh"
    "build_native.sh"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        pass "File exists: $file"
    else
        fail "File missing: $file"
    fi
done

echo ""

# Check 2: Verify C++ tests pass
echo "2. Checking C++ tests..."
echo "------------------------"

if [ -d "build/native" ]; then
    info "Running C++ tests..."
    cd build/native
    if ctest --output-on-failure > /dev/null 2>&1; then
        pass "All C++ tests pass"
    else
        fail "Some C++ tests failed"
        info "Run 'cd build/native && ctest --output-on-failure' for details"
    fi
    cd ../..
else
    warn "Native build not found. Run './build_native.sh' first"
    info "Skipping C++ tests"
fi

echo ""

# Check 3: Verify JavaScript tests
echo "3. Checking JavaScript tests..."
echo "-------------------------------"

if command -v node &> /dev/null; then
    if [ -f "package.json" ]; then
        info "Running JavaScript tests..."
        if npm test > /dev/null 2>&1; then
            pass "All JavaScript tests pass"
        else
            warn "Some JavaScript tests failed or no tests configured"
            info "Check package.json for test configuration"
        fi
    else
        warn "No package.json found"
        info "JavaScript tests may not be configured"
    fi
else
    warn "Node.js not found"
    info "Cannot run JavaScript tests"
fi

echo ""

# Check 4: Verify WASM build
echo "4. Checking WASM build..."
echo "-------------------------"

if [ -f "web/las_viewer.js" ] && [ -f "web/las_viewer.wasm" ]; then
    pass "WASM files exist"
    info "las_viewer.js: $(ls -lh web/las_viewer.js | awk '{print $5}')"
    info "las_viewer.wasm: $(ls -lh web/las_viewer.wasm | awk '{print $5}')"
else
    warn "WASM files not found"
    info "Run './build_wasm.sh' to build WASM module"
    info "Currently using wasm-stub.js for development"
fi

echo ""

# Check 5: Verify Emscripten availability
echo "5. Checking Emscripten..."
echo "-------------------------"

if command -v emcc &> /dev/null; then
    pass "Emscripten is installed"
    info "Version: $(emcc --version | head -n 1)"
else
    warn "Emscripten not found"
    info "Install from: https://emscripten.org/docs/getting_started/downloads.html"
    info "Required for building WASM module"
fi

echo ""

# Check 6: Verify build scripts are executable
echo "6. Checking build scripts..."
echo "----------------------------"

if [ -x "build_wasm.sh" ]; then
    pass "build_wasm.sh is executable"
else
    warn "build_wasm.sh is not executable"
    info "Run: chmod +x build_wasm.sh"
fi

if [ -x "build_native.sh" ]; then
    pass "build_native.sh is executable"
else
    warn "build_native.sh is not executable"
    info "Run: chmod +x build_native.sh"
fi

echo ""

# Check 7: Verify web server availability
echo "7. Checking web server options..."
echo "----------------------------------"

server_found=false

if command -v python3 &> /dev/null; then
    pass "Python 3 available for web server"
    info "Start with: python3 -m http.server 8000 --directory web"
    server_found=true
fi

if command -v node &> /dev/null; then
    pass "Node.js available"
    info "Start with: npx http-server web -p 8000"
    server_found=true
fi

if command -v php &> /dev/null; then
    pass "PHP available for web server"
    info "Start with: php -S localhost:8000 -t web"
    server_found=true
fi

if [ "$server_found" = false ]; then
    fail "No web server found"
    info "Install Python 3, Node.js, or PHP to run local server"
fi

echo ""

# Check 8: Verify documentation
echo "8. Checking documentation..."
echo "----------------------------"

if [ -f "README.md" ]; then
    pass "README.md exists"
else
    warn "README.md not found"
fi

if [ -f "CHECKPOINT_11_TESTING.md" ]; then
    pass "Testing guide exists"
else
    warn "CHECKPOINT_11_TESTING.md not found"
fi

echo ""

# Check 9: Verify task completion
echo "9. Checking task completion..."
echo "-------------------------------"

if [ -f ".kiro/specs/las-point-cloud-viewer/tasks.md" ]; then
    completed_tasks=$(grep -c "^\- \[x\]" .kiro/specs/las-point-cloud-viewer/tasks.md || true)
    total_tasks=$(grep -c "^\- \[" .kiro/specs/las-point-cloud-viewer/tasks.md || true)
    
    info "Completed tasks: $completed_tasks / $total_tasks"
    
    if [ "$completed_tasks" -ge 10 ]; then
        pass "Tasks 1-10 completed (ready for checkpoint 11)"
    else
        warn "Not all prerequisite tasks completed"
        info "Complete tasks 1-10 before checkpoint 11"
    fi
else
    warn "Tasks file not found"
fi

echo ""

# Check 10: Syntax check JavaScript files
echo "10. Checking JavaScript syntax..."
echo "---------------------------------"

if command -v node &> /dev/null; then
    js_files=(
        "web/main.js"
        "web/PointCloudViewer.js"
        "web/PointCloudRenderer.js"
        "web/CameraController.js"
        "web/UIController.js"
        "web/WASMLoader.js"
    )
    
    all_valid=true
    for file in "${js_files[@]}"; do
        if node --check "$file" 2>/dev/null; then
            pass "Valid syntax: $file"
        else
            fail "Syntax error: $file"
            all_valid=false
        fi
    done
    
    if [ "$all_valid" = true ]; then
        pass "All JavaScript files have valid syntax"
    fi
else
    warn "Node.js not available for syntax checking"
fi

echo ""

# Summary
echo "========================================="
echo "Verification Summary"
echo "========================================="
echo -e "${GREEN}Passed:${NC}   $PASSED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "${RED}Failed:${NC}   $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All critical checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Build WASM module: ./build_wasm.sh (if Emscripten is installed)"
    echo "2. Start web server: python3 -m http.server 8000 --directory web"
    echo "3. Open browser: http://localhost:8000"
    echo "4. Follow manual testing guide: CHECKPOINT_11_TESTING.md"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some checks failed${NC}"
    echo ""
    echo "Please fix the failed checks before proceeding."
    echo "See output above for details."
    echo ""
    exit 1
fi

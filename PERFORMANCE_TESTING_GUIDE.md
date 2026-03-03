# Performance Testing Quick Start Guide

## Prerequisites

1. **Build the WASM module:**
   ```bash
   ./build_wasm.sh
   ```
   This compiles the C++ code to WebAssembly with all optimizations enabled.

2. **Start a local web server:**
   ```bash
   # Using Python 3
   python3 -m http.server 8000
   
   # Or using Node.js
   npx http-server -p 8000
   ```

## Running Performance Tests

### Option 1: Web Interface (Recommended)

1. Open your browser to: `http://localhost:8000/web/performance-test.html`

2. Click one of the test buttons:
   - **Run All Tests**: Executes all three performance tests sequentially
   - **Test Load Time Only**: Tests 10M point file loading (< 5s target)
   - **Test Rendering Only**: Tests 1M point rendering (30+ FPS target)
   - **Test Memory Only**: Validates memory usage (< 2GB target)

3. Monitor the console output for real-time progress

4. Review the results summary when tests complete

### Option 2: Browser Console

1. Open your browser to: `http://localhost:8000/web/index.html`

2. Open Developer Tools (F12)

3. In the Console tab, run:
   ```javascript
   import('./performance-test.js').then(module => {
       const validator = new module.PerformanceValidator();
       return validator.runAllTests();
   });
   ```

## Performance Targets

| Test | Target | Validates |
|------|--------|-----------|
| Load Time | < 5 seconds for 10M points | Requirement 7.1 |
| Rendering | 30+ FPS with 1M points | Requirement 7.2 |
| Memory | < 2GB for 10M points | General performance |

## Expected Results

On modern hardware (2020+ CPU, dedicated GPU):

- **Load Time**: 2-4 seconds ✅
- **Average FPS**: 45-60 FPS ✅
- **Memory Usage**: 500-800 MB ✅

## Interpreting Results

### Load Time Test
- Generates synthetic 10M point LAS file
- Measures time from start of parsing to completion of spatial index build
- **Pass**: < 5 seconds
- **Fail**: ≥ 5 seconds

### Rendering Test
- Renders 1M points continuously for 5 seconds
- Calculates average FPS from frame timestamps
- **Pass**: ≥ 30 FPS average
- **Fail**: < 30 FPS average

### Memory Test
- Checks JavaScript heap usage after loading data
- Uses `performance.memory` API (Chrome/Edge only)
- **Pass**: < 2GB used
- **Fail**: ≥ 2GB used

## Troubleshooting

### "WASM module not available"
- Ensure you've run `./build_wasm.sh`
- Check that `web/las_viewer.js` and `web/las_viewer.wasm` exist
- Verify the web server is serving from the project root

### Low FPS Results
- Check GPU acceleration is enabled in browser
- Close other GPU-intensive applications
- Try a different browser (Chrome/Edge recommended)
- Check browser console for WebGL errors

### High Memory Usage
- This is expected for large point clouds
- Close other browser tabs
- Restart browser to clear memory
- Check for memory leaks using DevTools Memory profiler

### Tests Not Running
- Check browser console for JavaScript errors
- Ensure you're using a modern browser (Chrome 90+, Firefox 88+, Edge 90+)
- Verify WebGL 2.0 support: `http://webglreport.com/?v=2`

## Profiling Performance

### Chrome DevTools Performance Profiler

1. Open DevTools (F12) → Performance tab
2. Click Record (●)
3. Run a performance test or interact with the viewer
4. Click Stop
5. Analyze the flame graph:
   - Look for long-running functions
   - Check for excessive garbage collection
   - Identify rendering bottlenecks

### Key Metrics to Monitor

- **Frame Time**: Should be < 33ms for 30 FPS
- **Octree Query Time**: Should be < 5ms
- **GPU Upload Time**: Should be < 2ms
- **JavaScript Execution**: Should be < 10ms per frame

## Optimization Flags Verification

To verify optimizations are enabled, check the WASM build output:

```bash
./build_wasm.sh 2>&1 | grep -E "(O3|simd|closure)"
```

You should see:
- `-O3` (optimization level)
- `-msimd128` (SIMD support)
- `--closure 1` (minification)

## Comparing Performance

### Before vs After Optimizations

To compare performance before and after optimizations:

1. Build without optimizations:
   ```bash
   # Temporarily modify CMakeLists.txt to remove optimization flags
   # Then rebuild
   ./build_wasm.sh
   ```

2. Run performance tests and record results

3. Restore optimization flags and rebuild

4. Run performance tests again and compare

Expected improvements:
- Load time: 20-30% faster
- Rendering: 30-50% higher FPS
- Binary size: 20-30% smaller

## Continuous Performance Monitoring

For ongoing performance validation:

1. Run tests after each major change
2. Track results over time
3. Set up automated testing in CI/CD
4. Monitor for performance regressions

## Additional Resources

- **Full Documentation**: See `PERFORMANCE_OPTIMIZATIONS.md`
- **Task Summary**: See `TASK_14_SUMMARY.md`
- **Design Document**: See `.kiro/specs/las-point-cloud-viewer/design.md`
- **Requirements**: See `.kiro/specs/las-point-cloud-viewer/requirements.md`

## Support

If you encounter issues or have questions:

1. Check the browser console for errors
2. Review the performance documentation
3. Verify all prerequisites are met
4. Try a different browser or machine

## Quick Command Reference

```bash
# Build WASM (with optimizations)
./build_wasm.sh

# Build native (for testing)
./build_native.sh

# Run C++ tests
./build/native/tests/las_viewer_tests

# Start web server
python3 -m http.server 8000

# Open performance tests
open http://localhost:8000/web/performance-test.html

# Open main viewer
open http://localhost:8000/web/index.html
```

---

**Note**: Performance results may vary based on hardware, browser, and system load. For consistent results, close other applications and use a dedicated GPU.

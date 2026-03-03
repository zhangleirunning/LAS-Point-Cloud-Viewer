# Checkpoint 11: Basic Rendering Verification

This document provides a comprehensive testing guide for verifying that the LAS Point Cloud Viewer's basic rendering functionality works correctly.

## Prerequisites

Before testing, ensure:
1. ✅ All C++ core tests pass (Checkpoint 5 completed)
2. ✅ WASM interface is implemented (Task 6 completed)
3. ✅ Web application structure is set up (Task 7 completed)
4. ✅ WebGL renderer is implemented (Task 8 completed)
5. ✅ Camera controller is implemented (Task 9 completed)
6. ✅ File loading and rendering pipeline is integrated (Task 10 completed)

## Test Objectives

This checkpoint verifies:
- ✅ Points render correctly with colors
- ✅ Camera controls work (orbit, pan, zoom)
- ✅ LOD system reduces points at distance
- ✅ Complete end-to-end workflow functions

## Testing Steps

### Step 1: Build the WASM Module

First, we need to build the C++ code to WebAssembly:

```bash
# Ensure Emscripten is installed and activated
# If not installed, visit: https://emscripten.org/docs/getting_started/downloads.html

# Build WASM
./build_wasm.sh
```

**Expected Output:**
- `web/las_viewer.js` - Emscripten glue code
- `web/las_viewer.wasm` - Compiled WebAssembly binary

**Verification:**
```bash
ls -lh web/las_viewer.js web/las_viewer.wasm
```

### Step 2: Prepare Test Data

Since we don't have a sample LAS file in the repository, we have two options:

**Option A: Use a publicly available LAS file**
Download a sample LAS file from:
- USGS 3DEP: https://www.usgs.gov/3d-elevation-program
- OpenTopography: https://opentopography.org/
- Sample LAS files: https://github.com/ASPRSorg/LAS/tree/master/test/data

**Option B: Generate a synthetic LAS file**
Create a simple test LAS file with known properties for verification.

### Step 3: Start Local Web Server

The application requires a web server to load WASM modules:

```bash
# Option 1: Python 3
python3 -m http.server 8000 --directory web

# Option 2: Node.js (if http-server is installed)
npx http-server web -p 8000

# Option 3: PHP
php -S localhost:8000 -t web
```

### Step 4: Open Application in Browser

Navigate to: `http://localhost:8000`

**Expected Initial State:**
- ✅ Page loads without errors
- ✅ Canvas is visible (black background)
- ✅ "Choose LAS File" button is visible
- ✅ Stats display shows: FPS: 0, Visible Points: 0, Camera Distance: 0
- ✅ Controls hint is visible at bottom

**Browser Console Check:**
Open browser DevTools (F12) and check console for:
- ✅ No JavaScript errors
- ✅ "WASM runtime initialized" message (or stub message if using stub)
- ✅ "Application initialized successfully" message

### Step 5: Load LAS File

Click "Choose LAS File" and select a test LAS file.

**Expected Behavior:**
1. ✅ File name appears next to button
2. ✅ Loading indicator appears with progress bar
3. ✅ Progress bar animates from 0% to 100%
4. ✅ Loading indicator disappears after completion
5. ✅ Metadata section appears with file information:
   - Point Count (formatted with commas)
   - File Size (in KB/MB)
   - Bounds X, Y, Z (min to max ranges)
   - Point Format (e.g., "Format 2")

**Console Verification:**
Check browser console for:
- ✅ "Loading LAS file: [filename] ([size] bytes)"
- ✅ "LAS header parsed: [header object]"
- ✅ "Building spatial index..."
- ✅ "Spatial index built in [time]ms"
- ✅ "File loaded successfully: [metadata]"

**Error Handling Test:**
Try loading an invalid file (e.g., .txt file):
- ✅ Error message appears: "Please select a valid LAS file"
- ✅ Application doesn't crash

### Step 6: Verify Point Rendering

After file loads, points should be visible in the canvas.

**Visual Verification:**
- ✅ Points are visible in 3D space
- ✅ Points have colors (RGB from LAS data)
- ✅ Points appear as small dots/squares
- ✅ Depth testing works (closer points occlude farther points)
- ✅ No visual artifacts or glitches

**Stats Verification:**
Check the stats display (top-right corner):
- ✅ FPS: Should be 30+ (ideally 60)
- ✅ Visible Points: Should show a number > 0
- ✅ Camera Distance: Should show a reasonable value

**Console Verification:**
- ✅ No rendering errors
- ✅ No WebGL errors
- ✅ Frame rendering is continuous

### Step 7: Test Camera Controls - Orbit (Left Mouse Drag)

**Test Procedure:**
1. Click and hold left mouse button on canvas
2. Drag mouse horizontally (left/right)
3. Drag mouse vertically (up/down)

**Expected Behavior:**
- ✅ Camera rotates around the point cloud center
- ✅ Horizontal drag rotates azimuth (around Y-axis)
- ✅ Vertical drag changes elevation (pitch)
- ✅ Point cloud remains centered in view
- ✅ Camera distance from target stays constant
- ✅ Rotation is smooth and responsive
- ✅ Elevation is clamped (cannot flip upside down)

**Verification:**
- ✅ Camera Distance stat remains constant during orbit
- ✅ Visible points count may change as view angle changes
- ✅ FPS remains stable (30+)

### Step 8: Test Camera Controls - Pan (Right Mouse Drag)

**Test Procedure:**
1. Click and hold right mouse button on canvas
2. Drag mouse in various directions

**Expected Behavior:**
- ✅ Camera and target move together in the view plane
- ✅ Point cloud appears to slide across the screen
- ✅ Camera distance remains constant
- ✅ Camera orientation (azimuth/elevation) remains constant
- ✅ Panning is smooth and responsive

**Verification:**
- ✅ Camera Distance stat remains constant
- ✅ Point cloud moves in the direction of drag
- ✅ No rotation occurs during pan

### Step 9: Test Camera Controls - Zoom (Mouse Wheel)

**Test Procedure:**
1. Scroll mouse wheel forward (zoom in)
2. Scroll mouse wheel backward (zoom out)
3. Try extreme zoom in and out

**Expected Behavior:**
- ✅ Scrolling forward moves camera closer to target
- ✅ Scrolling backward moves camera away from target
- ✅ Target point remains fixed
- ✅ Zoom is smooth and proportional
- ✅ Camera distance is clamped (cannot go negative or too far)
- ✅ Point cloud appears larger when zooming in
- ✅ Point cloud appears smaller when zooming out

**Verification:**
- ✅ Camera Distance stat changes appropriately
- ✅ Distance stays within valid range (e.g., 0.1 to 1000)
- ✅ Visible points count may change with distance
- ✅ FPS remains stable

### Step 10: Verify LOD System

The Level-of-Detail system should reduce point density at greater distances.

**Test Procedure:**
1. Zoom in very close to the point cloud
2. Note the Visible Points count
3. Zoom out to a far distance
4. Note the Visible Points count again

**Expected Behavior:**
- ✅ When close: Visible Points count is HIGH (more detail)
- ✅ When far: Visible Points count is LOWER (less detail)
- ✅ LOD transitions are smooth (no sudden popping)
- ✅ FPS remains stable at all distances
- ✅ Point cloud remains recognizable at all LOD levels

**Quantitative Verification:**
- ✅ Visible points at close distance > Visible points at far distance
- ✅ FPS stays above 30 even with maximum visible points
- ✅ Memory usage is reasonable

**Console Verification:**
Check for LOD-related logs (if implemented):
- ✅ No errors during LOD calculations
- ✅ Skip factors increase with distance

### Step 11: Stress Test

Test with various scenarios to ensure robustness.

**Test Cases:**

1. **Large File Test** (if available):
   - Load a file with 1M+ points
   - ✅ Loads within reasonable time (< 10 seconds)
   - ✅ Maintains 30+ FPS
   - ✅ No memory leaks

2. **Rapid Interaction Test**:
   - Quickly orbit, pan, and zoom simultaneously
   - ✅ No lag or stuttering
   - ✅ No visual artifacts
   - ✅ No crashes

3. **Multiple File Loads**:
   - Load a file
   - Load a different file
   - Load the first file again
   - ✅ Each load works correctly
   - ✅ Previous file data is cleaned up
   - ✅ No memory leaks

4. **Browser Resize**:
   - Resize browser window
   - ✅ Canvas resizes appropriately
   - ✅ Aspect ratio is maintained
   - ✅ Rendering continues correctly

### Step 12: Cross-Browser Testing

Test in multiple browsers to ensure compatibility.

**Browsers to Test:**
- ✅ Chrome/Chromium (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest, macOS)
- ✅ Edge (latest)

**Verification for Each Browser:**
- ✅ Application loads without errors
- ✅ WASM module initializes
- ✅ File loading works
- ✅ Rendering works correctly
- ✅ Camera controls work
- ✅ Performance is acceptable

## Success Criteria

This checkpoint is considered PASSED if:

1. ✅ WASM module builds successfully
2. ✅ Application loads in browser without errors
3. ✅ LAS file loads and parses correctly
4. ✅ Points render with correct colors
5. ✅ All camera controls work as expected:
   - Orbit (left drag)
   - Pan (right drag)
   - Zoom (scroll)
6. ✅ LOD system reduces points at distance
7. ✅ FPS is 30+ with reasonable point counts
8. ✅ No memory leaks or crashes
9. ✅ Works in major browsers

## Known Limitations (Current State)

Since we're using a WASM stub for development:
- ✅ Stub mode is active (check console for "[STUB]" messages)
- ⚠️ Actual LAS parsing not functional (returns fake data)
- ⚠️ Spatial index not functional (returns empty results)
- ⚠️ Point rendering shows empty canvas (no real data)

**To test with real functionality:**
1. Build actual WASM module: `./build_wasm.sh`
2. Replace stub with real WASM files
3. Re-test all steps above

## Troubleshooting

### Issue: WASM module fails to load
**Solution:**
- Check browser console for specific error
- Ensure web server is running (not file:// protocol)
- Verify WASM files exist in web/ directory
- Check browser supports WebAssembly

### Issue: Points don't render
**Solution:**
- Check if file loaded successfully (metadata appears)
- Check browser console for WebGL errors
- Verify camera is positioned correctly
- Check if visible points count > 0

### Issue: Camera controls don't work
**Solution:**
- Check browser console for JavaScript errors
- Verify mouse events are being captured
- Check if canvas has focus
- Try clicking on canvas first

### Issue: Poor performance (low FPS)
**Solution:**
- Check visible points count (should be < 1M)
- Verify LOD system is working
- Check browser GPU acceleration is enabled
- Try smaller test file
- Check for memory leaks (DevTools Memory tab)

### Issue: File fails to load
**Solution:**
- Verify file is valid LAS format
- Check file size (very large files may timeout)
- Check browser console for specific error
- Try different LAS file

## Next Steps

After this checkpoint passes:
- Proceed to Task 12: Implement color visualization modes (optional)
- Proceed to Task 13: Implement error handling and edge cases
- Proceed to Task 14: Performance optimization and validation
- Proceed to Task 15: Final polish and documentation

## Notes

- This checkpoint is primarily manual testing
- Automated integration tests exist in `web/integration.test.js`
- Unit tests for components exist in `web/*.test.js`
- C++ tests can be run with: `cd build/native && ctest`

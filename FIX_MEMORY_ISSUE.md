# Fix for "offset is out of bounds" Error with Large LAS Files

## Problem
The WASM module was built without proper memory settings, causing "offset is out of bounds" errors when loading files larger than ~16MB.

## Solution
The CMakeLists.txt has been updated with proper memory settings. You need to rebuild the WASM module.

## Steps to Fix

### 1. Clean Previous Build
```bash
rm -rf build/wasm
rm web/las_viewer.js web/las_viewer.wasm
```

### 2. Activate Emscripten
```bash
source ~/emsdk/emsdk_env.sh
```

### 3. Rebuild WASM
```bash
./build_wasm.sh
```

### 4. Verify the Build
```bash
./check_wasm_memory.sh
```

You should see output showing the file sizes and that the memory settings are properly configured.

### 5. Test in Browser
1. Open your browser to http://localhost:8000
2. **Hard refresh** to clear cache: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+F5` (Windows/Linux)
3. Try loading your LAS file again

## What Changed

### CMakeLists.txt
- Added `INITIAL_MEMORY=268435456` (256MB) - provides enough initial memory for file loading
- Added `MAXIMUM_MEMORY=2147483648` (2GB) - allows memory to grow for large files
- Added `ALLOW_MEMORY_GROWTH=1` - enables dynamic memory growth
- Added `TOTAL_STACK=16777216` (16MB) - ensures enough stack space

### WASMLoader.js
- Fixed memory buffer access to use `module.HEAP8.buffer` directly
- Improved error messages to show exact memory bounds
- Added better debugging for memory allocation issues

## Expected Results

After rebuilding:
- `las_viewer.js` should be larger (likely 15-20KB instead of 13KB)
- `las_viewer.wasm` should be similar size or slightly larger
- Your 16.42 MB LAS file should load without "offset is out of bounds" error
- Memory will automatically grow as needed during file loading

## If It Still Fails

If you still get the error after rebuilding:

1. Check the browser console for the detailed error message
2. Look for the memory size information in the error
3. Verify the build output shows the memory flags being applied
4. Try with a smaller file first (< 5MB) to verify basic functionality

## Technical Details

The issue was that the WASM module was compiled with default memory settings (likely 16MB initial, 32MB max), which is too small for loading large LAS files. The malloc() call would succeed but return a pointer beyond the actual heap size, causing the "offset is out of bounds" error when trying to write to that memory location.

With the new settings:
- Initial heap: 256MB (enough for most files)
- Maximum heap: 2GB (browser limit)
- Memory grows automatically as needed

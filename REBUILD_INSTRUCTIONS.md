# Quick Rebuild Instructions

Your WASM module needs to be rebuilt with the updated memory settings to fix the "offset is out of bounds" error.

## Quick Steps

```bash
# 1. Clean old build
rm -rf build/wasm

# 2. Activate Emscripten
source ~/emsdk/emsdk_env.sh

# 3. Rebuild
./build_wasm.sh

# 4. Hard refresh browser (Cmd+Shift+R)
```

## What to Expect

After rebuilding, your 16.42 MB LAS file should load successfully. The WASM module now has:
- 256MB initial memory (was ~16MB)
- 2GB maximum memory (was ~32MB)
- Automatic memory growth enabled

## Verification

Run this to check if the build is correct:
```bash
./check_wasm_memory.sh
```

See `FIX_MEMORY_ISSUE.md` for detailed explanation and troubleshooting.

// WebAssembly Interface implementation
// This file will contain the WASM exported functions

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

#include "las_parser.h"
#include "spatial_index.h"

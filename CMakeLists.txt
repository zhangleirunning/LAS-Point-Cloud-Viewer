cmake_minimum_required(VERSION 3.15)
project(LASPointCloudViewer)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wall -Wextra")

# Emscripten-specific settings
if(EMSCRIPTEN)
    # Basic WASM settings
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -s WASM=1")
    
    # Release build optimizations
    set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -O3 -s ASSERTIONS=0")
    
    # Enable SIMD for vectorized operations (SSE/NEON equivalent in WASM)
    set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -msimd128")
    
    # Minimize binary size
    set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -s FILESYSTEM=0")  # No filesystem needed
    set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -s DISABLE_EXCEPTION_CATCHING=1")  # Reduce exception overhead
    set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -s MALLOC=emmalloc")  # Smaller allocator
    # Temporarily disable closure compiler for debugging
    # set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} --closure 1")  # Enable Closure compiler for JS minification
    
    # Debug build settings
    set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} -g -s ASSERTIONS=1")
    
    set(CMAKE_EXECUTABLE_SUFFIX ".js")
endif()

# Source files
set(SOURCES
    src/las_parser.cpp
    src/spatial_index.cpp
    src/wasm_interface.cpp
)

# Build WASM target when using Emscripten
if(EMSCRIPTEN)
    add_executable(las_viewer ${SOURCES})
    
    # Link flags for WASM optimization
    set(LINK_FLAGS "-s EXPORTED_FUNCTIONS='[\"_malloc\",\"_free\",\"_loadLASFile\",\"_getPointData\",\"_buildSpatialIndex\",\"_queryVisiblePoints\",\"_freeLASData\"]'")
    set(LINK_FLAGS "${LINK_FLAGS} -s EXPORTED_RUNTIME_METHODS='[\"ccall\",\"cwrap\"]'")
    
    # Memory settings for large files (must be in link flags)
    set(LINK_FLAGS "${LINK_FLAGS} -s ALLOW_MEMORY_GROWTH=1")
    set(LINK_FLAGS "${LINK_FLAGS} -s INITIAL_MEMORY=268435456")  # 256MB
    set(LINK_FLAGS "${LINK_FLAGS} -s MAXIMUM_MEMORY=2147483648")  # 2GB
    set(LINK_FLAGS "${LINK_FLAGS} -s TOTAL_STACK=16777216")  # 16MB stack
    
    # Performance optimizations for release builds
    if(CMAKE_BUILD_TYPE STREQUAL "Release")
        set(LINK_FLAGS "${LINK_FLAGS} -s MODULARIZE=1")  # Create modular output
        set(LINK_FLAGS "${LINK_FLAGS} -s EXPORT_NAME='createLASViewerModule'")  # Named export
    endif()
    
    set_target_properties(las_viewer PROPERTIES LINK_FLAGS "${LINK_FLAGS}")
else()
    # Native build for testing
    add_library(las_viewer_lib ${SOURCES})
    
    # Enable testing
    enable_testing()
    
    # Add test dependencies
    include(FetchContent)
    
    # Catch2
    FetchContent_Declare(
        Catch2
        GIT_REPOSITORY https://github.com/catchorg/Catch2.git
        GIT_TAG v3.5.0
    )
    
    # RapidCheck - disable extras to avoid conflicts
    FetchContent_Declare(
        rapidcheck
        GIT_REPOSITORY https://github.com/emil-e/rapidcheck.git
        GIT_TAG master
    )
    
    # Disable RapidCheck extras to avoid Catch2 conflict
    set(RC_ENABLE_CATCH OFF CACHE BOOL "Build Catch integration" FORCE)
    set(RC_ENABLE_GTEST OFF CACHE BOOL "Build GTest integration" FORCE)
    set(RC_ENABLE_GMOCK OFF CACHE BOOL "Build GMock integration" FORCE)
    set(RC_ENABLE_BOOST_TEST OFF CACHE BOOL "Build Boost.Test integration" FORCE)
    
    FetchContent_MakeAvailable(Catch2 rapidcheck)
    
    # Add tests subdirectory
    add_subdirectory(tests)
endif()

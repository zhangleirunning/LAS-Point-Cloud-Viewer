# Test executable
add_executable(las_viewer_tests
    test_main.cpp
    test_las_parser.cpp
    test_spatial_index.cpp
)

target_link_libraries(las_viewer_tests
    PRIVATE
    las_viewer_lib
    Catch2::Catch2
    rapidcheck
)

# Discover tests
include(CTest)
include(Catch)
catch_discover_tests(las_viewer_tests)

#include <catch2/catch_test_macros.hpp>
#include <rapidcheck.h>
#include "../src/las_parser.h"
#include "../src/spatial_index.h"
#include <vector>
#include <cstring>
#include <cmath>

// Declare the WASM interface functions
extern "C" {
    uintptr_t loadLASFile(const uint8_t* data, uint32_t size);
    uintptr_t getPointData(uint32_t* out_count);
    void buildSpatialIndex();
    uintptr_t queryVisiblePoints(const float* frustum_planes, 
                                float camera_distance,
                                uint32_t max_points,
                                uint32_t* out_count);
    void freeLASData();
}

// Helper function to create a minimal valid LAS file
std::vector<uint8_t> createMinimalLASFile(uint32_t point_count = 10) {
    std::vector<uint8_t> data(227 + point_count * 26, 0);  // Header + points
    
    // Magic bytes "LASF"
    data[0] = 'L';
    data[1] = 'A';
    data[2] = 'S';
    data[3] = 'F';
    
    // Version 1.2
    data[24] = 1;
    data[25] = 2;
    
    // Header size (227 bytes)
    data[94] = 227;
    data[95] = 0;
    
    // Point data offset (227 bytes)
    data[96] = 227;
    data[97] = 0;
    data[98] = 0;
    data[99] = 0;
    
    // Point format 2 (RGB)
    data[104] = 2;
    
    // Point record length (26 bytes for format 2)
    data[105] = 26;
    data[106] = 0;
    
    // Number of point records
    data[107] = point_count & 0xFF;
    data[108] = (point_count >> 8) & 0xFF;
    data[109] = (point_count >> 16) & 0xFF;
    data[110] = (point_count >> 24) & 0xFF;
    
    // Scale factors (1.0)
    double scale = 1.0;
    std::memcpy(&data[131], &scale, sizeof(double));
    std::memcpy(&data[139], &scale, sizeof(double));
    std::memcpy(&data[147], &scale, sizeof(double));
    
    // Offsets (0.0)
    double offset = 0.0;
    std::memcpy(&data[155], &offset, sizeof(double));
    std::memcpy(&data[163], &offset, sizeof(double));
    std::memcpy(&data[171], &offset, sizeof(double));
    
    // Bounding box
    double min_val = 0.0;
    double max_val = 100.0;
    std::memcpy(&data[179], &max_val, sizeof(double));  // max_x
    std::memcpy(&data[187], &min_val, sizeof(double));  // min_x
    std::memcpy(&data[195], &max_val, sizeof(double));  // max_y
    std::memcpy(&data[203], &min_val, sizeof(double));  // min_y
    std::memcpy(&data[211], &max_val, sizeof(double));  // max_z
    std::memcpy(&data[219], &min_val, sizeof(double));  // min_z
    
    // Add some point data (simple pattern)
    for (uint32_t i = 0; i < point_count; ++i) {
        size_t offset_base = 227 + i * 26;
        
        // X, Y, Z coordinates (as int32_t)
        int32_t x = static_cast<int32_t>(i * 10);
        int32_t y = static_cast<int32_t>(i * 10);
        int32_t z = static_cast<int32_t>(i * 10);
        
        std::memcpy(&data[offset_base + 0], &x, sizeof(int32_t));
        std::memcpy(&data[offset_base + 4], &y, sizeof(int32_t));
        std::memcpy(&data[offset_base + 8], &z, sizeof(int32_t));
        
        // RGB values (16-bit)
        uint16_t r = 255 << 8;
        uint16_t g = 128 << 8;
        uint16_t b = 64 << 8;
        
        std::memcpy(&data[offset_base + 20], &r, sizeof(uint16_t));
        std::memcpy(&data[offset_base + 22], &g, sizeof(uint16_t));
        std::memcpy(&data[offset_base + 24], &b, sizeof(uint16_t));
    }
    
    return data;
}

TEST_CASE("WASM Interface: Load and free LAS file", "[wasm_interface]") {
    auto las_data = createMinimalLASFile(10);
    
    // Load file
    uintptr_t header_ptr = loadLASFile(las_data.data(), static_cast<uint32_t>(las_data.size()));
    REQUIRE(header_ptr != 0);
    
    // Get point data
    uint32_t point_count = 0;
    uintptr_t points_ptr = getPointData(&point_count);
    REQUIRE(points_ptr != 0);
    REQUIRE(point_count == 10);
    
    // Free data
    freeLASData();
    
    // After freeing, getPointData should return 0
    point_count = 999;
    points_ptr = getPointData(&point_count);
    REQUIRE(points_ptr == 0);
    REQUIRE(point_count == 0);
}

TEST_CASE("WASM Interface: Build spatial index", "[wasm_interface]") {
    auto las_data = createMinimalLASFile(100);
    
    // Load file
    uintptr_t header_ptr = loadLASFile(las_data.data(), static_cast<uint32_t>(las_data.size()));
    REQUIRE(header_ptr != 0);
    
    // Build spatial index (should not crash)
    buildSpatialIndex();
    
    // Clean up
    freeLASData();
}

TEST_CASE("WASM Interface: Query visible points", "[wasm_interface]") {
    auto las_data = createMinimalLASFile(50);
    
    // Load file
    uintptr_t header_ptr = loadLASFile(las_data.data(), static_cast<uint32_t>(las_data.size()));
    REQUIRE(header_ptr != 0);
    
    // Build spatial index
    buildSpatialIndex();
    
    // Create a frustum that includes all points
    float frustum_planes[24] = {
        // Left plane
        1.0f, 0.0f, 0.0f, 1000.0f,
        // Right plane
        -1.0f, 0.0f, 0.0f, 1000.0f,
        // Top plane
        0.0f, -1.0f, 0.0f, 1000.0f,
        // Bottom plane
        0.0f, 1.0f, 0.0f, 1000.0f,
        // Near plane
        0.0f, 0.0f, 1.0f, 1000.0f,
        // Far plane
        0.0f, 0.0f, -1.0f, 1000.0f
    };
    
    // Query visible points
    uint32_t result_count = 0;
    uintptr_t result_ptr = queryVisiblePoints(frustum_planes, 100.0f, 1000, &result_count);
    
    // Should return some points
    REQUIRE(result_count > 0);
    REQUIRE(result_count <= 50);
    
    // Verify we got a valid pointer if we have results
    if (result_count > 0) {
        REQUIRE(result_ptr != 0);
    }
    
    // Clean up
    freeLASData();
}

TEST_CASE("WASM Interface: Load invalid file returns error", "[wasm_interface]") {
    std::vector<uint8_t> invalid_data(100, 0);  // Too small and invalid
    
    // Load should fail
    uintptr_t header_ptr = loadLASFile(invalid_data.data(), static_cast<uint32_t>(invalid_data.size()));
    REQUIRE(header_ptr == 0);
    
    // Clean up (should be safe even after failed load)
    freeLASData();
}

TEST_CASE("WASM Interface: Multiple load/free cycles", "[wasm_interface]") {
    auto las_data = createMinimalLASFile(20);
    
    // First cycle
    uintptr_t header_ptr1 = loadLASFile(las_data.data(), static_cast<uint32_t>(las_data.size()));
    REQUIRE(header_ptr1 != 0);
    freeLASData();
    
    // Second cycle
    uintptr_t header_ptr2 = loadLASFile(las_data.data(), static_cast<uint32_t>(las_data.size()));
    REQUIRE(header_ptr2 != 0);
    freeLASData();
    
    // Third cycle
    uintptr_t header_ptr3 = loadLASFile(las_data.data(), static_cast<uint32_t>(las_data.size()));
    REQUIRE(header_ptr3 != 0);
    freeLASData();
}

// Feature: las-point-cloud-viewer, Property 5: WASM Data Transfer Integrity
// Validates: Requirements 2.2, 2.3
TEST_CASE("WASM data transfer integrity", "[wasm_interface][property]") {
    // Run property-based test with 100 iterations
    const bool result = rc::check("point cloud data passed to WASM and retrieved back should be identical (round-trip property)",
        []() {
            // Generate random number of points (reasonable range for testing)
            uint32_t point_count = *rc::gen::inRange<uint32_t>(1, 500);
            
            // Create a LAS file with random point data
            std::vector<uint8_t> las_data = createMinimalLASFile(point_count);
            
            // Generate random point data and write it to the file
            std::vector<int32_t> original_coords_x;
            std::vector<int32_t> original_coords_y;
            std::vector<int32_t> original_coords_z;
            std::vector<uint16_t> original_colors_r;
            std::vector<uint16_t> original_colors_g;
            std::vector<uint16_t> original_colors_b;
            
            original_coords_x.reserve(point_count);
            original_coords_y.reserve(point_count);
            original_coords_z.reserve(point_count);
            original_colors_r.reserve(point_count);
            original_colors_g.reserve(point_count);
            original_colors_b.reserve(point_count);
            
            // Overwrite the point data section with random values
            for (uint32_t i = 0; i < point_count; ++i) {
                size_t offset_base = 227 + i * 26;
                
                // Generate random coordinates
                int32_t x = *rc::gen::inRange<int32_t>(-1000000, 1000000);
                int32_t y = *rc::gen::inRange<int32_t>(-1000000, 1000000);
                int32_t z = *rc::gen::inRange<int32_t>(-10000, 10000);
                
                original_coords_x.push_back(x);
                original_coords_y.push_back(y);
                original_coords_z.push_back(z);
                
                std::memcpy(&las_data[offset_base + 0], &x, sizeof(int32_t));
                std::memcpy(&las_data[offset_base + 4], &y, sizeof(int32_t));
                std::memcpy(&las_data[offset_base + 8], &z, sizeof(int32_t));
                
                // Generate random RGB values (16-bit)
                uint16_t r = *rc::gen::inRange<uint16_t>(0, 65535);
                uint16_t g = *rc::gen::inRange<uint16_t>(0, 65535);
                uint16_t b = *rc::gen::inRange<uint16_t>(0, 65535);
                
                original_colors_r.push_back(r);
                original_colors_g.push_back(g);
                original_colors_b.push_back(b);
                
                std::memcpy(&las_data[offset_base + 20], &r, sizeof(uint16_t));
                std::memcpy(&las_data[offset_base + 22], &g, sizeof(uint16_t));
                std::memcpy(&las_data[offset_base + 24], &b, sizeof(uint16_t));
            }
            
            // Step 1: Pass data to WASM (simulating JavaScript passing ArrayBuffer)
            uintptr_t header_ptr = loadLASFile(las_data.data(), static_cast<uint32_t>(las_data.size()));
            RC_ASSERT(header_ptr != 0);
            
            // Step 2: Retrieve point data from WASM
            uint32_t retrieved_count = 0;
            uintptr_t points_ptr = getPointData(&retrieved_count);
            RC_ASSERT(points_ptr != 0);
            RC_ASSERT(retrieved_count == point_count);
            
            // Step 3: Verify round-trip integrity - all data should match
            const LASPoint* points = reinterpret_cast<const LASPoint*>(points_ptr);
            
            for (uint32_t i = 0; i < point_count; ++i) {
                const LASPoint& point = points[i];
                
                // Verify coordinates (accounting for scale/offset transformation)
                // With scale=1.0 and offset=0.0, world coords should equal raw coords
                float expected_x = static_cast<float>(original_coords_x[i]);
                float expected_y = static_cast<float>(original_coords_y[i]);
                float expected_z = static_cast<float>(original_coords_z[i]);
                
                // Allow small tolerance for int32->float conversion
                float tolerance = 0.01f;
                RC_ASSERT(std::abs(point.x - expected_x) < tolerance);
                RC_ASSERT(std::abs(point.y - expected_y) < tolerance);
                RC_ASSERT(std::abs(point.z - expected_z) < tolerance);
                
                // Verify RGB colors (16-bit to 8-bit conversion: take high byte)
                uint8_t expected_r = static_cast<uint8_t>(original_colors_r[i] >> 8);
                uint8_t expected_g = static_cast<uint8_t>(original_colors_g[i] >> 8);
                uint8_t expected_b = static_cast<uint8_t>(original_colors_b[i] >> 8);
                
                RC_ASSERT(point.r == expected_r);
                RC_ASSERT(point.g == expected_g);
                RC_ASSERT(point.b == expected_b);
            }
            
            // Step 4: Verify header data integrity
            const LASHeader* header = reinterpret_cast<const LASHeader*>(header_ptr);
            RC_ASSERT(header->point_count == point_count);
            RC_ASSERT(header->point_format == 2);
            RC_ASSERT(header->version_major == 1);
            RC_ASSERT(header->version_minor == 2);
            
            // Clean up
            freeLASData();
        });
    
    // Check if the property test succeeded
    REQUIRE(result);
}

// Feature: las-point-cloud-viewer, Property 6: Memory Leak Prevention
// Validates: Requirements 2.4
TEST_CASE("Memory leak prevention across load/free cycles", "[wasm_interface][property]") {
    // Run property-based test with 100 iterations
    const bool result = rc::check("sequence of load-parse-free operations should not leak memory",
        []() {
            // Generate random number of load/free cycles (1 to 20)
            uint32_t num_cycles = *rc::gen::inRange<uint32_t>(1, 20);
            
            // Track memory state by checking that we can successfully load/free multiple times
            // In a real WASM environment, we'd check heap size, but in native tests we verify
            // that the operations complete successfully and don't accumulate state
            
            for (uint32_t cycle = 0; cycle < num_cycles; ++cycle) {
                // Generate random point count for this cycle
                uint32_t point_count = *rc::gen::inRange<uint32_t>(10, 1000);
                
                // Create a LAS file
                std::vector<uint8_t> las_data = createMinimalLASFile(point_count);
                
                // Load the file
                uintptr_t header_ptr = loadLASFile(las_data.data(), static_cast<uint32_t>(las_data.size()));
                RC_ASSERT(header_ptr != 0);
                
                // Verify we can get point data
                uint32_t retrieved_count = 0;
                uintptr_t points_ptr = getPointData(&retrieved_count);
                RC_ASSERT(points_ptr != 0);
                RC_ASSERT(retrieved_count == point_count);
                
                // Optionally build spatial index (adds more memory allocation)
                if (*rc::gen::arbitrary<bool>()) {
                    buildSpatialIndex();
                }
                
                // Free all data
                freeLASData();
                
                // Verify that after freeing, getPointData returns null state
                uint32_t count_after_free = 999;
                uintptr_t ptr_after_free = getPointData(&count_after_free);
                RC_ASSERT(ptr_after_free == 0);
                RC_ASSERT(count_after_free == 0);
            }
            
            // After all cycles, verify we can still load a new file successfully
            // This ensures no lingering state prevents new allocations
            auto final_las_data = createMinimalLASFile(50);
            uintptr_t final_header_ptr = loadLASFile(final_las_data.data(), 
                                                     static_cast<uint32_t>(final_las_data.size()));
            RC_ASSERT(final_header_ptr != 0);
            
            uint32_t final_count = 0;
            uintptr_t final_points_ptr = getPointData(&final_count);
            RC_ASSERT(final_points_ptr != 0);
            RC_ASSERT(final_count == 50);
            
            // Final cleanup
            freeLASData();
            
            // Verify final state is clean
            uint32_t final_check_count = 999;
            uintptr_t final_check_ptr = getPointData(&final_check_count);
            RC_ASSERT(final_check_ptr == 0);
            RC_ASSERT(final_check_count == 0);
        });
    
    // Check if the property test succeeded
    REQUIRE(result);
}

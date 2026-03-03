#include <catch2/catch_test_macros.hpp>
#include <rapidcheck.h>
#include "../src/las_parser.h"
#include <cmath>
#include <cstring>
#include <vector>

// Helper function to write little-endian values
template<typename T>
void writeLittleEndian(uint8_t* dest, T value) {
    for (size_t i = 0; i < sizeof(T); ++i) {
        dest[i] = static_cast<uint8_t>((value >> (i * 8)) & 0xFF);
    }
}

// Helper function to write double to bytes
void writeDouble(uint8_t* dest, double value) {
    std::memcpy(dest, &value, sizeof(double));
}

// Helper function to create a valid LAS header in memory
std::vector<uint8_t> createLASHeader(const LASHeader& header) {
    // Create a buffer for LAS 1.2 header (227 bytes minimum)
    std::vector<uint8_t> buffer(227, 0);
    
    // Write magic bytes "LASF" (bytes 0-3)
    buffer[0] = 'L';
    buffer[1] = 'A';
    buffer[2] = 'S';
    buffer[3] = 'F';
    
    // Write version (bytes 24-25)
    buffer[24] = header.version_major;
    buffer[25] = header.version_minor;
    
    // Write header size (bytes 94-95) - 227 for LAS 1.2
    writeLittleEndian<uint16_t>(buffer.data() + 94, 227);
    
    // Write point data offset (bytes 96-99) - typically 227 (after header)
    writeLittleEndian<uint32_t>(buffer.data() + 96, 227);
    
    // Write point data format (byte 104)
    buffer[104] = header.point_format;
    
    // Write point record length (bytes 105-106)
    writeLittleEndian<uint16_t>(buffer.data() + 105, header.point_record_length);
    
    // Write number of point records (bytes 107-110)
    writeLittleEndian<uint32_t>(buffer.data() + 107, header.point_count);
    
    // Write scale factors (bytes 131-154)
    writeDouble(buffer.data() + 131, header.scale_x);
    writeDouble(buffer.data() + 139, header.scale_y);
    writeDouble(buffer.data() + 147, header.scale_z);
    
    // Write offsets (bytes 155-178)
    writeDouble(buffer.data() + 155, header.offset_x);
    writeDouble(buffer.data() + 163, header.offset_y);
    writeDouble(buffer.data() + 171, header.offset_z);
    
    // Write bounding box (bytes 179-226)
    writeDouble(buffer.data() + 179, header.max_x);
    writeDouble(buffer.data() + 187, header.min_x);
    writeDouble(buffer.data() + 195, header.max_y);
    writeDouble(buffer.data() + 203, header.min_y);
    writeDouble(buffer.data() + 211, header.max_z);
    writeDouble(buffer.data() + 219, header.min_z);
    
    return buffer;
}

// Feature: las-point-cloud-viewer, Property 1: LAS Header Parsing Round-Trip
// Validates: Requirements 1.1
TEST_CASE("LAS header parsing round-trip", "[las_parser][property]") {
    // Run property-based test with 100 iterations
    const bool result = rc::check("parsed header metadata matches original values within floating-point precision",
        []() {
            // Generate random valid header metadata
            LASHeader original_header;
            
            // Version: support 1.2 and 1.4
            original_header.version_major = 1;
            original_header.version_minor = *rc::gen::element(2, 4);
            
            // Point format: we support format 2 (RGB)
            original_header.point_format = 2;
            
            // Point record length for format 2 is 26 bytes
            original_header.point_record_length = 26;
            
            // Generate random point count (reasonable range)
            original_header.point_count = *rc::gen::inRange<uint32_t>(0, 10000000);
            
            // Generate random scale factors (positive, reasonable range for LAS files)
            original_header.scale_x = *rc::gen::inRange(1, 1000) / 1000.0;
            original_header.scale_y = *rc::gen::inRange(1, 1000) / 1000.0;
            original_header.scale_z = *rc::gen::inRange(1, 1000) / 1000.0;
            
            // Generate random offsets (reasonable range for geographic coordinates)
            original_header.offset_x = *rc::gen::inRange(-1000000, 1000000) * 1.0;
            original_header.offset_y = *rc::gen::inRange(-1000000, 1000000) * 1.0;
            original_header.offset_z = *rc::gen::inRange(-1000, 10000) * 1.0;
            
            // Generate random bounding box (ensure min < max)
            double base_x = *rc::gen::inRange(-1000000, 1000000) * 1.0;
            double base_y = *rc::gen::inRange(-1000000, 1000000) * 1.0;
            double base_z = *rc::gen::inRange(-1000, 10000) * 1.0;
            
            double extent_x = *rc::gen::inRange(1, 10000) * 1.0;
            double extent_y = *rc::gen::inRange(1, 10000) * 1.0;
            double extent_z = *rc::gen::inRange(1, 1000) * 1.0;
            
            original_header.min_x = base_x;
            original_header.max_x = base_x + extent_x;
            original_header.min_y = base_y;
            original_header.max_y = base_y + extent_y;
            original_header.min_z = base_z;
            original_header.max_z = base_z + extent_z;
            
            // Create a valid LAS header in memory
            std::vector<uint8_t> header_data = createLASHeader(original_header);
            
            // Parse the header
            LASParser parser;
            auto result = parser.parseHeader(header_data.data(), header_data.size());
            
            // Verify parsing succeeded
            RC_ASSERT(result.isOk());
            
            const LASHeader& parsed_header = result.value();
            
            // Verify all metadata matches within floating-point precision
            RC_ASSERT(parsed_header.version_major == original_header.version_major);
            RC_ASSERT(parsed_header.version_minor == original_header.version_minor);
            RC_ASSERT(parsed_header.point_format == original_header.point_format);
            RC_ASSERT(parsed_header.point_record_length == original_header.point_record_length);
            RC_ASSERT(parsed_header.point_count == original_header.point_count);
            
            // For floating-point values, use appropriate tolerance
            // Double precision should maintain very high accuracy for round-trip
            const double tolerance = 1e-10;
            
            RC_ASSERT(std::abs(parsed_header.scale_x - original_header.scale_x) < tolerance);
            RC_ASSERT(std::abs(parsed_header.scale_y - original_header.scale_y) < tolerance);
            RC_ASSERT(std::abs(parsed_header.scale_z - original_header.scale_z) < tolerance);
            
            RC_ASSERT(std::abs(parsed_header.offset_x - original_header.offset_x) < tolerance);
            RC_ASSERT(std::abs(parsed_header.offset_y - original_header.offset_y) < tolerance);
            RC_ASSERT(std::abs(parsed_header.offset_z - original_header.offset_z) < tolerance);
            
            RC_ASSERT(std::abs(parsed_header.min_x - original_header.min_x) < tolerance);
            RC_ASSERT(std::abs(parsed_header.max_x - original_header.max_x) < tolerance);
            RC_ASSERT(std::abs(parsed_header.min_y - original_header.min_y) < tolerance);
            RC_ASSERT(std::abs(parsed_header.max_y - original_header.max_y) < tolerance);
            RC_ASSERT(std::abs(parsed_header.min_z - original_header.min_z) < tolerance);
            RC_ASSERT(std::abs(parsed_header.max_z - original_header.max_z) < tolerance);
        });
    
    // Check if the property test succeeded
    REQUIRE(result);
}

// Helper function to create a complete LAS file with header and point data
std::vector<uint8_t> createLASFile(const LASHeader& header, const std::vector<LASPoint>& points) {
    // Create header
    std::vector<uint8_t> file_data = createLASHeader(header);
    
    // Add point data
    for (const auto& point : points) {
        // Convert world coordinates back to raw coordinates
        int32_t raw_x = static_cast<int32_t>((point.x - header.offset_x) / header.scale_x);
        int32_t raw_y = static_cast<int32_t>((point.y - header.offset_y) / header.scale_y);
        int32_t raw_z = static_cast<int32_t>((point.z - header.offset_z) / header.scale_z);
        
        // Create point record (26 bytes for format 2)
        std::vector<uint8_t> record(26, 0);
        
        // Write XYZ (bytes 0-11)
        writeLittleEndian<int32_t>(record.data() + 0, raw_x);
        writeLittleEndian<int32_t>(record.data() + 4, raw_y);
        writeLittleEndian<int32_t>(record.data() + 8, raw_z);
        
        // Write intensity (bytes 12-13)
        writeLittleEndian<uint16_t>(record.data() + 12, point.intensity);
        
        // Write classification (byte 15)
        record[15] = point.classification;
        
        // Write RGB (bytes 20-25) - scale 8-bit back to 16-bit
        writeLittleEndian<uint16_t>(record.data() + 20, static_cast<uint16_t>(point.r) << 8);
        writeLittleEndian<uint16_t>(record.data() + 22, static_cast<uint16_t>(point.g) << 8);
        writeLittleEndian<uint16_t>(record.data() + 24, static_cast<uint16_t>(point.b) << 8);
        
        // Append record to file
        file_data.insert(file_data.end(), record.begin(), record.end());
    }
    
    return file_data;
}

// Feature: las-point-cloud-viewer, Property 2: Point Data Extraction Completeness
// Validates: Requirements 1.2, 1.4
TEST_CASE("Point data extraction completeness", "[las_parser][property]") {
    // Run property-based test with 100 iterations
    const bool result = rc::check("parsing extracts exactly N points with all required attributes populated",
        []() {
            // Generate random number of points (reasonable range for testing)
            uint32_t point_count = *rc::gen::inRange<uint32_t>(1, 1000);
            
            // Create header with valid metadata
            LASHeader header;
            header.version_major = 1;
            header.version_minor = 2;
            header.point_format = 2;
            header.point_record_length = 26;
            header.point_count = point_count;
            
            // Generate reasonable scale and offset values
            header.scale_x = 0.01;
            header.scale_y = 0.01;
            header.scale_z = 0.01;
            header.offset_x = 0.0;
            header.offset_y = 0.0;
            header.offset_z = 0.0;
            
            // Generate random points with all attributes
            std::vector<LASPoint> original_points;
            original_points.reserve(point_count);
            
            double min_x = std::numeric_limits<double>::max();
            double max_x = std::numeric_limits<double>::lowest();
            double min_y = std::numeric_limits<double>::max();
            double max_y = std::numeric_limits<double>::lowest();
            double min_z = std::numeric_limits<double>::max();
            double max_z = std::numeric_limits<double>::lowest();
            
            for (uint32_t i = 0; i < point_count; ++i) {
                LASPoint point;
                
                // Generate random coordinates (within reasonable range)
                // Use integer ranges and convert to float
                point.x = static_cast<float>(*rc::gen::inRange(-1000, 1000));
                point.y = static_cast<float>(*rc::gen::inRange(-1000, 1000));
                point.z = static_cast<float>(*rc::gen::inRange(-100, 100));
                
                // Generate random RGB values
                point.r = *rc::gen::inRange<uint8_t>(0, 255);
                point.g = *rc::gen::inRange<uint8_t>(0, 255);
                point.b = *rc::gen::inRange<uint8_t>(0, 255);
                
                // Generate random intensity
                point.intensity = *rc::gen::inRange<uint16_t>(0, 65535);
                
                // Generate random classification
                point.classification = *rc::gen::inRange<uint8_t>(0, 31);
                
                // Update bounding box
                min_x = std::min(min_x, static_cast<double>(point.x));
                max_x = std::max(max_x, static_cast<double>(point.x));
                min_y = std::min(min_y, static_cast<double>(point.y));
                max_y = std::max(max_y, static_cast<double>(point.y));
                min_z = std::min(min_z, static_cast<double>(point.z));
                max_z = std::max(max_z, static_cast<double>(point.z));
                
                original_points.push_back(point);
            }
            
            // Set bounding box in header
            header.min_x = min_x;
            header.max_x = max_x;
            header.min_y = min_y;
            header.max_y = max_y;
            header.min_z = min_z;
            header.max_z = max_z;
            
            // Create complete LAS file
            std::vector<uint8_t> file_data = createLASFile(header, original_points);
            
            // Parse the file
            LASParser parser;
            auto parse_result = parser.parsePoints(file_data.data(), file_data.size(), header);
            
            // Verify parsing succeeded
            RC_ASSERT(parse_result.isOk());
            
            const std::vector<LASPoint>& parsed_points = parse_result.value();
            
            // Property 1: Verify exactly N points were extracted
            RC_ASSERT(parsed_points.size() == point_count);
            
            // Property 2: Verify all points have all required attributes populated
            for (size_t i = 0; i < parsed_points.size(); ++i) {
                const LASPoint& parsed = parsed_points[i];
                const LASPoint& original = original_points[i];
                
                // Verify XYZ coordinates (with tolerance for round-trip conversion)
                // The tolerance accounts for int32 -> float -> int32 conversion
                float coord_tolerance = std::max(std::abs(original.x) * 0.01f, 0.01f);
                RC_ASSERT(std::abs(parsed.x - original.x) < coord_tolerance);
                
                coord_tolerance = std::max(std::abs(original.y) * 0.01f, 0.01f);
                RC_ASSERT(std::abs(parsed.y - original.y) < coord_tolerance);
                
                coord_tolerance = std::max(std::abs(original.z) * 0.01f, 0.01f);
                RC_ASSERT(std::abs(parsed.z - original.z) < coord_tolerance);
                
                // Verify RGB colors (exact match expected after round-trip)
                RC_ASSERT(parsed.r == original.r);
                RC_ASSERT(parsed.g == original.g);
                RC_ASSERT(parsed.b == original.b);
                
                // Verify intensity (exact match expected)
                RC_ASSERT(parsed.intensity == original.intensity);
                
                // Verify classification (exact match expected)
                RC_ASSERT(parsed.classification == original.classification);
            }
        });
    
    // Check if the property test succeeded
    REQUIRE(result);
}

// Feature: las-point-cloud-viewer, Property 3: Coordinate Transformation Correctness
// Validates: Requirements 1.3
TEST_CASE("Coordinate transformation correctness", "[las_parser][property]") {
    // Run property-based test with 100 iterations
    const bool result = rc::check("transformed coordinates satisfy formula: world_coord = raw_coord * scale + offset", 
        []() {
            // Generate random raw coordinates (32-bit integers as per LAS format)
            auto raw_x = *rc::gen::inRange<int32_t>(-2147483648, 2147483647);
            auto raw_y = *rc::gen::inRange<int32_t>(-2147483648, 2147483647);
            auto raw_z = *rc::gen::inRange<int32_t>(-2147483648, 2147483647);
            
            // Generate random scale factors (positive, reasonable range for LAS files)
            // Use integer range and convert to double for floating-point values
            auto scale_x = *rc::gen::inRange(1, 1000) / 1000.0;
            auto scale_y = *rc::gen::inRange(1, 1000) / 1000.0;
            auto scale_z = *rc::gen::inRange(1, 1000) / 1000.0;
            
            // Generate random offsets (reasonable range for geographic coordinates)
            auto offset_x = *rc::gen::inRange(-1000000, 1000000) * 1.0;
            auto offset_y = *rc::gen::inRange(-1000000, 1000000) * 1.0;
            auto offset_z = *rc::gen::inRange(-1000, 10000) * 1.0;
            
            // Create a header with these parameters
            LASHeader header;
            header.scale_x = scale_x;
            header.scale_y = scale_y;
            header.scale_z = scale_z;
            header.offset_x = offset_x;
            header.offset_y = offset_y;
            header.offset_z = offset_z;
            
            // Create parser and apply transformation
            LASParser parser;
            float world_x, world_y, world_z;
            
            // Call the transformation function
            parser.transformCoordinates(raw_x, raw_y, raw_z, header, 
                                       world_x, world_y, world_z);
            
            // Calculate expected world coordinates using the LAS formula
            double expected_x = static_cast<double>(raw_x) * scale_x + offset_x;
            double expected_y = static_cast<double>(raw_y) * scale_y + offset_y;
            double expected_z = static_cast<double>(raw_z) * scale_z + offset_z;
            
            // Verify the formula holds (with tolerance for floating-point precision)
            // We need to account for the double->float conversion precision loss
            double tolerance = std::max(std::abs(expected_x) * 1e-6, 1e-5);
            RC_ASSERT(std::abs(world_x - expected_x) < tolerance);
            
            tolerance = std::max(std::abs(expected_y) * 1e-6, 1e-5);
            RC_ASSERT(std::abs(world_y - expected_y) < tolerance);
            
            tolerance = std::max(std::abs(expected_z) * 1e-6, 1e-5);
            RC_ASSERT(std::abs(world_z - expected_z) < tolerance);
        });
    
    // Check if the property test succeeded
    REQUIRE(result);
}

// ============================================================================
// Unit Tests for Error Handling
// Requirements: 1.5, 12.1
// ============================================================================

TEST_CASE("Reject file with invalid magic bytes", "[las_parser][error_handling]") {
    // Create a buffer with invalid magic bytes
    std::vector<uint8_t> data(227, 0);
    
    // Set invalid magic bytes (not "LASF")
    data[0] = 'X';
    data[1] = 'Y';
    data[2] = 'Z';
    data[3] = 'W';
    
    LASParser parser;
    auto result = parser.parseHeader(data.data(), data.size());
    
    // Should return an error
    REQUIRE(result.isErr());
    
    // Error message should mention magic bytes
    REQUIRE(result.error().find("magic") != std::string::npos);
}

TEST_CASE("Reject file with partially correct magic bytes", "[las_parser][error_handling]") {
    // Create a buffer with partially correct magic bytes
    std::vector<uint8_t> data(227, 0);
    
    // Set partially correct magic bytes
    data[0] = 'L';
    data[1] = 'A';
    data[2] = 'S';
    data[3] = 'X';  // Wrong last byte
    
    LASParser parser;
    auto result = parser.parseHeader(data.data(), data.size());
    
    // Should return an error
    REQUIRE(result.isErr());
    REQUIRE(result.error().find("magic") != std::string::npos);
}

TEST_CASE("Reject truncated file - too small for header", "[las_parser][error_handling]") {
    // Create a buffer that's too small (less than 227 bytes)
    std::vector<uint8_t> data(100, 0);
    
    // Even with correct magic bytes, should fail
    data[0] = 'L';
    data[1] = 'A';
    data[2] = 'S';
    data[3] = 'F';
    
    LASParser parser;
    auto result = parser.parseHeader(data.data(), data.size());
    
    // Should return an error
    REQUIRE(result.isErr());
    
    // Error message should mention file size or header
    std::string error_msg = result.error();
    REQUIRE((error_msg.find("small") != std::string::npos || 
             error_msg.find("header") != std::string::npos));
}

TEST_CASE("Reject empty file", "[las_parser][error_handling]") {
    // Create an empty buffer
    std::vector<uint8_t> data;
    
    LASParser parser;
    auto result = parser.parseHeader(data.data(), data.size());
    
    // Should return an error
    REQUIRE(result.isErr());
}

TEST_CASE("Reject file smaller than declared header size", "[las_parser][error_handling]") {
    // Create a buffer with correct magic bytes but declare larger header size
    std::vector<uint8_t> data(227, 0);
    
    // Set correct magic bytes
    data[0] = 'L';
    data[1] = 'A';
    data[2] = 'S';
    data[3] = 'F';
    
    // Set version 1.2
    data[24] = 1;
    data[25] = 2;
    
    // Declare header size larger than actual file (bytes 94-95)
    writeLittleEndian<uint16_t>(data.data() + 94, 500);  // Claim 500 bytes but only have 227
    
    LASParser parser;
    auto result = parser.parseHeader(data.data(), data.size());
    
    // Should return an error
    REQUIRE(result.isErr());
    REQUIRE(result.error().find("header size") != std::string::npos);
}

TEST_CASE("Reject unsupported LAS version", "[las_parser][error_handling]") {
    // Create a valid header structure but with unsupported version
    std::vector<uint8_t> data(227, 0);
    
    // Set correct magic bytes
    data[0] = 'L';
    data[1] = 'A';
    data[2] = 'S';
    data[3] = 'F';
    
    // Set unsupported version (e.g., 2.0)
    data[24] = 2;
    data[25] = 0;
    
    // Set header size
    writeLittleEndian<uint16_t>(data.data() + 94, 227);
    
    LASParser parser;
    auto result = parser.parseHeader(data.data(), data.size());
    
    // Should return an error
    REQUIRE(result.isErr());
    REQUIRE(result.error().find("version") != std::string::npos);
}

TEST_CASE("Reject unsupported point format", "[las_parser][error_handling]") {
    // Create a valid header but with unsupported point format
    LASHeader header;
    header.version_major = 1;
    header.version_minor = 2;
    header.point_format = 5;  // Unsupported format (we only support format 2)
    header.point_record_length = 26;
    header.point_count = 0;
    header.scale_x = 0.01;
    header.scale_y = 0.01;
    header.scale_z = 0.01;
    header.offset_x = 0.0;
    header.offset_y = 0.0;
    header.offset_z = 0.0;
    header.min_x = 0.0;
    header.max_x = 100.0;
    header.min_y = 0.0;
    header.max_y = 100.0;
    header.min_z = 0.0;
    header.max_z = 100.0;
    
    std::vector<uint8_t> data = createLASHeader(header);
    
    LASParser parser;
    auto result = parser.parseHeader(data.data(), data.size());
    
    // Should return an error
    REQUIRE(result.isErr());
    REQUIRE(result.error().find("format") != std::string::npos);
}

TEST_CASE("Reject truncated point data", "[las_parser][error_handling]") {
    // Create a header claiming more points than the file contains
    LASHeader header;
    header.version_major = 1;
    header.version_minor = 2;
    header.point_format = 2;
    header.point_record_length = 26;
    header.point_count = 100;  // Claim 100 points
    header.scale_x = 0.01;
    header.scale_y = 0.01;
    header.scale_z = 0.01;
    header.offset_x = 0.0;
    header.offset_y = 0.0;
    header.offset_z = 0.0;
    header.min_x = 0.0;
    header.max_x = 100.0;
    header.min_y = 0.0;
    header.max_y = 100.0;
    header.min_z = 0.0;
    header.max_z = 100.0;
    
    // Create file with header but only 10 points worth of data
    std::vector<uint8_t> file_data = createLASHeader(header);
    
    // Add only 10 points (26 bytes each = 260 bytes)
    std::vector<uint8_t> point_data(260, 0);
    file_data.insert(file_data.end(), point_data.begin(), point_data.end());
    
    LASParser parser;
    auto result = parser.parsePoints(file_data.data(), file_data.size(), header);
    
    // Should return an error
    REQUIRE(result.isErr());
    
    // Error message should mention point records or file size
    std::string error_msg = result.error();
    REQUIRE((error_msg.find("point") != std::string::npos || 
             error_msg.find("small") != std::string::npos));
}

// ============================================================================
// Property-Based Tests for Error Handling and Edge Cases
// ============================================================================

// Feature: las-point-cloud-viewer, Property 4: Invalid File Rejection
// Validates: Requirements 1.5, 12.1, 12.4
TEST_CASE("Invalid file rejection property", "[las_parser][property][error_handling]") {
    // Run property-based test with 100 iterations
    const bool result = rc::check("parser returns error for invalid files without crashing",
        []() {
            LASParser parser;
            
            // Generate different types of invalid files
            auto corruption_type = *rc::gen::inRange(0, 6);
            
            std::vector<uint8_t> invalid_data;
            
            switch (corruption_type) {
                case 0: {
                    // Invalid magic bytes
                    invalid_data.resize(227, 0);
                    // Generate random invalid magic bytes (not "LASF")
                    invalid_data[0] = *rc::gen::inRange<uint8_t>(0, 255);
                    invalid_data[1] = *rc::gen::inRange<uint8_t>(0, 255);
                    invalid_data[2] = *rc::gen::inRange<uint8_t>(0, 255);
                    invalid_data[3] = *rc::gen::inRange<uint8_t>(0, 255);
                    // Ensure it's not accidentally "LASF"
                    if (invalid_data[0] == 'L' && invalid_data[1] == 'A' && 
                        invalid_data[2] == 'S' && invalid_data[3] == 'F') {
                        invalid_data[0] = 'X';
                    }
                    break;
                }
                
                case 1: {
                    // File too small (less than minimum header size)
                    auto small_size = *rc::gen::inRange<size_t>(0, 226);
                    invalid_data.resize(small_size, 0);
                    // Add correct magic bytes to test size validation
                    if (small_size >= 4) {
                        invalid_data[0] = 'L';
                        invalid_data[1] = 'A';
                        invalid_data[2] = 'S';
                        invalid_data[3] = 'F';
                    }
                    break;
                }
                
                case 2: {
                    // Unsupported version
                    invalid_data.resize(227, 0);
                    invalid_data[0] = 'L';
                    invalid_data[1] = 'A';
                    invalid_data[2] = 'S';
                    invalid_data[3] = 'F';
                    // Generate unsupported version (not 1.2, 1.3, or 1.4)
                    auto major = *rc::gen::inRange<uint8_t>(0, 10);
                    auto minor = *rc::gen::inRange<uint8_t>(0, 10);
                    // Ensure it's not 1.2, 1.3, or 1.4
                    if (major == 1 && (minor == 2 || minor == 3 || minor == 4)) {
                        major = 2;
                    }
                    invalid_data[24] = major;
                    invalid_data[25] = minor;
                    writeLittleEndian<uint16_t>(invalid_data.data() + 94, 227);
                    break;
                }
                
                case 3: {
                    // Unsupported point format
                    invalid_data.resize(227, 0);
                    invalid_data[0] = 'L';
                    invalid_data[1] = 'A';
                    invalid_data[2] = 'S';
                    invalid_data[3] = 'F';
                    invalid_data[24] = 1;
                    invalid_data[25] = 2;
                    writeLittleEndian<uint16_t>(invalid_data.data() + 94, 227);
                    // Generate unsupported format (not 2, 3, or 6)
                    auto format = *rc::gen::inRange<uint8_t>(0, 10);
                    if (format == 2 || format == 3 || format == 6) {
                        format = 5;
                    }
                    invalid_data[104] = format;
                    break;
                }
                
                case 4: {
                    // Declared header size larger than file
                    invalid_data.resize(227, 0);
                    invalid_data[0] = 'L';
                    invalid_data[1] = 'A';
                    invalid_data[2] = 'S';
                    invalid_data[3] = 'F';
                    invalid_data[24] = 1;
                    invalid_data[25] = 2;
                    // Claim header is larger than actual file
                    auto claimed_size = *rc::gen::inRange<uint16_t>(228, 1000);
                    writeLittleEndian<uint16_t>(invalid_data.data() + 94, claimed_size);
                    break;
                }
                
                case 5: {
                    // Truncated point data - this case tests parsePoints, not parseHeader
                    // Skip this case for the header parsing test
                    // (it will be tested separately in the edge case test)
                    corruption_type = 0; // Fall through to invalid magic bytes
                    
                    invalid_data.resize(227, 0);
                    invalid_data[0] = *rc::gen::inRange<uint8_t>(0, 255);
                    invalid_data[1] = *rc::gen::inRange<uint8_t>(0, 255);
                    invalid_data[2] = *rc::gen::inRange<uint8_t>(0, 255);
                    invalid_data[3] = *rc::gen::inRange<uint8_t>(0, 255);
                    if (invalid_data[0] == 'L' && invalid_data[1] == 'A' && 
                        invalid_data[2] == 'S' && invalid_data[3] == 'F') {
                        invalid_data[0] = 'X';
                    }
                    break;
                }
                
                default: {
                    // Completely random data
                    auto size = *rc::gen::inRange<size_t>(0, 500);
                    invalid_data.resize(size);
                    for (size_t i = 0; i < size; ++i) {
                        invalid_data[i] = *rc::gen::inRange<uint8_t>(0, 255);
                    }
                    break;
                }
            }
            
            // Try to parse the invalid data
            auto result = parser.parseHeader(invalid_data.data(), invalid_data.size());
            
            // Property: Parser should return an error (not crash)
            RC_ASSERT(result.isErr());
            
            // Property: Error message should be non-empty and descriptive
            RC_ASSERT(!result.error().empty());
            
            // Property: Error message should not contain crash indicators
            std::string error_msg = result.error();
            RC_ASSERT(error_msg.find("segfault") == std::string::npos);
            RC_ASSERT(error_msg.find("crash") == std::string::npos);
        });
    
    // Check if the property test succeeded
    REQUIRE(result);
}

// Feature: las-point-cloud-viewer, Property 22: Edge Case Robustness
// Validates: Requirements 12.5
TEST_CASE("Edge case robustness property", "[las_parser][property][edge_cases]") {
    // Run property-based test with 100 iterations
    const bool result = rc::check("system handles edge cases gracefully without crashing",
        []() {
            LASParser parser;
            
            // Generate different edge cases
            auto edge_case_type = *rc::gen::inRange(0, 4);
            
            switch (edge_case_type) {
                case 0: {
                    // Empty point cloud (0 points)
                    LASHeader header;
                    header.version_major = 1;
                    header.version_minor = 2;
                    header.point_format = 2;
                    header.point_record_length = 26;
                    header.point_count = 0;  // Zero points
                    header.scale_x = 0.01;
                    header.scale_y = 0.01;
                    header.scale_z = 0.01;
                    header.offset_x = 0.0;
                    header.offset_y = 0.0;
                    header.offset_z = 0.0;
                    header.min_x = 0.0;
                    header.max_x = 0.0;
                    header.min_y = 0.0;
                    header.max_y = 0.0;
                    header.min_z = 0.0;
                    header.max_z = 0.0;
                    
                    std::vector<uint8_t> file_data = createLASHeader(header);
                    
                    // Parse should succeed with empty result
                    auto result = parser.parsePoints(file_data.data(), file_data.size(), header);
                    RC_ASSERT(result.isOk());
                    RC_ASSERT(result.value().empty());
                    break;
                }
                
                case 1: {
                    // Single point
                    LASHeader header;
                    header.version_major = 1;
                    header.version_minor = 2;
                    header.point_format = 2;
                    header.point_record_length = 26;
                    header.point_count = 1;  // Single point
                    header.scale_x = 0.01;
                    header.scale_y = 0.01;
                    header.scale_z = 0.01;
                    header.offset_x = 0.0;
                    header.offset_y = 0.0;
                    header.offset_z = 0.0;
                    
                    // Generate random single point
                    LASPoint point;
                    point.x = static_cast<float>(*rc::gen::inRange(-1000, 1000));
                    point.y = static_cast<float>(*rc::gen::inRange(-1000, 1000));
                    point.z = static_cast<float>(*rc::gen::inRange(-100, 100));
                    point.r = *rc::gen::inRange<uint8_t>(0, 255);
                    point.g = *rc::gen::inRange<uint8_t>(0, 255);
                    point.b = *rc::gen::inRange<uint8_t>(0, 255);
                    point.intensity = *rc::gen::inRange<uint16_t>(0, 65535);
                    point.classification = *rc::gen::inRange<uint8_t>(0, 31);
                    
                    header.min_x = header.max_x = point.x;
                    header.min_y = header.max_y = point.y;
                    header.min_z = header.max_z = point.z;
                    
                    std::vector<LASPoint> points = {point};
                    std::vector<uint8_t> file_data = createLASFile(header, points);
                    
                    // Parse should succeed with single point
                    auto result = parser.parsePoints(file_data.data(), file_data.size(), header);
                    RC_ASSERT(result.isOk());
                    RC_ASSERT(result.value().size() == 1);
                    break;
                }
                
                case 2: {
                    // All points at same location
                    auto point_count = *rc::gen::inRange<uint32_t>(2, 100);
                    
                    LASHeader header;
                    header.version_major = 1;
                    header.version_minor = 2;
                    header.point_format = 2;
                    header.point_record_length = 26;
                    header.point_count = point_count;
                    header.scale_x = 0.01;
                    header.scale_y = 0.01;
                    header.scale_z = 0.01;
                    header.offset_x = 0.0;
                    header.offset_y = 0.0;
                    header.offset_z = 0.0;
                    
                    // Generate random location
                    float x = static_cast<float>(*rc::gen::inRange(-1000, 1000));
                    float y = static_cast<float>(*rc::gen::inRange(-1000, 1000));
                    float z = static_cast<float>(*rc::gen::inRange(-100, 100));
                    
                    header.min_x = header.max_x = x;
                    header.min_y = header.max_y = y;
                    header.min_z = header.max_z = z;
                    
                    // Create points all at same location
                    std::vector<LASPoint> points;
                    for (uint32_t i = 0; i < point_count; ++i) {
                        LASPoint point;
                        point.x = x;
                        point.y = y;
                        point.z = z;
                        point.r = *rc::gen::inRange<uint8_t>(0, 255);
                        point.g = *rc::gen::inRange<uint8_t>(0, 255);
                        point.b = *rc::gen::inRange<uint8_t>(0, 255);
                        point.intensity = *rc::gen::inRange<uint16_t>(0, 65535);
                        point.classification = *rc::gen::inRange<uint8_t>(0, 31);
                        points.push_back(point);
                    }
                    
                    std::vector<uint8_t> file_data = createLASFile(header, points);
                    
                    // Parse should succeed
                    auto result = parser.parsePoints(file_data.data(), file_data.size(), header);
                    RC_ASSERT(result.isOk());
                    RC_ASSERT(result.value().size() == point_count);
                    break;
                }
                
                case 3: {
                    // Extreme coordinate values (near int32 limits)
                    LASHeader header;
                    header.version_major = 1;
                    header.version_minor = 2;
                    header.point_format = 2;
                    header.point_record_length = 26;
                    header.point_count = 1;
                    header.scale_x = 0.01;
                    header.scale_y = 0.01;
                    header.scale_z = 0.01;
                    header.offset_x = 0.0;
                    header.offset_y = 0.0;
                    header.offset_z = 0.0;
                    
                    // Generate extreme coordinates
                    float x = static_cast<float>(*rc::gen::inRange(-20000000, 20000000));
                    float y = static_cast<float>(*rc::gen::inRange(-20000000, 20000000));
                    float z = static_cast<float>(*rc::gen::inRange(-200000, 200000));
                    
                    header.min_x = header.max_x = x;
                    header.min_y = header.max_y = y;
                    header.min_z = header.max_z = z;
                    
                    LASPoint point;
                    point.x = x;
                    point.y = y;
                    point.z = z;
                    point.r = *rc::gen::inRange<uint8_t>(0, 255);
                    point.g = *rc::gen::inRange<uint8_t>(0, 255);
                    point.b = *rc::gen::inRange<uint8_t>(0, 255);
                    point.intensity = *rc::gen::inRange<uint16_t>(0, 65535);
                    point.classification = *rc::gen::inRange<uint8_t>(0, 31);
                    
                    std::vector<LASPoint> points = {point};
                    std::vector<uint8_t> file_data = createLASFile(header, points);
                    
                    // Parse should succeed
                    auto result = parser.parsePoints(file_data.data(), file_data.size(), header);
                    RC_ASSERT(result.isOk());
                    RC_ASSERT(result.value().size() == 1);
                    break;
                }
                
                default: {
                    // Very small scale factors
                    LASHeader header;
                    header.version_major = 1;
                    header.version_minor = 2;
                    header.point_format = 2;
                    header.point_record_length = 26;
                    header.point_count = 1;
                    // Very small scale factors
                    header.scale_x = *rc::gen::inRange(1, 100) / 1000000.0;
                    header.scale_y = *rc::gen::inRange(1, 100) / 1000000.0;
                    header.scale_z = *rc::gen::inRange(1, 100) / 1000000.0;
                    header.offset_x = 0.0;
                    header.offset_y = 0.0;
                    header.offset_z = 0.0;
                    
                    LASPoint point;
                    point.x = static_cast<float>(*rc::gen::inRange(-100, 100));
                    point.y = static_cast<float>(*rc::gen::inRange(-100, 100));
                    point.z = static_cast<float>(*rc::gen::inRange(-10, 10));
                    point.r = *rc::gen::inRange<uint8_t>(0, 255);
                    point.g = *rc::gen::inRange<uint8_t>(0, 255);
                    point.b = *rc::gen::inRange<uint8_t>(0, 255);
                    point.intensity = *rc::gen::inRange<uint16_t>(0, 65535);
                    point.classification = *rc::gen::inRange<uint8_t>(0, 31);
                    
                    header.min_x = header.max_x = point.x;
                    header.min_y = header.max_y = point.y;
                    header.min_z = header.max_z = point.z;
                    
                    std::vector<LASPoint> points = {point};
                    std::vector<uint8_t> file_data = createLASFile(header, points);
                    
                    // Parse should succeed
                    auto result = parser.parsePoints(file_data.data(), file_data.size(), header);
                    RC_ASSERT(result.isOk());
                    RC_ASSERT(result.value().size() == 1);
                    break;
                }
            }
        });
    
    // Check if the property test succeeded
    REQUIRE(result);
}

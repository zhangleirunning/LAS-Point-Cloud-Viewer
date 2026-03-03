// LAS Parser implementation
// This file will contain the LAS file parsing logic

#include "las_parser.h"
#include <cstring>

// Helper function to read little-endian values
template<typename T>
T readLittleEndian(const uint8_t* data) {
    T value = 0;
    for (size_t i = 0; i < sizeof(T); ++i) {
        value |= static_cast<T>(data[i]) << (i * 8);
    }
    return value;
}

// Helper function to read double from bytes
double readDouble(const uint8_t* data) {
    double value;
    std::memcpy(&value, data, sizeof(double));
    return value;
}

Result<LASHeader, std::string> LASParser::parseHeader(const uint8_t* data, size_t size) {
    // Minimum LAS 1.2 header size is 227 bytes
    if (size < 227) {
        return Result<LASHeader, std::string>::Err("File too small to contain LAS header");
    }
    
    // Validate magic bytes "LASF"
    if (std::memcmp(data, "LASF", 4) != 0) {
        return Result<LASHeader, std::string>::Err("Invalid LAS magic bytes");
    }
    
    LASHeader header;
    
    // Read version (bytes 24-25)
    header.version_major = data[24];
    header.version_minor = data[25];
    
    // Validate version (support 1.2, 1.3, and 1.4)
    if (header.version_major != 1 || (header.version_minor != 2 && header.version_minor != 3 && header.version_minor != 4)) {
        return Result<LASHeader, std::string>::Err(
            "Unsupported LAS version: " + std::to_string(header.version_major) + 
            "." + std::to_string(header.version_minor)
        );
    }
    
    // Read header size (bytes 94-95)
    uint16_t header_size = readLittleEndian<uint16_t>(data + 94);
    if (size < header_size) {
        return Result<LASHeader, std::string>::Err("File smaller than declared header size");
    }
    
    // Read point data format (byte 104)
    header.point_format = data[104];
    
    // Validate point format (we support formats 2, 3, and 6 - all have RGB)
    if (header.point_format != 2 && header.point_format != 3 && header.point_format != 6) {
        return Result<LASHeader, std::string>::Err(
            "Unsupported point format: " + std::to_string(header.point_format) + 
            " (only formats 2, 3, and 6 with RGB are supported)"
        );
    }
    
    // Read point record length (bytes 105-106)
    header.point_record_length = readLittleEndian<uint16_t>(data + 105);
    
    // Read number of point records
    // For LAS 1.4, if the legacy count is 0, use the extended count (bytes 247-254)
    uint32_t legacy_point_count = readLittleEndian<uint32_t>(data + 107);
    
    if (header.version_minor == 4 && legacy_point_count == 0 && header_size >= 375) {
        // LAS 1.4 with extended point count
        uint64_t extended_count = readLittleEndian<uint64_t>(data + 247);
        // Cap at uint32_t max for now (4 billion points)
        header.point_count = (extended_count > 0xFFFFFFFF) ? 0xFFFFFFFF : static_cast<uint32_t>(extended_count);
    } else {
        header.point_count = legacy_point_count;
    }
    
    // Read scale factors (bytes 131-154)
    header.scale_x = readDouble(data + 131);
    header.scale_y = readDouble(data + 139);
    header.scale_z = readDouble(data + 147);
    
    // Read offsets (bytes 155-178)
    header.offset_x = readDouble(data + 155);
    header.offset_y = readDouble(data + 163);
    header.offset_z = readDouble(data + 171);
    
    // Read bounding box (bytes 179-226)
    header.max_x = readDouble(data + 179);
    header.min_x = readDouble(data + 187);
    header.max_y = readDouble(data + 195);
    header.min_y = readDouble(data + 203);
    header.max_z = readDouble(data + 211);
    header.min_z = readDouble(data + 219);
    
    return Result<LASHeader, std::string>::Ok(header);
}

void LASParser::transformCoordinates(int32_t raw_x, int32_t raw_y, int32_t raw_z,
                                     const LASHeader& header,
                                     float& out_x, float& out_y, float& out_z) {
    // Apply LAS coordinate transformation: world_coord = raw_coord * scale + offset
    // Optimized for SIMD-friendly operations (separate operations allow vectorization)
    out_x = static_cast<float>(static_cast<double>(raw_x) * header.scale_x + header.offset_x);
    out_y = static_cast<float>(static_cast<double>(raw_y) * header.scale_y + header.offset_y);
    out_z = static_cast<float>(static_cast<double>(raw_z) * header.scale_z + header.offset_z);
}

LASPoint LASParser::parsePointRecord(const uint8_t* record, const LASHeader& header) {
    LASPoint point;
    
    // Read raw XYZ coordinates (bytes 0-11, 32-bit integers) - same for all formats
    int32_t raw_x = readLittleEndian<int32_t>(record + 0);
    int32_t raw_y = readLittleEndian<int32_t>(record + 4);
    int32_t raw_z = readLittleEndian<int32_t>(record + 8);
    
    // Transform to world coordinates
    transformCoordinates(raw_x, raw_y, raw_z, header, point.x, point.y, point.z);
    
    // Read intensity (bytes 12-13, 16-bit unsigned integer) - same for all formats
    point.intensity = readLittleEndian<uint16_t>(record + 12);
    
    // Read classification - location varies by format
    // Format 2: byte 15
    // Format 3: byte 15  
    // Format 6: byte 16 (LAS 1.4 uses different bit packing)
    if (header.point_format == 6) {
        point.classification = record[16];
    } else {
        point.classification = record[15];
    }
    
    // RGB location varies by format:
    // Format 2: bytes 20-25 (after X,Y,Z,intensity,return,class,angle,user,source)
    // Format 3: bytes 28-33 (after format 1 fields + GPS time)
    // Format 6: bytes 18-23 (LAS 1.4 compact format)
    uint16_t r16, g16, b16;
    
    if (header.point_format == 2) {
        // Format 2: RGB at bytes 20-25
        r16 = readLittleEndian<uint16_t>(record + 20);
        g16 = readLittleEndian<uint16_t>(record + 22);
        b16 = readLittleEndian<uint16_t>(record + 24);
    } else if (header.point_format == 3) {
        // Format 3: GPS time (8 bytes) at 20-27, then RGB at 28-33
        r16 = readLittleEndian<uint16_t>(record + 28);
        g16 = readLittleEndian<uint16_t>(record + 30);
        b16 = readLittleEndian<uint16_t>(record + 32);
    } else if (header.point_format == 6) {
        // Format 6: RGB at bytes 18-23 (LAS 1.4)
        r16 = readLittleEndian<uint16_t>(record + 18);
        g16 = readLittleEndian<uint16_t>(record + 20);
        b16 = readLittleEndian<uint16_t>(record + 22);
    } else {
        // Fallback - shouldn't reach here due to validation
        r16 = g16 = b16 = 0;
    }
    
    // Scale from 16-bit to 8-bit
    point.r = static_cast<uint8_t>(r16 >> 8);
    point.g = static_cast<uint8_t>(g16 >> 8);
    point.b = static_cast<uint8_t>(b16 >> 8);
    
    return point;
}

Result<std::vector<LASPoint>, std::string> LASParser::parsePoints(
    const uint8_t* data, 
    size_t size,
    const LASHeader& header) {
    
    // Calculate offset to point data (after header)
    // For LAS 1.2, header size is typically 227 bytes
    uint32_t point_data_offset = readLittleEndian<uint32_t>(data + 96);
    
    // Validate we have enough data
    size_t required_size = point_data_offset + 
                          (static_cast<size_t>(header.point_count) * header.point_record_length);
    if (size < required_size) {
        return Result<std::vector<LASPoint>, std::string>::Err(
            "File too small to contain all point records"
        );
    }
    
    // Parse all points
    std::vector<LASPoint> points;
    points.reserve(header.point_count);
    
    const uint8_t* point_data = data + point_data_offset;
    
    for (uint32_t i = 0; i < header.point_count; ++i) {
        const uint8_t* record = point_data + (i * header.point_record_length);
        points.push_back(parsePointRecord(record, header));
    }
    
    return Result<std::vector<LASPoint>, std::string>::Ok(std::move(points));
}

#ifndef LAS_PARSER_H
#define LAS_PARSER_H

#include <cstdint>
#include <vector>
#include <string>
#include <optional>
#include <variant>

// Result type for error handling
template<typename T, typename E>
class Result {
public:
    static Result Ok(T value) {
        Result r;
        r.data_ = std::move(value);
        return r;
    }
    
    static Result Err(E error) {
        Result r;
        r.data_ = std::move(error);
        return r;
    }
    
    bool isOk() const { return std::holds_alternative<T>(data_); }
    bool isErr() const { return std::holds_alternative<E>(data_); }
    
    const T& value() const { return std::get<T>(data_); }
    const E& error() const { return std::get<E>(data_); }
    
    T& value() { return std::get<T>(data_); }
    E& error() { return std::get<E>(data_); }

private:
    std::variant<T, E> data_;
};

// LAS file header structure
struct LASHeader {
    uint32_t point_count;
    double min_x, min_y, min_z;
    double max_x, max_y, max_z;
    double scale_x, scale_y, scale_z;
    double offset_x, offset_y, offset_z;
    uint8_t point_format;
    uint16_t point_record_length;
    uint8_t version_major;
    uint8_t version_minor;
};

// LAS point structure
struct LASPoint {
    float x, y, z;           // World coordinates
    uint8_t r, g, b;         // RGB color
    uint16_t intensity;      // Intensity value
    uint8_t classification;  // Point classification
};

// LAS Parser class
class LASParser {
public:
    // Parse LAS file header from memory buffer
    Result<LASHeader, std::string> parseHeader(const uint8_t* data, size_t size);
    
    // Extract all points from file
    Result<std::vector<LASPoint>, std::string> parsePoints(
        const uint8_t* data, 
        size_t size,
        const LASHeader& header
    );

private:
    // Apply coordinate scaling and offset transformations
    void transformCoordinates(int32_t raw_x, int32_t raw_y, int32_t raw_z,
                             const LASHeader& header,
                             float& out_x, float& out_y, float& out_z);
    
    // Parse point based on format type
    LASPoint parsePointRecord(const uint8_t* record, const LASHeader& header);
};

#endif // LAS_PARSER_H

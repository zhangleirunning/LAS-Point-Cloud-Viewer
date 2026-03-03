/**
 * @file las_parser.h
 * @brief LAS (LASer) point cloud file format parser
 * 
 * This module provides functionality for parsing LAS format files, which are
 * the industry standard for storing LiDAR point cloud data. The parser supports
 * LAS versions 1.2, 1.3, and 1.4 with RGB color data (point formats 2, 3, and 6).
 * 
 * The LAS format consists of:
 * - Public Header Block: Metadata about the file and point cloud
 * - Variable Length Records (optional): Additional metadata
 * - Point Data Records: Array of point records with XYZ coordinates and attributes
 * 
 * Key features:
 * - Validates file format and version
 * - Extracts point coordinates with scale/offset transformation
 * - Extracts RGB colors, intensity, and classification data
 * - Robust error handling with descriptive error messages
 */

#ifndef LAS_PARSER_H
#define LAS_PARSER_H

#include <cstdint>
#include <vector>
#include <string>
#include <optional>
#include <variant>

/**
 * @brief Result type for error handling using Modern C++ idioms
 * 
 * This is a Rust-inspired Result type that represents either a successful value (Ok)
 * or an error (Err). It provides type-safe error handling without exceptions.
 * 
 * @tparam T The type of the success value
 * @tparam E The type of the error value (typically std::string)
 * 
 * Example usage:
 * @code
 * Result<int, std::string> divide(int a, int b) {
 *     if (b == 0) return Result::Err("Division by zero");
 *     return Result::Ok(a / b);
 * }
 * 
 * auto result = divide(10, 2);
 * if (result.isOk()) {
 *     std::cout << "Result: " << result.value() << std::endl;
 * } else {
 *     std::cerr << "Error: " << result.error() << std::endl;
 * }
 * @endcode
 */
template<typename T, typename E>
class Result {
public:
    /**
     * @brief Create a successful Result containing a value
     * @param value The success value to wrap
     * @return Result containing the value
     */
    static Result Ok(T value) {
        Result r;
        r.data_ = std::move(value);
        return r;
    }
    
    /**
     * @brief Create an error Result containing an error
     * @param error The error value to wrap
     * @return Result containing the error
     */
    static Result Err(E error) {
        Result r;
        r.data_ = std::move(error);
        return r;
    }
    
    /** @brief Check if this Result contains a success value */
    bool isOk() const { return std::holds_alternative<T>(data_); }
    
    /** @brief Check if this Result contains an error */
    bool isErr() const { return std::holds_alternative<E>(data_); }
    
    /** @brief Get the success value (const). Undefined behavior if isErr() */
    const T& value() const { return std::get<T>(data_); }
    
    /** @brief Get the error value (const). Undefined behavior if isOk() */
    const E& error() const { return std::get<E>(data_); }
    
    /** @brief Get the success value (mutable). Undefined behavior if isErr() */
    T& value() { return std::get<T>(data_); }
    
    /** @brief Get the error value (mutable). Undefined behavior if isOk() */
    E& error() { return std::get<E>(data_); }

private:
    std::variant<T, E> data_;
};

/**
 * @brief LAS file header structure containing metadata
 * 
 * The header contains essential information about the point cloud including:
 * - Total point count
 * - Bounding box (min/max XYZ coordinates)
 * - Scale and offset for coordinate transformation
 * - Point format and record length
 * - File version information
 * 
 * Coordinate transformation formula:
 *   world_coord = (raw_integer_coord * scale) + offset
 */
struct LASHeader {
    uint32_t point_count;           ///< Total number of point records in the file
    double min_x, min_y, min_z;     ///< Minimum XYZ coordinates (bounding box)
    double max_x, max_y, max_z;     ///< Maximum XYZ coordinates (bounding box)
    double scale_x, scale_y, scale_z;   ///< Scale factors for coordinate transformation
    double offset_x, offset_y, offset_z; ///< Offset values for coordinate transformation
    uint8_t point_format;           ///< Point data format (2, 3, or 6 supported)
    uint16_t point_record_length;   ///< Size of each point record in bytes
    uint8_t version_major;          ///< LAS format major version (1)
    uint8_t version_minor;          ///< LAS format minor version (2, 3, or 4)
};

/**
 * @brief LAS point structure containing position and attributes
 * 
 * Represents a single point in the point cloud with:
 * - 3D position in world coordinates (after scale/offset transformation)
 * - RGB color values (8-bit per channel)
 * - Intensity value (16-bit, represents return signal strength)
 * - Classification code (ground, vegetation, building, etc.)
 */
struct LASPoint {
    float x, y, z;           ///< World coordinates (meters or feet, depending on file)
    uint8_t r, g, b;         ///< RGB color (0-255 per channel)
    uint16_t intensity;      ///< Return signal intensity (0-65535)
    uint8_t classification;  ///< Point classification code (ASPRS standard)
};

/**
 * @brief LAS file parser class
 * 
 * Provides methods to parse LAS format files and extract point cloud data.
 * The parser validates file format, reads metadata, and extracts point records
 * with proper coordinate transformation.
 * 
 * Supported LAS versions: 1.2, 1.3, 1.4
 * Supported point formats: 2 (RGB), 3 (RGB + GPS time), 6 (LAS 1.4 RGB)
 * 
 * Usage example:
 * @code
 * LASParser parser;
 * auto header_result = parser.parseHeader(data, size);
 * if (header_result.isOk()) {
 *     const LASHeader& header = header_result.value();
 *     auto points_result = parser.parsePoints(data, size, header);
 *     if (points_result.isOk()) {
 *         const std::vector<LASPoint>& points = points_result.value();
 *         // Use points...
 *     }
 * }
 * @endcode
 */
class LASParser {
public:
    /**
     * @brief Parse LAS file header from memory buffer
     * 
     * Reads and validates the LAS file header, extracting metadata including:
     * - File version and format
     * - Point count and bounding box
     * - Scale and offset parameters
     * - Point format and record length
     * 
     * @param data Pointer to LAS file data in memory
     * @param size Size of the data buffer in bytes
     * @return Result containing LASHeader on success, or error message on failure
     * 
     * Error conditions:
     * - File too small (< 227 bytes minimum header size)
     * - Invalid magic bytes (not "LASF")
     * - Unsupported version or point format
     * - Corrupted or truncated header
     */
    Result<LASHeader, std::string> parseHeader(const uint8_t* data, size_t size);
    
    /**
     * @brief Extract all points from LAS file
     * 
     * Parses all point records from the file, applying coordinate transformation
     * and extracting all attributes (position, color, intensity, classification).
     * 
     * @param data Pointer to LAS file data in memory
     * @param size Size of the data buffer in bytes
     * @param header Previously parsed header (from parseHeader)
     * @return Result containing vector of LASPoint on success, or error message on failure
     * 
     * Error conditions:
     * - File too small to contain all declared points
     * - Invalid point data offset
     * 
     * @note This method allocates memory for all points. For large files (>10M points),
     *       ensure sufficient memory is available.
     */
    Result<std::vector<LASPoint>, std::string> parsePoints(
        const uint8_t* data, 
        size_t size,
        const LASHeader& header
    );
    
    /**
     * @brief Apply LAS coordinate transformation
     * 
     * Converts raw integer coordinates from the LAS file to world coordinates
     * using the scale and offset parameters from the header.
     * 
     * Formula: world_coord = (raw_coord * scale) + offset
     * 
     * @param raw_x Raw X coordinate (32-bit integer from file)
     * @param raw_y Raw Y coordinate (32-bit integer from file)
     * @param raw_z Raw Z coordinate (32-bit integer from file)
     * @param header LAS header containing scale and offset parameters
     * @param out_x Output world X coordinate (float)
     * @param out_y Output world Y coordinate (float)
     * @param out_z Output world Z coordinate (float)
     * 
     * @note Made public for testing purposes. Normally called internally by parsePoints.
     * @note Uses double precision for intermediate calculations to maintain accuracy.
     */
    void transformCoordinates(int32_t raw_x, int32_t raw_y, int32_t raw_z,
                             const LASHeader& header,
                             float& out_x, float& out_y, float& out_z);

private:
    /**
     * @brief Parse a single point record
     * 
     * Extracts data from a single point record based on the point format.
     * Handles different point formats (2, 3, 6) with varying field layouts.
     * 
     * @param record Pointer to the start of the point record
     * @param header LAS header containing format information
     * @return Parsed LASPoint with all attributes
     */
    LASPoint parsePointRecord(const uint8_t* record, const LASHeader& header);
};

#endif // LAS_PARSER_H

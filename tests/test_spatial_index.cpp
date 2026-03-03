#include <catch2/catch_test_macros.hpp>
#include <rapidcheck.h>
#include "../src/spatial_index.h"
#include <vector>
#include <set>
#include <functional>

// Helper function to create test points
std::vector<LASPoint> createTestPoints(size_t count) {
    std::vector<LASPoint> points;
    points.reserve(count);
    
    for (size_t i = 0; i < count; ++i) {
        LASPoint p;
        p.x = static_cast<float>(i % 10);
        p.y = static_cast<float>((i / 10) % 10);
        p.z = static_cast<float>(i / 100);
        p.r = p.g = p.b = 255;
        p.intensity = 1000;
        p.classification = 1;
        points.push_back(p);
    }
    
    return points;
}

TEST_CASE("Frustum intersection with axis-aligned box", "[spatial_index]") {
    // Create a simple box-shaped frustum: x in [0, 10], y in [0, 10], z in [0, 10]
    Frustum frustum;
    
    // Left plane: x >= 0
    frustum.planes[0][0] = 1.0f;
    frustum.planes[0][1] = 0.0f;
    frustum.planes[0][2] = 0.0f;
    frustum.planes[0][3] = 0.0f;
    
    // Right plane: x <= 10
    frustum.planes[1][0] = -1.0f;
    frustum.planes[1][1] = 0.0f;
    frustum.planes[1][2] = 0.0f;
    frustum.planes[1][3] = 10.0f;
    
    // Bottom plane: y >= 0
    frustum.planes[2][0] = 0.0f;
    frustum.planes[2][1] = 1.0f;
    frustum.planes[2][2] = 0.0f;
    frustum.planes[2][3] = 0.0f;
    
    // Top plane: y <= 10
    frustum.planes[3][0] = 0.0f;
    frustum.planes[3][1] = -1.0f;
    frustum.planes[3][2] = 0.0f;
    frustum.planes[3][3] = 10.0f;
    
    // Near plane: z >= 0
    frustum.planes[4][0] = 0.0f;
    frustum.planes[4][1] = 0.0f;
    frustum.planes[4][2] = 1.0f;
    frustum.planes[4][3] = 0.0f;
    
    // Far plane: z <= 10
    frustum.planes[5][0] = 0.0f;
    frustum.planes[5][1] = 0.0f;
    frustum.planes[5][2] = -1.0f;
    frustum.planes[5][3] = 10.0f;
    
    // Box completely inside frustum
    BoundingBox inside{2.0f, 2.0f, 2.0f, 8.0f, 8.0f, 8.0f};
    REQUIRE(frustum.intersects(inside));
    
    // Box completely outside frustum (to the left)
    BoundingBox outside_left{-20.0f, 2.0f, 2.0f, -10.0f, 8.0f, 8.0f};
    REQUIRE_FALSE(frustum.intersects(outside_left));
    
    // Box completely outside frustum (to the right)
    BoundingBox outside_right{20.0f, 2.0f, 2.0f, 30.0f, 8.0f, 8.0f};
    REQUIRE_FALSE(frustum.intersects(outside_right));
    
    // Box completely outside frustum (below)
    BoundingBox outside_below{2.0f, -20.0f, 2.0f, 8.0f, -10.0f, 8.0f};
    REQUIRE_FALSE(frustum.intersects(outside_below));
    
    // Box completely outside frustum (above)
    BoundingBox outside_above{2.0f, 20.0f, 2.0f, 8.0f, 30.0f, 8.0f};
    REQUIRE_FALSE(frustum.intersects(outside_above));
    
    // Box completely outside frustum (in front)
    BoundingBox outside_front{2.0f, 2.0f, -20.0f, 8.0f, 8.0f, -10.0f};
    REQUIRE_FALSE(frustum.intersects(outside_front));
    
    // Box completely outside frustum (behind)
    BoundingBox outside_back{2.0f, 2.0f, 20.0f, 8.0f, 8.0f, 30.0f};
    REQUIRE_FALSE(frustum.intersects(outside_back));
    
    // Box partially overlapping frustum
    BoundingBox overlapping{-5.0f, -5.0f, -5.0f, 5.0f, 5.0f, 5.0f};
    REQUIRE(frustum.intersects(overlapping));
}

TEST_CASE("Simple spatial query test", "[spatial_index]") {
    // Create a few points in known locations
    std::vector<LASPoint> points;
    
    // Point inside query region
    LASPoint p1{5.0f, 5.0f, 5.0f, 255, 255, 255, 1000, 1};
    points.push_back(p1);
    
    // Point outside query region (z too large)
    LASPoint p2{5.0f, 5.0f, 50.0f, 255, 255, 255, 1000, 1};
    points.push_back(p2);
    
    // Build spatial index
    SpatialIndex index;
    index.build(points);
    
    // Create frustum for query region: x in [0, 10], y in [0, 10], z in [0, 10]
    Frustum frustum;
    frustum.planes[0][0] = 1.0f; frustum.planes[0][1] = 0.0f; frustum.planes[0][2] = 0.0f; frustum.planes[0][3] = 0.0f;
    frustum.planes[1][0] = -1.0f; frustum.planes[1][1] = 0.0f; frustum.planes[1][2] = 0.0f; frustum.planes[1][3] = 10.0f;
    frustum.planes[2][0] = 0.0f; frustum.planes[2][1] = 1.0f; frustum.planes[2][2] = 0.0f; frustum.planes[2][3] = 0.0f;
    frustum.planes[3][0] = 0.0f; frustum.planes[3][1] = -1.0f; frustum.planes[3][2] = 0.0f; frustum.planes[3][3] = 10.0f;
    frustum.planes[4][0] = 0.0f; frustum.planes[4][1] = 0.0f; frustum.planes[4][2] = 1.0f; frustum.planes[4][3] = 0.0f;
    frustum.planes[5][0] = 0.0f; frustum.planes[5][1] = 0.0f; frustum.planes[5][2] = -1.0f; frustum.planes[5][3] = 10.0f;
    
    // Query
    std::vector<uint32_t> results = index.queryFrustum(frustum);
    
    // Should only return point 0 (p1)
    REQUIRE(results.size() == 1);
    REQUIRE(results[0] == 0);
    
    // Verify the returned point is actually inside
    const LASPoint& returned = points[results[0]];
    REQUIRE(returned.x >= 0.0f);
    REQUIRE(returned.x <= 10.0f);
    REQUIRE(returned.y >= 0.0f);
    REQUIRE(returned.y <= 10.0f);
    REQUIRE(returned.z >= 0.0f);
    REQUIRE(returned.z <= 10.0f);
}

TEST_CASE("BoundingBox contains point", "[spatial_index]") {
    BoundingBox box{0.0f, 0.0f, 0.0f, 10.0f, 10.0f, 10.0f};
    
    REQUIRE(box.contains(5.0f, 5.0f, 5.0f));
    REQUIRE(box.contains(0.0f, 0.0f, 0.0f));
    REQUIRE(box.contains(10.0f, 10.0f, 10.0f));
    REQUIRE_FALSE(box.contains(-1.0f, 5.0f, 5.0f));
    REQUIRE_FALSE(box.contains(5.0f, 11.0f, 5.0f));
    REQUIRE_FALSE(box.contains(5.0f, 5.0f, 15.0f));
}

TEST_CASE("BoundingBox intersection", "[spatial_index]") {
    BoundingBox box1{0.0f, 0.0f, 0.0f, 10.0f, 10.0f, 10.0f};
    BoundingBox box2{5.0f, 5.0f, 5.0f, 15.0f, 15.0f, 15.0f};
    BoundingBox box3{20.0f, 20.0f, 20.0f, 30.0f, 30.0f, 30.0f};
    
    REQUIRE(box1.intersects(box2));
    REQUIRE(box2.intersects(box1));
    REQUIRE_FALSE(box1.intersects(box3));
    REQUIRE_FALSE(box3.intersects(box1));
}

TEST_CASE("BoundingBox center calculation", "[spatial_index]") {
    BoundingBox box{0.0f, 0.0f, 0.0f, 10.0f, 20.0f, 30.0f};
    float cx, cy, cz;
    box.getCenter(cx, cy, cz);
    
    REQUIRE(cx == 5.0f);
    REQUIRE(cy == 10.0f);
    REQUIRE(cz == 15.0f);
}

TEST_CASE("SpatialIndex builds from empty point cloud", "[spatial_index]") {
    std::vector<LASPoint> points;
    SpatialIndex index;
    
    index.build(points);
    
    REQUIRE(index.getRoot() == nullptr);
}

TEST_CASE("SpatialIndex builds from single point", "[spatial_index]") {
    std::vector<LASPoint> points = createTestPoints(1);
    SpatialIndex index;
    
    index.build(points);
    
    REQUIRE(index.getRoot() != nullptr);
    REQUIRE(index.getRoot()->isLeaf());
    REQUIRE(index.getRoot()->point_indices.size() == 1);
}

// Edge case tests for Requirement 12.5

TEST_CASE("Edge case: Empty point cloud", "[spatial_index][edge_cases]") {
    std::vector<LASPoint> points;
    SpatialIndex index;
    
    // Should handle empty point cloud gracefully
    REQUIRE_NOTHROW(index.build(points));
    
    // Root should be null for empty point cloud
    REQUIRE(index.getRoot() == nullptr);
    
    // Bounds should be zero/empty
    BoundingBox bounds = index.getBounds();
    REQUIRE(bounds.min_x == 0.0f);
    REQUIRE(bounds.max_x == 0.0f);
    REQUIRE(bounds.min_y == 0.0f);
    REQUIRE(bounds.max_y == 0.0f);
    REQUIRE(bounds.min_z == 0.0f);
    REQUIRE(bounds.max_z == 0.0f);
}

TEST_CASE("Edge case: Single point", "[spatial_index][edge_cases]") {
    std::vector<LASPoint> points;
    LASPoint p{5.0f, 10.0f, 15.0f, 255, 128, 64, 1000, 2};
    points.push_back(p);
    
    SpatialIndex index;
    
    // Should handle single point gracefully
    REQUIRE_NOTHROW(index.build(points));
    
    // Root should exist and be a leaf
    REQUIRE(index.getRoot() != nullptr);
    REQUIRE(index.getRoot()->isLeaf());
    
    // Should contain exactly one point
    REQUIRE(index.getRoot()->point_indices.size() == 1);
    REQUIRE(index.getRoot()->point_indices[0] == 0);
    
    // Bounding box should be tight around the single point
    BoundingBox bounds = index.getBounds();
    REQUIRE(bounds.min_x == 5.0f);
    REQUIRE(bounds.max_x == 5.0f);
    REQUIRE(bounds.min_y == 10.0f);
    REQUIRE(bounds.max_y == 10.0f);
    REQUIRE(bounds.min_z == 15.0f);
    REQUIRE(bounds.max_z == 15.0f);
    
    // Bounding box should contain the point
    REQUIRE(bounds.contains(p.x, p.y, p.z));
}

TEST_CASE("Edge case: All points at same location", "[spatial_index][edge_cases]") {
    std::vector<LASPoint> points;
    
    // Create 100 points all at the same location
    for (int i = 0; i < 100; ++i) {
        LASPoint p{10.0f, 20.0f, 30.0f, 
                   static_cast<uint8_t>(i % 256), 
                   static_cast<uint8_t>((i * 2) % 256), 
                   static_cast<uint8_t>((i * 3) % 256), 
                   static_cast<uint16_t>(1000 + i), 
                   static_cast<uint8_t>(i % 10)};
        points.push_back(p);
    }
    
    SpatialIndex index;
    
    // Should handle degenerate case gracefully
    REQUIRE_NOTHROW(index.build(points));
    
    // Root should exist
    REQUIRE(index.getRoot() != nullptr);
    
    // Should be a leaf node (cannot subdivide points at same location)
    REQUIRE(index.getRoot()->isLeaf());
    
    // Should contain all 100 points
    REQUIRE(index.getRoot()->point_indices.size() == 100);
    
    // Bounding box should be degenerate (zero volume)
    BoundingBox bounds = index.getBounds();
    REQUIRE(bounds.min_x == 10.0f);
    REQUIRE(bounds.max_x == 10.0f);
    REQUIRE(bounds.min_y == 20.0f);
    REQUIRE(bounds.max_y == 20.0f);
    REQUIRE(bounds.min_z == 30.0f);
    REQUIRE(bounds.max_z == 30.0f);
    
    // All points should be contained
    for (const auto& point : points) {
        REQUIRE(bounds.contains(point.x, point.y, point.z));
    }
    
    // Verify all point indices are present
    std::set<uint32_t> indices_set(index.getRoot()->point_indices.begin(), 
                                    index.getRoot()->point_indices.end());
    REQUIRE(indices_set.size() == 100);
    for (uint32_t i = 0; i < 100; ++i) {
        REQUIRE(indices_set.count(i) == 1);
    }
}

TEST_CASE("SpatialIndex builds from small point cloud", "[spatial_index]") {
    std::vector<LASPoint> points = createTestPoints(100);
    SpatialIndex index;
    
    index.build(points);
    
    REQUIRE(index.getRoot() != nullptr);
    REQUIRE(index.getRoot()->isLeaf());  // Should be leaf since < 1000 points
    REQUIRE(index.getRoot()->point_indices.size() == 100);
}

TEST_CASE("SpatialIndex subdivides large point cloud", "[spatial_index]") {
    std::vector<LASPoint> points = createTestPoints(2000);
    SpatialIndex index;
    
    index.build(points);
    
    REQUIRE(index.getRoot() != nullptr);
    REQUIRE_FALSE(index.getRoot()->isLeaf());  // Should subdivide since > 1000 points
    
    // Check that at least one child exists
    bool has_child = false;
    for (const auto& child : index.getRoot()->children) {
        if (child != nullptr) {
            has_child = true;
            break;
        }
    }
    REQUIRE(has_child);
}

TEST_CASE("SpatialIndex calculates correct bounds", "[spatial_index]") {
    std::vector<LASPoint> points;
    
    LASPoint p1{0.0f, 0.0f, 0.0f, 255, 255, 255, 1000, 1};
    LASPoint p2{10.0f, 20.0f, 30.0f, 255, 255, 255, 1000, 1};
    LASPoint p3{5.0f, 10.0f, 15.0f, 255, 255, 255, 1000, 1};
    
    points.push_back(p1);
    points.push_back(p2);
    points.push_back(p3);
    
    SpatialIndex index;
    index.build(points);
    
    BoundingBox bounds = index.getBounds();
    
    REQUIRE(bounds.min_x == 0.0f);
    REQUIRE(bounds.max_x == 10.0f);
    REQUIRE(bounds.min_y == 0.0f);
    REQUIRE(bounds.max_y == 20.0f);
    REQUIRE(bounds.min_z == 0.0f);
    REQUIRE(bounds.max_z == 30.0f);
}

TEST_CASE("SpatialIndex respects max depth", "[spatial_index]") {
    // Create a large point cloud
    std::vector<LASPoint> points = createTestPoints(10000);
    SpatialIndex index;
    
    // Build with max depth of 2
    index.build(points, 2);
    
    REQUIRE(index.getRoot() != nullptr);
    
    // Verify no node exceeds depth 2
    std::function<void(const OctreeNode*, uint32_t)> checkDepth;
    checkDepth = [&](const OctreeNode* node, uint32_t max_allowed_depth) {
        REQUIRE(node->depth <= max_allowed_depth);
        for (const auto& child : node->children) {
            if (child != nullptr) {
                checkDepth(child.get(), max_allowed_depth);
            }
        }
    };
    
    checkDepth(index.getRoot(), 2);
}

// Feature: las-point-cloud-viewer, Property 20: Bounding Box Containment
// For any set of points, the calculated bounding box should contain all points, 
// and no smaller axis-aligned box should contain all points (tightness property).
TEST_CASE("Property 20: Bounding Box Containment", "[spatial_index][property]") {
    // Run property-based test with 100 iterations
    const bool result = rc::check("bounding box contains all points and is tight", []() {
        // Generate random number of points (reasonable range for testing)
        uint32_t point_count = *rc::gen::inRange<uint32_t>(1, 1000);
        
        // Generate random points
        std::vector<LASPoint> points;
        points.reserve(point_count);
        
        for (uint32_t i = 0; i < point_count; ++i) {
            LASPoint point;
            // Use integer ranges and convert to float
            point.x = static_cast<float>(*rc::gen::inRange(-1000, 1000));
            point.y = static_cast<float>(*rc::gen::inRange(-1000, 1000));
            point.z = static_cast<float>(*rc::gen::inRange(-1000, 1000));
            point.r = *rc::gen::inRange<uint8_t>(0, 255);
            point.g = *rc::gen::inRange<uint8_t>(0, 255);
            point.b = *rc::gen::inRange<uint8_t>(0, 255);
            point.intensity = *rc::gen::inRange<uint16_t>(0, 65535);
            point.classification = *rc::gen::inRange<uint8_t>(0, 31);
            points.push_back(point);
        }
        
        // Build spatial index to get bounding box
        SpatialIndex index;
        index.build(points);
        
        BoundingBox bounds = index.getBounds();
        
        // Property 1: All points must be contained in the bounding box
        for (const LASPoint& point : points) {
            RC_ASSERT(bounds.contains(point.x, point.y, point.z));
        }
        
        // Property 2: Tightness - the bounding box should be minimal
        // This means at least one point should touch each boundary
        // Find the actual min/max values from the points
        float actual_min_x = points[0].x;
        float actual_max_x = points[0].x;
        float actual_min_y = points[0].y;
        float actual_max_y = points[0].y;
        float actual_min_z = points[0].z;
        float actual_max_z = points[0].z;
        
        for (const LASPoint& point : points) {
            actual_min_x = std::min(actual_min_x, point.x);
            actual_max_x = std::max(actual_max_x, point.x);
            actual_min_y = std::min(actual_min_y, point.y);
            actual_max_y = std::max(actual_max_y, point.y);
            actual_min_z = std::min(actual_min_z, point.z);
            actual_max_z = std::max(actual_max_z, point.z);
        }
        
        // The calculated bounding box should match the actual tight bounds
        const float epsilon = 0.0001f;
        RC_ASSERT(std::abs(bounds.min_x - actual_min_x) < epsilon);
        RC_ASSERT(std::abs(bounds.max_x - actual_max_x) < epsilon);
        RC_ASSERT(std::abs(bounds.min_y - actual_min_y) < epsilon);
        RC_ASSERT(std::abs(bounds.max_y - actual_max_y) < epsilon);
        RC_ASSERT(std::abs(bounds.min_z - actual_min_z) < epsilon);
        RC_ASSERT(std::abs(bounds.max_z - actual_max_z) < epsilon);
    });
    
    // Check if the property test succeeded
    REQUIRE(result);
}

// Feature: las-point-cloud-viewer, Property 8: Spatial Query Correctness
// For any bounding box or frustum query, all returned points should be within the 
// query region, and no points within the query region should be missing (assuming no LOD filtering).
TEST_CASE("Property 8: Spatial Query Correctness", "[spatial_index][property]") {
    // Run property-based test with 100 iterations
    const bool result = rc::check("spatial query returns all and only points within frustum", []() {
        // Generate random number of points (reasonable range for testing)
        uint32_t point_count = *rc::gen::inRange<uint32_t>(10, 2000);
        
        // Generate random points in a known space
        std::vector<LASPoint> points;
        points.reserve(point_count);
        
        for (uint32_t i = 0; i < point_count; ++i) {
            LASPoint point;
            // Use integer ranges and convert to float
            point.x = static_cast<float>(*rc::gen::inRange(-500, 500));
            point.y = static_cast<float>(*rc::gen::inRange(-500, 500));
            point.z = static_cast<float>(*rc::gen::inRange(-500, 500));
            point.r = *rc::gen::inRange<uint8_t>(0, 255);
            point.g = *rc::gen::inRange<uint8_t>(0, 255);
            point.b = *rc::gen::inRange<uint8_t>(0, 255);
            point.intensity = *rc::gen::inRange<uint16_t>(0, 65535);
            point.classification = *rc::gen::inRange<uint8_t>(0, 31);
            points.push_back(point);
        }
        
        // Build spatial index
        SpatialIndex index;
        index.build(points);
        
        // Generate a random frustum that intersects the point cloud
        // For simplicity, we'll create a frustum from a bounding box subset
        BoundingBox cloud_bounds = index.getBounds();
        
        // Create a query region within or overlapping the point cloud
        float query_min_x = static_cast<float>(*rc::gen::inRange(-600, 400));
        float query_max_x = query_min_x + static_cast<float>(*rc::gen::inRange(50, 500));
        float query_min_y = static_cast<float>(*rc::gen::inRange(-600, 400));
        float query_max_y = query_min_y + static_cast<float>(*rc::gen::inRange(50, 500));
        float query_min_z = static_cast<float>(*rc::gen::inRange(-600, 400));
        float query_max_z = query_min_z + static_cast<float>(*rc::gen::inRange(50, 500));
        
        // Create a frustum that represents this bounding box
        // We'll use axis-aligned planes to create a box-shaped frustum
        // Plane equation: ax + by + cz + d = 0
        // For frustum culling, we want the normal to point INWARD
        // A point is inside if distance to plane >= 0
        Frustum frustum;
        
        // Left plane: x >= query_min_x
        // Normal points right (+X), so points with x >= query_min_x have positive distance
        // Plane: 1*x + 0*y + 0*z - query_min_x >= 0
        frustum.planes[0][0] = 1.0f;
        frustum.planes[0][1] = 0.0f;
        frustum.planes[0][2] = 0.0f;
        frustum.planes[0][3] = -query_min_x;
        
        // Right plane: x <= query_max_x
        // Normal points left (-X), so points with x <= query_max_x have positive distance
        // Plane: -1*x + 0*y + 0*z + query_max_x >= 0
        frustum.planes[1][0] = -1.0f;
        frustum.planes[1][1] = 0.0f;
        frustum.planes[1][2] = 0.0f;
        frustum.planes[1][3] = query_max_x;
        
        // Bottom plane: y >= query_min_y
        // Normal points up (+Y)
        frustum.planes[2][0] = 0.0f;
        frustum.planes[2][1] = 1.0f;
        frustum.planes[2][2] = 0.0f;
        frustum.planes[2][3] = -query_min_y;
        
        // Top plane: y <= query_max_y
        // Normal points down (-Y)
        frustum.planes[3][0] = 0.0f;
        frustum.planes[3][1] = -1.0f;
        frustum.planes[3][2] = 0.0f;
        frustum.planes[3][3] = query_max_y;
        
        // Near plane: z >= query_min_z
        // Normal points forward (+Z)
        frustum.planes[4][0] = 0.0f;
        frustum.planes[4][1] = 0.0f;
        frustum.planes[4][2] = 1.0f;
        frustum.planes[4][3] = -query_min_z;
        
        // Far plane: z <= query_max_z
        // Normal points backward (-Z)
        frustum.planes[5][0] = 0.0f;
        frustum.planes[5][1] = 0.0f;
        frustum.planes[5][2] = -1.0f;
        frustum.planes[5][3] = query_max_z;
        
        // Query the spatial index
        std::vector<uint32_t> result_indices = index.queryFrustum(frustum);
        
        // Build a set of returned indices for fast lookup
        std::set<uint32_t> returned_set(result_indices.begin(), result_indices.end());
        
        // Manually determine which points should be in the query region
        std::set<uint32_t> expected_set;
        for (uint32_t i = 0; i < points.size(); ++i) {
            const LASPoint& point = points[i];
            
            // Check if point is within the query box
            if (point.x >= query_min_x && point.x <= query_max_x &&
                point.y >= query_min_y && point.y <= query_max_y &&
                point.z >= query_min_z && point.z <= query_max_z) {
                expected_set.insert(i);
            }
        }
        
        // Property 1: All returned points should be within the query region
        for (uint32_t idx : result_indices) {
            RC_ASSERT(idx < points.size());
            const LASPoint& point = points[idx];
            
            // Verify point is within query bounds
            RC_ASSERT(point.x >= query_min_x && point.x <= query_max_x);
            RC_ASSERT(point.y >= query_min_y && point.y <= query_max_y);
            RC_ASSERT(point.z >= query_min_z && point.z <= query_max_z);
        }
        
        // Property 2: No points within the query region should be missing
        // (All expected points should be in the result)
        for (uint32_t expected_idx : expected_set) {
            RC_ASSERT(returned_set.count(expected_idx) == 1);
        }
        
        // Property 3: The sets should be identical (completeness and correctness)
        RC_ASSERT(returned_set.size() == expected_set.size());
        RC_ASSERT(returned_set == expected_set);
    });
    
    // Check if the property test succeeded
    REQUIRE(result);
}

// Feature: las-point-cloud-viewer, Property 10: LOD Distance Relationship
// For any two camera positions at different distances from the same region, the query 
// at greater distance should return fewer or equal points than the query at closer distance.
TEST_CASE("Property 10: LOD Distance Relationship", "[spatial_index][property]") {
    // Run property-based test with 100 iterations
    const bool result = rc::check("greater distance returns fewer or equal points", []() {
        // Generate random number of points (reasonable range for testing)
        uint32_t point_count = *rc::gen::inRange<uint32_t>(500, 5000);
        
        // Generate random points in a known space
        std::vector<LASPoint> points;
        points.reserve(point_count);
        
        for (uint32_t i = 0; i < point_count; ++i) {
            LASPoint point;
            // Use integer ranges and convert to float
            point.x = static_cast<float>(*rc::gen::inRange(-500, 500));
            point.y = static_cast<float>(*rc::gen::inRange(-500, 500));
            point.z = static_cast<float>(*rc::gen::inRange(-500, 500));
            point.r = *rc::gen::inRange<uint8_t>(0, 255);
            point.g = *rc::gen::inRange<uint8_t>(0, 255);
            point.b = *rc::gen::inRange<uint8_t>(0, 255);
            point.intensity = *rc::gen::inRange<uint16_t>(0, 65535);
            point.classification = *rc::gen::inRange<uint8_t>(0, 31);
            points.push_back(point);
        }
        
        // Build spatial index
        SpatialIndex index;
        index.build(points);
        
        // Get the actual bounds of the point cloud
        BoundingBox cloud_bounds = index.getBounds();
        
        // Create a query region that definitely overlaps with the point cloud
        // Use the center of the cloud and create a box around it
        float center_x = (cloud_bounds.min_x + cloud_bounds.max_x) * 0.5f;
        float center_y = (cloud_bounds.min_y + cloud_bounds.max_y) * 0.5f;
        float center_z = (cloud_bounds.min_z + cloud_bounds.max_z) * 0.5f;
        
        // Create a box that covers a significant portion of the cloud
        float half_size = std::min({
            (cloud_bounds.max_x - cloud_bounds.min_x) * 0.4f,
            (cloud_bounds.max_y - cloud_bounds.min_y) * 0.4f,
            (cloud_bounds.max_z - cloud_bounds.min_z) * 0.4f
        });
        
        float query_min_x = center_x - half_size;
        float query_max_x = center_x + half_size;
        float query_min_y = center_y - half_size;
        float query_max_y = center_y + half_size;
        float query_min_z = center_z - half_size;
        float query_max_z = center_z + half_size;
        
        // Create a frustum that represents this bounding box
        Frustum frustum;
        
        // Left plane: x >= query_min_x
        frustum.planes[0][0] = 1.0f;
        frustum.planes[0][1] = 0.0f;
        frustum.planes[0][2] = 0.0f;
        frustum.planes[0][3] = -query_min_x;
        
        // Right plane: x <= query_max_x
        frustum.planes[1][0] = -1.0f;
        frustum.planes[1][1] = 0.0f;
        frustum.planes[1][2] = 0.0f;
        frustum.planes[1][3] = query_max_x;
        
        // Bottom plane: y >= query_min_y
        frustum.planes[2][0] = 0.0f;
        frustum.planes[2][1] = 1.0f;
        frustum.planes[2][2] = 0.0f;
        frustum.planes[2][3] = -query_min_y;
        
        // Top plane: y <= query_max_y
        frustum.planes[3][0] = 0.0f;
        frustum.planes[3][1] = -1.0f;
        frustum.planes[3][2] = 0.0f;
        frustum.planes[3][3] = query_max_y;
        
        // Near plane: z >= query_min_z
        frustum.planes[4][0] = 0.0f;
        frustum.planes[4][1] = 0.0f;
        frustum.planes[4][2] = 1.0f;
        frustum.planes[4][3] = -query_min_z;
        
        // Far plane: z <= query_max_z
        frustum.planes[5][0] = 0.0f;
        frustum.planes[5][1] = 0.0f;
        frustum.planes[5][2] = -1.0f;
        frustum.planes[5][3] = query_max_z;
        
        // Generate two different camera distances
        // Ensure distance1 < distance2 (closer vs farther)
        float distance1 = static_cast<float>(*rc::gen::inRange(10, 500));
        float distance2 = static_cast<float>(*rc::gen::inRange(501, 2000));
        
        // Use a reasonable max_points budget (high enough to not be a limiting factor)
        uint32_t max_points = *rc::gen::inRange<uint32_t>(5000, 20000);
        
        // Query at closer distance
        std::vector<uint32_t> results_close = index.queryFrustumLOD(frustum, distance1, max_points);
        
        // Query at farther distance
        std::vector<uint32_t> results_far = index.queryFrustumLOD(frustum, distance2, max_points);
        
        // Only test the property if we actually have points in the frustum
        // (Skip cases where the frustum is empty)
        RC_PRE(results_close.size() > 0);
        
        // Property: Greater distance should return fewer or equal points
        // This is because LOD skip factor increases with distance
        RC_ASSERT(results_far.size() <= results_close.size());
        
        // Additional verification: All returned points should be within the frustum
        for (uint32_t idx : results_close) {
            RC_ASSERT(idx < points.size());
            const LASPoint& point = points[idx];
            
            // Verify point is within query bounds
            bool inside = true;
            for (int i = 0; i < 6; ++i) {
                if (frustum.distanceToPlane(i, point.x, point.y, point.z) < 0) {
                    inside = false;
                    break;
                }
            }
            RC_ASSERT(inside);
        }
        
        for (uint32_t idx : results_far) {
            RC_ASSERT(idx < points.size());
            const LASPoint& point = points[idx];
            
            // Verify point is within query bounds
            bool inside = true;
            for (int i = 0; i < 6; ++i) {
                if (frustum.distanceToPlane(i, point.x, point.y, point.z) < 0) {
                    inside = false;
                    break;
                }
            }
            RC_ASSERT(inside);
        }
    });
    
    // Check if the property test succeeded
    REQUIRE(result);
}

// Feature: las-point-cloud-viewer, Property 7: Octree Spatial Partitioning
// For any point cloud, after building the octree, every point should be reachable 
// through the tree structure, and each point should be in a leaf node whose bounding 
// box contains that point's coordinates.
TEST_CASE("Property 7: Octree Spatial Partitioning", "[spatial_index][property]") {
    // Run property-based test with 100 iterations
    const bool result = rc::check("all points are reachable and in correct leaf nodes", []() {
        // Generate random number of points (reasonable range for testing)
        uint32_t point_count = *rc::gen::inRange<uint32_t>(1, 5000);
        
        // Generate random points
        std::vector<LASPoint> points;
        points.reserve(point_count);
        
        for (uint32_t i = 0; i < point_count; ++i) {
            LASPoint point;
            // Use integer ranges and convert to float
            point.x = static_cast<float>(*rc::gen::inRange(-1000, 1000));
            point.y = static_cast<float>(*rc::gen::inRange(-1000, 1000));
            point.z = static_cast<float>(*rc::gen::inRange(-1000, 1000));
            point.r = *rc::gen::inRange<uint8_t>(0, 255);
            point.g = *rc::gen::inRange<uint8_t>(0, 255);
            point.b = *rc::gen::inRange<uint8_t>(0, 255);
            point.intensity = *rc::gen::inRange<uint16_t>(0, 65535);
            point.classification = *rc::gen::inRange<uint8_t>(0, 31);
            points.push_back(point);
        }
        
        // Build spatial index
        SpatialIndex index;
        index.build(points);
        
        // Collect all point indices from leaf nodes
        std::set<uint32_t> reachable_indices;
        
        std::function<void(const OctreeNode*)> collectLeafIndices;
        collectLeafIndices = [&](const OctreeNode* node) {
            if (node == nullptr) return;
            
            if (node->isLeaf()) {
                // This is a leaf - collect all point indices
                for (uint32_t idx : node->point_indices) {
                    reachable_indices.insert(idx);
                }
            } else {
                // Recurse into children
                for (const auto& child : node->children) {
                    if (child != nullptr) {
                        collectLeafIndices(child.get());
                    }
                }
            }
        };
        
        collectLeafIndices(index.getRoot());
        
        // Property 1: Every point should be reachable
        RC_ASSERT(reachable_indices.size() == points.size());
        
        // Property 2: Each point should be in a leaf node whose bounding box contains it
        std::function<void(const OctreeNode*)> verifyContainment;
        verifyContainment = [&](const OctreeNode* node) {
            if (node == nullptr) return;
            
            if (node->isLeaf()) {
                // Verify each point in this leaf is contained by the node's bounding box
                for (uint32_t idx : node->point_indices) {
                    RC_ASSERT(idx < points.size());
                    const LASPoint& point = points[idx];
                    RC_ASSERT(node->bounds.contains(point.x, point.y, point.z));
                }
            } else {
                // Recurse into children
                for (const auto& child : node->children) {
                    if (child != nullptr) {
                        verifyContainment(child.get());
                    }
                }
            }
        };
        
        verifyContainment(index.getRoot());
    });
    
    // Check if the property test succeeded
    REQUIRE(result);
}

// Feature: las-point-cloud-viewer, Property 11: Camera Frustum Update Consistency
// For any camera movement, the visible point set should change to reflect the new frustum, 
// and points outside the new frustum should not be included.
TEST_CASE("Property 11: Camera Frustum Update Consistency", "[spatial_index][property]") {
    // Run property-based test with 100 iterations
    const bool result = rc::check("camera movement updates visible point set correctly", []() {
        // Generate random number of points (reasonable range for testing)
        uint32_t point_count = *rc::gen::inRange<uint32_t>(100, 3000);
        
        // Generate random points in a known space
        std::vector<LASPoint> points;
        points.reserve(point_count);
        
        for (uint32_t i = 0; i < point_count; ++i) {
            LASPoint point;
            // Use integer ranges and convert to float
            point.x = static_cast<float>(*rc::gen::inRange(-500, 500));
            point.y = static_cast<float>(*rc::gen::inRange(-500, 500));
            point.z = static_cast<float>(*rc::gen::inRange(-500, 500));
            point.r = *rc::gen::inRange<uint8_t>(0, 255);
            point.g = *rc::gen::inRange<uint8_t>(0, 255);
            point.b = *rc::gen::inRange<uint8_t>(0, 255);
            point.intensity = *rc::gen::inRange<uint16_t>(0, 65535);
            point.classification = *rc::gen::inRange<uint8_t>(0, 31);
            points.push_back(point);
        }
        
        // Build spatial index
        SpatialIndex index;
        index.build(points);
        
        // Get the actual bounds of the point cloud
        BoundingBox cloud_bounds = index.getBounds();
        
        // Create initial frustum (Frustum 1) - a box-shaped frustum
        float frustum1_min_x = static_cast<float>(*rc::gen::inRange(-600, 0));
        float frustum1_max_x = frustum1_min_x + static_cast<float>(*rc::gen::inRange(200, 600));
        float frustum1_min_y = static_cast<float>(*rc::gen::inRange(-600, 0));
        float frustum1_max_y = frustum1_min_y + static_cast<float>(*rc::gen::inRange(200, 600));
        float frustum1_min_z = static_cast<float>(*rc::gen::inRange(-600, 0));
        float frustum1_max_z = frustum1_min_z + static_cast<float>(*rc::gen::inRange(200, 600));
        
        Frustum frustum1;
        
        // Left plane: x >= frustum1_min_x
        frustum1.planes[0][0] = 1.0f;
        frustum1.planes[0][1] = 0.0f;
        frustum1.planes[0][2] = 0.0f;
        frustum1.planes[0][3] = -frustum1_min_x;
        
        // Right plane: x <= frustum1_max_x
        frustum1.planes[1][0] = -1.0f;
        frustum1.planes[1][1] = 0.0f;
        frustum1.planes[1][2] = 0.0f;
        frustum1.planes[1][3] = frustum1_max_x;
        
        // Bottom plane: y >= frustum1_min_y
        frustum1.planes[2][0] = 0.0f;
        frustum1.planes[2][1] = 1.0f;
        frustum1.planes[2][2] = 0.0f;
        frustum1.planes[2][3] = -frustum1_min_y;
        
        // Top plane: y <= frustum1_max_y
        frustum1.planes[3][0] = 0.0f;
        frustum1.planes[3][1] = -1.0f;
        frustum1.planes[3][2] = 0.0f;
        frustum1.planes[3][3] = frustum1_max_y;
        
        // Near plane: z >= frustum1_min_z
        frustum1.planes[4][0] = 0.0f;
        frustum1.planes[4][1] = 0.0f;
        frustum1.planes[4][2] = 1.0f;
        frustum1.planes[4][3] = -frustum1_min_z;
        
        // Far plane: z <= frustum1_max_z
        frustum1.planes[5][0] = 0.0f;
        frustum1.planes[5][1] = 0.0f;
        frustum1.planes[5][2] = -1.0f;
        frustum1.planes[5][3] = frustum1_max_z;
        
        // Create second frustum (Frustum 2) - simulating camera movement
        // Move the frustum to a different location
        float offset_x = static_cast<float>(*rc::gen::inRange(100, 500));
        float offset_y = static_cast<float>(*rc::gen::inRange(100, 500));
        float offset_z = static_cast<float>(*rc::gen::inRange(50, 300));
        
        float frustum2_min_x = frustum1_min_x + offset_x;
        float frustum2_max_x = frustum1_max_x + offset_x;
        float frustum2_min_y = frustum1_min_y + offset_y;
        float frustum2_max_y = frustum1_max_y + offset_y;
        float frustum2_min_z = frustum1_min_z + offset_z;
        float frustum2_max_z = frustum1_max_z + offset_z;
        
        Frustum frustum2;
        
        // Left plane: x >= frustum2_min_x
        frustum2.planes[0][0] = 1.0f;
        frustum2.planes[0][1] = 0.0f;
        frustum2.planes[0][2] = 0.0f;
        frustum2.planes[0][3] = -frustum2_min_x;
        
        // Right plane: x <= frustum2_max_x
        frustum2.planes[1][0] = -1.0f;
        frustum2.planes[1][1] = 0.0f;
        frustum2.planes[1][2] = 0.0f;
        frustum2.planes[1][3] = frustum2_max_x;
        
        // Bottom plane: y >= frustum2_min_y
        frustum2.planes[2][0] = 0.0f;
        frustum2.planes[2][1] = 1.0f;
        frustum2.planes[2][2] = 0.0f;
        frustum2.planes[2][3] = -frustum2_min_y;
        
        // Top plane: y <= frustum2_max_y
        frustum2.planes[3][0] = 0.0f;
        frustum2.planes[3][1] = -1.0f;
        frustum2.planes[3][2] = 0.0f;
        frustum2.planes[3][3] = frustum2_max_y;
        
        // Near plane: z >= frustum2_min_z
        frustum2.planes[4][0] = 0.0f;
        frustum2.planes[4][1] = 0.0f;
        frustum2.planes[4][2] = 1.0f;
        frustum2.planes[4][3] = -frustum2_min_z;
        
        // Far plane: z <= frustum2_max_z
        frustum2.planes[5][0] = 0.0f;
        frustum2.planes[5][1] = 0.0f;
        frustum2.planes[5][2] = -1.0f;
        frustum2.planes[5][3] = frustum2_max_z;
        
        // Query with first frustum
        std::vector<uint32_t> results1 = index.queryFrustum(frustum1);
        
        // Query with second frustum (after "camera movement")
        std::vector<uint32_t> results2 = index.queryFrustum(frustum2);
        
        // Build sets for easier comparison
        std::set<uint32_t> set1(results1.begin(), results1.end());
        std::set<uint32_t> set2(results2.begin(), results2.end());
        
        // Property 1: All points in results1 should be within frustum1
        for (uint32_t idx : results1) {
            RC_ASSERT(idx < points.size());
            const LASPoint& point = points[idx];
            
            // Verify point is within frustum1 bounds
            RC_ASSERT(point.x >= frustum1_min_x && point.x <= frustum1_max_x);
            RC_ASSERT(point.y >= frustum1_min_y && point.y <= frustum1_max_y);
            RC_ASSERT(point.z >= frustum1_min_z && point.z <= frustum1_max_z);
        }
        
        // Property 2: All points in results2 should be within frustum2
        for (uint32_t idx : results2) {
            RC_ASSERT(idx < points.size());
            const LASPoint& point = points[idx];
            
            // Verify point is within frustum2 bounds
            RC_ASSERT(point.x >= frustum2_min_x && point.x <= frustum2_max_x);
            RC_ASSERT(point.y >= frustum2_min_y && point.y <= frustum2_max_y);
            RC_ASSERT(point.z >= frustum2_min_z && point.z <= frustum2_max_z);
        }
        
        // Property 3: Points outside frustum2 should not be in results2
        // We'll verify this by checking that no point in results2 is outside frustum2
        for (uint32_t idx : results2) {
            const LASPoint& point = points[idx];
            
            // Check against all 6 planes of frustum2
            bool inside = true;
            for (int i = 0; i < 6; ++i) {
                if (frustum2.distanceToPlane(i, point.x, point.y, point.z) < 0) {
                    inside = false;
                    break;
                }
            }
            
            RC_ASSERT(inside);
        }
        
        // Property 4: The visible point sets should reflect the frustum change
        // If the frustums don't overlap, the result sets should be different
        // (unless both are empty)
        BoundingBox box1{frustum1_min_x, frustum1_min_y, frustum1_min_z,
                         frustum1_max_x, frustum1_max_y, frustum1_max_z};
        BoundingBox box2{frustum2_min_x, frustum2_min_y, frustum2_min_z,
                         frustum2_max_x, frustum2_max_y, frustum2_max_z};
        
        // If the frustums don't overlap and both have points, the sets should be different
        if (!box1.intersects(box2)) {
            if (!results1.empty() && !results2.empty()) {
                // The sets should be different (no overlap in frustums means no overlap in results)
                RC_ASSERT(set1 != set2);
            }
        }
        
        // Property 5: Verify completeness - all points within frustum2 should be in results2
        // Manually check which points should be in frustum2
        std::set<uint32_t> expected_in_frustum2;
        for (uint32_t i = 0; i < points.size(); ++i) {
            const LASPoint& point = points[i];
            
            if (point.x >= frustum2_min_x && point.x <= frustum2_max_x &&
                point.y >= frustum2_min_y && point.y <= frustum2_max_y &&
                point.z >= frustum2_min_z && point.z <= frustum2_max_z) {
                expected_in_frustum2.insert(i);
            }
        }
        
        // All expected points should be in results2
        for (uint32_t expected_idx : expected_in_frustum2) {
            RC_ASSERT(set2.count(expected_idx) == 1);
        }
        
        // Results2 should not contain any unexpected points
        RC_ASSERT(set2.size() == expected_in_frustum2.size());
        RC_ASSERT(set2 == expected_in_frustum2);
    });
    
    // Check if the property test succeeded
    REQUIRE(result);
}

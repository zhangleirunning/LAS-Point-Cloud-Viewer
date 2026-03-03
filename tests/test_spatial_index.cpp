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

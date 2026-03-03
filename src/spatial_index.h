#ifndef SPATIAL_INDEX_H
#define SPATIAL_INDEX_H

#include "las_parser.h"
#include <memory>
#include <array>
#include <vector>
#include <cstdint>

// Bounding box structure for spatial queries
struct BoundingBox {
    float min_x, min_y, min_z;
    float max_x, max_y, max_z;
    
    // Check if a point is contained within this bounding box
    bool contains(float x, float y, float z) const;
    
    // Check if this bounding box intersects with another
    bool intersects(const BoundingBox& other) const;
    
    // Get the center point of the bounding box
    void getCenter(float& cx, float& cy, float& cz) const;
};

// Frustum structure for view frustum culling
struct Frustum {
    // 6 planes: left, right, top, bottom, near, far
    // Each plane is represented as [a, b, c, d] where ax + by + cz + d = 0
    float planes[6][4];
    
    // Calculate signed distance from a point to a plane
    // Positive distance means point is on the "inside" of the plane
    float distanceToPlane(int plane_index, float x, float y, float z) const;
    
    // Test if a bounding box intersects with the frustum
    // Returns true if the box is at least partially inside the frustum
    bool intersects(const BoundingBox& box) const;
};

// Octree node for spatial partitioning
class OctreeNode {
public:
    BoundingBox bounds;
    std::vector<uint32_t> point_indices;  // Indices into global point array
    std::array<std::unique_ptr<OctreeNode>, 8> children;
    uint32_t depth;
    
    OctreeNode(const BoundingBox& bbox, uint32_t d);
    
    // Check if this is a leaf node (no children)
    bool isLeaf() const;
};

// Spatial index using octree structure
class SpatialIndex {
public:
    SpatialIndex();
    
    // Build octree from point cloud
    void build(const std::vector<LASPoint>& points, uint32_t max_depth = 10);
    
    // Get bounding box of entire point cloud
    BoundingBox getBounds() const;
    
    // Query points visible in frustum (without LOD)
    std::vector<uint32_t> queryFrustum(const Frustum& frustum) const;
    
    // Query points visible in frustum with LOD selection
    std::vector<uint32_t> queryFrustumLOD(const Frustum& frustum,
                                          float camera_distance,
                                          uint32_t max_points) const;
    
    // Get the root node (for testing/debugging)
    const OctreeNode* getRoot() const { return root_.get(); }

private:
    std::unique_ptr<OctreeNode> root_;
    const std::vector<LASPoint>* points_;
    uint32_t max_depth_;
    uint32_t subdivision_threshold_;  // Points per leaf before subdivision
    
    // Recursively build octree
    void buildRecursive(OctreeNode* node, 
                       const std::vector<uint32_t>& indices,
                       uint32_t current_depth);
    
    // Calculate bounding box from a set of points
    BoundingBox calculateBounds(const std::vector<uint32_t>& indices) const;
    
    // Subdivide a node into 8 octants
    void subdivideNode(OctreeNode* node, const std::vector<uint32_t>& indices);
    
    // Recursively query octree with frustum culling
    void queryRecursive(const OctreeNode* node,
                       const Frustum& frustum,
                       std::vector<uint32_t>& results) const;
    
    // Recursively query octree with frustum culling and LOD
    void queryRecursiveLOD(const OctreeNode* node,
                          const Frustum& frustum,
                          float camera_distance,
                          std::vector<uint32_t>& results,
                          uint32_t max_points) const;
    
    // Calculate LOD skip factor based on distance and depth
    uint32_t calculateLODSkip(float distance, uint32_t depth) const;
};

#endif // SPATIAL_INDEX_H

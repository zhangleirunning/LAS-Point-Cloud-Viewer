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
    // Inline for performance in hot paths
    inline bool contains(float x, float y, float z) const {
        return x >= min_x && x <= max_x &&
               y >= min_y && y <= max_y &&
               z >= min_z && z <= max_z;
    }
    
    // Check if this bounding box intersects with another
    // Inline for performance in hot paths
    inline bool intersects(const BoundingBox& other) const {
        return !(max_x < other.min_x || min_x > other.max_x ||
                 max_y < other.min_y || min_y > other.max_y ||
                 max_z < other.min_z || min_z > other.max_z);
    }
    
    // Get the center point of the bounding box
    // Inline for performance in hot paths
    inline void getCenter(float& cx, float& cy, float& cz) const {
        cx = (min_x + max_x) * 0.5f;
        cy = (min_y + max_y) * 0.5f;
        cz = (min_z + max_z) * 0.5f;
    }
};

// Frustum structure for view frustum culling
struct Frustum {
    // 6 planes: left, right, top, bottom, near, far
    // Each plane is represented as [a, b, c, d] where ax + by + cz + d = 0
    float planes[6][4];
    
    // Calculate signed distance from a point to a plane
    // Positive distance means point is on the "inside" of the plane
    // Inline for performance in hot paths
    inline float distanceToPlane(int plane_index, float x, float y, float z) const {
        const float* plane = planes[plane_index];
        return plane[0] * x + plane[1] * y + plane[2] * z + plane[3];
    }
    
    // Test if a bounding box intersects with the frustum
    // Returns true if the box is at least partially inside the frustum
    // Inline for performance in hot paths
    inline bool intersects(const BoundingBox& box) const {
        // Test the bounding box against all 6 frustum planes
        // For each plane, find the "positive vertex" (vertex most in the direction of the plane normal)
        // If the positive vertex is outside the plane, the entire box is outside
        
        for (int i = 0; i < 6; ++i) {
            const float* plane = planes[i];
            
            // Find the positive vertex (furthest point in the direction of the plane normal)
            float px = (plane[0] >= 0) ? box.max_x : box.min_x;
            float py = (plane[1] >= 0) ? box.max_y : box.min_y;
            float pz = (plane[2] >= 0) ? box.max_z : box.min_z;
            
            // If the positive vertex is outside this plane, the entire box is outside the frustum
            if (plane[0] * px + plane[1] * py + plane[2] * pz + plane[3] < 0) {
                return false;
            }
        }
        
        // Box intersects or is inside the frustum
        return true;
    }
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

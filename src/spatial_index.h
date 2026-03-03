/**
 * @file spatial_index.h
 * @brief Octree-based spatial indexing for efficient point cloud queries
 * 
 * This module provides a hierarchical spatial index (octree) for organizing
 * and querying large point clouds. The octree enables:
 * - Fast frustum culling for rendering
 * - Level-of-detail (LOD) selection based on camera distance
 * - Efficient spatial queries (O(log n) average case)
 * 
 * Key algorithms:
 * - Octree construction with adaptive subdivision
 * - View frustum culling using plane-box intersection tests
 * - Distance-based LOD with point sampling
 * 
 * Performance characteristics:
 * - Construction: O(n log n) average case
 * - Query: O(log n + k) where k is the number of results
 * - Memory: O(n) with small constant overhead for tree structure
 */

#ifndef SPATIAL_INDEX_H
#define SPATIAL_INDEX_H

#include "las_parser.h"
#include <memory>
#include <array>
#include <vector>
#include <cstdint>

/**
 * @brief Axis-aligned bounding box for spatial queries
 * 
 * Represents a rectangular volume in 3D space defined by minimum and maximum
 * coordinates along each axis. Used for:
 * - Defining octree node boundaries
 * - Testing point containment
 * - Testing intersection with other bounding boxes and frustums
 * 
 * All methods are inlined for performance in hot paths (frustum culling).
 */
struct BoundingBox {
    float min_x, min_y, min_z;  ///< Minimum corner of the box
    float max_x, max_y, max_z;  ///< Maximum corner of the box
    
    /**
     * @brief Check if a point is contained within this bounding box
     * @param x X coordinate of the point
     * @param y Y coordinate of the point
     * @param z Z coordinate of the point
     * @return true if the point is inside or on the boundary, false otherwise
     * @note Inlined for performance in hot paths
     */
    inline bool contains(float x, float y, float z) const {
        return x >= min_x && x <= max_x &&
               y >= min_y && y <= max_y &&
               z >= min_z && z <= max_z;
    }
    
    /**
     * @brief Check if this bounding box intersects with another
     * @param other The other bounding box to test against
     * @return true if the boxes overlap or touch, false if completely separate
     * @note Uses separating axis theorem: boxes don't intersect if separated along any axis
     * @note Inlined for performance in hot paths
     */
    inline bool intersects(const BoundingBox& other) const {
        return !(max_x < other.min_x || min_x > other.max_x ||
                 max_y < other.min_y || min_y > other.max_y ||
                 max_z < other.min_z || min_z > other.max_z);
    }
    
    /**
     * @brief Get the center point of the bounding box
     * @param cx Output X coordinate of center
     * @param cy Output Y coordinate of center
     * @param cz Output Z coordinate of center
     * @note Inlined for performance in hot paths
     */
    inline void getCenter(float& cx, float& cy, float& cz) const {
        cx = (min_x + max_x) * 0.5f;
        cy = (min_y + max_y) * 0.5f;
        cz = (min_z + max_z) * 0.5f;
    }
};

/**
 * @brief View frustum for culling invisible geometry
 * 
 * Represents the visible region of 3D space from a camera's perspective.
 * Defined by 6 planes (left, right, top, bottom, near, far) extracted from
 * the view-projection matrix.
 * 
 * Each plane is represented as [a, b, c, d] where ax + by + cz + d = 0.
 * Points with positive distance are "inside" the frustum (visible).
 * 
 * Used for:
 * - Culling octree nodes outside the view
 * - Testing individual points for visibility
 * - Optimizing rendering by skipping invisible geometry
 */
struct Frustum {
    /**
     * @brief 6 frustum planes: [0]=left, [1]=right, [2]=top, [3]=bottom, [4]=near, [5]=far
     * Each plane is [a, b, c, d] where ax + by + cz + d = 0
     */
    float planes[6][4];
    
    /**
     * @brief Calculate signed distance from a point to a frustum plane
     * @param plane_index Index of the plane (0-5)
     * @param x X coordinate of the point
     * @param y Y coordinate of the point
     * @param z Z coordinate of the point
     * @return Signed distance (positive = inside, negative = outside)
     * @note Inlined for performance in hot paths
     */
    inline float distanceToPlane(int plane_index, float x, float y, float z) const {
        const float* plane = planes[plane_index];
        return plane[0] * x + plane[1] * y + plane[2] * z + plane[3];
    }
    
    /**
     * @brief Test if a bounding box intersects with the frustum
     * 
     * Uses the "positive vertex" test: for each plane, find the vertex of the
     * bounding box that is furthest in the direction of the plane normal.
     * If this vertex is outside the plane, the entire box is outside the frustum.
     * 
     * @param box The bounding box to test
     * @return true if the box is at least partially inside the frustum, false if completely outside
     * @note This is a conservative test - may return true for boxes that are actually outside
     * @note Inlined for performance in hot paths (called for every octree node)
     */
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

/**
 * @brief Octree node for hierarchical spatial partitioning
 * 
 * Each node represents a cubic region of 3D space and can have up to 8 children
 * (one for each octant). Leaf nodes store indices of points within their region.
 * 
 * Octant numbering (binary encoding):
 * - Bit 0: X axis (0=negative, 1=positive)
 * - Bit 1: Y axis (0=negative, 1=positive)
 * - Bit 2: Z axis (0=negative, 1=positive)
 * 
 * Example: octant 5 = binary 101 = +X, -Y, +Z
 */
class OctreeNode {
public:
    BoundingBox bounds;                                 ///< Spatial extent of this node
    std::vector<uint32_t> point_indices;                ///< Point indices (only for leaf nodes)
    std::array<std::unique_ptr<OctreeNode>, 8> children; ///< 8 child nodes (nullptr if leaf)
    uint32_t depth;                                     ///< Depth in tree (0 = root)
    
    /**
     * @brief Construct an octree node
     * @param bbox Bounding box defining the spatial extent
     * @param d Depth level in the tree (0 for root)
     */
    OctreeNode(const BoundingBox& bbox, uint32_t d);
    
    /**
     * @brief Check if this is a leaf node (no children)
     * @return true if leaf, false if internal node
     */
    bool isLeaf() const;
};

/**
 * @brief Spatial index using octree structure for efficient point cloud queries
 * 
 * The SpatialIndex organizes points hierarchically in an octree, enabling:
 * - Fast frustum culling (O(log n) average case)
 * - Level-of-detail selection based on camera distance
 * - Efficient spatial queries
 * 
 * Construction algorithm:
 * 1. Calculate bounding box of all points
 * 2. Create root node with this bounding box
 * 3. Recursively subdivide nodes that exceed the point threshold
 * 4. Stop at maximum depth to prevent over-subdivision
 * 
 * Query algorithm:
 * 1. Test root node's bounding box against frustum
 * 2. If outside, skip entire subtree
 * 3. If inside, recursively test children
 * 4. At leaf nodes, test individual points
 * 5. Apply LOD sampling based on distance
 * 
 * Performance tuning:
 * - subdivision_threshold: Points per leaf (default 1000)
 * - max_depth: Maximum tree depth (default 10)
 * - Adjust based on point cloud density and query patterns
 */
class SpatialIndex {
public:
    /**
     * @brief Construct an empty spatial index
     */
    SpatialIndex();
    
    /**
     * @brief Build octree from point cloud
     * 
     * Constructs the octree hierarchy by recursively subdividing space.
     * Nodes are subdivided if they contain more than subdivision_threshold points
     * and haven't reached max_depth.
     * 
     * @param points Vector of points to index
     * @param max_depth Maximum tree depth (default 10, range 1-20 recommended)
     * 
     * @note Time complexity: O(n log n) average case
     * @note Space complexity: O(n) with small constant overhead
     * @note This method stores a pointer to the points vector - ensure it remains valid
     */
    void build(const std::vector<LASPoint>& points, uint32_t max_depth = 10);
    
    /**
     * @brief Get bounding box of entire point cloud
     * @return Bounding box of the root node (entire point cloud extent)
     */
    BoundingBox getBounds() const;
    
    /**
     * @brief Query points visible in frustum (without LOD)
     * 
     * Returns all points within the view frustum without any level-of-detail
     * filtering. Useful for small point clouds or when maximum detail is required.
     * 
     * @param frustum View frustum to query against
     * @return Vector of point indices that are visible
     * 
     * @note Time complexity: O(log n + k) where k is the number of results
     */
    std::vector<uint32_t> queryFrustum(const Frustum& frustum) const;
    
    /**
     * @brief Query points visible in frustum with LOD selection
     * 
     * Returns points within the view frustum, applying level-of-detail filtering
     * based on camera distance. Distant points are sampled (skipped) to maintain
     * performance with large point clouds.
     * 
     * LOD formula: skip_factor = max(1, floor(distance / (base_distance * 2^depth)))
     * - Closer nodes: skip_factor = 1 (all points)
     * - Distant nodes: skip_factor > 1 (sample points)
     * 
     * @param frustum View frustum to query against
     * @param camera_distance Distance from camera to scene center
     * @param max_points Maximum number of points to return (budget)
     * @return Vector of point indices that are visible (up to max_points)
     * 
     * @note Time complexity: O(log n + k) where k is the number of results
     * @note Results are capped at max_points to maintain frame rate
     */
    std::vector<uint32_t> queryFrustumLOD(const Frustum& frustum,
                                          float camera_distance,
                                          uint32_t max_points) const;
    
    /**
     * @brief Get the root node (for testing/debugging)
     * @return Pointer to root node, or nullptr if not built
     */
    const OctreeNode* getRoot() const { return root_.get(); }

private:
    std::unique_ptr<OctreeNode> root_;      ///< Root node of the octree
    const std::vector<LASPoint>* points_;   ///< Pointer to point cloud data
    uint32_t max_depth_;                    ///< Maximum tree depth
    uint32_t subdivision_threshold_;        ///< Points per leaf before subdivision
    
    /**
     * @brief Recursively build octree
     * @param node Current node being built
     * @param indices Point indices to distribute among children
     * @param current_depth Current depth in tree
     */
    void buildRecursive(OctreeNode* node, 
                       const std::vector<uint32_t>& indices,
                       uint32_t current_depth);
    
    /**
     * @brief Calculate tight bounding box from a set of points
     * @param indices Indices of points to include
     * @return Minimum bounding box containing all specified points
     */
    BoundingBox calculateBounds(const std::vector<uint32_t>& indices) const;
    
    /**
     * @brief Subdivide a node into 8 octants
     * @param node Node to subdivide
     * @param indices Point indices to distribute among children
     */
    void subdivideNode(OctreeNode* node, const std::vector<uint32_t>& indices);
    
    /**
     * @brief Recursively query octree with frustum culling
     * @param node Current node being queried
     * @param frustum View frustum
     * @param results Output vector of point indices
     */
    void queryRecursive(const OctreeNode* node,
                       const Frustum& frustum,
                       std::vector<uint32_t>& results) const;
    
    /**
     * @brief Recursively query octree with frustum culling and LOD
     * @param node Current node being queried
     * @param frustum View frustum
     * @param camera_distance Distance from camera to scene
     * @param results Output vector of point indices
     * @param max_points Maximum points to return
     */
    void queryRecursiveLOD(const OctreeNode* node,
                          const Frustum& frustum,
                          float camera_distance,
                          std::vector<uint32_t>& results,
                          uint32_t max_points) const;
    
    /**
     * @brief Calculate LOD skip factor based on distance and depth
     * @param distance Camera distance to scene
     * @param depth Node depth in tree
     * @return Skip factor (1 = all points, >1 = sample every Nth point)
     */
    uint32_t calculateLODSkip(float distance, uint32_t depth) const;
};

#endif // SPATIAL_INDEX_H

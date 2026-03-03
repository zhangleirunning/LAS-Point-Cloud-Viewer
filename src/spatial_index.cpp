#include "spatial_index.h"
#include <limits>
#include <algorithm>
#include <cmath>

// BoundingBox implementation - methods are now inline in header

// Frustum implementation - methods are now inline in header

// OctreeNode implementation

OctreeNode::OctreeNode(const BoundingBox& bbox, uint32_t d)
    : bounds(bbox), depth(d) {
    // Initialize all children to nullptr
    for (auto& child : children) {
        child = nullptr;
    }
}

bool OctreeNode::isLeaf() const {
    return children[0] == nullptr;
}

// SpatialIndex implementation

SpatialIndex::SpatialIndex()
    : root_(nullptr), points_(nullptr), max_depth_(10), subdivision_threshold_(1000) {
}

void SpatialIndex::build(const std::vector<LASPoint>& points, uint32_t max_depth) {
    points_ = &points;
    max_depth_ = max_depth;
    
    if (points.empty()) {
        root_ = nullptr;
        return;
    }
    
    // Create initial index list (all points)
    std::vector<uint32_t> all_indices;
    all_indices.reserve(points.size());
    for (uint32_t i = 0; i < points.size(); ++i) {
        all_indices.push_back(i);
    }
    
    // Calculate bounding box for all points
    BoundingBox root_bounds = calculateBounds(all_indices);
    
    // Create root node
    root_ = std::make_unique<OctreeNode>(root_bounds, 0);
    
    // Build tree recursively
    buildRecursive(root_.get(), all_indices, 0);
}

BoundingBox SpatialIndex::getBounds() const {
    if (root_) {
        return root_->bounds;
    }
    // Return empty bounding box if no root
    return BoundingBox{0, 0, 0, 0, 0, 0};
}

BoundingBox SpatialIndex::calculateBounds(const std::vector<uint32_t>& indices) const {
    if (indices.empty() || !points_) {
        return BoundingBox{0, 0, 0, 0, 0, 0};
    }
    
    // Initialize with first point
    const LASPoint& first = (*points_)[indices[0]];
    BoundingBox bounds;
    bounds.min_x = bounds.max_x = first.x;
    bounds.min_y = bounds.max_y = first.y;
    bounds.min_z = bounds.max_z = first.z;
    
    // Expand to include all points
    for (size_t i = 1; i < indices.size(); ++i) {
        const LASPoint& point = (*points_)[indices[i]];
        
        bounds.min_x = std::min(bounds.min_x, point.x);
        bounds.max_x = std::max(bounds.max_x, point.x);
        bounds.min_y = std::min(bounds.min_y, point.y);
        bounds.max_y = std::max(bounds.max_y, point.y);
        bounds.min_z = std::min(bounds.min_z, point.z);
        bounds.max_z = std::max(bounds.max_z, point.z);
    }
    
    return bounds;
}

void SpatialIndex::buildRecursive(OctreeNode* node, 
                                  const std::vector<uint32_t>& indices,
                                  uint32_t current_depth) {
    // Base cases: stop subdivision
    if (indices.size() <= subdivision_threshold_ || current_depth >= max_depth_) {
        // This is a leaf node - store all point indices
        node->point_indices = indices;
        return;
    }
    
    // Subdivide this node
    subdivideNode(node, indices);
}

void SpatialIndex::subdivideNode(OctreeNode* node, const std::vector<uint32_t>& indices) {
    // Get center of current bounding box
    float cx, cy, cz;
    node->bounds.getCenter(cx, cy, cz);
    
    // Create 8 child bounding boxes
    std::array<BoundingBox, 8> child_bounds;
    
    // Octant 0: -X, -Y, -Z
    child_bounds[0] = {node->bounds.min_x, node->bounds.min_y, node->bounds.min_z,
                       cx, cy, cz};
    
    // Octant 1: +X, -Y, -Z
    child_bounds[1] = {cx, node->bounds.min_y, node->bounds.min_z,
                       node->bounds.max_x, cy, cz};
    
    // Octant 2: -X, +Y, -Z
    child_bounds[2] = {node->bounds.min_x, cy, node->bounds.min_z,
                       cx, node->bounds.max_y, cz};
    
    // Octant 3: +X, +Y, -Z
    child_bounds[3] = {cx, cy, node->bounds.min_z,
                       node->bounds.max_x, node->bounds.max_y, cz};
    
    // Octant 4: -X, -Y, +Z
    child_bounds[4] = {node->bounds.min_x, node->bounds.min_y, cz,
                       cx, cy, node->bounds.max_z};
    
    // Octant 5: +X, -Y, +Z
    child_bounds[5] = {cx, node->bounds.min_y, cz,
                       node->bounds.max_x, cy, node->bounds.max_z};
    
    // Octant 6: -X, +Y, +Z
    child_bounds[6] = {node->bounds.min_x, cy, cz,
                       cx, node->bounds.max_y, node->bounds.max_z};
    
    // Octant 7: +X, +Y, +Z
    child_bounds[7] = {cx, cy, cz,
                       node->bounds.max_x, node->bounds.max_y, node->bounds.max_z};
    
    // Distribute points to octants
    std::array<std::vector<uint32_t>, 8> child_indices;
    
    for (uint32_t idx : indices) {
        const LASPoint& point = (*points_)[idx];
        
        // Determine which octant this point belongs to
        int octant = 0;
        if (point.x >= cx) octant |= 1;  // +X
        if (point.y >= cy) octant |= 2;  // +Y
        if (point.z >= cz) octant |= 4;  // +Z
        
        child_indices[octant].push_back(idx);
    }
    
    // Create child nodes for non-empty octants
    for (int i = 0; i < 8; ++i) {
        if (!child_indices[i].empty()) {
            node->children[i] = std::make_unique<OctreeNode>(child_bounds[i], node->depth + 1);
            buildRecursive(node->children[i].get(), child_indices[i], node->depth + 1);
        }
    }
}

std::vector<uint32_t> SpatialIndex::queryFrustum(const Frustum& frustum) const {
    std::vector<uint32_t> results;
    
    if (!root_ || !points_) {
        return results;
    }
    
    // Start recursive traversal from root
    queryRecursive(root_.get(), frustum, results);
    
    return results;
}

void SpatialIndex::queryRecursive(const OctreeNode* node,
                                  const Frustum& frustum,
                                  std::vector<uint32_t>& results) const {
    if (!node) {
        return;
    }
    
    // Test if this node's bounding box intersects the frustum
    if (!frustum.intersects(node->bounds)) {
        // Node is completely outside frustum - skip it and all children
        return;
    }
    
    // If this is a leaf node, check each point individually
    if (node->isLeaf()) {
        // We can't assume all points in the leaf are within the frustum
        // because the leaf's bounding box might only partially intersect
        for (uint32_t idx : node->point_indices) {
            const LASPoint& point = (*points_)[idx];
            
            // Check if this specific point is within the frustum
            // by testing it against all 6 planes
            bool inside = true;
            for (int i = 0; i < 6; ++i) {
                if (frustum.distanceToPlane(i, point.x, point.y, point.z) < 0) {
                    inside = false;
                    break;
                }
            }
            
            if (inside) {
                results.push_back(idx);
            }
        }
        return;
    }
    
    // Internal node - recursively query children
    for (const auto& child : node->children) {
        if (child) {
            queryRecursive(child.get(), frustum, results);
        }
    }
}

std::vector<uint32_t> SpatialIndex::queryFrustumLOD(const Frustum& frustum,
                                                     float camera_distance,
                                                     uint32_t max_points) const {
    std::vector<uint32_t> results;
    
    if (!root_ || !points_) {
        return results;
    }
    
    // Reserve space to avoid reallocations
    results.reserve(std::min(max_points, static_cast<uint32_t>(points_->size())));
    
    // Start recursive traversal from root
    queryRecursiveLOD(root_.get(), frustum, camera_distance, results, max_points);
    
    return results;
}

void SpatialIndex::queryRecursiveLOD(const OctreeNode* node,
                                     const Frustum& frustum,
                                     float camera_distance,
                                     std::vector<uint32_t>& results,
                                     uint32_t max_points) const {
    if (!node) {
        return;
    }
    
    // Check if we've reached the point budget
    if (results.size() >= max_points) {
        return;
    }
    
    // Test if this node's bounding box intersects the frustum
    if (!frustum.intersects(node->bounds)) {
        // Node is completely outside frustum - skip it and all children
        return;
    }
    
    // If this is a leaf node, add points with LOD sampling
    if (node->isLeaf()) {
        // Calculate skip factor based on distance and depth
        uint32_t skip = calculateLODSkip(camera_distance, node->depth);
        
        // Optimize: pre-extract frustum planes for faster point testing
        const float* planes_data = &frustum.planes[0][0];
        
        // Add points with sampling, checking each point against frustum
        const size_t num_points = node->point_indices.size();
        for (size_t i = 0; i < num_points && results.size() < max_points; i += skip) {
            uint32_t idx = node->point_indices[i];
            const LASPoint& point = (*points_)[idx];
            
            // Optimized frustum test: check all planes inline
            bool inside = true;
            for (int j = 0; j < 6; ++j) {
                const float* plane = planes_data + (j * 4);
                if (plane[0] * point.x + plane[1] * point.y + plane[2] * point.z + plane[3] < 0) {
                    inside = false;
                    break;
                }
            }
            
            if (inside) {
                results.push_back(idx);
            }
        }
        return;
    }
    
    // Internal node - recursively query children
    // Optimize: check children in order of likelihood to contain visible points
    for (const auto& child : node->children) {
        if (child && results.size() < max_points) {
            queryRecursiveLOD(child.get(), frustum, camera_distance, results, max_points);
        }
    }
}

uint32_t SpatialIndex::calculateLODSkip(float distance, uint32_t depth) const {
    // LOD formula: skip_factor = max(1, floor(distance / (base_distance * 2^depth)))
    // base_distance is chosen to provide good detail at typical viewing distances
    const float base_distance = 10.0f;
    
    // Calculate the divisor: base_distance * 2^depth
    float divisor = base_distance * (1 << depth);  // Bit shift for 2^depth
    
    // Calculate skip factor
    uint32_t skip = static_cast<uint32_t>(std::max(1.0f, distance / divisor));
    
    return skip;
}

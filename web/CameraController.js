/**
 * Camera Controller - Manages camera state and transformations
 * Handles user input for orbit, pan, and zoom controls
 */

/**
 * 4x4 Matrix utilities for camera transformations
 */
class Mat4 {
    /**
     * Create an identity matrix
     * @returns {Float32Array} 4x4 identity matrix
     */
    static identity() {
        return new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ]);
    }
    
    /**
     * Create a perspective projection matrix
     * @param {number} fovy - Field of view in radians
     * @param {number} aspect - Aspect ratio (width/height)
     * @param {number} near - Near clipping plane
     * @param {number} far - Far clipping plane
     * @returns {Float32Array} 4x4 projection matrix
     */
    static perspective(fovy, aspect, near, far) {
        const f = 1.0 / Math.tan(fovy / 2);
        const nf = 1 / (near - far);
        
        return new Float32Array([
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (far + near) * nf, -1,
            0, 0, 2 * far * near * nf, 0
        ]);
    }
    
    /**
     * Create a lookAt view matrix
     * @param {Array<number>} eye - Camera position [x, y, z]
     * @param {Array<number>} target - Look-at target [x, y, z]
     * @param {Array<number>} up - Up vector [x, y, z]
     * @returns {Float32Array} 4x4 view matrix
     */
    static lookAt(eye, target, up) {
        const eyeX = eye[0], eyeY = eye[1], eyeZ = eye[2];
        const targetX = target[0], targetY = target[1], targetZ = target[2];
        const upX = up[0], upY = up[1], upZ = up[2];
        
        // Calculate forward vector (from eye to target)
        let z0 = eyeX - targetX;
        let z1 = eyeY - targetY;
        let z2 = eyeZ - targetZ;
        
        // Normalize forward vector
        let len = Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
        if (len === 0) {
            z0 = 0; z1 = 0; z2 = 1;
        } else {
            len = 1 / len;
            z0 *= len;
            z1 *= len;
            z2 *= len;
        }
        
        // Calculate right vector (cross product of up and forward)
        let x0 = upY * z2 - upZ * z1;
        let x1 = upZ * z0 - upX * z2;
        let x2 = upX * z1 - upY * z0;
        
        // Normalize right vector
        len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
        if (len === 0) {
            x0 = 1; x1 = 0; x2 = 0;
        } else {
            len = 1 / len;
            x0 *= len;
            x1 *= len;
            x2 *= len;
        }
        
        // Calculate up vector (cross product of forward and right)
        let y0 = z1 * x2 - z2 * x1;
        let y1 = z2 * x0 - z0 * x2;
        let y2 = z0 * x1 - z1 * x0;
        
        // Create view matrix
        return new Float32Array([
            x0, y0, z0, 0,
            x1, y1, z1, 0,
            x2, y2, z2, 0,
            -(x0 * eyeX + x1 * eyeY + x2 * eyeZ),
            -(y0 * eyeX + y1 * eyeY + y2 * eyeZ),
            -(z0 * eyeX + z1 * eyeY + z2 * eyeZ),
            1
        ]);
    }
    
    /**
     * Multiply two 4x4 matrices
     * @param {Float32Array} a - First matrix
     * @param {Float32Array} b - Second matrix
     * @returns {Float32Array} Result matrix (a * b)
     */
    static multiply(a, b) {
        const result = new Float32Array(16);
        
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                result[i * 4 + j] = 
                    a[i * 4 + 0] * b[0 * 4 + j] +
                    a[i * 4 + 1] * b[1 * 4 + j] +
                    a[i * 4 + 2] * b[2 * 4 + j] +
                    a[i * 4 + 3] * b[3 * 4 + j];
            }
        }
        
        return result;
    }
}

/**
 * Vector3 utilities
 */
class Vec3 {
    /**
     * Calculate distance between two points
     * @param {Array<number>} a - First point [x, y, z]
     * @param {Array<number>} b - Second point [x, y, z]
     * @returns {number} Distance
     */
    static distance(a, b) {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const dz = b[2] - a[2];
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    
    /**
     * Normalize a vector
     * @param {Array<number>} v - Vector [x, y, z]
     * @returns {Array<number>} Normalized vector
     */
    static normalize(v) {
        const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
        if (len === 0) return [0, 0, 1];
        return [v[0] / len, v[1] / len, v[2] / len];
    }
    
    /**
     * Cross product of two vectors
     * @param {Array<number>} a - First vector
     * @param {Array<number>} b - Second vector
     * @returns {Array<number>} Cross product
     */
    static cross(a, b) {
        return [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]
        ];
    }
}

export class CameraController {
    constructor(canvas) {
        this.canvas = canvas;
        
        // Camera state - Cartesian coordinates
        this.position = [0, 0, 5];
        this.target = [0, 0, 0];
        this.up = [0, 1, 0];
        
        // Camera state - Spherical coordinates
        this.distance = 5;
        this.azimuth = 0;      // Horizontal rotation in degrees
        this.elevation = 30;   // Vertical rotation in degrees
        
        // Projection parameters
        this.fov = 60 * Math.PI / 180;  // 60 degrees in radians
        this.near = 0.1;
        this.far = 10000;
        
        // Mouse interaction state
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.dragButton = -1;
        
        // Constraints
        this.minDistance = 0.1;
        this.maxDistance = 1000;
        this.minElevation = -89;
        this.maxElevation = 89;
        
        // Initialize mouse handlers
        this.setupMouseHandlers();
        
        // Update initial position
        this.updatePosition();
    }
    
    /**
     * Set up mouse event handlers for camera control
     */
    setupMouseHandlers() {
        // Mouse down - start dragging
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this.dragButton = e.button;
            e.preventDefault();
        });
        
        // Mouse move - handle orbit/pan
        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            
            const deltaX = e.clientX - this.lastMouseX;
            const deltaY = e.clientY - this.lastMouseY;
            
            this.onMouseDrag(deltaX, deltaY, this.dragButton);
            
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            
            e.preventDefault();
        });
        
        // Mouse up - stop dragging
        const stopDragging = (e) => {
            this.isDragging = false;
            this.dragButton = -1;
        };
        
        this.canvas.addEventListener('mouseup', stopDragging);
        this.canvas.addEventListener('mouseleave', stopDragging);
        
        // Mouse wheel - zoom
        this.canvas.addEventListener('wheel', (e) => {
            this.onMouseWheel(e.deltaY);
            e.preventDefault();
        });
        
        // Prevent context menu on right-click
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }
    
    /**
     * Handle mouse drag for orbit or pan
     * @param {number} deltaX - Horizontal mouse movement
     * @param {number} deltaY - Vertical mouse movement
     * @param {number} button - Mouse button (0=left, 2=right)
     */
    onMouseDrag(deltaX, deltaY, button) {
        if (button === 0) {
            // Left button - orbit
            this.orbit(deltaX, deltaY);
        } else if (button === 2) {
            // Right button - pan
            this.pan(deltaX, deltaY);
        }
    }
    
    /**
     * Orbit camera around target
     * @param {number} deltaX - Horizontal rotation delta
     * @param {number} deltaY - Vertical rotation delta
     */
    orbit(deltaX, deltaY) {
        // Update azimuth (horizontal rotation)
        this.azimuth -= deltaX * 0.5;
        
        // Update elevation (vertical rotation) with constraints
        this.elevation += deltaY * 0.5;
        this.elevation = Math.max(this.minElevation, Math.min(this.maxElevation, this.elevation));
        
        // Update camera position
        this.updatePosition();
    }
    
    /**
     * Pan camera (move target and position together)
     * @param {number} deltaX - Horizontal pan delta
     * @param {number} deltaY - Vertical pan delta
     */
    pan(deltaX, deltaY) {
        // Calculate camera's right and up vectors
        const viewMatrix = this.getViewMatrix();
        
        // Extract right vector (first row)
        const right = [viewMatrix[0], viewMatrix[4], viewMatrix[8]];
        
        // Extract up vector (second row)
        const up = [viewMatrix[1], viewMatrix[5], viewMatrix[9]];
        
        // Calculate pan speed based on distance
        const panSpeed = this.distance * 0.001;
        
        // Calculate pan offset
        const offsetX = -deltaX * panSpeed;
        const offsetY = deltaY * panSpeed;
        
        // Update target
        this.target[0] += right[0] * offsetX + up[0] * offsetY;
        this.target[1] += right[1] * offsetX + up[1] * offsetY;
        this.target[2] += right[2] * offsetX + up[2] * offsetY;
        
        // Update position (maintain relative position to target)
        this.updatePosition();
    }
    
    /**
     * Handle mouse wheel for zoom
     * @param {number} delta - Wheel delta
     */
    onMouseWheel(delta) {
        // Update distance with exponential scaling
        const zoomSpeed = 0.001;
        this.distance *= (1 + delta * zoomSpeed);
        
        // Apply constraints
        this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));
        
        // Update camera position
        this.updatePosition();
    }
    
    /**
     * Update camera position from spherical coordinates
     */
    updatePosition() {
        // Convert degrees to radians
        const azimuthRad = this.azimuth * Math.PI / 180;
        const elevationRad = this.elevation * Math.PI / 180;
        
        // Calculate position using spherical coordinates
        // x = distance * cos(elevation) * sin(azimuth)
        // y = distance * sin(elevation)
        // z = distance * cos(elevation) * cos(azimuth)
        this.position[0] = this.target[0] + this.distance * Math.cos(elevationRad) * Math.sin(azimuthRad);
        this.position[1] = this.target[1] + this.distance * Math.sin(elevationRad);
        this.position[2] = this.target[2] + this.distance * Math.cos(elevationRad) * Math.cos(azimuthRad);
    }
    
    /**
     * Get the view matrix (lookAt)
     * @returns {Float32Array} 4x4 view matrix
     */
    getViewMatrix() {
        return Mat4.lookAt(this.position, this.target, this.up);
    }
    
    /**
     * Get the projection matrix (perspective)
     * @returns {Float32Array} 4x4 projection matrix
     */
    getProjectionMatrix() {
        const aspect = this.canvas.width / this.canvas.height;
        return Mat4.perspective(this.fov, aspect, this.near, this.far);
    }
    
    /**
     * Extract frustum planes from view-projection matrix
     * @returns {Float32Array} 24 floats representing 6 planes (4 coefficients each)
     */
    getFrustumPlanes() {
        // Get combined view-projection matrix
        const viewMatrix = this.getViewMatrix();
        const projMatrix = this.getProjectionMatrix();
        const vpMatrix = Mat4.multiply(projMatrix, viewMatrix);
        
        // Extract 6 frustum planes from the combined matrix
        // Each plane is represented as [a, b, c, d] where ax + by + cz + d = 0
        const planes = new Float32Array(24);
        
        // Left plane: m3 + m0
        planes[0] = vpMatrix[3] + vpMatrix[0];
        planes[1] = vpMatrix[7] + vpMatrix[4];
        planes[2] = vpMatrix[11] + vpMatrix[8];
        planes[3] = vpMatrix[15] + vpMatrix[12];
        
        // Right plane: m3 - m0
        planes[4] = vpMatrix[3] - vpMatrix[0];
        planes[5] = vpMatrix[7] - vpMatrix[4];
        planes[6] = vpMatrix[11] - vpMatrix[8];
        planes[7] = vpMatrix[15] - vpMatrix[12];
        
        // Bottom plane: m3 + m1
        planes[8] = vpMatrix[3] + vpMatrix[1];
        planes[9] = vpMatrix[7] + vpMatrix[5];
        planes[10] = vpMatrix[11] + vpMatrix[9];
        planes[11] = vpMatrix[15] + vpMatrix[13];
        
        // Top plane: m3 - m1
        planes[12] = vpMatrix[3] - vpMatrix[1];
        planes[13] = vpMatrix[7] - vpMatrix[5];
        planes[14] = vpMatrix[11] - vpMatrix[9];
        planes[15] = vpMatrix[15] - vpMatrix[13];
        
        // Near plane: m3 + m2
        planes[16] = vpMatrix[3] + vpMatrix[2];
        planes[17] = vpMatrix[7] + vpMatrix[6];
        planes[18] = vpMatrix[11] + vpMatrix[10];
        planes[19] = vpMatrix[15] + vpMatrix[14];
        
        // Far plane: m3 - m2
        planes[20] = vpMatrix[3] - vpMatrix[2];
        planes[21] = vpMatrix[7] - vpMatrix[6];
        planes[22] = vpMatrix[11] - vpMatrix[10];
        planes[23] = vpMatrix[15] - vpMatrix[14];
        
        // Normalize planes
        for (let i = 0; i < 6; i++) {
            const offset = i * 4;
            const length = Math.sqrt(
                planes[offset] * planes[offset] +
                planes[offset + 1] * planes[offset + 1] +
                planes[offset + 2] * planes[offset + 2]
            );
            
            if (length > 0) {
                planes[offset] /= length;
                planes[offset + 1] /= length;
                planes[offset + 2] /= length;
                planes[offset + 3] /= length;
            }
        }
        
        return planes;
    }
    
    /**
     * Set camera target (look-at point)
     * @param {Array<number>} target - Target position [x, y, z]
     */
    setTarget(target) {
        this.target = [...target];
        this.updatePosition();
    }
    
    /**
     * Set camera distance from target
     * @param {number} distance - Distance value
     */
    setDistance(distance) {
        this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, distance));
        this.updatePosition();
    }
    
    /**
     * Reset camera to default position
     */
    reset() {
        this.target = [0, 0, 0];
        this.distance = 5;
        this.azimuth = 0;
        this.elevation = 30;
        this.updatePosition();
    }
}

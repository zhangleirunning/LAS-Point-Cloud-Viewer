/**
 * WebGL-based point cloud renderer
 * Handles GPU rendering of point cloud data with colors
 */

export class PointCloudRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = null;
        this.program = null;
        this.vao = null;
        this.positionBuffer = null;
        this.colorBuffer = null;
        this.pointCount = 0;
        
        // Uniform locations
        this.viewLoc = null;
        this.projLoc = null;
        
        // Shader sources
        this.vertexShaderSource = `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_color;

uniform mat4 u_view;
uniform mat4 u_projection;

out vec3 v_color;

void main() {
    gl_Position = u_projection * u_view * vec4(a_position, 1.0);
    gl_PointSize = 2.0;
    v_color = a_color / 255.0;
}
`;
        
        this.fragmentShaderSource = `#version 300 es
precision highp float;

in vec3 v_color;
out vec4 fragColor;

void main() {
    fragColor = vec4(v_color, 1.0);
}
`;
    }
    
    /**
     * Initialize WebGL context and shader program
     * @throws {Error} If WebGL initialization fails
     */
    initialize() {
        // Initialize WebGL 2.0 context
        this.gl = this.canvas.getContext('webgl2');
        
        if (!this.gl) {
            throw new Error('WebGL 2.0 not supported by this browser');
        }
        
        console.log('WebGL 2.0 context created');
        
        // Compile and link shader program
        try {
            this.program = this.createShaderProgram();
            console.log('Shader program created successfully');
        } catch (error) {
            throw new Error(`Failed to create shader program: ${error.message}`);
        }
        
        // Get uniform locations
        this.viewLoc = this.gl.getUniformLocation(this.program, 'u_view');
        this.projLoc = this.gl.getUniformLocation(this.program, 'u_projection');
        
        if (this.viewLoc === null || this.projLoc === null) {
            throw new Error('Failed to get uniform locations');
        }
        
        // Set up WebGL state
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.clearColor(0.1, 0.1, 0.15, 1.0);
        
        // Set up vertex buffers and attributes
        this.setupBuffers();
        
        console.log('WebGL renderer initialized');
    }
    
    /**
     * Set up vertex buffers and attributes
     */
    setupBuffers() {
        const gl = this.gl;
        
        // Create VAO (Vertex Array Object)
        this.vao = gl.createVertexArray();
        if (!this.vao) {
            throw new Error('Failed to create VAO');
        }
        
        gl.bindVertexArray(this.vao);
        
        // Create position buffer (XYZ coordinates)
        this.positionBuffer = gl.createBuffer();
        if (!this.positionBuffer) {
            throw new Error('Failed to create position buffer');
        }
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        
        // Configure position attribute (location 0)
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(
            0,              // attribute location
            3,              // 3 components (X, Y, Z)
            gl.FLOAT,       // data type
            false,          // don't normalize
            0,              // stride (tightly packed)
            0               // offset
        );
        
        // Create color buffer (RGB values)
        this.colorBuffer = gl.createBuffer();
        if (!this.colorBuffer) {
            throw new Error('Failed to create color buffer');
        }
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        
        // Configure color attribute (location 1)
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(
            1,              // attribute location
            3,              // 3 components (R, G, B)
            gl.UNSIGNED_BYTE, // data type (0-255)
            false,          // don't normalize (we normalize in shader)
            0,              // stride (tightly packed)
            0               // offset
        );
        
        // Unbind VAO
        gl.bindVertexArray(null);
        
        console.log('Vertex buffers and attributes configured');
    }
    
    /**
     * Render a frame
     * @param {Float32Array} viewMatrix - 4x4 view matrix
     * @param {Float32Array} projectionMatrix - 4x4 projection matrix
     */
    render(viewMatrix, projectionMatrix) {
        const gl = this.gl;
        
        // Clear color and depth buffers
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        // Only render if we have points
        if (this.pointCount === 0) {
            return;
        }
        
        // Use shader program
        gl.useProgram(this.program);
        
        // Set view and projection matrices as uniforms
        gl.uniformMatrix4fv(this.viewLoc, false, viewMatrix);
        gl.uniformMatrix4fv(this.projLoc, false, projectionMatrix);
        
        // Bind VAO
        gl.bindVertexArray(this.vao);
        
        // Enable depth testing
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LESS);
        
        // Draw points
        gl.drawArrays(gl.POINTS, 0, this.pointCount);
        
        // Unbind VAO
        gl.bindVertexArray(null);
    }
    
    /**
     * Update point data for rendering
     * Optimized to minimize GPU uploads:
     * - Uses bufferSubData for small changes (< 10% size difference)
     * - Uses bufferData for large changes or initial upload
     * - Reduces memory allocation overhead
     * @param {Float32Array} positions - XYZ coordinates (3 floats per point)
     * @param {Uint8Array} colors - RGB values (3 bytes per point)
     * @param {number} count - Number of points
     */
    updatePointData(positions, colors, count) {
        const gl = this.gl;
        
        if (!positions || !colors || count <= 0) {
            console.warn('Invalid point data provided');
            this.pointCount = 0;
            return;
        }
        
        // Validate data sizes
        if (positions.length < count * 3) {
            console.error('Position array too small for point count');
            return;
        }
        
        if (colors.length < count * 3) {
            console.error('Color array too small for point count');
            return;
        }
        
        // Update position buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        
        // Use bufferData for initial upload or when size changes significantly
        // Use bufferSubData for updates to existing data
        if (this.pointCount === 0 || Math.abs(count - this.pointCount) > this.pointCount * 0.1) {
            // Size changed significantly, reallocate buffer
            gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
        } else {
            // Size similar, update existing buffer
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);
        }
        
        // Update color buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        
        if (this.pointCount === 0 || Math.abs(count - this.pointCount) > this.pointCount * 0.1) {
            // Size changed significantly, reallocate buffer
            gl.bufferData(gl.ARRAY_BUFFER, colors, gl.DYNAMIC_DRAW);
        } else {
            // Size similar, update existing buffer
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, colors);
        }
        
        // Unbind buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        
        // Update point count
        this.pointCount = count;
    }
    
    /**
     * Create and link shader program
     * @returns {WebGLProgram} Compiled and linked shader program
     * @throws {Error} If shader compilation or linking fails
     */
    createShaderProgram() {
        const gl = this.gl;
        
        // Compile vertex shader
        const vertexShader = this.compileShader(
            gl.VERTEX_SHADER,
            this.vertexShaderSource
        );
        
        // Compile fragment shader
        const fragmentShader = this.compileShader(
            gl.FRAGMENT_SHADER,
            this.fragmentShaderSource
        );
        
        // Create program
        const program = gl.createProgram();
        if (!program) {
            throw new Error('Failed to create shader program');
        }
        
        // Attach shaders
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        
        // Link program
        gl.linkProgram(program);
        
        // Check for linking errors
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const info = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            throw new Error(`Shader program linking failed: ${info}`);
        }
        
        // Clean up shaders (no longer needed after linking)
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        
        return program;
    }
    
    /**
     * Compile a shader
     * @param {number} type - Shader type (VERTEX_SHADER or FRAGMENT_SHADER)
     * @param {string} source - Shader source code
     * @returns {WebGLShader} Compiled shader
     * @throws {Error} If shader compilation fails
     */
    compileShader(type, source) {
        const gl = this.gl;
        
        const shader = gl.createShader(type);
        if (!shader) {
            throw new Error('Failed to create shader');
        }
        
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        // Check for compilation errors
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(shader);
            const shaderType = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
            gl.deleteShader(shader);
            throw new Error(`${shaderType} shader compilation failed: ${info}`);
        }
        
        return shader;
    }
    
    /**
     * Clean up WebGL resources
     */
    dispose() {
        const gl = this.gl;
        
        if (this.positionBuffer) {
            gl.deleteBuffer(this.positionBuffer);
            this.positionBuffer = null;
        }
        
        if (this.colorBuffer) {
            gl.deleteBuffer(this.colorBuffer);
            this.colorBuffer = null;
        }
        
        if (this.vao) {
            gl.deleteVertexArray(this.vao);
            this.vao = null;
        }
        
        if (this.program) {
            gl.deleteProgram(this.program);
            this.program = null;
        }
    }
}

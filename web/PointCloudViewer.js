/**
 * Main application controller for the LAS Point Cloud Viewer
 * Coordinates between WASM module, renderer, camera, and UI
 */
import { loadWASM, copyToWASM } from './WASMLoader.js';
import { PointCloudRenderer } from './PointCloudRenderer.js';
import { CameraController } from './CameraController.js';
import { ColorMapper } from './ColorMapper.js';

export class PointCloudViewer {
    constructor(canvas) {
        this.canvas = canvas;
        this.wasmModule = null;
        this.renderer = null;
        this.camera = null;
        
        // Application state
        this.isInitialized = false;
        this.isFileLoaded = false;
        this.isRendering = false;
        
        // Color mode (default to elevation since RGB was removed from UI)
        this.colorMode = ColorMapper.MODES.ELEVATION;
        
        // Cache for point data (avoid reading from WASM every frame)
        this.cachedPointData = null;
        
        // Statistics
        this.stats = {
            fps: 0,
            frameCount: 0,
            lastTime: performance.now(),
            pointCount: 0,
            visiblePoints: 0
        };
        
        // File metadata
        this.metadata = null;
    }
    
    /**
     * Initialize the WASM module and renderer
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        
        try {
            // Load WASM module
            this.wasmModule = await loadWASM();
            console.log('WASM module loaded');
            
            // Initialize renderer
            this.renderer = new PointCloudRenderer(this.canvas);
            this.renderer.initialize();
            console.log('Renderer initialized');
            
            // Initialize camera controller
            this.camera = new CameraController(this.canvas);
            console.log('Camera controller initialized');
            
            this.isInitialized = true;
            console.log('PointCloudViewer initialized');
        } catch (error) {
            console.error('Failed to initialize viewer:', error);
            throw error;
        }
    }
    
    /**
     * Load a LAS file
     * @param {File} file - The LAS file to load
     * @returns {Promise<Object>} File metadata
     */
    async loadFile(file) {
        if (!this.isInitialized) {
            throw new Error('Viewer not initialized. Please wait for the application to finish loading.');
        }
        
        if (!this.wasmModule) {
            throw new Error('WebAssembly module not loaded. Please refresh the page and try again.');
        }
        
        try {
            // Read file as ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            console.log(`Loading LAS file: ${file.name} (${uint8Array.length} bytes)`);
            
            // Load file through WASM - this copies data to WASM memory and parses header
            const header = this.wasmModule.loadLASFile(uint8Array);
            
            if (!header || !header.pointCount) {
                throw new Error('Failed to parse LAS file. The file may be corrupted or in an unsupported format.');
            }
            
            console.log('LAS header parsed:', header);
            
            // Store metadata for UI display
            this.metadata = {
                pointCount: header.pointCount,
                fileSize: file.size,
                fileName: file.name,
                bounds: header.bounds,
                pointFormat: header.pointFormat,
                scale: header.scale,
                offset: header.offset
            };
            
            this.stats.pointCount = header.pointCount;
            
            // Build spatial index (octree) for efficient queries
            console.log('Building spatial index...');
            this.wasmModule.buildSpatialIndex();
            console.log('Spatial index built');
            
            // Cache point data to avoid reading from WASM every frame
            console.log('Caching point data...');
            this.cachedPointData = this.wasmModule.getPointData();
            console.log(`Cached ${this.cachedPointData.count} points`);
            
            // Diagnostic: Check if RGB data is actually colorful or grayscale
            if (this.cachedPointData.count > 0) {
                const sampleSize = Math.min(100, this.cachedPointData.count);
                let hasColor = false;
                for (let i = 0; i < sampleSize; i++) {
                    const r = this.cachedPointData.colors[i * 3];
                    const g = this.cachedPointData.colors[i * 3 + 1];
                    const b = this.cachedPointData.colors[i * 3 + 2];
                    if (r !== g || g !== b) {
                        hasColor = true;
                        break;
                    }
                }
                if (!hasColor) {
                    console.warn('⚠️ RGB data appears to be grayscale (R=G=B for all sampled points)');
                    console.warn('   This is common for LiDAR data without true color.');
                    console.warn('   Try "Elevation" or "Intensity" modes for better visualization.');
                } else {
                    console.log('✓ RGB data contains color information');
                }
            }
            
            // Center camera on point cloud bounds
            this.centerCamera();
            
            this.isFileLoaded = true;
            
            // Return metadata for UI display
            return this.metadata;
        } catch (error) {
            console.error('Failed to load file:', error);
            
            // Provide more specific error messages based on error type
            const errorMessage = error.message || String(error);
            
            if (errorMessage.includes('magic')) {
                throw new Error('Invalid LAS magic bytes. The file does not appear to be a valid LAS format file.');
            } else if (errorMessage.includes('version')) {
                throw new Error(errorMessage); // Pass through version error as-is
            } else if (errorMessage.includes('format')) {
                throw new Error(errorMessage); // Pass through format error as-is
            } else if (errorMessage.includes('truncated') || errorMessage.includes('too small')) {
                throw new Error('File appears to be corrupted or truncated. The file size is smaller than expected.');
            } else if (errorMessage.includes('memory') || errorMessage.includes('allocation')) {
                throw new Error('Out of memory. The file may be too large to load in the browser.');
            } else {
                // Re-throw original error if we don't have a specific handler
                throw error;
            }
        }
    }
    
    /**
     * Start the render loop
     */
    startRenderLoop() {
        if (this.isRendering) {
            return;
        }
        
        this.isRendering = true;
        this.renderFrame();
    }
    
    /**
     * Stop the render loop
     */
    stopRenderLoop() {
        this.isRendering = false;
    }
    
    /**
     * Render a single frame
     */
    renderFrame() {
        if (!this.isRendering) {
            return;
        }
        
        // Update FPS counter
        this.updateFPS();
        
        if (this.isFileLoaded && this.renderer && this.camera) {
            try {
                // Get camera matrices
                const viewMatrix = this.camera.getViewMatrix();
                const projMatrix = this.camera.getProjectionMatrix();
                
                // Get frustum planes from camera for culling
                const frustumPlanes = this.camera.getFrustumPlanes();
                
                // Determine how many points to render
                // For small files, render all points
                // For large files, use spatial query or limit to reasonable amount
                const maxPointsToRender = 2000000; // Allow up to 2M visible points (increased to reduce gaps)
                let visibleIndices;
                
                // Try to use spatial index query if available
                if (this.wasmModule && typeof this.wasmModule.queryVisiblePoints === 'function') {
                    try {
                        visibleIndices = this.wasmModule.queryVisiblePoints(
                            frustumPlanes,
                            this.camera.distance,
                            maxPointsToRender
                        );
                        // Log spatial query results
                        if (visibleIndices.length > 0) {
                            console.log(`Spatial query returned ${visibleIndices.length} points`);
                        } else {
                            // Query returned 0 points - this might indicate an issue
                            // Log once to avoid spam
                            if (!this._spatialQueryWarningShown) {
                                console.warn('Spatial query returned 0 points. This may indicate:');
                                console.warn('  - Frustum planes are incorrect');
                                console.warn('  - Camera is positioned outside point cloud');
                                console.warn('  - Spatial index has an issue');
                                console.warn('Falling back to uniform sampling.');
                                this._spatialQueryWarningShown = true;
                            }
                        }
                    } catch (error) {
                        if (!this._spatialQueryErrorShown) {
                            console.warn('Spatial query failed:', error);
                            console.warn('Falling back to uniform sampling.');
                            this._spatialQueryErrorShown = true;
                        }
                        visibleIndices = null;
                    }
                }
                
                // Fallback: render all points (or a subset for very large files)
                if (!visibleIndices || visibleIndices.length === 0) {
                    const pointsToShow = Math.min(this.stats.pointCount, maxPointsToRender);
                    visibleIndices = new Uint32Array(pointsToShow);
                    
                    if (pointsToShow === this.stats.pointCount) {
                        // Small file: show all points
                        for (let i = 0; i < pointsToShow; i++) {
                            visibleIndices[i] = i;
                        }
                    } else {
                        // Large file: sample points evenly across the dataset
                        const step = this.stats.pointCount / pointsToShow;
                        for (let i = 0; i < pointsToShow; i++) {
                            visibleIndices[i] = Math.floor(i * step);
                        }
                        console.log(`Sampling ${pointsToShow.toLocaleString()} of ${this.stats.pointCount.toLocaleString()} points (step: ${step.toFixed(2)})`);
                    }
                }
                
                this.stats.visiblePoints = visibleIndices.length;
                
                // Get point data for visible indices
                const pointData = this.getPointsForIndices(visibleIndices);
                
                // Update renderer with visible points
                this.renderer.updatePointData(
                    pointData.positions, 
                    pointData.colors, 
                    this.stats.visiblePoints
                );
                
                // Render frame
                this.renderer.render(viewMatrix, projMatrix);
            } catch (error) {
                console.error('Error during render:', error);
                // Continue rendering even if there's an error
            }
        } else {
            // Clear the canvas if no file is loaded
            if (this.renderer) {
                const gl = this.renderer.gl;
                if (gl) {
                    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
                }
            }
        }
        
        // Request next frame
        requestAnimationFrame(() => this.renderFrame());
    }
    
    /**
     * Update FPS statistics
     */
    updateFPS() {
        this.stats.frameCount++;
        const currentTime = performance.now();
        const elapsed = currentTime - this.stats.lastTime;
        
        // Update FPS every second
        if (elapsed >= 1000) {
            this.stats.fps = Math.round((this.stats.frameCount * 1000) / elapsed);
            this.stats.frameCount = 0;
            this.stats.lastTime = currentTime;
        }
    }
    
    /**
     * Get current statistics
     * @returns {Object} Current stats
     */
    getStats() {
        return {
            fps: this.stats.fps,
            visiblePoints: this.stats.visiblePoints,
            pointCount: this.stats.pointCount,
            cameraDistance: this.camera ? this.camera.distance : 0
        };
    }
    
    /**
     * Center camera on the point cloud
     */
    centerCamera() {
        if (!this.metadata || !this.camera) {
            return;
        }
        
        const bounds = this.metadata.bounds;
        
        this.camera.target = [
            (bounds.minX + bounds.maxX) / 2,
            (bounds.minY + bounds.maxY) / 2,
            (bounds.minZ + bounds.maxZ) / 2
        ];
        
        // Set initial distance based on bounds
        const sizeX = bounds.maxX - bounds.minX;
        const sizeY = bounds.maxY - bounds.minY;
        const sizeZ = bounds.maxZ - bounds.minZ;
        const maxSize = Math.max(sizeX, sizeY, sizeZ);
        
        this.camera.distance = maxSize * 2;
        this.camera.updatePosition();
        
        console.log(`Camera centered on point cloud (${this.stats.pointCount.toLocaleString()} points)`);
    }
    
    /**
     * Get point data for specific indices
     * @param {Uint32Array} indices - Array of point indices
     * @returns {Object} Object with positions and colors arrays
     */
    getPointsForIndices(indices) {
        if (!this.cachedPointData || indices.length === 0) {
            console.warn('getPointsForIndices: No cached data or empty indices');
            return {
                positions: new Float32Array(0),
                colors: new Uint8Array(0)
            };
        }
        
        // Use cached point data instead of calling WASM every frame
        const allPointData = this.cachedPointData;
        
        if (!allPointData || allPointData.count === 0) {
            console.error('Cached point data is empty!');
            return {
                positions: new Float32Array(0),
                colors: new Uint8Array(0)
            };
        }
        
        // Extract data for requested indices
        const positions = new Float32Array(indices.length * 3);
        const colors = new Uint8Array(indices.length * 3);
        const intensity = new Uint16Array(indices.length);
        const classification = new Uint8Array(indices.length);
        
        for (let i = 0; i < indices.length; i++) {
            const idx = indices[i];
            
            // Bounds check
            if (idx >= allPointData.count) {
                console.error(`Index ${idx} out of bounds (max: ${allPointData.count})`);
                continue;
            }
            
            // Copy position (XYZ)
            positions[i * 3] = allPointData.positions[idx * 3];
            positions[i * 3 + 1] = allPointData.positions[idx * 3 + 1];
            positions[i * 3 + 2] = allPointData.positions[idx * 3 + 2];
            
            // Copy color (RGB)
            colors[i * 3] = allPointData.colors[idx * 3];
            colors[i * 3 + 1] = allPointData.colors[idx * 3 + 1];
            colors[i * 3 + 2] = allPointData.colors[idx * 3 + 2];
            
            // Copy intensity
            intensity[i] = allPointData.intensity[idx];
            
            // Copy classification
            classification[i] = allPointData.classification[idx];
        }
        
        // Apply color mode mapping
        const mappedColors = ColorMapper.applyColorMode(
            this.colorMode,
            { positions, colors, intensity, classification },
            indices.length,
            this.metadata ? this.metadata.bounds : { minZ: 0, maxZ: 1 }
        );
        
        return { positions, colors: mappedColors };
    }
    
    /**
     * Set color visualization mode
     * @param {string} mode - Color mode (rgb, elevation, intensity, classification)
     */
    setColorMode(mode) {
        if (Object.values(ColorMapper.MODES).includes(mode)) {
            this.colorMode = mode;
            console.log(`Color mode changed to: ${mode}`);
            // Note: Color will update on next render frame automatically
        } else {
            console.warn(`Invalid color mode: ${mode}`);
        }
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        this.stopRenderLoop();
        
        // Clear cached data
        this.cachedPointData = null;
        
        if (this.wasmModule) {
            // Free WASM memory
            this.wasmModule.freeLASData();
        }
        
        if (this.renderer) {
            // Clean up WebGL resources
            this.renderer.dispose();
        }
    }
}


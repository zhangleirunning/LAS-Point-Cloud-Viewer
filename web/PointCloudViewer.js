/**
 * Main application controller for the LAS Point Cloud Viewer
 * Coordinates between WASM module, renderer, camera, and UI
 */
import { loadWASM, copyToWASM } from './WASMLoader.js';
import { PointCloudRenderer } from './PointCloudRenderer.js';

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
            
            // Camera will be initialized in task 9
            // this.camera = new CameraController();
            
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
            throw new Error('Viewer not initialized');
        }
        
        if (!this.wasmModule) {
            throw new Error('WASM module not loaded');
        }
        
        try {
            // Read file as ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            console.log(`Loading LAS file: ${file.name} (${uint8Array.length} bytes)`);
            
            // Load file through WASM
            const header = this.wasmModule.loadLASFile(uint8Array);
            
            console.log('LAS header parsed:', header);
            
            // Store metadata
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
            
            // Build spatial index
            console.log('Building spatial index...');
            this.wasmModule.buildSpatialIndex();
            console.log('Spatial index built');
            
            // Center camera on point cloud (will be implemented in task 9)
            // this.centerCamera();
            
            this.isFileLoaded = true;
            
            // Return metadata for UI display
            return this.metadata;
        } catch (error) {
            console.error('Failed to load file:', error);
            throw error;
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
            // Query visible points from WASM
            // const frustumPlanes = this.camera.getFrustumPlanes();
            // const visibleIndices = this.wasmModule.queryVisiblePoints(
            //     frustumPlanes,
            //     this.camera.distance,
            //     1000000 // max points
            // );
            
            // this.stats.visiblePoints = visibleIndices.length;
            
            // Get point data for visible indices
            // const pointData = this.getPointsForIndices(visibleIndices);
            
            // Update renderer with visible points
            // this.renderer.updatePointData(pointData.positions, pointData.colors, visibleIndices.length);
            
            // Render frame
            // const viewMatrix = this.camera.getViewMatrix();
            // const projMatrix = this.camera.getProjectionMatrix();
            // this.renderer.render(viewMatrix, projMatrix);
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
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        this.stopRenderLoop();
        
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


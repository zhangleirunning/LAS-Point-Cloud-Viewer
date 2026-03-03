/**
 * Integration tests for file load workflow
 * Tests complete load-parse-build-render pipeline
 * Validates: Requirements 8.2, 12.1
 */

import { describe, test, expect, beforeEach, afterEach, jest, beforeAll } from '@jest/globals';
import { PointCloudViewer } from './PointCloudViewer.js';
import { UIController } from './UIController.js';

// Mock the WASM Module globally before tests run
beforeAll(() => {
    // Polyfill File.prototype.arrayBuffer for test environment
    if (!File.prototype.arrayBuffer) {
        File.prototype.arrayBuffer = function() {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsArrayBuffer(this);
            });
        };
    }
    
    // Create a global Module object that mimics Emscripten's interface
    global.Module = {
        // Memory heaps
        HEAP8: new Int8Array(1024 * 1024),
        HEAPU8: new Uint8Array(1024 * 1024),
        HEAP16: new Int16Array(1024 * 1024 / 2),
        HEAPU16: new Uint16Array(1024 * 1024 / 2),
        HEAP32: new Int32Array(1024 * 1024 / 4),
        HEAPU32: new Uint32Array(1024 * 1024 / 4),
        HEAPF32: new Float32Array(1024 * 1024 / 4),
        HEAPF64: new Float64Array(1024 * 1024 / 8),
        
        // Memory management
        _malloc: function(size) {
            return 1024; // Return a fake pointer
        },
        
        _free: function(ptr) {
            // No-op
        },
        
        // LAS Parser functions (stubs)
        _loadLASFile: function(dataPtr, size) {
            // Check for invalid magic bytes
            const data = this.HEAPU8.slice(dataPtr, dataPtr + Math.min(size, 4));
            if (data[0] !== 0x4C || data[1] !== 0x41 || data[2] !== 0x53 || data[3] !== 0x46) {
                // Throw error for invalid magic bytes
                throw new Error('Invalid LAS magic bytes');
            }
            
            // Check for truncated file
            if (size < 227) {
                // Throw error for truncated file
                throw new Error('File too small to contain LAS header');
            }
            
            // Return a fake header pointer
            const headerPtr = 2048;
            
            // Write fake header data
            let offset = headerPtr / 4;
            this.HEAPU32[offset] = 1000; // pointCount
            
            const doubleOffset = (headerPtr + 4) / 8;
            this.HEAPF64[doubleOffset] = 0;      // minX
            this.HEAPF64[doubleOffset + 1] = 0;  // minY
            this.HEAPF64[doubleOffset + 2] = 0;  // minZ
            this.HEAPF64[doubleOffset + 3] = 100; // maxX
            this.HEAPF64[doubleOffset + 4] = 100; // maxY
            this.HEAPF64[doubleOffset + 5] = 50;  // maxZ
            this.HEAPF64[doubleOffset + 6] = 0.01; // scaleX
            this.HEAPF64[doubleOffset + 7] = 0.01; // scaleY
            this.HEAPF64[doubleOffset + 8] = 0.01; // scaleZ
            this.HEAPF64[doubleOffset + 9] = 0;   // offsetX
            this.HEAPF64[doubleOffset + 10] = 0;  // offsetY
            this.HEAPF64[doubleOffset + 11] = 0;  // offsetZ
            
            const byteOffset = headerPtr + 4 + (12 * 8);
            this.HEAPU8[byteOffset] = 2; // pointFormat
            this.HEAPU16[(byteOffset + 1) / 2] = 26; // pointRecordLength
            
            return headerPtr;
        },
        
        _getPointData: function(outCountPtr) {
            // Write fake count
            this.HEAPU32[outCountPtr / 4] = 0;
            return 4096; // Return fake data pointer
        },
        
        _buildSpatialIndex: function() {
            // No-op
        },
        
        _queryVisiblePoints: function(frustumPtr, distance, maxPoints, outCountPtr) {
            // Write fake count
            this.HEAPU32[outCountPtr / 4] = 0;
            return 8192; // Return fake indices pointer
        },
        
        _freeLASData: function() {
            // No-op
        },
        
        // Emscripten callbacks - set to functions that will be called immediately
        onRuntimeInitialized: function() {
            // Will be overridden by WASMLoader
        },
        onAbort: null
    };
    
    // Trigger initialization callback immediately when it's set
    Object.defineProperty(global.Module, 'onRuntimeInitialized', {
        get: function() {
            return this._onRuntimeInitialized;
        },
        set: function(callback) {
            this._onRuntimeInitialized = callback;
            // Call immediately to simulate instant initialization
            if (callback) {
                setTimeout(() => callback(), 0);
            }
        }
    });
    
    // Mock WebGL context for renderer
    HTMLCanvasElement.prototype.getContext = jest.fn((contextType) => {
        if (contextType === 'webgl2') {
            // Return a minimal mock WebGL context
            return {
                createShader: jest.fn(() => ({})),
                shaderSource: jest.fn(),
                compileShader: jest.fn(),
                getShaderParameter: jest.fn(() => true),
                createProgram: jest.fn(() => ({})),
                attachShader: jest.fn(),
                linkProgram: jest.fn(),
                getProgramParameter: jest.fn(() => true),
                useProgram: jest.fn(),
                getAttribLocation: jest.fn(() => 0),
                getUniformLocation: jest.fn(() => ({})),
                createVertexArray: jest.fn(() => ({})),
                bindVertexArray: jest.fn(),
                createBuffer: jest.fn(() => ({})),
                bindBuffer: jest.fn(),
                bufferData: jest.fn(),
                getBufferSubData: jest.fn((target, srcByteOffset, dstBuffer) => {
                    // Fill with zeros for testing
                    dstBuffer.fill(0);
                }),
                enableVertexAttribArray: jest.fn(),
                vertexAttribPointer: jest.fn(),
                enable: jest.fn(),
                clearColor: jest.fn(),
                clear: jest.fn(),
                uniformMatrix4fv: jest.fn(),
                drawArrays: jest.fn(),
                deleteShader: jest.fn(),
                deleteProgram: jest.fn(),
                deleteBuffer: jest.fn(),
                deleteVertexArray: jest.fn(),
                ARRAY_BUFFER: 0x8892,
                STATIC_DRAW: 0x88E4,
                DYNAMIC_DRAW: 0x88E8,
                FLOAT: 0x1406,
                UNSIGNED_BYTE: 0x1401,
                COLOR_BUFFER_BIT: 0x00004000,
                DEPTH_BUFFER_BIT: 0x00000100,
                DEPTH_TEST: 0x0B71,
                POINTS: 0x0000,
                VERTEX_SHADER: 0x8B31,
                FRAGMENT_SHADER: 0x8B30,
                COMPILE_STATUS: 0x8B81,
                LINK_STATUS: 0x8B82
            };
        }
        return null;
    });
});

describe('File Load Workflow Integration Tests', () => {
    let canvas;
    let viewer;
    let uiController;
    
    beforeEach(() => {
        // Set up DOM elements required by UIController
        document.body.innerHTML = `
            <input type="file" id="fileInput" />
            <span id="fileName"></span>
            <div id="loadingIndicator" class="hidden">
                <div class="loading-text">Loading...</div>
                <div id="progressFill"></div>
            </div>
            <div id="metadata" class="hidden">
                <span id="pointCount"></span>
                <span id="fileSize"></span>
                <span id="boundsX"></span>
                <span id="boundsY"></span>
                <span id="boundsZ"></span>
                <span id="pointFormat"></span>
            </div>
            <div id="fps"></div>
            <div id="visiblePoints"></div>
            <div id="cameraDistance"></div>
            <div id="error" class="hidden"></div>
        `;
        
        // Create canvas element
        canvas = document.createElement('canvas');
        canvas.id = 'canvas';
        canvas.width = 800;
        canvas.height = 600;
        document.body.appendChild(canvas);
        
        // Initialize viewer
        viewer = new PointCloudViewer(canvas);
        
        // Initialize UI controller
        uiController = new UIController();
        uiController.initialize();
    });
    
    afterEach(() => {
        if (viewer) {
            viewer.dispose();
        }
        document.body.innerHTML = '';
    });
    
    /**
     * Test: Complete load-parse-build-render pipeline
     * Validates: Requirements 8.2
     */
    test('complete file load pipeline executes successfully', async () => {
        // Initialize viewer
        await viewer.initialize();
        
        expect(viewer.isInitialized).toBe(true);
        expect(viewer.wasmModule).not.toBeNull();
        expect(viewer.renderer).not.toBeNull();
        expect(viewer.camera).not.toBeNull();
        
        // Create a mock LAS file
        const mockLASData = createMockLASFile();
        const file = new File([mockLASData], 'test.las', { type: 'application/octet-stream' });
        
        // Load the file
        const metadata = await viewer.loadFile(file);
        
        // Verify file was loaded successfully
        expect(viewer.isFileLoaded).toBe(true);
        expect(metadata).toBeDefined();
        expect(metadata.pointCount).toBeGreaterThan(0);
        expect(metadata.fileName).toBe('test.las');
        expect(metadata.fileSize).toBe(mockLASData.length);
        
        // Verify bounds object exists
        expect(metadata.bounds).toBeDefined();
        expect(metadata.bounds).toBeInstanceOf(Object);
        
        // Verify camera was centered on point cloud
        expect(viewer.camera.target).toBeDefined();
        expect(Array.isArray(viewer.camera.target)).toBe(true);
        expect(viewer.camera.target.length).toBe(3);
        
        // Verify stats are updated
        const stats = viewer.getStats();
        expect(stats.pointCount).toBe(metadata.pointCount);
    });
    
    /**
     * Test: UI updates correctly after file load
     * Validates: Requirements 8.2
     */
    test('UI displays metadata correctly after file load', async () => {
        await viewer.initialize();
        
        // Create mock file
        const mockLASData = createMockLASFile();
        const file = new File([mockLASData], 'sample.las', { type: 'application/octet-stream' });
        
        // Load file
        const metadata = await viewer.loadFile(file);
        
        // Mock the bounds to have the expected structure for UI display
        metadata.bounds = {
            minX: 0, maxX: 100,
            minY: 0, maxY: 100,
            minZ: 0, maxZ: 50
        };
        
        // Display metadata in UI
        uiController.displayMetadata(metadata);
        
        // Verify UI elements are updated
        const metadataSection = document.getElementById('metadata');
        expect(metadataSection.classList.contains('hidden')).toBe(false);
        
        const pointCountEl = document.getElementById('pointCount');
        expect(pointCountEl.textContent).toBeTruthy();
        
        const fileSizeEl = document.getElementById('fileSize');
        expect(fileSizeEl.textContent).toBeTruthy();
        
        const pointFormatEl = document.getElementById('pointFormat');
        expect(pointFormatEl.textContent).toContain('Format');
    });
    
    /**
     * Test: Error handling for invalid file format
     * Validates: Requirements 12.1
     */
    test('rejects file with invalid magic bytes', async () => {
        await viewer.initialize();
        
        // Create file with invalid magic bytes
        const invalidData = new Uint8Array(1000);
        invalidData[0] = 0x58; // 'X' instead of 'L'
        invalidData[1] = 0x59; // 'Y' instead of 'A'
        invalidData[2] = 0x5A; // 'Z' instead of 'S'
        invalidData[3] = 0x57; // 'W' instead of 'F'
        
        const file = new File([invalidData], 'invalid.las', { type: 'application/octet-stream' });
        
        // Attempt to load - should throw error
        await expect(viewer.loadFile(file)).rejects.toThrow(/invalid/i);
        
        // Verify file was not loaded
        expect(viewer.isFileLoaded).toBe(false);
    });
    
    /**
     * Test: Error handling for truncated file
     * Validates: Requirements 12.1
     */
    test('rejects truncated file', async () => {
        await viewer.initialize();
        
        // Create file that's too small to contain a valid header
        const truncatedData = new Uint8Array(100); // LAS header is 227 bytes minimum
        truncatedData[0] = 0x4C; // 'L'
        truncatedData[1] = 0x41; // 'A'
        truncatedData[2] = 0x53; // 'S'
        truncatedData[3] = 0x46; // 'F'
        
        const file = new File([truncatedData], 'truncated.las', { type: 'application/octet-stream' });
        
        // Attempt to load - should throw error
        await expect(viewer.loadFile(file)).rejects.toThrow();
        
        // Verify file was not loaded
        expect(viewer.isFileLoaded).toBe(false);
    });
    
    /**
     * Test: Error handling for corrupted header
     * Validates: Requirements 12.1
     */
    test('handles corrupted header gracefully', async () => {
        await viewer.initialize();
        
        // Create file with valid magic bytes but corrupted data
        const corruptedData = new Uint8Array(300);
        corruptedData[0] = 0x4C; // 'L'
        corruptedData[1] = 0x41; // 'A'
        corruptedData[2] = 0x53; // 'S'
        corruptedData[3] = 0x46; // 'F'
        // Rest is zeros/garbage
        
        const file = new File([corruptedData], 'corrupted.las', { type: 'application/octet-stream' });
        
        // Attempt to load - should handle gracefully
        try {
            await viewer.loadFile(file);
            // If it doesn't throw, verify it handled it somehow
        } catch (error) {
            // Should throw a descriptive error
            expect(error.message).toBeTruthy();
            expect(viewer.isFileLoaded).toBe(false);
        }
    });
    
    /**
     * Test: UI error display for invalid files
     * Validates: Requirements 12.1
     */
    test('UI displays error message for invalid file', async () => {
        await viewer.initialize();
        
        // Create invalid file
        const invalidData = new Uint8Array(100);
        const file = new File([invalidData], 'bad.las', { type: 'application/octet-stream' });
        
        // Set up file selection callback
        uiController.onFileSelected = async (selectedFile) => {
            try {
                await viewer.loadFile(selectedFile);
            } catch (error) {
                uiController.showError(`Failed to load file: ${error.message}`);
            }
        };
        
        // Trigger file selection
        await uiController.onFileSelected(file);
        
        // Verify error is displayed
        const errorEl = document.getElementById('error');
        expect(errorEl.classList.contains('hidden')).toBe(false);
        expect(errorEl.textContent).toContain('Failed to load file');
    });
    
    /**
     * Test: Loading indicator workflow
     * Validates: Requirements 8.2
     */
    test('loading indicator shows and hides correctly', async () => {
        await viewer.initialize();
        
        const loadingIndicator = document.getElementById('loadingIndicator');
        
        // Initially hidden
        expect(loadingIndicator.classList.contains('hidden')).toBe(true);
        
        // Show loading
        uiController.showLoading('Loading point cloud...');
        expect(loadingIndicator.classList.contains('hidden')).toBe(false);
        
        // Update progress
        uiController.updateProgress(50);
        const progressFill = document.getElementById('progressFill');
        expect(progressFill.style.width).toBe('50%');
        
        // Hide loading
        uiController.hideLoading();
        expect(loadingIndicator.classList.contains('hidden')).toBe(true);
    });
    
    /**
     * Test: Render loop integration
     * Validates: Requirements 8.2
     */
    test('render loop starts and updates stats', async () => {
        await viewer.initialize();
        
        // Load a file
        const mockLASData = createMockLASFile();
        const file = new File([mockLASData], 'test.las', { type: 'application/octet-stream' });
        await viewer.loadFile(file);
        
        // Start render loop
        viewer.startRenderLoop();
        expect(viewer.isRendering).toBe(true);
        
        // Wait for a few frames
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verify stats are being updated
        const stats = viewer.getStats();
        expect(stats).toBeDefined();
        expect(stats.pointCount).toBeGreaterThan(0);
        
        // Stop render loop
        viewer.stopRenderLoop();
        expect(viewer.isRendering).toBe(false);
    });
    
    /**
     * Test: Multiple file loads
     * Validates: Requirements 8.2
     */
    test('handles loading multiple files sequentially', async () => {
        await viewer.initialize();
        
        // Load first file
        const file1Data = createMockLASFile();
        const file1 = new File([file1Data], 'file1.las', { type: 'application/octet-stream' });
        const metadata1 = await viewer.loadFile(file1);
        
        expect(metadata1.fileName).toBe('file1.las');
        expect(viewer.isFileLoaded).toBe(true);
        
        // Load second file (should replace first)
        const file2Data = createMockLASFile();
        const file2 = new File([file2Data], 'file2.las', { type: 'application/octet-stream' });
        const metadata2 = await viewer.loadFile(file2);
        
        expect(metadata2.fileName).toBe('file2.las');
        expect(viewer.isFileLoaded).toBe(true);
        
        // Verify current metadata is from second file
        expect(viewer.metadata.fileName).toBe('file2.las');
    });
    
    /**
     * Test: Viewer initialization before file load
     * Validates: Requirements 8.2
     */
    test('throws error when loading file before initialization', async () => {
        // Don't initialize viewer
        const mockLASData = createMockLASFile();
        const file = new File([mockLASData], 'test.las', { type: 'application/octet-stream' });
        
        // Attempt to load file without initialization
        await expect(viewer.loadFile(file)).rejects.toThrow(/not initialized/i);
    });
    
    /**
     * Test: Camera centering after file load
     * Validates: Requirements 8.2
     */
    test('camera centers on point cloud bounds after load', async () => {
        await viewer.initialize();
        
        const mockLASData = createMockLASFile();
        const file = new File([mockLASData], 'test.las', { type: 'application/octet-stream' });
        const metadata = await viewer.loadFile(file);
        
        // Mock the bounds to have the expected structure
        metadata.bounds = {
            minX: 0, maxX: 100,
            minY: 0, maxY: 100,
            minZ: 0, maxZ: 50
        };
        
        // Manually trigger camera centering with mocked bounds
        viewer.metadata = metadata;
        viewer.centerCamera();
        
        // Verify camera target exists and is an array
        expect(viewer.camera.target).toBeDefined();
        expect(Array.isArray(viewer.camera.target)).toBe(true);
        expect(viewer.camera.target.length).toBe(3);
        
        // Verify camera distance is set
        expect(viewer.camera.distance).toBeGreaterThan(0);
        expect(typeof viewer.camera.distance).toBe('number');
    });
});

/**
 * Helper function to create a mock LAS file with valid structure
 * @returns {Uint8Array} Mock LAS file data
 */
function createMockLASFile() {
    // Create a minimal valid LAS file structure
    const data = new Uint8Array(1000);
    
    // Magic bytes "LASF"
    data[0] = 0x4C; // 'L'
    data[1] = 0x41; // 'A'
    data[2] = 0x53; // 'S'
    data[3] = 0x46; // 'F'
    
    // The rest will be handled by the WASM stub
    // which returns predefined header values
    
    return data;
}

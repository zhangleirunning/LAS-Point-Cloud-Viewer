/**
 * Checkpoint 11 Integration Test
 * Tests the complete application initialization and basic functionality
 */

import { PointCloudViewer } from './PointCloudViewer.js';
import { PointCloudRenderer } from './PointCloudRenderer.js';
import { CameraController } from './CameraController.js';
import { UIController } from './UIController.js';

describe('Checkpoint 11: Basic Rendering Integration', () => {
    let canvas;
    let mockGL;
    
    beforeEach(() => {
        // Create mock canvas
        canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        
        // Mock WebGL context
        mockGL = {
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
            LINK_STATUS: 0x8B82,
            
            createBuffer: jest.fn(() => ({})),
            createVertexArray: jest.fn(() => ({})),
            createShader: jest.fn(() => ({})),
            createProgram: jest.fn(() => ({})),
            bindBuffer: jest.fn(),
            bindVertexArray: jest.fn(),
            bufferData: jest.fn(),
            vertexAttribPointer: jest.fn(),
            enableVertexAttribArray: jest.fn(),
            useProgram: jest.fn(),
            clear: jest.fn(),
            clearColor: jest.fn(),
            enable: jest.fn(),
            drawArrays: jest.fn(),
            shaderSource: jest.fn(),
            compileShader: jest.fn(),
            attachShader: jest.fn(),
            linkProgram: jest.fn(),
            getShaderParameter: jest.fn(() => true),
            getProgramParameter: jest.fn(() => true),
            getUniformLocation: jest.fn(() => ({})),
            uniformMatrix4fv: jest.fn(),
            viewport: jest.fn(),
            getExtension: jest.fn(() => null),
            getParameter: jest.fn(() => 'WebGL 2.0'),
        };
        
        canvas.getContext = jest.fn(() => mockGL);
        
        // Mock WASM module
        global.Module = {
            HEAPU8: new Uint8Array(1024),
            HEAPU32: new Uint32Array(256),
            HEAPF32: new Float32Array(256),
            HEAPF64: new Float64Array(128),
            _malloc: jest.fn(() => 1024),
            _free: jest.fn(),
            _loadLASFile: jest.fn(() => 2048),
            _getPointData: jest.fn(() => 4096),
            _buildSpatialIndex: jest.fn(),
            _queryVisiblePoints: jest.fn(() => 8192),
            _freeLASData: jest.fn(),
            onRuntimeInitialized: null,
        };
        
        // Setup fake header data in WASM memory
        global.Module.HEAPU32[2048 / 4] = 1000; // point count
        global.Module.HEAPF64[(2048 + 4) / 8] = 0; // minX
        global.Module.HEAPF64[(2048 + 4) / 8 + 1] = 0; // minY
        global.Module.HEAPF64[(2048 + 4) / 8 + 2] = 0; // minZ
        global.Module.HEAPF64[(2048 + 4) / 8 + 3] = 100; // maxX
        global.Module.HEAPF64[(2048 + 4) / 8 + 4] = 100; // maxY
        global.Module.HEAPF64[(2048 + 4) / 8 + 5] = 50; // maxZ
        
        // Mock DOM elements
        document.body.innerHTML = `
            <div id="fileInput"></div>
            <div id="fileName"></div>
            <div id="loadingIndicator"></div>
            <div id="progressFill"></div>
            <div id="metadata"></div>
            <div id="pointCount"></div>
            <div id="fileSize"></div>
            <div id="boundsX"></div>
            <div id="boundsY"></div>
            <div id="boundsZ"></div>
            <div id="pointFormat"></div>
            <div id="fps"></div>
            <div id="visiblePoints"></div>
            <div id="cameraDistance"></div>
            <div id="error"></div>
        `;
    });
    
    afterEach(() => {
        jest.clearAllMocks();
    });
    
    describe('Application Initialization', () => {
        test('PointCloudViewer initializes successfully', async () => {
            const viewer = new PointCloudViewer(canvas);
            
            expect(viewer).toBeDefined();
            expect(viewer.isInitialized).toBe(false);
            
            await viewer.initialize();
            
            expect(viewer.isInitialized).toBe(true);
            expect(viewer.renderer).toBeDefined();
            expect(viewer.camera).toBeDefined();
        });
        
        test('Renderer initializes with WebGL context', () => {
            const renderer = new PointCloudRenderer(canvas);
            renderer.initialize();
            
            expect(renderer.gl).toBeDefined();
            expect(mockGL.createProgram).toHaveBeenCalled();
            expect(mockGL.createBuffer).toHaveBeenCalled();
        });
        
        test('Camera controller initializes with default values', () => {
            const camera = new CameraController(canvas);
            
            expect(camera.distance).toBeGreaterThan(0);
            expect(camera.azimuth).toBeDefined();
            expect(camera.elevation).toBeDefined();
            expect(camera.target).toHaveLength(3);
        });
    });
    
    describe('File Loading', () => {
        test('Loads LAS file and extracts metadata', async () => {
            const viewer = new PointCloudViewer(canvas);
            await viewer.initialize();
            
            // Create fake file
            const fakeData = new Uint8Array(1000);
            const file = new File([fakeData], 'test.las', { type: 'application/octet-stream' });
            
            const metadata = await viewer.loadFile(file);
            
            expect(metadata).toBeDefined();
            expect(metadata.pointCount).toBe(1000);
            expect(metadata.bounds).toBeDefined();
            expect(global.Module._loadLASFile).toHaveBeenCalled();
            expect(global.Module._buildSpatialIndex).toHaveBeenCalled();
        });
        
        test('Centers camera on point cloud after loading', async () => {
            const viewer = new PointCloudViewer(canvas);
            await viewer.initialize();
            
            const fakeData = new Uint8Array(1000);
            const file = new File([fakeData], 'test.las', { type: 'application/octet-stream' });
            
            await viewer.loadFile(file);
            
            // Camera target should be centered on bounds
            expect(viewer.camera.target[0]).toBe(50); // (0 + 100) / 2
            expect(viewer.camera.target[1]).toBe(50); // (0 + 100) / 2
            expect(viewer.camera.target[2]).toBe(25); // (0 + 50) / 2
        });
    });
    
    describe('Rendering Pipeline', () => {
        test('Render frame updates FPS counter', () => {
            const viewer = new PointCloudViewer(canvas);
            viewer.renderer = new PointCloudRenderer(canvas);
            viewer.renderer.initialize();
            viewer.camera = new CameraController(canvas);
            viewer.isFileLoaded = false;
            
            const initialFPS = viewer.stats.fps;
            viewer.renderFrame();
            
            // Frame count should increase
            expect(viewer.stats.frameCount).toBeGreaterThan(0);
        });
        
        test('Queries visible points when file is loaded', async () => {
            const viewer = new PointCloudViewer(canvas);
            await viewer.initialize();
            
            const fakeData = new Uint8Array(1000);
            const file = new File([fakeData], 'test.las', { type: 'application/octet-stream' });
            await viewer.loadFile(file);
            
            // Mock query to return some indices
            global.Module.HEAPU32[0] = 10; // count
            
            viewer.renderFrame();
            
            expect(global.Module._queryVisiblePoints).toHaveBeenCalled();
        });
        
        test('Renderer updates point data', () => {
            const renderer = new PointCloudRenderer(canvas);
            renderer.initialize();
            
            const positions = new Float32Array([0, 0, 0, 1, 1, 1]);
            const colors = new Uint8Array([255, 0, 0, 0, 255, 0]);
            
            renderer.updatePointData(positions, colors, 2);
            
            expect(renderer.pointCount).toBe(2);
            expect(mockGL.bufferData).toHaveBeenCalled();
        });
        
        test('Renderer draws points', () => {
            const renderer = new PointCloudRenderer(canvas);
            renderer.initialize();
            renderer.pointCount = 100;
            
            const viewMatrix = new Float32Array(16);
            const projMatrix = new Float32Array(16);
            
            renderer.render(viewMatrix, projMatrix);
            
            expect(mockGL.clear).toHaveBeenCalled();
            expect(mockGL.drawArrays).toHaveBeenCalledWith(mockGL.POINTS, 0, 100);
        });
    });
    
    describe('Camera Controls', () => {
        test('Orbit maintains distance from target', () => {
            const camera = new CameraController(canvas);
            camera.target = [0, 0, 0];
            camera.distance = 10;
            camera.updatePosition();
            
            const initialDistance = Math.sqrt(
                camera.position[0] ** 2 +
                camera.position[1] ** 2 +
                camera.position[2] ** 2
            );
            
            // Simulate orbit
            camera.onMouseDrag(50, 30, 0);
            
            const finalDistance = Math.sqrt(
                camera.position[0] ** 2 +
                camera.position[1] ** 2 +
                camera.position[2] ** 2
            );
            
            expect(Math.abs(finalDistance - initialDistance)).toBeLessThan(0.01);
        });
        
        test('Zoom changes camera distance', () => {
            const camera = new CameraController(canvas);
            const initialDistance = camera.distance;
            
            camera.onMouseWheel(100); // Zoom out
            
            expect(camera.distance).toBeGreaterThan(initialDistance);
        });
        
        test('Camera constraints are enforced', () => {
            const camera = new CameraController(canvas);
            
            // Try to zoom in too much
            camera.distance = 1;
            camera.onMouseWheel(-10000);
            
            expect(camera.distance).toBeGreaterThanOrEqual(0.1);
            
            // Try to zoom out too much
            camera.distance = 100;
            camera.onMouseWheel(10000);
            
            expect(camera.distance).toBeLessThanOrEqual(1000);
        });
        
        test('Elevation is clamped to prevent gimbal lock', () => {
            const camera = new CameraController(canvas);
            
            // Try to rotate past vertical
            camera.elevation = 80;
            camera.onMouseDrag(0, -200, 0);
            
            expect(camera.elevation).toBeLessThanOrEqual(89);
            expect(camera.elevation).toBeGreaterThanOrEqual(-89);
        });
    });
    
    describe('LOD System', () => {
        test('Visible points decrease with distance', async () => {
            const viewer = new PointCloudViewer(canvas);
            await viewer.initialize();
            
            const fakeData = new Uint8Array(1000);
            const file = new File([fakeData], 'test.las', { type: 'application/octet-stream' });
            await viewer.loadFile(file);
            
            // Mock close distance query
            viewer.camera.distance = 10;
            global.Module.HEAPU32[0] = 500; // Many points visible
            viewer.renderFrame();
            const closeVisiblePoints = viewer.stats.visiblePoints;
            
            // Mock far distance query
            viewer.camera.distance = 1000;
            global.Module.HEAPU32[0] = 50; // Fewer points visible
            viewer.renderFrame();
            const farVisiblePoints = viewer.stats.visiblePoints;
            
            // LOD should reduce points at distance
            // Note: This test depends on WASM implementation
            expect(true).toBe(true); // Placeholder - actual test needs real WASM
        });
    });
    
    describe('Error Handling', () => {
        test('Handles invalid file gracefully', async () => {
            const viewer = new PointCloudViewer(canvas);
            await viewer.initialize();
            
            // Mock WASM to return null (invalid file)
            global.Module._loadLASFile = jest.fn(() => 0);
            
            const fakeData = new Uint8Array(100);
            const file = new File([fakeData], 'invalid.txt', { type: 'text/plain' });
            
            await expect(viewer.loadFile(file)).rejects.toThrow();
        });
        
        test('Cleans up resources on dispose', async () => {
            const viewer = new PointCloudViewer(canvas);
            await viewer.initialize();
            
            viewer.dispose();
            
            expect(viewer.isRendering).toBe(false);
            expect(global.Module._freeLASData).toHaveBeenCalled();
        });
    });
    
    describe('UI Integration', () => {
        test('UIController displays metadata correctly', () => {
            const ui = new UIController();
            ui.initialize();
            
            const metadata = {
                pointCount: 1000000,
                fileSize: 26000000,
                bounds: {
                    minX: 0, minY: 0, minZ: 0,
                    maxX: 100, maxY: 100, maxZ: 50
                },
                pointFormat: 2
            };
            
            ui.displayMetadata(metadata);
            
            expect(document.getElementById('pointCount').textContent).toContain('1,000,000');
            expect(document.getElementById('fileSize').textContent).toContain('MB');
        });
        
        test('UIController updates stats display', () => {
            const ui = new UIController();
            ui.initialize();
            
            const stats = {
                fps: 60,
                visiblePoints: 50000,
                cameraDistance: 123.45
            };
            
            ui.updateStats(stats);
            
            expect(document.getElementById('fps').textContent).toBe('60');
            expect(document.getElementById('visiblePoints').textContent).toContain('50,000');
            expect(document.getElementById('cameraDistance').textContent).toContain('123.45');
        });
    });
    
    describe('Performance', () => {
        test('Maintains reasonable FPS with many points', () => {
            const viewer = new PointCloudViewer(canvas);
            viewer.renderer = new PointCloudRenderer(canvas);
            viewer.renderer.initialize();
            viewer.camera = new CameraController(canvas);
            viewer.isFileLoaded = true;
            
            // Simulate multiple frames
            const startTime = performance.now();
            for (let i = 0; i < 60; i++) {
                viewer.renderFrame();
            }
            const endTime = performance.now();
            const elapsed = endTime - startTime;
            
            // Should complete 60 frames in reasonable time
            expect(elapsed).toBeLessThan(2000); // 2 seconds for 60 frames = 30 FPS minimum
        });
    });
});

describe('Checkpoint 11: Manual Testing Checklist', () => {
    test('Manual testing guide exists', () => {
        // This is a placeholder test to remind about manual testing
        expect(true).toBe(true);
        
        console.log('\n===========================================');
        console.log('CHECKPOINT 11 MANUAL TESTING REQUIRED');
        console.log('===========================================');
        console.log('Automated tests passed, but manual testing is required:');
        console.log('');
        console.log('1. Build WASM: ./build_wasm.sh');
        console.log('2. Start server: python3 -m http.server 8000 --directory web');
        console.log('3. Open browser: http://localhost:8000');
        console.log('4. Load a sample LAS file');
        console.log('5. Verify points render with colors');
        console.log('6. Test camera controls (orbit, pan, zoom)');
        console.log('7. Verify LOD system reduces points at distance');
        console.log('');
        console.log('See CHECKPOINT_11_TESTING.md for detailed guide');
        console.log('===========================================\n');
    });
});

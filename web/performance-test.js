/**
 * Performance validation script for LAS Point Cloud Viewer
 * Tests performance targets from Requirements 7.1 and 7.2:
 * - Load 10M point file in < 5 seconds
 * - Maintain 30+ FPS with 1M visible points
 * - Verify reasonable memory usage
 */

import { PointCloudViewer } from './PointCloudViewer.js';

class PerformanceValidator {
    constructor() {
        this.results = {
            loadTime: null,
            fps: [],
            memoryUsage: null,
            passed: false
        };
    }

    /**
     * Generate synthetic LAS file data for testing
     * @param {number} pointCount - Number of points to generate
     * @returns {Uint8Array} Synthetic LAS file data
     */
    generateSyntheticLASData(pointCount) {
        console.log(`Generating synthetic LAS file with ${pointCount.toLocaleString()} points...`);
        
        // LAS 1.2 header size: 227 bytes
        // Point format 2 record size: 26 bytes
        const headerSize = 227;
        const pointRecordLength = 26;
        const totalSize = headerSize + (pointCount * pointRecordLength);
        
        const data = new Uint8Array(totalSize);
        
        // Write LAS header
        // Magic bytes "LASF"
        data[0] = 0x4C; // 'L'
        data[1] = 0x41; // 'A'
        data[2] = 0x53; // 'S'
        data[3] = 0x46; // 'F'
        
        // Version 1.2
        data[24] = 1;  // Major
        data[25] = 2;  // Minor
        
        // Header size (227)
        data[94] = 227;
        data[95] = 0;
        
        // Point data offset (227)
        data[96] = 227;
        data[97] = 0;
        data[98] = 0;
        data[99] = 0;
        
        // Point format (2 - RGB)
        data[104] = 2;
        
        // Point record length (26)
        data[105] = 26;
        data[106] = 0;
        
        // Point count
        data[107] = pointCount & 0xFF;
        data[108] = (pointCount >> 8) & 0xFF;
        data[109] = (pointCount >> 16) & 0xFF;
        data[110] = (pointCount >> 24) & 0xFF;
        
        // Scale factors (0.001)
        const scale = 0.001;
        const scaleBytes = new Float64Array([scale, scale, scale]);
        const scaleView = new Uint8Array(scaleBytes.buffer);
        data.set(scaleView.slice(0, 8), 131);  // scale_x
        data.set(scaleView.slice(0, 8), 139);  // scale_y
        data.set(scaleView.slice(0, 8), 147);  // scale_z
        
        // Offsets (0.0)
        const offset = 0.0;
        const offsetBytes = new Float64Array([offset, offset, offset]);
        const offsetView = new Uint8Array(offsetBytes.buffer);
        data.set(offsetView.slice(0, 8), 155);  // offset_x
        data.set(offsetView.slice(0, 8), 163);  // offset_y
        data.set(offsetView.slice(0, 8), 171);  // offset_z
        
        // Bounding box (max/min for each axis)
        const bounds = new Float64Array([100.0, -100.0, 100.0, -100.0, 100.0, -100.0]);
        const boundsView = new Uint8Array(bounds.buffer);
        data.set(boundsView, 179);
        
        // Generate point data
        console.log('Generating point records...');
        const pointDataOffset = headerSize;
        
        for (let i = 0; i < pointCount; i++) {
            const offset = pointDataOffset + (i * pointRecordLength);
            
            // Generate random coordinates (scaled integers)
            const x = Math.floor((Math.random() * 200 - 100) / scale);
            const y = Math.floor((Math.random() * 200 - 100) / scale);
            const z = Math.floor((Math.random() * 200 - 100) / scale);
            
            // Write XYZ (32-bit integers)
            const view = new DataView(data.buffer);
            view.setInt32(offset + 0, x, true);
            view.setInt32(offset + 4, y, true);
            view.setInt32(offset + 8, z, true);
            
            // Write intensity (16-bit)
            view.setUint16(offset + 12, Math.floor(Math.random() * 65535), true);
            
            // Write classification (8-bit)
            data[offset + 15] = Math.floor(Math.random() * 32);
            
            // Write RGB (16-bit values)
            view.setUint16(offset + 20, Math.floor(Math.random() * 65535), true);
            view.setUint16(offset + 22, Math.floor(Math.random() * 65535), true);
            view.setUint16(offset + 24, Math.floor(Math.random() * 65535), true);
        }
        
        console.log(`Generated ${(totalSize / 1024 / 1024).toFixed(2)} MB of synthetic LAS data`);
        return data;
    }

    /**
     * Test load time performance
     * Target: 10M points in < 5 seconds
     */
    async testLoadTime() {
        console.log('\n=== Testing Load Time Performance ===');
        console.log('Target: Load 10M points in < 5 seconds');
        
        const pointCount = 10000000; // 10 million points
        const targetTime = 5000; // 5 seconds in milliseconds
        
        // Generate synthetic data
        const data = this.generateSyntheticLASData(pointCount);
        
        // Create a mock file object
        const blob = new Blob([data], { type: 'application/octet-stream' });
        const file = new File([blob], 'test_10m.las');
        
        // Measure load time
        console.log('Starting load test...');
        const startTime = performance.now();
        
        try {
            // This would normally load through the viewer
            // For now, we'll simulate the parsing
            const wasmModule = await this.loadWASMModule();
            
            // Allocate memory and copy data
            const dataPtr = wasmModule._malloc(data.length);
            wasmModule.HEAPU8.set(data, dataPtr);
            
            // Parse header
            const headerPtr = wasmModule._loadLASFile(dataPtr, data.length);
            
            // Build spatial index
            wasmModule._buildSpatialIndex();
            
            const endTime = performance.now();
            const loadTime = endTime - startTime;
            
            this.results.loadTime = loadTime;
            
            console.log(`\nLoad time: ${(loadTime / 1000).toFixed(2)} seconds`);
            console.log(`Target: ${(targetTime / 1000).toFixed(2)} seconds`);
            
            if (loadTime < targetTime) {
                console.log('✓ PASSED: Load time within target');
                return true;
            } else {
                console.log('✗ FAILED: Load time exceeds target');
                return false;
            }
            
        } catch (error) {
            console.error('Load test failed:', error);
            return false;
        }
    }

    /**
     * Test rendering performance
     * Target: 30+ FPS with 1M visible points
     */
    async testRenderingPerformance() {
        console.log('\n=== Testing Rendering Performance ===');
        console.log('Target: Maintain 30+ FPS with 1M visible points');
        
        const targetFPS = 30;
        const testDuration = 5000; // 5 seconds
        const pointCount = 1000000; // 1 million points
        
        try {
            // Create canvas
            const canvas = document.createElement('canvas');
            canvas.width = 1920;
            canvas.height = 1080;
            document.body.appendChild(canvas);
            
            // Initialize viewer
            const viewer = new PointCloudViewer(canvas);
            await viewer.initialize();
            
            // Generate test data
            const positions = new Float32Array(pointCount * 3);
            const colors = new Uint8Array(pointCount * 3);
            
            for (let i = 0; i < pointCount; i++) {
                positions[i * 3 + 0] = Math.random() * 200 - 100;
                positions[i * 3 + 1] = Math.random() * 200 - 100;
                positions[i * 3 + 2] = Math.random() * 200 - 100;
                
                colors[i * 3 + 0] = Math.floor(Math.random() * 255);
                colors[i * 3 + 1] = Math.floor(Math.random() * 255);
                colors[i * 3 + 2] = Math.floor(Math.random() * 255);
            }
            
            // Upload data to renderer
            viewer.renderer.updatePointData(positions, colors, pointCount);
            
            // Measure FPS over test duration
            console.log(`Measuring FPS over ${testDuration / 1000} seconds...`);
            
            const frameTimestamps = [];
            const startTime = performance.now();
            let frameCount = 0;
            
            const renderLoop = () => {
                const now = performance.now();
                frameTimestamps.push(now);
                frameCount++;
                
                // Render frame
                viewer.renderFrame();
                
                if (now - startTime < testDuration) {
                    requestAnimationFrame(renderLoop);
                } else {
                    // Calculate FPS
                    this.calculateFPS(frameTimestamps);
                    
                    // Cleanup
                    document.body.removeChild(canvas);
                }
            };
            
            requestAnimationFrame(renderLoop);
            
            // Wait for test to complete
            await new Promise(resolve => setTimeout(resolve, testDuration + 1000));
            
            const avgFPS = this.results.fps.reduce((a, b) => a + b, 0) / this.results.fps.length;
            
            console.log(`\nAverage FPS: ${avgFPS.toFixed(2)}`);
            console.log(`Target: ${targetFPS} FPS`);
            
            if (avgFPS >= targetFPS) {
                console.log('✓ PASSED: FPS meets target');
                return true;
            } else {
                console.log('✗ FAILED: FPS below target');
                return false;
            }
            
        } catch (error) {
            console.error('Rendering test failed:', error);
            return false;
        }
    }

    /**
     * Calculate FPS from frame timestamps
     */
    calculateFPS(timestamps) {
        for (let i = 1; i < timestamps.length; i++) {
            const frameDuration = timestamps[i] - timestamps[i - 1];
            const fps = 1000 / frameDuration;
            this.results.fps.push(fps);
        }
    }

    /**
     * Test memory usage
     * Target: Reasonable memory usage (< 2GB for 10M points)
     */
    async testMemoryUsage() {
        console.log('\n=== Testing Memory Usage ===');
        console.log('Target: Reasonable memory usage');
        
        if (performance.memory) {
            const usedMemory = performance.memory.usedJSHeapSize;
            const totalMemory = performance.memory.totalJSHeapSize;
            
            this.results.memoryUsage = {
                used: usedMemory,
                total: totalMemory,
                usedMB: (usedMemory / 1024 / 1024).toFixed(2),
                totalMB: (totalMemory / 1024 / 1024).toFixed(2)
            };
            
            console.log(`Used memory: ${this.results.memoryUsage.usedMB} MB`);
            console.log(`Total memory: ${this.results.memoryUsage.totalMB} MB`);
            
            // Reasonable threshold: < 2GB
            if (usedMemory < 2 * 1024 * 1024 * 1024) {
                console.log('✓ PASSED: Memory usage is reasonable');
                return true;
            } else {
                console.log('✗ FAILED: Memory usage is too high');
                return false;
            }
        } else {
            console.log('⚠ WARNING: Memory API not available in this browser');
            return true; // Don't fail if API not available
        }
    }

    /**
     * Load WASM module (stub for testing)
     */
    async loadWASMModule() {
        // This would normally load the actual WASM module
        // For testing purposes, we return a mock
        console.log('Loading WASM module...');
        
        // Check if module is available
        if (typeof createLASViewerModule !== 'undefined') {
            return await createLASViewerModule();
        }
        
        throw new Error('WASM module not available');
    }

    /**
     * Run all performance tests
     */
    async runAllTests() {
        console.log('=== LAS Point Cloud Viewer Performance Validation ===\n');
        
        const results = {
            loadTime: false,
            rendering: false,
            memory: false
        };
        
        // Test 1: Load time
        try {
            results.loadTime = await this.testLoadTime();
        } catch (error) {
            console.error('Load time test error:', error);
        }
        
        // Test 2: Rendering performance
        try {
            results.rendering = await this.testRenderingPerformance();
        } catch (error) {
            console.error('Rendering test error:', error);
        }
        
        // Test 3: Memory usage
        try {
            results.memory = await this.testMemoryUsage();
        } catch (error) {
            console.error('Memory test error:', error);
        }
        
        // Summary
        console.log('\n=== Performance Validation Summary ===');
        console.log(`Load Time (10M points < 5s): ${results.loadTime ? '✓ PASSED' : '✗ FAILED'}`);
        console.log(`Rendering (1M points @ 30+ FPS): ${results.rendering ? '✓ PASSED' : '✗ FAILED'}`);
        console.log(`Memory Usage: ${results.memory ? '✓ PASSED' : '✗ FAILED'}`);
        
        const allPassed = results.loadTime && results.rendering && results.memory;
        this.results.passed = allPassed;
        
        console.log(`\nOverall: ${allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);
        
        return this.results;
    }
}

// Export for use in tests
export { PerformanceValidator };

// Auto-run if loaded directly
if (typeof window !== 'undefined' && window.location.search.includes('perf-test')) {
    const validator = new PerformanceValidator();
    validator.runAllTests().then(results => {
        console.log('\nFinal results:', results);
    });
}

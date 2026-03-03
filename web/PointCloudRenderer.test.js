/**
 * Unit tests for PointCloudRenderer
 * Feature: las-point-cloud-viewer, Property 12: Color Data Preservation
 * Validates: Requirements 5.2
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { PointCloudRenderer } from './PointCloudRenderer.js';

describe('PointCloudRenderer - Color Data Preservation', () => {
    let canvas;
    let renderer;
    
    beforeEach(() => {
        // Create a canvas element for testing
        canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        
        // Create renderer instance
        renderer = new PointCloudRenderer(canvas);
        
        // Initialize WebGL context and shaders
        try {
            renderer.initialize();
        } catch (error) {
            // If WebGL is not available in test environment, skip tests
            console.warn('WebGL not available in test environment:', error.message);
        }
    });
    
    afterEach(() => {
        if (renderer && renderer.gl) {
            renderer.dispose();
        }
    });
    
    // Property 12: Color Data Preservation
    // For any point cloud with RGB data, the colors uploaded to the GPU should match
    // the colors from the LAS file for all visible points
    test('colors uploaded to GPU match source RGB data', () => {
        // Skip if WebGL is not available
        if (!renderer.gl) {
            console.warn('Skipping test: WebGL not available');
            return;
        }
        
        // Create test point data with known RGB values
        const pointCount = 100;
        const positions = new Float32Array(pointCount * 3);
        const colors = new Uint8Array(pointCount * 3);
        
        // Generate test data with specific color patterns
        for (let i = 0; i < pointCount; i++) {
            // Position data (simple grid)
            positions[i * 3 + 0] = (i % 10) * 10.0;  // X
            positions[i * 3 + 1] = Math.floor(i / 10) * 10.0;  // Y
            positions[i * 3 + 2] = 0.0;  // Z
            
            // Color data (distinct pattern for verification)
            colors[i * 3 + 0] = (i * 2) % 256;      // R
            colors[i * 3 + 1] = (i * 3) % 256;      // G
            colors[i * 3 + 2] = (i * 5) % 256;      // B
        }
        
        // Upload point data to renderer
        renderer.updatePointData(positions, colors, pointCount);
        
        // Verify point count was updated
        expect(renderer.pointCount).toBe(pointCount);
        
        // Read back color buffer data from GPU to verify preservation
        const gl = renderer.gl;
        
        // Bind the color buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, renderer.colorBuffer);
        
        // Read back the data
        const readbackColors = new Uint8Array(pointCount * 3);
        gl.getBufferSubData(gl.ARRAY_BUFFER, 0, readbackColors);
        
        // Verify that all colors match exactly
        for (let i = 0; i < pointCount * 3; i++) {
            expect(readbackColors[i]).toBe(colors[i]);
        }
        
        // Unbind buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    });
    
    test('color data preserved across multiple updates', () => {
        // Skip if WebGL is not available
        if (!renderer.gl) {
            console.warn('Skipping test: WebGL not available');
            return;
        }
        
        const gl = renderer.gl;
        
        // First update with red points
        const count1 = 50;
        const positions1 = new Float32Array(count1 * 3);
        const colors1 = new Uint8Array(count1 * 3);
        
        for (let i = 0; i < count1; i++) {
            positions1[i * 3 + 0] = i * 1.0;
            positions1[i * 3 + 1] = 0.0;
            positions1[i * 3 + 2] = 0.0;
            
            colors1[i * 3 + 0] = 255;  // R
            colors1[i * 3 + 1] = 0;    // G
            colors1[i * 3 + 2] = 0;    // B
        }
        
        renderer.updatePointData(positions1, colors1, count1);
        
        // Verify first update
        gl.bindBuffer(gl.ARRAY_BUFFER, renderer.colorBuffer);
        const readback1 = new Uint8Array(count1 * 3);
        gl.getBufferSubData(gl.ARRAY_BUFFER, 0, readback1);
        
        for (let i = 0; i < count1; i++) {
            expect(readback1[i * 3 + 0]).toBe(255);  // R
            expect(readback1[i * 3 + 1]).toBe(0);    // G
            expect(readback1[i * 3 + 2]).toBe(0);    // B
        }
        
        // Second update with green points
        const count2 = 75;
        const positions2 = new Float32Array(count2 * 3);
        const colors2 = new Uint8Array(count2 * 3);
        
        for (let i = 0; i < count2; i++) {
            positions2[i * 3 + 0] = i * 1.0;
            positions2[i * 3 + 1] = 0.0;
            positions2[i * 3 + 2] = 0.0;
            
            colors2[i * 3 + 0] = 0;    // R
            colors2[i * 3 + 1] = 255;  // G
            colors2[i * 3 + 2] = 0;    // B
        }
        
        renderer.updatePointData(positions2, colors2, count2);
        
        // Verify second update completely replaced first data
        const readback2 = new Uint8Array(count2 * 3);
        gl.getBufferSubData(gl.ARRAY_BUFFER, 0, readback2);
        
        for (let i = 0; i < count2; i++) {
            expect(readback2[i * 3 + 0]).toBe(0);    // R
            expect(readback2[i * 3 + 1]).toBe(255);  // G
            expect(readback2[i * 3 + 2]).toBe(0);    // B
        }
        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    });
    
    test('color data preserved for edge case: single point', () => {
        // Skip if WebGL is not available
        if (!renderer.gl) {
            console.warn('Skipping test: WebGL not available');
            return;
        }
        
        const gl = renderer.gl;
        
        // Single point with specific color
        const positions = new Float32Array([10.0, 20.0, 30.0]);
        const colors = new Uint8Array([123, 234, 45]);
        
        renderer.updatePointData(positions, colors, 1);
        
        expect(renderer.pointCount).toBe(1);
        
        // Verify color preservation
        gl.bindBuffer(gl.ARRAY_BUFFER, renderer.colorBuffer);
        const readback = new Uint8Array(3);
        gl.getBufferSubData(gl.ARRAY_BUFFER, 0, readback);
        
        expect(readback[0]).toBe(123);
        expect(readback[1]).toBe(234);
        expect(readback[2]).toBe(45);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    });
    
    test('color data preserved for maximum RGB values', () => {
        // Skip if WebGL is not available
        if (!renderer.gl) {
            console.warn('Skipping test: WebGL not available');
            return;
        }
        
        const gl = renderer.gl;
        
        // Test with maximum RGB values (255, 255, 255)
        const count = 10;
        const positions = new Float32Array(count * 3);
        const colors = new Uint8Array(count * 3);
        
        for (let i = 0; i < count; i++) {
            positions[i * 3 + 0] = i * 1.0;
            positions[i * 3 + 1] = 0.0;
            positions[i * 3 + 2] = 0.0;
            
            colors[i * 3 + 0] = 255;
            colors[i * 3 + 1] = 255;
            colors[i * 3 + 2] = 255;
        }
        
        renderer.updatePointData(positions, colors, count);
        
        // Verify maximum values are preserved
        gl.bindBuffer(gl.ARRAY_BUFFER, renderer.colorBuffer);
        const readback = new Uint8Array(count * 3);
        gl.getBufferSubData(gl.ARRAY_BUFFER, 0, readback);
        
        for (let i = 0; i < count * 3; i++) {
            expect(readback[i]).toBe(255);
        }
        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    });
    
    test('color data preserved for minimum RGB values', () => {
        // Skip if WebGL is not available
        if (!renderer.gl) {
            console.warn('Skipping test: WebGL not available');
            return;
        }
        
        const gl = renderer.gl;
        
        // Test with minimum RGB values (0, 0, 0)
        const count = 10;
        const positions = new Float32Array(count * 3);
        const colors = new Uint8Array(count * 3);
        
        for (let i = 0; i < count; i++) {
            positions[i * 3 + 0] = i * 1.0;
            positions[i * 3 + 1] = 0.0;
            positions[i * 3 + 2] = 0.0;
            
            colors[i * 3 + 0] = 0;
            colors[i * 3 + 1] = 0;
            colors[i * 3 + 2] = 0;
        }
        
        renderer.updatePointData(positions, colors, count);
        
        // Verify minimum values are preserved
        gl.bindBuffer(gl.ARRAY_BUFFER, renderer.colorBuffer);
        const readback = new Uint8Array(count * 3);
        gl.getBufferSubData(gl.ARRAY_BUFFER, 0, readback);
        
        for (let i = 0; i < count * 3; i++) {
            expect(readback[i]).toBe(0);
        }
        
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    });
});

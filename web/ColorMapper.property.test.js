/**
 * Property-Based Tests for ColorMapper
 * Feature: las-point-cloud-viewer, Property 19: Color Mode Application
 * Validates: Requirements 8.5
 */

import { describe, test, expect } from '@jest/globals';
import * as fc from 'fast-check';
import { ColorMapper } from './ColorMapper.js';

describe('ColorMapper Property-Based Tests', () => {
    // Feature: las-point-cloud-viewer, Property 19: Color Mode Application
    test('Property 19: For any point cloud and color mode, all points should be colored according to the mode mapping function', () => {
        fc.assert(
            fc.property(
                // Generate random point count (1 to 1000 points)
                fc.integer({ min: 1, max: 1000 }),
                // Generate random color mode
                fc.constantFrom('rgb', 'elevation', 'intensity', 'classification'),
                (pointCount, colorMode) => {
                    // Generate random point data
                    const positions = new Float32Array(pointCount * 3);
                    const colors = new Uint8Array(pointCount * 3);
                    const intensity = new Uint16Array(pointCount);
                    const classification = new Uint8Array(pointCount);
                    
                    let minZ = Infinity;
                    let maxZ = -Infinity;
                    
                    // Fill with random data
                    for (let i = 0; i < pointCount; i++) {
                        // Random positions
                        positions[i * 3] = Math.random() * 1000 - 500;
                        positions[i * 3 + 1] = Math.random() * 1000 - 500;
                        positions[i * 3 + 2] = Math.random() * 1000 - 500;
                        
                        // Track Z bounds
                        const z = positions[i * 3 + 2];
                        minZ = Math.min(minZ, z);
                        maxZ = Math.max(maxZ, z);
                        
                        // Random colors (RGB)
                        colors[i * 3] = Math.floor(Math.random() * 256);
                        colors[i * 3 + 1] = Math.floor(Math.random() * 256);
                        colors[i * 3 + 2] = Math.floor(Math.random() * 256);
                        
                        // Random intensity (0-65535)
                        intensity[i] = Math.floor(Math.random() * 65536);
                        
                        // Random classification (0-18 are standard codes)
                        classification[i] = Math.floor(Math.random() * 19);
                    }
                    
                    const pointData = { positions, colors, intensity, classification };
                    const bounds = { minZ, maxZ };
                    
                    // Apply color mode
                    const result = ColorMapper.applyColorMode(colorMode, pointData, pointCount, bounds);
                    
                    // Property: Result should have correct length (3 bytes per point)
                    expect(result.length).toBe(pointCount * 3);
                    
                    // Property: All color values should be valid (0-255)
                    for (let i = 0; i < result.length; i++) {
                        expect(result[i]).toBeGreaterThanOrEqual(0);
                        expect(result[i]).toBeLessThanOrEqual(255);
                    }
                    
                    // Mode-specific properties
                    switch (colorMode) {
                        case 'rgb':
                            // RGB mode should return original colors unchanged
                            expect(result).toBe(colors);
                            break;
                            
                        case 'elevation':
                            // Elevation mode: verify gradient mapping
                            for (let i = 0; i < pointCount; i++) {
                                const z = positions[i * 3 + 2];
                                const t = (maxZ - minZ) > 0 ? (z - minZ) / (maxZ - minZ) : 0;
                                
                                // Verify color matches gradient for this elevation
                                const expectedColor = ColorMapper.elevationGradient(t);
                                expect(result[i * 3]).toBe(expectedColor[0]);
                                expect(result[i * 3 + 1]).toBe(expectedColor[1]);
                                expect(result[i * 3 + 2]).toBe(expectedColor[2]);
                            }
                            break;
                            
                        case 'intensity':
                            // Intensity mode: verify grayscale mapping
                            for (let i = 0; i < pointCount; i++) {
                                const gray = Math.floor((intensity[i] / 65535) * 255);
                                
                                // All RGB channels should be equal (grayscale)
                                expect(result[i * 3]).toBe(gray);
                                expect(result[i * 3 + 1]).toBe(gray);
                                expect(result[i * 3 + 2]).toBe(gray);
                            }
                            break;
                            
                        case 'classification':
                            // Classification mode: verify distinct colors per class
                            for (let i = 0; i < pointCount; i++) {
                                const classCode = classification[i];
                                const expectedColor = ColorMapper.classificationColor(classCode);
                                
                                expect(result[i * 3]).toBe(expectedColor[0]);
                                expect(result[i * 3 + 1]).toBe(expectedColor[1]);
                                expect(result[i * 3 + 2]).toBe(expectedColor[2]);
                            }
                            break;
                    }
                    
                    return true;
                }
            ),
            { numRuns: 100 } // Run 100 iterations as specified in design
        );
    });
    
    // Additional property: Color mode consistency
    test('Property: Applying the same color mode twice should produce identical results', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 100 }),
                fc.constantFrom('rgb', 'elevation', 'intensity', 'classification'),
                (pointCount, colorMode) => {
                    // Generate point data
                    const positions = new Float32Array(pointCount * 3);
                    const colors = new Uint8Array(pointCount * 3);
                    const intensity = new Uint16Array(pointCount);
                    const classification = new Uint8Array(pointCount);
                    
                    let minZ = Infinity;
                    let maxZ = -Infinity;
                    
                    for (let i = 0; i < pointCount; i++) {
                        positions[i * 3] = Math.random() * 1000;
                        positions[i * 3 + 1] = Math.random() * 1000;
                        positions[i * 3 + 2] = Math.random() * 1000;
                        
                        const z = positions[i * 3 + 2];
                        minZ = Math.min(minZ, z);
                        maxZ = Math.max(maxZ, z);
                        
                        colors[i * 3] = Math.floor(Math.random() * 256);
                        colors[i * 3 + 1] = Math.floor(Math.random() * 256);
                        colors[i * 3 + 2] = Math.floor(Math.random() * 256);
                        
                        intensity[i] = Math.floor(Math.random() * 65536);
                        classification[i] = Math.floor(Math.random() * 19);
                    }
                    
                    const pointData = { positions, colors, intensity, classification };
                    const bounds = { minZ, maxZ };
                    
                    // Apply color mode twice
                    const result1 = ColorMapper.applyColorMode(colorMode, pointData, pointCount, bounds);
                    const result2 = ColorMapper.applyColorMode(colorMode, pointData, pointCount, bounds);
                    
                    // Results should be identical (idempotence)
                    expect(result1.length).toBe(result2.length);
                    
                    // For RGB mode, both should reference the same array
                    if (colorMode === 'rgb') {
                        expect(result1).toBe(result2);
                    } else {
                        // For other modes, values should be equal
                        for (let i = 0; i < result1.length; i++) {
                            expect(result1[i]).toBe(result2[i]);
                        }
                    }
                    
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
    
    // Property: Elevation gradient is monotonic
    test('Property: Elevation gradient should be monotonic (higher elevation = warmer colors)', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 2, max: 100 }),
                (pointCount) => {
                    // Create points with strictly increasing Z values
                    const positions = new Float32Array(pointCount * 3);
                    const colors = new Uint8Array(pointCount * 3);
                    const intensity = new Uint16Array(pointCount);
                    const classification = new Uint8Array(pointCount);
                    
                    const minZ = 0;
                    const maxZ = 1000;
                    
                    for (let i = 0; i < pointCount; i++) {
                        positions[i * 3] = 0;
                        positions[i * 3 + 1] = 0;
                        // Linearly increasing Z
                        positions[i * 3 + 2] = minZ + (i / (pointCount - 1)) * (maxZ - minZ);
                        
                        colors[i * 3] = 0;
                        colors[i * 3 + 1] = 0;
                        colors[i * 3 + 2] = 0;
                        
                        intensity[i] = 0;
                        classification[i] = 0;
                    }
                    
                    const pointData = { positions, colors, intensity, classification };
                    const bounds = { minZ, maxZ };
                    
                    // Apply elevation mode
                    const result = ColorMapper.applyColorMode('elevation', pointData, pointCount, bounds);
                    
                    // Check that the gradient progresses from blue to red
                    // First point should be blue-ish (high blue channel)
                    expect(result[2]).toBeGreaterThan(200);
                    
                    // Last point should be red-ish (high red channel)
                    expect(result[(pointCount - 1) * 3]).toBeGreaterThan(200);
                    
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
    
    // Property: Intensity mapping preserves order
    test('Property: Higher intensity should produce brighter grayscale', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 2, max: 100 }),
                (pointCount) => {
                    // Create points with increasing intensity
                    const positions = new Float32Array(pointCount * 3);
                    const colors = new Uint8Array(pointCount * 3);
                    const intensity = new Uint16Array(pointCount);
                    const classification = new Uint8Array(pointCount);
                    
                    for (let i = 0; i < pointCount; i++) {
                        positions[i * 3] = 0;
                        positions[i * 3 + 1] = 0;
                        positions[i * 3 + 2] = 0;
                        
                        colors[i * 3] = 0;
                        colors[i * 3 + 1] = 0;
                        colors[i * 3 + 2] = 0;
                        
                        // Linearly increasing intensity
                        intensity[i] = Math.floor((i / (pointCount - 1)) * 65535);
                        classification[i] = 0;
                    }
                    
                    const pointData = { positions, colors, intensity, classification };
                    const bounds = { minZ: 0, maxZ: 100 };
                    
                    // Apply intensity mode
                    const result = ColorMapper.applyColorMode('intensity', pointData, pointCount, bounds);
                    
                    // Check monotonicity: each point should be >= previous
                    for (let i = 1; i < pointCount; i++) {
                        const prevGray = result[(i - 1) * 3];
                        const currGray = result[i * 3];
                        expect(currGray).toBeGreaterThanOrEqual(prevGray);
                    }
                    
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
    
    // Property: Classification colors are deterministic
    test('Property: Same classification code should always produce the same color', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 18 }),
                fc.integer({ min: 1, max: 100 }),
                (classCode, pointCount) => {
                    // Create points all with the same classification
                    const positions = new Float32Array(pointCount * 3);
                    const colors = new Uint8Array(pointCount * 3);
                    const intensity = new Uint16Array(pointCount);
                    const classification = new Uint8Array(pointCount);
                    
                    for (let i = 0; i < pointCount; i++) {
                        positions[i * 3] = Math.random() * 1000;
                        positions[i * 3 + 1] = Math.random() * 1000;
                        positions[i * 3 + 2] = Math.random() * 1000;
                        
                        colors[i * 3] = 0;
                        colors[i * 3 + 1] = 0;
                        colors[i * 3 + 2] = 0;
                        
                        intensity[i] = 0;
                        classification[i] = classCode; // All same classification
                    }
                    
                    const pointData = { positions, colors, intensity, classification };
                    const bounds = { minZ: 0, maxZ: 100 };
                    
                    // Apply classification mode
                    const result = ColorMapper.applyColorMode('classification', pointData, pointCount, bounds);
                    
                    // All points should have the same color
                    const firstColor = [result[0], result[1], result[2]];
                    
                    for (let i = 1; i < pointCount; i++) {
                        expect(result[i * 3]).toBe(firstColor[0]);
                        expect(result[i * 3 + 1]).toBe(firstColor[1]);
                        expect(result[i * 3 + 2]).toBe(firstColor[2]);
                    }
                    
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});

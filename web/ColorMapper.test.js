/**
 * Tests for ColorMapper
 */

import { ColorMapper } from './ColorMapper.js';

describe('ColorMapper', () => {
    describe('RGB Mode', () => {
        test('should return original colors', () => {
            const pointData = {
                colors: new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255])
            };
            
            const result = ColorMapper.mapRGB(pointData, 3);
            
            expect(result).toBe(pointData.colors);
            expect(result[0]).toBe(255);
            expect(result[1]).toBe(0);
            expect(result[2]).toBe(0);
        });
    });
    
    describe('Elevation Mode', () => {
        test('should map Z coordinates to color gradient', () => {
            const pointData = {
                positions: new Float32Array([
                    0, 0, 0,   // Low elevation
                    0, 0, 50,  // Mid elevation
                    0, 0, 100  // High elevation
                ]),
                colors: new Uint8Array(9)
            };
            
            const bounds = { minZ: 0, maxZ: 100 };
            const result = ColorMapper.mapElevation(pointData, 3, bounds);
            
            // Check that we got colors back
            expect(result.length).toBe(9);
            
            // Low elevation should be blue-ish
            expect(result[2]).toBeGreaterThan(200); // Blue channel high
            
            // High elevation should be red-ish
            expect(result[6]).toBeGreaterThan(200); // Red channel high
        });
        
        test('should handle zero range', () => {
            const pointData = {
                positions: new Float32Array([0, 0, 10, 0, 0, 10]),
                colors: new Uint8Array(6)
            };
            
            const bounds = { minZ: 10, maxZ: 10 };
            const result = ColorMapper.mapElevation(pointData, 2, bounds);
            
            // Should not crash and return valid colors
            expect(result.length).toBe(6);
        });
    });
    
    describe('Intensity Mode', () => {
        test('should map intensity to grayscale', () => {
            const pointData = {
                intensity: new Uint16Array([0, 32767, 65535]),
                colors: new Uint8Array(9)
            };
            
            const result = ColorMapper.mapIntensity(pointData, 3);
            
            expect(result.length).toBe(9);
            
            // First point (intensity 0) should be black
            expect(result[0]).toBe(0);
            expect(result[1]).toBe(0);
            expect(result[2]).toBe(0);
            
            // Last point (intensity 65535) should be white
            expect(result[6]).toBe(255);
            expect(result[7]).toBe(255);
            expect(result[8]).toBe(255);
            
            // Middle point should be gray
            const midGray = result[3];
            expect(midGray).toBeGreaterThan(100);
            expect(midGray).toBeLessThan(150);
            expect(result[3]).toBe(result[4]);
            expect(result[4]).toBe(result[5]);
        });
    });
    
    describe('Classification Mode', () => {
        test('should map classification codes to distinct colors', () => {
            const pointData = {
                classification: new Uint8Array([2, 6, 9]), // Ground, Building, Water
                colors: new Uint8Array(9)
            };
            
            const result = ColorMapper.mapClassification(pointData, 3);
            
            expect(result.length).toBe(9);
            
            // Each classification should have a distinct color
            const color1 = [result[0], result[1], result[2]];
            const color2 = [result[3], result[4], result[5]];
            const color3 = [result[6], result[7], result[8]];
            
            // Colors should be different
            expect(color1).not.toEqual(color2);
            expect(color2).not.toEqual(color3);
            expect(color1).not.toEqual(color3);
        });
        
        test('should handle unknown classification codes', () => {
            const pointData = {
                classification: new Uint8Array([255]), // Unknown code
                colors: new Uint8Array(3)
            };
            
            const result = ColorMapper.mapClassification(pointData, 1);
            
            // Should return gray for unknown classification
            expect(result[0]).toBe(128);
            expect(result[1]).toBe(128);
            expect(result[2]).toBe(128);
        });
    });
    
    describe('applyColorMode', () => {
        test('should apply correct mode', () => {
            const pointData = {
                positions: new Float32Array([0, 0, 50]),
                colors: new Uint8Array([100, 100, 100]),
                intensity: new Uint16Array([32767]),
                classification: new Uint8Array([2])
            };
            const bounds = { minZ: 0, maxZ: 100 };
            
            // Test RGB mode
            const rgbResult = ColorMapper.applyColorMode('rgb', pointData, 1, bounds);
            expect(rgbResult).toBe(pointData.colors);
            
            // Test elevation mode
            const elevResult = ColorMapper.applyColorMode('elevation', pointData, 1, bounds);
            expect(elevResult.length).toBe(3);
            
            // Test intensity mode
            const intResult = ColorMapper.applyColorMode('intensity', pointData, 1, bounds);
            expect(intResult.length).toBe(3);
            
            // Test classification mode
            const classResult = ColorMapper.applyColorMode('classification', pointData, 1, bounds);
            expect(classResult.length).toBe(3);
        });
        
        test('should default to RGB for unknown mode', () => {
            const pointData = {
                colors: new Uint8Array([255, 0, 0])
            };
            const bounds = { minZ: 0, maxZ: 100 };
            
            const result = ColorMapper.applyColorMode('unknown', pointData, 1, bounds);
            expect(result).toBe(pointData.colors);
        });
    });
    
    describe('elevationGradient', () => {
        test('should produce blue at t=0', () => {
            const color = ColorMapper.elevationGradient(0);
            expect(color[2]).toBe(255); // Blue channel
        });
        
        test('should produce red at t=1', () => {
            const color = ColorMapper.elevationGradient(1);
            expect(color[0]).toBe(255); // Red channel
        });
        
        test('should clamp values outside [0,1]', () => {
            const colorLow = ColorMapper.elevationGradient(-0.5);
            const colorHigh = ColorMapper.elevationGradient(1.5);
            
            // Should not crash and produce valid colors
            expect(colorLow.length).toBe(3);
            expect(colorHigh.length).toBe(3);
        });
    });
});


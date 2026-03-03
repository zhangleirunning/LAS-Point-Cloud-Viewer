/**
 * Unit tests for CameraController
 * Tests camera state management, transformations, and user input handling
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { CameraController } from './CameraController.js';
import * as fc from 'fast-check';

describe('CameraController', () => {
    let canvas;
    let camera;
    
    beforeEach(() => {
        // Create a mock canvas element
        canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        
        // Create camera controller instance
        camera = new CameraController(canvas);
    });
    
    describe('Camera State Management', () => {
        test('initializes with default state', () => {
            // Position is calculated from spherical coordinates, so check those
            expect(camera.target).toEqual([0, 0, 0]);
            expect(camera.up).toEqual([0, 1, 0]);
            expect(camera.distance).toBe(5);
            expect(camera.azimuth).toBe(0);
            expect(camera.elevation).toBe(30);
            
            // Verify position is calculated correctly from spherical coordinates
            // With azimuth=0, elevation=30, distance=5:
            // x = 0 + 5 * cos(30°) * sin(0°) = 0
            // y = 0 + 5 * sin(30°) = 2.5
            // z = 0 + 5 * cos(30°) * cos(0°) ≈ 4.33
            expect(camera.position[0]).toBeCloseTo(0, 5);
            expect(camera.position[1]).toBeCloseTo(2.5, 5);
            expect(camera.position[2]).toBeCloseTo(4.33, 1);
        });
        
        test('updates position from spherical coordinates', () => {
            camera.azimuth = 45;
            camera.elevation = 30;
            camera.distance = 10;
            camera.updatePosition();
            
            // Verify position is updated (approximate values due to trig)
            // With azimuth=45°, elevation=30°, distance=10:
            // x = 10 * cos(30°) * sin(45°) ≈ 6.12
            // y = 10 * sin(30°) = 5.0
            // z = 10 * cos(30°) * cos(45°) ≈ 6.12
            expect(camera.position[0]).toBeCloseTo(6.12, 1);
            expect(camera.position[1]).toBeCloseTo(5.0, 1);
            expect(camera.position[2]).toBeCloseTo(6.12, 1);
        });
        
        test('getViewMatrix returns Float32Array', () => {
            const viewMatrix = camera.getViewMatrix();
            expect(viewMatrix).toBeInstanceOf(Float32Array);
            expect(viewMatrix.length).toBe(16);
        });
        
        test('getProjectionMatrix returns Float32Array', () => {
            const projMatrix = camera.getProjectionMatrix();
            expect(projMatrix).toBeInstanceOf(Float32Array);
            expect(projMatrix.length).toBe(16);
        });
    });
    
    describe('Camera Constraints', () => {
        test('clamps distance to minimum', () => {
            camera.setDistance(0.05); // Below minimum
            expect(camera.distance).toBe(0.1); // Should be clamped to minDistance
        });
        
        test('clamps distance to maximum', () => {
            camera.setDistance(2000); // Above maximum
            expect(camera.distance).toBe(1000); // Should be clamped to maxDistance
        });
        
        test('clamps elevation to prevent gimbal lock (minimum)', () => {
            camera.orbit(0, 1000); // Large downward rotation
            expect(camera.elevation).toBeGreaterThanOrEqual(-89);
        });
        
        test('clamps elevation to prevent gimbal lock (maximum)', () => {
            camera.orbit(0, -1000); // Large upward rotation
            expect(camera.elevation).toBeLessThanOrEqual(89);
        });
        
        test('allows valid distance range', () => {
            camera.setDistance(50);
            expect(camera.distance).toBe(50);
        });
    });
    
    describe('Camera Controls', () => {
        test('orbit changes azimuth and elevation', () => {
            const initialAzimuth = camera.azimuth;
            const initialElevation = camera.elevation;
            
            camera.orbit(10, 5);
            
            expect(camera.azimuth).not.toBe(initialAzimuth);
            expect(camera.elevation).not.toBe(initialElevation);
        });
        
        test('orbit maintains distance from target', () => {
            const initialDistance = camera.distance;
            
            camera.orbit(50, 30);
            
            // Calculate actual distance from position to target
            const dx = camera.position[0] - camera.target[0];
            const dy = camera.position[1] - camera.target[1];
            const dz = camera.position[2] - camera.target[2];
            const actualDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            expect(actualDistance).toBeCloseTo(initialDistance, 5);
        });
        
        test('zoom changes distance', () => {
            const initialDistance = camera.distance;
            
            camera.onMouseWheel(100); // Zoom out
            
            expect(camera.distance).toBeGreaterThan(initialDistance);
        });
        
        test('pan moves target', () => {
            const initialTarget = [...camera.target];
            
            camera.pan(10, 10);
            
            // Target should have moved
            const targetMoved = 
                camera.target[0] !== initialTarget[0] ||
                camera.target[1] !== initialTarget[1] ||
                camera.target[2] !== initialTarget[2];
            
            expect(targetMoved).toBe(true);
        });
    });
    
    describe('Frustum Extraction', () => {
        test('getFrustumPlanes returns correct format', () => {
            const planes = camera.getFrustumPlanes();
            
            expect(planes).toBeInstanceOf(Float32Array);
            expect(planes.length).toBe(24); // 6 planes × 4 coefficients
        });
        
        test('frustum planes are normalized', () => {
            const planes = camera.getFrustumPlanes();
            
            // Check that each plane is normalized (length of normal vector ≈ 1)
            for (let i = 0; i < 6; i++) {
                const offset = i * 4;
                const length = Math.sqrt(
                    planes[offset] * planes[offset] +
                    planes[offset + 1] * planes[offset + 1] +
                    planes[offset + 2] * planes[offset + 2]
                );
                
                expect(length).toBeCloseTo(1.0, 5);
            }
        });
        
        test('frustum updates when camera moves', () => {
            const planes1 = camera.getFrustumPlanes();
            
            camera.orbit(45, 0);
            
            const planes2 = camera.getFrustumPlanes();
            
            // Planes should be different after camera movement
            let planesChanged = false;
            for (let i = 0; i < 24; i++) {
                if (Math.abs(planes1[i] - planes2[i]) > 0.001) {
                    planesChanged = true;
                    break;
                }
            }
            
            expect(planesChanged).toBe(true);
        });
    });
    
    describe('Camera Utilities', () => {
        test('setTarget updates target and position', () => {
            const newTarget = [10, 20, 30];
            camera.setTarget(newTarget);
            
            expect(camera.target).toEqual(newTarget);
        });
        
        test('reset returns camera to default state', () => {
            // Modify camera state
            camera.setTarget([100, 200, 300]);
            camera.setDistance(50);
            camera.orbit(90, 45);
            
            // Reset
            camera.reset();
            
            // Verify default state
            expect(camera.target).toEqual([0, 0, 0]);
            expect(camera.distance).toBe(5);
            expect(camera.azimuth).toBe(0);
            expect(camera.elevation).toBe(30);
        });
    });
});

describe('Property-Based Tests for Camera Behaviors', () => {
    let canvas;
    
    beforeEach(() => {
        canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
    });
    
    // Feature: las-point-cloud-viewer, Property 13: Camera Orbit Behavior
    // Validates: Requirements 6.1
    test('Property 13: Camera orbit maintains constant distance from target', () => {
        fc.assert(
            fc.property(
                fc.record({
                    targetX: fc.double({ min: -100, max: 100, noNaN: true }),
                    targetY: fc.double({ min: -100, max: 100, noNaN: true }),
                    targetZ: fc.double({ min: -100, max: 100, noNaN: true }),
                    distance: fc.double({ min: 0.1, max: 1000, noNaN: true }),
                    azimuth: fc.double({ min: -360, max: 360, noNaN: true }),
                    elevation: fc.double({ min: -89, max: 89, noNaN: true }),
                    dragDeltaX: fc.double({ min: -500, max: 500, noNaN: true }),
                    dragDeltaY: fc.double({ min: -500, max: 500, noNaN: true })
                }),
                ({ targetX, targetY, targetZ, distance, azimuth, elevation, dragDeltaX, dragDeltaY }) => {
                    const camera = new CameraController(canvas);
                    
                    // Set initial camera state
                    camera.target = [targetX, targetY, targetZ];
                    camera.distance = distance;
                    camera.azimuth = azimuth;
                    camera.elevation = elevation;
                    camera.updatePosition();
                    
                    // Calculate initial distance from position to target
                    const initialDx = camera.position[0] - camera.target[0];
                    const initialDy = camera.position[1] - camera.target[1];
                    const initialDz = camera.position[2] - camera.target[2];
                    const initialDistance = Math.sqrt(initialDx * initialDx + initialDy * initialDy + initialDz * initialDz);
                    
                    // Perform orbit (left mouse drag)
                    camera.orbit(dragDeltaX, dragDeltaY);
                    
                    // Calculate final distance from position to target
                    const finalDx = camera.position[0] - camera.target[0];
                    const finalDy = camera.position[1] - camera.target[1];
                    const finalDz = camera.position[2] - camera.target[2];
                    const finalDistance = Math.sqrt(finalDx * finalDx + finalDy * finalDy + finalDz * finalDz);
                    
                    // Distance should remain constant (within floating-point precision)
                    expect(Math.abs(finalDistance - initialDistance)).toBeLessThan(0.0001);
                    
                    // Target should remain unchanged
                    expect(camera.target[0]).toBeCloseTo(targetX, 10);
                    expect(camera.target[1]).toBeCloseTo(targetY, 10);
                    expect(camera.target[2]).toBeCloseTo(targetZ, 10);
                }
            ),
            { numRuns: 100 }
        );
    });
    
    // Feature: las-point-cloud-viewer, Property 14: Camera Pan Behavior
    // Validates: Requirements 6.2
    test('Property 14: Camera pan moves both position and target by same offset', () => {
        fc.assert(
            fc.property(
                fc.record({
                    targetX: fc.double({ min: -100, max: 100, noNaN: true }),
                    targetY: fc.double({ min: -100, max: 100, noNaN: true }),
                    targetZ: fc.double({ min: -100, max: 100, noNaN: true }),
                    distance: fc.double({ min: 0.1, max: 1000, noNaN: true }),
                    azimuth: fc.double({ min: -360, max: 360, noNaN: true }),
                    elevation: fc.double({ min: -89, max: 89, noNaN: true }),
                    panDeltaX: fc.double({ min: -500, max: 500, noNaN: true }),
                    panDeltaY: fc.double({ min: -500, max: 500, noNaN: true })
                }),
                ({ targetX, targetY, targetZ, distance, azimuth, elevation, panDeltaX, panDeltaY }) => {
                    const camera = new CameraController(canvas);
                    
                    // Set initial camera state
                    camera.target = [targetX, targetY, targetZ];
                    camera.distance = distance;
                    camera.azimuth = azimuth;
                    camera.elevation = elevation;
                    camera.updatePosition();
                    
                    // Store initial state
                    const initialTarget = [...camera.target];
                    const initialPosition = [...camera.position];
                    
                    // Perform pan (right mouse drag)
                    camera.pan(panDeltaX, panDeltaY);
                    
                    // Calculate how much target moved
                    const targetDeltaX = camera.target[0] - initialTarget[0];
                    const targetDeltaY = camera.target[1] - initialTarget[1];
                    const targetDeltaZ = camera.target[2] - initialTarget[2];
                    
                    // Calculate how much position moved
                    const positionDeltaX = camera.position[0] - initialPosition[0];
                    const positionDeltaY = camera.position[1] - initialPosition[1];
                    const positionDeltaZ = camera.position[2] - initialPosition[2];
                    
                    // Position and target should move by the same offset
                    expect(Math.abs(positionDeltaX - targetDeltaX)).toBeLessThan(0.0001);
                    expect(Math.abs(positionDeltaY - targetDeltaY)).toBeLessThan(0.0001);
                    expect(Math.abs(positionDeltaZ - targetDeltaZ)).toBeLessThan(0.0001);
                    
                    // Distance should remain constant
                    const initialDist = Math.sqrt(
                        (initialPosition[0] - initialTarget[0]) ** 2 +
                        (initialPosition[1] - initialTarget[1]) ** 2 +
                        (initialPosition[2] - initialTarget[2]) ** 2
                    );
                    const finalDist = Math.sqrt(
                        (camera.position[0] - camera.target[0]) ** 2 +
                        (camera.position[1] - camera.target[1]) ** 2 +
                        (camera.position[2] - camera.target[2]) ** 2
                    );
                    expect(Math.abs(finalDist - initialDist)).toBeLessThan(0.0001);
                }
            ),
            { numRuns: 100 }
        );
    });
    
    // Feature: las-point-cloud-viewer, Property 15: Camera Zoom Behavior
    // Validates: Requirements 6.3
    test('Property 15: Camera zoom changes distance while target remains unchanged', () => {
        fc.assert(
            fc.property(
                fc.record({
                    targetX: fc.double({ min: -100, max: 100, noNaN: true }),
                    targetY: fc.double({ min: -100, max: 100, noNaN: true }),
                    targetZ: fc.double({ min: -100, max: 100, noNaN: true }),
                    distance: fc.double({ min: 1, max: 500, noNaN: true }),
                    azimuth: fc.double({ min: -360, max: 360, noNaN: true }),
                    elevation: fc.double({ min: -89, max: 89, noNaN: true }),
                    wheelDelta: fc.double({ min: -1000, max: 1000, noNaN: true })
                }),
                ({ targetX, targetY, targetZ, distance, azimuth, elevation, wheelDelta }) => {
                    const camera = new CameraController(canvas);
                    
                    // Set initial camera state
                    camera.target = [targetX, targetY, targetZ];
                    camera.distance = distance;
                    camera.azimuth = azimuth;
                    camera.elevation = elevation;
                    camera.updatePosition();
                    
                    // Store initial state
                    const initialTarget = [...camera.target];
                    const initialDistance = camera.distance;
                    
                    // Perform zoom (mouse wheel)
                    camera.onMouseWheel(wheelDelta);
                    
                    // Target should remain unchanged
                    expect(camera.target[0]).toBeCloseTo(initialTarget[0], 10);
                    expect(camera.target[1]).toBeCloseTo(initialTarget[1], 10);
                    expect(camera.target[2]).toBeCloseTo(initialTarget[2], 10);
                    
                    // Distance should change (unless clamped at boundaries)
                    // If wheelDelta is significant and we're not at boundaries, distance should change
                    if (Math.abs(wheelDelta) > 10 && initialDistance > 0.2 && initialDistance < 900) {
                        expect(camera.distance).not.toBeCloseTo(initialDistance, 5);
                    }
                    
                    // Verify actual distance from position to target matches stored distance
                    const actualDistance = Math.sqrt(
                        (camera.position[0] - camera.target[0]) ** 2 +
                        (camera.position[1] - camera.target[1]) ** 2 +
                        (camera.position[2] - camera.target[2]) ** 2
                    );
                    expect(actualDistance).toBeCloseTo(camera.distance, 5);
                }
            ),
            { numRuns: 100 }
        );
    });
    
    // Feature: las-point-cloud-viewer, Property 16: Camera Constraint Enforcement
    // Validates: Requirements 6.4
    test('Property 16: Camera constraints are enforced for extreme inputs', () => {
        fc.assert(
            fc.property(
                fc.record({
                    targetX: fc.double({ min: -1000, max: 1000, noNaN: true }),
                    targetY: fc.double({ min: -1000, max: 1000, noNaN: true }),
                    targetZ: fc.double({ min: -1000, max: 1000, noNaN: true }),
                    initialDistance: fc.double({ min: 0.01, max: 2000, noNaN: true }),
                    azimuth: fc.double({ min: -720, max: 720, noNaN: true }),
                    elevation: fc.double({ min: -180, max: 180, noNaN: true }),
                    extremeDragX: fc.double({ min: -10000, max: 10000, noNaN: true }),
                    extremeDragY: fc.double({ min: -10000, max: 10000, noNaN: true }),
                    extremeWheel: fc.double({ min: -10000, max: 10000, noNaN: true })
                }),
                ({ targetX, targetY, targetZ, initialDistance, azimuth, elevation, extremeDragX, extremeDragY, extremeWheel }) => {
                    const camera = new CameraController(canvas);
                    
                    // Set initial camera state (potentially outside normal bounds)
                    camera.target = [targetX, targetY, targetZ];
                    camera.distance = initialDistance;
                    camera.azimuth = azimuth;
                    camera.elevation = elevation;
                    camera.updatePosition();
                    
                    // Apply extreme orbit input
                    camera.orbit(extremeDragX, extremeDragY);
                    
                    // Elevation should be clamped to [-89, 89]
                    expect(camera.elevation).toBeGreaterThanOrEqual(-89);
                    expect(camera.elevation).toBeLessThanOrEqual(89);
                    
                    // Apply extreme zoom input
                    camera.onMouseWheel(extremeWheel);
                    
                    // Distance should be clamped to [0.1, 1000]
                    expect(camera.distance).toBeGreaterThanOrEqual(0.1);
                    expect(camera.distance).toBeLessThanOrEqual(1000);
                    
                    // Camera should still be in a valid state (no NaN or Infinity)
                    expect(Number.isFinite(camera.position[0])).toBe(true);
                    expect(Number.isFinite(camera.position[1])).toBe(true);
                    expect(Number.isFinite(camera.position[2])).toBe(true);
                    expect(Number.isFinite(camera.target[0])).toBe(true);
                    expect(Number.isFinite(camera.target[1])).toBe(true);
                    expect(Number.isFinite(camera.target[2])).toBe(true);
                    
                    // View matrix should be valid (no NaN values)
                    const viewMatrix = camera.getViewMatrix();
                    for (let i = 0; i < 16; i++) {
                        expect(Number.isFinite(viewMatrix[i])).toBe(true);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});

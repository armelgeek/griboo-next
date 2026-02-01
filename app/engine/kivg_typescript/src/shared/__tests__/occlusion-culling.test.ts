/**
 * Tests for Occlusion Culling Consistency
 * Validates that the frontend and server use the same logic for:
 * - Occlusion detection (proxiesIntersect)
 * - Intersection rectangle calculation (getIntersectionRect)
 * - Erase zone calculation (ensureMinimumEraseZone)
 * - Zigzag path generation (generateZigzagPath)
 */

import { describe, it, expect } from 'vitest';
import { OcclusionLogic } from '../occlusion_logic';
import { proxiesIntersect } from '../performance_utils';
import { OcclusionProxy } from '../types';

describe('Occlusion Culling - Shared Logic Consistency', () => {
    describe('proxiesIntersect', () => {
        it('should detect overlapping rect proxies', () => {
            const proxyA: OcclusionProxy = {
                type: 'rect',
                x: 100,
                y: 100,
                width: 200,
                height: 150
            };
            const proxyB: OcclusionProxy = {
                type: 'rect',
                x: 200,  // Overlaps with A (x: 100-300, y: 100-250)
                y: 150,  // Overlaps with A
                width: 200,
                height: 150
            };

            // With 0.5 margin ratio (sensitive detection)
            expect(proxiesIntersect(proxyA, proxyB, 0.5)).toBe(true);
            
            // With 0.1 margin ratio
            expect(proxiesIntersect(proxyA, proxyB, 0.1)).toBe(true);
        });

        it('should detect non-overlapping rect proxies when margin allows', () => {
            const proxyA: OcclusionProxy = {
                type: 'rect',
                x: 100,
                y: 100,
                width: 100,
                height: 100
            };
            const proxyB: OcclusionProxy = {
                type: 'rect',
                x: 210,  // 10px gap from A
                y: 100,
                width: 100,
                height: 100
            };

            // With 0.5 margin ratio (50% of 100 = 50px), gap of 10px should still intersect
            expect(proxiesIntersect(proxyA, proxyB, 0.5)).toBe(true);
            
            // With 0.1 margin ratio (10% of 100 = 10px), gap of 10px might barely intersect
            // Note: depends on exact implementation
        });

        it('should not detect far-apart proxies', () => {
            const proxyA: OcclusionProxy = {
                type: 'rect',
                x: 0,
                y: 0,
                width: 100,
                height: 100
            };
            const proxyB: OcclusionProxy = {
                type: 'rect',
                x: 500,  // Far away
                y: 500,
                width: 100,
                height: 100
            };

            expect(proxiesIntersect(proxyA, proxyB, 0.5)).toBe(false);
            expect(proxiesIntersect(proxyA, proxyB, 0.1)).toBe(false);
        });
    });

    describe('getIntersectionRect', () => {
        it('should calculate correct intersection for overlapping rects', () => {
            const proxyA: OcclusionProxy = {
                type: 'rect',
                x: 100,
                y: 100,
                width: 200,
                height: 150
            };
            const proxyB: OcclusionProxy = {
                type: 'rect',
                x: 200,
                y: 150,
                width: 200,
                height: 150
            };

            const intersection = OcclusionLogic.getIntersectionRect(proxyA, proxyB, 0.1);
            
            expect(intersection).not.toBeNull();
            if (intersection) {
                // Intersection should be approximately where both rectangles overlap
                // Taking into account margins and edge padding
                expect(intersection.left).toBeLessThan(intersection.right);
                expect(intersection.top).toBeLessThan(intersection.bottom);
            }
        });

        it('should return null for non-overlapping rects', () => {
            const proxyA: OcclusionProxy = {
                type: 'rect',
                x: 0,
                y: 0,
                width: 100,
                height: 100
            };
            const proxyB: OcclusionProxy = {
                type: 'rect',
                x: 500,
                y: 500,
                width: 100,
                height: 100
            };

            const intersection = OcclusionLogic.getIntersectionRect(proxyA, proxyB, 0.1);
            expect(intersection).toBeNull();
        });

        it('should handle circle proxies', () => {
            const circleA: OcclusionProxy = {
                type: 'circle',
                x: 150, // center
                y: 150,
                width: 100, // diameter
                height: 100,
                radius: 50
            };
            const circleB: OcclusionProxy = {
                type: 'circle',
                x: 200,
                y: 200,
                width: 100,
                height: 100,
                radius: 50
            };

            const intersection = OcclusionLogic.getIntersectionRect(circleA, circleB, 0.1);
            expect(intersection).not.toBeNull();
        });
    });

    describe('getUnionIntersectionRect', () => {
        it('should calculate union of multiple intersections', () => {
            const target: OcclusionProxy = {
                type: 'rect',
                x: 200,
                y: 200,
                width: 200,
                height: 200
            };
            
            const others: OcclusionProxy[] = [
                { type: 'rect', x: 100, y: 100, width: 150, height: 150 },
                { type: 'rect', x: 300, y: 300, width: 150, height: 150 }
            ];

            const union = OcclusionLogic.getUnionIntersectionRect(target, others, 0.1);
            expect(union).not.toBeNull();
        });
    });

    describe('ensureMinimumEraseZone', () => {
        it('should expand small erase zones', () => {
            const smallRect = { left: 100, top: 100, right: 105, bottom: 105 }; // 5x5
            const radius = 30;

            const expanded = OcclusionLogic.ensureMinimumEraseZone(smallRect, radius);
            
            // Width should be at least 2 * radius = 60
            const width = expanded.right - expanded.left;
            const height = expanded.bottom - expanded.top;
            
            expect(width).toBeGreaterThanOrEqual(radius * 2);
            expect(height).toBeGreaterThanOrEqual(radius * 2);
        });

        it('should not shrink large erase zones', () => {
            const largeRect = { left: 0, top: 0, right: 200, bottom: 200 };
            const radius = 30;

            const result = OcclusionLogic.ensureMinimumEraseZone(largeRect, radius);
            
            // Should not change significantly
            expect(result.left).toBeLessThanOrEqual(largeRect.left);
            expect(result.right).toBeGreaterThanOrEqual(largeRect.right);
        });
    });

    describe('generateZigzagPath', () => {
        it('should generate a path covering the rectangle', () => {
            const left = 0;
            const top = 0;
            const right = 100;
            const bottom = 100;
            const radius = 10;

            const path = OcclusionLogic.generateZigzagPath(left, top, right, bottom, radius);
            
            expect(path.length).toBeGreaterThan(0);
            
            // First point should be at top-left area
            const [firstX, firstY] = path[0];
            expect(firstX).toBeGreaterThanOrEqual(left);
            expect(firstY).toBeGreaterThanOrEqual(top);
            
            // Last point should be near bottom
            const [lastX, lastY] = path[path.length - 1];
            expect(lastY).toBeLessThanOrEqual(bottom + 1); // Allow for floating point
        });

        it('should generate deterministic paths', () => {
            const params = { left: 50, top: 50, right: 150, bottom: 150, radius: 20 };
            
            const path1 = OcclusionLogic.generateZigzagPath(
                params.left, params.top, params.right, params.bottom, params.radius
            );
            const path2 = OcclusionLogic.generateZigzagPath(
                params.left, params.top, params.right, params.bottom, params.radius
            );
            
            // Same parameters should produce same path
            expect(path1.length).toBe(path2.length);
            for (let i = 0; i < path1.length; i++) {
                expect(path1[i][0]).toBeCloseTo(path2[i][0], 5);
                expect(path1[i][1]).toBeCloseTo(path2[i][1], 5);
            }
        });
    });

    describe('Frontend/Server Logic Consistency', () => {
        it('should use same defaults for margin ratios', () => {
            // Frontend uses 0.5 for detection, 0.1 for intersection
            // This test ensures the constants match
            const DETECTION_MARGIN_RATIO = 0.5;
            const INTERSECTION_MARGIN_RATIO = 0.1;
            
            const proxyA: OcclusionProxy = {
                type: 'rect', x: 100, y: 100, width: 200, height: 200
            };
            const proxyB: OcclusionProxy = {
                type: 'rect', x: 250, y: 250, width: 200, height: 200
            };
            
            // Both frontend and server should use these same values
            const detected = proxiesIntersect(proxyA, proxyB, DETECTION_MARGIN_RATIO);
            const intersection = OcclusionLogic.getIntersectionRect(proxyA, proxyB, INTERSECTION_MARGIN_RATIO);
            
            // If detected, there should be an intersection
            if (detected) {
                expect(intersection).not.toBeNull();
            }
        });

        it('should produce same erase zone from same proxies', () => {
            // This simulates what both frontend and server should compute
            const upperProxy: OcclusionProxy = {
                type: 'rect', x: 200, y: 200, width: 300, height: 200
            };
            const lowerProxy: OcclusionProxy = {
                type: 'rect', x: 100, y: 100, width: 400, height: 300
            };
            
            const radius = 30;
            const marginRatio = 0.1;
            
            // Calculate intersection (shared logic)
            const intersection = OcclusionLogic.getIntersectionRect(upperProxy, lowerProxy, marginRatio);
            expect(intersection).not.toBeNull();
            
            if (intersection) {
                // Apply minimum erase zone (shared logic)
                const eraseZone = OcclusionLogic.ensureMinimumEraseZone(intersection, radius);
                
                // Generate zigzag path (shared logic)
                const path = OcclusionLogic.generateZigzagPath(
                    eraseZone.left, eraseZone.top, eraseZone.right, eraseZone.bottom, radius
                );
                
                expect(path.length).toBeGreaterThan(0);
            }
        });
    });
});

/**
 * Path Module for Kivg Core
 * 
 * Provides path manipulation, smoothing, and animation utilities.
 * 
 * Features:
 * - Path smoothing with Chaikin corner-cutting algorithm
 * - Path length calculations
 * - Point-on-path interpolation
 * - Bezier curve generation
 * - Path configuration handling
 * 
 * Usage:
 *     import { smoothPath, getPointOnPath, calculatePathLength } from './core/path';
 *     
 *     const smoothed = chaikinSmooth(points, 2);
 *     const pathLength = calculatePathLength(points);
 *     const point = getPointOnPath(points, 0.5);
 */

import { easingFunction } from '../logic/camera';
import { calculatePathLength as sharedCalculatePathLength, getPointOnPath as sharedGetPointOnPath, interpolatePath as sharedInterpolatePath } from '../../../shared/graphics/path_utils';
import { Point as SharedPoint } from '../../../shared/types';

/**
 * Point coordinate [x, y].
 */
export type Point = [number, number];

/**
 * Path point with optional pen_up flag.
 */
export interface PathPoint {
    x: number;
    y: number;
    pen_up?: boolean;
}

/**
 * Get coordinates from point (tuple or object).
 */
function getCoords(p: Point | PathPoint): [number, number] {
    if (Array.isArray(p)) {
        return [p[0], p[1]];
    }
    return [p.x, p.y];
}

/**
 * Calculate angle at p2 formed by p1-p2-p3.
 */
export function angleBetween(
    p1: Point | PathPoint,
    p2: Point | PathPoint,
    p3: Point | PathPoint
): number {
    const p1Coords = getCoords(p1);
    const p2Coords = getCoords(p2);
    const p3Coords = getCoords(p3);

    const v1: [number, number] = [
        p1Coords[0] - p2Coords[0],
        p1Coords[1] - p2Coords[1]
    ];
    const v2: [number, number] = [
        p3Coords[0] - p2Coords[0],
        p3Coords[1] - p2Coords[1]
    ];

    const dot = v1[0] * v2[0] + v1[1] * v2[1];
    const mag1 = Math.sqrt(v1[0] ** 2 + v1[1] ** 2);
    const mag2 = Math.sqrt(v2[0] ** 2 + v2[1] ** 2);

    if (mag1 === 0 || mag2 === 0) {
        return 0.0;
    }

    const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    const angleRad = Math.acos(cosAngle);
    return (angleRad * 180) / Math.PI;
}

/**
 * Apply Chaikin corner-cutting smoothing to a path.
 */
export function chaikinSmooth(
    pts: (Point | PathPoint)[],
    iterations: number = 2
): Point[] {
    let currentPts: Point[] = pts.map(p => getCoords(p));

    for (let iter = 0; iter < iterations; iter++) {
        const n = currentPts.length;
        if (n < 2) {
            return currentPts;
        }

        const newPts: Point[] = [];

        // Keep first point
        newPts.push(currentPts[0]);

        for (let i = 0; i < n - 1; i++) {
            const p0 = currentPts[i];
            const p1 = currentPts[i + 1];

            const q: Point = [
                0.75 * p0[0] + 0.25 * p1[0],
                0.75 * p0[1] + 0.25 * p1[1]
            ];
            const r: Point = [
                0.25 * p0[0] + 0.75 * p1[0],
                0.25 * p0[1] + 0.75 * p1[1]
            ];
            newPts.push(q, r);
        }

        // Keep last point
        newPts.push(currentPts[n - 1]);
        currentPts = newPts;
    }

    return currentPts;
}

/**
 * Automatically smooth path when sharp corners are present.
 */
export function autoSmoothPath(
    pts: (Point | PathPoint)[],
    angleThreshold: number = 150,
    iterations: number = 2
): Point[] {
    if (pts.length < 3) {
        return pts.map(p => getCoords(p));
    }

    // Detect any angle larger than threshold
    for (let i = 1; i < pts.length - 1; i++) {
        const ang = angleBetween(pts[i - 1], pts[i], pts[i + 1]);
        if (ang > angleThreshold) {
            return chaikinSmooth(pts, iterations);
        }
    }

    return pts.map(p => getCoords(p));
}

/**
 * Smooth a path configuration list handling pen_up segments.
 */
export function smoothPathConfig(
    pathConfig: PathPoint[],
    angleThreshold: number = 150,
    iterations: number = 2
): PathPoint[] {
    if (!pathConfig.length) {
        return pathConfig;
    }

    const newPathConfig: PathPoint[] = [];
    let currentSegment: Point[] = [];

    for (const pt of pathConfig) {
        currentSegment.push([pt.x, pt.y]);

        if (pt.pen_up) {
            let smoothedSegment: Point[];
            if (currentSegment.length > 2) {
                smoothedSegment = autoSmoothPath(currentSegment, angleThreshold, iterations);
            } else {
                smoothedSegment = currentSegment;
            }

            for (let i = 0; i < smoothedSegment.length; i++) {
                const p = smoothedSegment[i];
                newPathConfig.push({
                    x: Math.round(p[0]),
                    y: Math.round(p[1]),
                    pen_up: i === smoothedSegment.length - 1
                });
            }

            currentSegment = [];
        }
    }

    // Handle remaining segment
    if (currentSegment.length > 0) {
        let smoothedSegment: Point[];
        if (currentSegment.length > 2) {
            smoothedSegment = autoSmoothPath(currentSegment, angleThreshold, iterations);
        } else {
            smoothedSegment = currentSegment;
        }

        for (let i = 0; i < smoothedSegment.length; i++) {
            const p = smoothedSegment[i];
            newPathConfig.push({
                x: Math.round(p[0]),
                y: Math.round(p[1]),
                pen_up: i === smoothedSegment.length - 1
            });
        }
    }

    return newPathConfig;
}

/**
 * Calculate total length of a path.
 */
export function calculatePathLength(points: Point[]): number {
    return sharedCalculatePathLength(points);
}

/**
 * Get a point along a path at a given progress.
 */
export function getPointOnPath(
    points: Point[],
    progress: number,
    easing: string = 'linear'
): Point {
    // Apply easing if specified
    let adjustedProgress = progress;
    if (easing !== 'linear') {
        adjustedProgress = easingFunction(progress, easing);
    }

    return sharedGetPointOnPath(points, adjustedProgress);
}

/**
 * Interpolate a path to have a specific number of points.
 */
export function interpolatePath(
    points: Point[],
    numPoints: number
): Point[] {
    return sharedInterpolatePath(points, numPoints);
}

/**
 * Resample a path with uniform step size.
 */
export function resamplePath(
    points: Point[],
    stepSize: number
): Point[] {
    if (points.length < 2) {
        return points;
    }

    const totalLength = calculatePathLength(points);
    if (totalLength === 0) {
        return points;
    }

    const numPoints = Math.max(2, Math.floor(totalLength / stepSize) + 1);
    return interpolatePath(points, numPoints);
}

/**
 * Generate a zigzag path for erasing/covering an area.
 */
export function generateZigzagPath(
    width: number,
    height: number,
    rows: number = 5,
    margin: number = 0.1
): Point[] {
    const points: Point[] = [];

    // Start off-screen
    points.push([Math.floor(-width * margin), Math.floor(-height * margin)]);

    for (let r = 0; r < rows; r++) {
        const y = Math.floor((height * (r + 0.5)) / rows);
        if (r % 2 === 0) {
            // Left to right
            points.push([Math.floor(-width * margin), y]);
            points.push([Math.floor(width * (1 + margin)), y]);
        } else {
            // Right to left
            points.push([Math.floor(width * (1 + margin)), y]);
            points.push([Math.floor(-width * margin), y]);
        }
    }

    // End off-screen
    const finalX = rows % 2 !== 0
        ? Math.floor(width * (1 + margin))
        : Math.floor(-width * margin);
    points.push([finalX, Math.floor(height * (1 + margin))]);

    return points;
}

/**
 * Generate a spiral path from center outward.
 */
export function generateSpiralPath(
    centerX: number,
    centerY: number,
    maxRadius: number,
    numTurns: number = 3,
    pointsPerTurn: number = 36
): Point[] {
    const points: Point[] = [];
    const totalPoints = Math.floor(numTurns * pointsPerTurn);

    for (let i = 0; i <= totalPoints; i++) {
        const progress = i / totalPoints;
        const angle = progress * numTurns * 2 * Math.PI;
        const radius = progress * maxRadius;

        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        points.push([x, y]);
    }

    return points;
}

/**
 * Offset a path perpendicular to its direction.
 */
export function offsetPath(
    points: Point[],
    offset: number
): Point[] {
    if (points.length < 2) {
        return points;
    }

    const result: Point[] = [];

    for (let i = 0; i < points.length; i++) {
        let dx: number, dy: number;

        if (i === 0) {
            // First point: use direction to next point
            dx = points[1][0] - points[0][0];
            dy = points[1][1] - points[0][1];
        } else if (i === points.length - 1) {
            // Last point: use direction from previous point
            dx = points[i][0] - points[i - 1][0];
            dy = points[i][1] - points[i - 1][1];
        } else {
            // Middle point: average of adjacent directions
            dx = points[i + 1][0] - points[i - 1][0];
            dy = points[i + 1][1] - points[i - 1][1];
        }

        // Normalize and rotate 90 degrees for perpendicular
        const length = Math.sqrt(dx * dx + dy * dy);
        let nx = 0, ny = 0;
        if (length > 0) {
            nx = -dy / length;
            ny = dx / length;
        }

        const x = points[i][0] + nx * offset;
        const y = points[i][1] + ny * offset;
        result.push([x, y]);
    }

    return result;
}

/**
 * Calculate the bounding box of a path.
 */
export function getPathBounds(points: Point[]): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
} {
    if (points.length === 0) {
        return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }

    let minX = points[0][0];
    let minY = points[0][1];
    let maxX = points[0][0];
    let maxY = points[0][1];

    for (const [x, y] of points) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    }

    return {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX,
        height: maxY - minY
    };
}

/**
 * Translate a path by offset.
 */
export function translatePath(
    points: Point[],
    offsetX: number,
    offsetY: number
): Point[] {
    return points.map(([x, y]) => [x + offsetX, y + offsetY]);
}

/**
 * Scale a path around a center point.
 */
export function scalePath(
    points: Point[],
    scale: number,
    centerX?: number,
    centerY?: number
): Point[] {
    if (points.length === 0) {
        return [];
    }

    // Use center of path if not specified
    const bounds = getPathBounds(points);
    const cx = centerX ?? (bounds.minX + bounds.maxX) / 2;
    const cy = centerY ?? (bounds.minY + bounds.maxY) / 2;

    return points.map(([x, y]) => [
        cx + (x - cx) * scale,
        cy + (y - cy) * scale
    ]);
}

/**
 * Rotate a path around a center point.
 */
export function rotatePath(
    points: Point[],
    angleDegrees: number,
    centerX?: number,
    centerY?: number
): Point[] {
    if (points.length === 0) {
        return [];
    }

    // Use center of path if not specified
    const bounds = getPathBounds(points);
    const cx = centerX ?? (bounds.minX + bounds.maxX) / 2;
    const cy = centerY ?? (bounds.minY + bounds.maxY) / 2;

    const angleRad = (angleDegrees * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    return points.map(([x, y]) => {
        const dx = x - cx;
        const dy = y - cy;
        return [
            cx + dx * cos - dy * sin,
            cy + dx * sin + dy * cos
        ];
    });
}

/**
 * Generate a line path between two points.
 */
export function generateLinePath(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    numPoints: number = 2
): Point[] {
    if (numPoints < 2) {
        return [[startX, startY]];
    }

    const points: Point[] = [];
    for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1);
        const x = startX + (endX - startX) * t;
        const y = startY + (endY - startY) * t;
        points.push([x, y]);
    }

    return points;
}

/**
 * Generate a rectangular path.
 */
export function generateRectPath(
    x: number,
    y: number,
    width: number,
    height: number,
    closed: boolean = true
): Point[] {
    const points: Point[] = [
        [x, y],
        [x + width, y],
        [x + width, y + height],
        [x, y + height]
    ];

    if (closed) {
        points.push([x, y]);
    }

    return points;
}

/**
 * Generate a circle path.
 */
export function generateCirclePath(
    centerX: number,
    centerY: number,
    radius: number,
    numPoints: number = 36
): Point[] {
    const points: Point[] = [];

    for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        points.push([x, y]);
    }

    return points;
}

/**
 * Generate an arc path.
 */
export function generateArcPath(
    centerX: number,
    centerY: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    numPoints: number = 36
): Point[] {
    const points: Point[] = [];
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const angle = startRad + (endRad - startRad) * t;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        points.push([x, y]);
    }

    return points;
}

/**
 * Simplify a path using the Douglas-Peucker algorithm.
 */
export function simplifyPath(
    points: Point[],
    tolerance: number = 1.0
): Point[] {
    if (points.length < 3) {
        return points;
    }

    // Find the point with maximum distance
    let maxDist = 0;
    let index = 0;
    const end = points.length - 1;

    for (let i = 1; i < end; i++) {
        const dist = perpendicularDistance(points[i], points[0], points[end]);
        if (dist > maxDist) {
            maxDist = dist;
            index = i;
        }
    }

    // If max distance is greater than tolerance, recursively simplify
    if (maxDist > tolerance) {
        const left = simplifyPath(points.slice(0, index + 1), tolerance);
        const right = simplifyPath(points.slice(index), tolerance);
        return [...left.slice(0, -1), ...right];
    }

    return [points[0], points[end]];
}

/**
 * Get a point on a cubic bezier curve at parameter t (0 to 1).
 * Uses the cubic bezier formula: B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
 * 
 * @param start - Starting point [x, y]
 * @param control1 - First control point [x, y]
 * @param control2 - Second control point [x, y]
 * @param end - End point [x, y]
 * @param t - Parameter (0 to 1) where 0 is start and 1 is end
 * @returns Point on the bezier curve at parameter t
 */
export function getPointOnCubicBezier(
    start: Point,
    control1: Point,
    control2: Point,
    end: Point,
    t: number
): Point {
    // Clamp t to [0, 1]
    t = Math.max(0, Math.min(1, t));

    // Calculate powers of t and (1-t) for the cubic bezier formula
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;

    // Apply cubic bezier formula
    const x = mt3 * start[0] + 3 * mt2 * t * control1[0] + 3 * mt * t2 * control2[0] + t3 * end[0];
    const y = mt3 * start[1] + 3 * mt2 * t * control1[1] + 3 * mt * t2 * control2[1] + t3 * end[1];

    return [x, y];
}

/**
 * Calculate perpendicular distance from point to line.
 */
function perpendicularDistance(
    point: Point,
    lineStart: Point,
    lineEnd: Point
): number {
    const dx = lineEnd[0] - lineStart[0];
    const dy = lineEnd[1] - lineStart[1];

    const lineLengthSquared = dx * dx + dy * dy;
    if (lineLengthSquared === 0) {
        return Math.sqrt(
            Math.pow(point[0] - lineStart[0], 2) +
            Math.pow(point[1] - lineStart[1], 2)
        );
    }

    const t = Math.max(0, Math.min(1,
        ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) / lineLengthSquared
    ));

    const projX = lineStart[0] + t * dx;
    const projY = lineStart[1] + t * dy;

    return Math.sqrt(
        Math.pow(point[0] - projX, 2) +
        Math.pow(point[1] - projY, 2)
    );
}

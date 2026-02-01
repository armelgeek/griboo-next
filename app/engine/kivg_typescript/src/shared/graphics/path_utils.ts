/**
 * Shared path utilities for both frontend and server.
 */

import { Point } from '../types';
export type { Point };

/**
 * Calculate total length of a path.
 */
export function calculatePathLength(points: Point[]): number {
    if (points.length < 2) {
        return 0.0;
    }

    let totalLength = 0.0;
    for (let i = 1; i < points.length; i++) {
        const dx = points[i][0] - points[i - 1][0];
        const dy = points[i][1] - points[i - 1][1];
        totalLength += Math.sqrt(dx * dx + dy * dy);
    }

    return totalLength;
}

/**
 * Get a point along a path at a given progress.
 */
export function getPointOnPath(
    points: Point[],
    progress: number
): Point {
    if (points.length === 0) {
        return [0.0, 0.0];
    }
    if (points.length === 1) {
        return points[0];
    }
    if (progress <= 0) {
        return points[0];
    }
    if (progress >= 1) {
        return points[points.length - 1];
    }

    // Calculate total path length
    const totalLength = calculatePathLength(points);
    if (totalLength === 0) {
        return points[0];
    }

    // Find the point at the given progress
    const targetLength = totalLength * progress;
    let currentLength = 0.0;

    for (let i = 1; i < points.length; i++) {
        const dx = points[i][0] - points[i - 1][0];
        const dy = points[i][1] - points[i - 1][1];
        const segmentLength = Math.sqrt(dx * dx + dy * dy);

        if (currentLength + segmentLength >= targetLength) {
            if (segmentLength === 0) {
                return points[i - 1];
            }
            const segmentProgress = (targetLength - currentLength) / segmentLength;
            const x = points[i - 1][0] + dx * segmentProgress;
            const y = points[i - 1][1] + dy * segmentProgress;
            return [x, y];
        }

        currentLength += segmentLength;
    }

    return points[points.length - 1];
}

/**
 * Interpolate a path to have a specific number of points.
 */
export function interpolatePath(
    points: Point[],
    numPoints: number
): Point[] {
    if (numPoints <= 1) {
        return points.length ? [points[0]] : [];
    }

    const result: Point[] = [];
    for (let i = 0; i < numPoints; i++) {
        const progress = i / (numPoints - 1);
        result.push(getPointOnPath(points, progress));
    }

    return result;
}

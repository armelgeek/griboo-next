/**
 * HybridImageAnimator - Hybrid rendering for SVG/Image speed drawing animations
 * 
 * This module implements a two-layer hybrid rendering approach for maximum
 * performance while maintaining pixel-perfect fidelity to the source image.
 * 
 * Architecture:
 *     - Stroke Layer: Vectorized path animation for line/stroke drawing
 *     - Fill Layer: Color coalescing with near-zero tolerance for pixel-perfect fills
 *     - Sequential Rendering: Strokes first, fills revealed only after stroke completion
 * 
 * Based on the Python implementation in whiteboard_modules/hybrid_renderer.py
 */

import { generateCanvasId } from '../infra/utils';


// Type definitions
type Point = [number, number]; // [row, col] or [y, x]
type Coordinate = [number, number]; // [x, y]
type RGB = [number, number, number];
type RGBA = [number, number, number, number];

/**
 * Color region extracted from image for fill animation
 */
interface ColorRegion {
    color: RGB;        // RGB color
    pixels: Point[];   // List of (row, col) pixel coordinates
    centroid: Point;   // (row, col) centroid
    size: number;      // Number of pixels
}

/**
 * Stroke path extracted from image edges
 */
interface StrokePath {
    points: Coordinate[];  // List of (x, y) points
}

/**
 * Configuration for hybrid animation
 */
export interface HybridAnimatorConfig {
    width: number;
    height: number;
    background?: RGBA;
    strokeDurationRatio?: number;   // Ratio of animation for stroke phase (0.0-1.0)
    colorTolerance?: number;        // Color tolerance for region coalescing
    minRegionSize?: number;         // Minimum pixel count for color regions
    strokeWidth?: number;           // Width of stroke lines
    fillDirection?: 'diagonal' | 'vertical' | 'horizontal';  // Direction for fill animation sweep
    edgeThreshold?: number;         // Edge detection threshold (lower = more detail, default 25)
    minContourPoints?: number;      // Minimum points per contour (default 8)
}

/**
 * Frame result from hybrid animation
 */
export interface HybridFrame {
    imageData: ImageData;
    handPosition: Coordinate | null;
    isStrokePhase: boolean;
}

// ============================================================================
// Constants for Hybrid Rendering
// ============================================================================

/** Color tolerance for lossless color coalescing (ΔE value) - higher values group more similar colors */
const DEFAULT_COLOR_TOLERANCE = 10.0;

/** Default width for stroke lines in pixels */
const DEFAULT_STROKE_WIDTH = 3;

/** Default stroke color for the sketch phase (gray for pencil/sketch effect) */
const DEFAULT_STROKE_COLOR: RGB = [128, 128, 128];

/** Minimum pixel count for a valid color region - filters out noise */
const DEFAULT_MIN_REGION_SIZE = 50;


/** 
 * Threshold for filtering "white-like" color regions.
 * Regions with grayscale value above this are considered background and skipped.
 * Slightly lower than NON_WHITE_THRESHOLD to filter near-white noise.
 */
const WHITE_LIKE_THRESHOLD = 240;

/**
 * Minimum number of points for a valid stroke contour.
 * Smaller contours are filtered out as noise fragments.
 * Reduced from 15 to 8 to keep fine details.
 */
const DEFAULT_MIN_STROKE_CONTOUR_POINTS = 8;

/**
 * Edge detection threshold for Sobel operator.
 * Lower values detect more edges, higher values only detect stronger edges.
 * Reduced from 50 to 25 to capture finer line details.
 */
const DEFAULT_EDGE_DETECTION_THRESHOLD = 25;

/**
 * Smoothing parameters for ultra-smooth contours
 * These values are tuned to match the Python hybrid_renderer.py for identical rendering
 * The Python version produces the "nickel" (perfect) contours we want to match
 */
const SMOOTHING_RDP_EPSILON = 1.5;        // Douglas-Peucker simplification tolerance (matches Python)
const SMOOTHING_CHAIKIN_ITERATIONS = 3;   // Number of Chaikin corner-cutting iterations (matches Python)
const SMOOTHING_CATMULL_SEGMENTS = 8;     // Interpolation segments between control points (matches Python)
const SMOOTHING_MIN_INTERPOLATED_POINTS = 10;  // Minimum interpolated points for closed contour unwrap

/**
 * Calculate perceptual color difference (simplified ΔE)
 */
function calculateDeltaE(color1: RGB, color2: RGB): number {
    const [r1, g1, b1] = color1;
    const [r2, g2, b2] = color2;

    const rMean = (r1 + r2) / 2.0;
    const deltaR = r1 - r2;
    const deltaG = g1 - g2;
    const deltaB = b1 - b2;

    const weightR = 2 + rMean / 256.0;
    const weightG = 4.0;
    const weightB = 2 + (255 - rMean) / 256.0;

    const deltaE = Math.sqrt(weightR * deltaR * deltaR + weightG * deltaG * deltaG + weightB * deltaB * deltaB);

    return deltaE * (100.0 / 255.0);
}

/**
 * Check if two colors match exactly (all RGB components equal)
 */
function colorsMatchExact(color1: RGB, color2: RGB): boolean {
    return color1[0] === color2[0] && color1[1] === color2[1] && color1[2] === color2[2];
}

/**
 * Calculate color difference based on tolerance.
 * For tolerance === 0, returns 0 for exact match, Infinity otherwise.
 * For tolerance > 0, returns the ΔE perceptual difference.
 */
function getColorDifference(color1: RGB, color2: RGB, tolerance: number): number {
    if (tolerance === 0) {
        return colorsMatchExact(color1, color2) ? 0 : Infinity;
    }
    return calculateDeltaE(color1, color2);
}

/**
 * Check if a color is "white-like" (background)
 */
function isWhiteLike(color: RGB): boolean {
    const [r, g, b] = color;
    const grayValue = 0.299 * r + 0.587 * g + 0.114 * b;
    return grayValue > WHITE_LIKE_THRESHOLD;
}

/**
 * Sort pixels in diagonal order (top-left to bottom-right).
 * 
 * This organizes pixels into diagonal bands where diagIdx = row + col,
 * and within each band, pixels are sorted in a zigzag pattern to create
 * smooth diagonal sweep animation matching the Python implementation.
 * 
 * @param pixels - Array of [row, col] points
 * @returns Pixels sorted in diagonal sweep order
 */
function sortPixelsDiagonally(pixels: Point[]): Point[] {
    if (pixels.length === 0) return pixels;

    // Group pixels by diagonal index (row + col)
    const diagonalBands = new Map<number, Point[]>();

    for (const [row, col] of pixels) {
        const diagIdx = row + col;
        if (!diagonalBands.has(diagIdx)) {
            diagonalBands.set(diagIdx, []);
        }
        diagonalBands.get(diagIdx)!.push([row, col]);
    }

    // Sort diagonal indices
    const sortedDiagIndices = Array.from(diagonalBands.keys()).sort((a, b) => a - b);

    // Build ordered pixel list with zigzag pattern within each diagonal
    const orderedPixels: Point[] = [];

    for (let i = 0; i < sortedDiagIndices.length; i++) {
        const diagIdx = sortedDiagIndices[i];
        const bandPixels = diagonalBands.get(diagIdx)!;

        // Zigzag: alternate sort direction (by row) for smooth animation
        if (i % 2 === 0) {
            bandPixels.sort((a, b) => a[0] - b[0]); // Sort by row ascending
        } else {
            bandPixels.sort((a, b) => b[0] - a[0]); // Sort by row descending
        }

        orderedPixels.push(...bandPixels);
    }

    return orderedPixels;
}

/**
 * Sort pixels vertically (top to bottom, left to right).
 * Pixels are organized by column first, then by row within each column.
 * 
 * @param pixels - Array of [row, col] points
 * @returns Pixels sorted in vertical sweep order
 */
function sortPixelsVertically(pixels: Point[]): Point[] {
    if (pixels.length === 0) return pixels;

    const sortedPixels = [...pixels];
    sortedPixels.sort((a, b) => {
        const [row1, col1] = a;
        const [row2, col2] = b;
        // Sort by column first, then by row
        if (col1 !== col2) return col1 - col2;
        return row1 - row2;
    });

    return sortedPixels;
}

/**
 * Sort pixels horizontally (left to right, top to bottom).
 * Pixels are organized by row first, then by column within each row.
 * 
 * @param pixels - Array of [row, col] points
 * @returns Pixels sorted in horizontal sweep order
 */
function sortPixelsHorizontally(pixels: Point[]): Point[] {
    if (pixels.length === 0) return pixels;

    const sortedPixels = [...pixels];
    sortedPixels.sort((a, b) => {
        const [row1, col1] = a;
        const [row2, col2] = b;
        // Sort by row first, then by column
        if (row1 !== row2) return row1 - row2;
        return col1 - col2;
    });

    return sortedPixels;
}

/**
 * Sort pixels based on fill direction.
 * 
 * @param pixels - Array of [row, col] points
 * @param direction - Fill direction ('diagonal', 'vertical', or 'horizontal')
 * @returns Pixels sorted according to the specified direction
 */
function sortPixelsByDirection(pixels: Point[], direction: 'diagonal' | 'vertical' | 'horizontal' = 'diagonal'): Point[] {
    switch (direction) {
        case 'vertical':
            return sortPixelsVertically(pixels);
        case 'horizontal':
            return sortPixelsHorizontally(pixels);
        case 'diagonal':
        default:
            return sortPixelsDiagonally(pixels);
    }
}

/**
 * Check if a contour is closed (first and last points are close)
 */
function isContourClosed(points: Coordinate[], threshold: number = 5): boolean {
    if (points.length < 3) return false;
    const [x1, y1] = points[0];
    const [x2, y2] = points[points.length - 1];
    const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    return dist <= threshold;
}

/**
 * Prepare contour for smooth closed-loop processing.
 * For closed contours, duplicates points at the boundary to ensure
 * smooth transitions when applying smoothing algorithms.
 */
function prepareClosedContour(points: Coordinate[]): { points: Coordinate[], isClosed: boolean } {
    const isClosed = isContourClosed(points);

    if (!isClosed || points.length < 4) {
        return { points: points.slice(), isClosed: false };
    }

    // For closed contours, wrap points to ensure smooth boundary transition
    // Add last few points before the start and first few points after the end
    const wrapCount = Math.min(3, Math.floor(points.length / 4));
    const wrapped: Coordinate[] = [];

    // Add wrapped points from the end (before start)
    for (let i = points.length - wrapCount; i < points.length; i++) {
        wrapped.push(points[i]);
    }

    // Add all original points
    wrapped.push(...points);

    // Add wrapped points from the start (after end)
    for (let i = 0; i < wrapCount; i++) {
        wrapped.push(points[i]);
    }

    return { points: wrapped, isClosed: true };
}

/**
 * Unwrap a closed contour after smoothing.
 * Removes the duplicated boundary points and ensures seamless connection.
 */
function unwrapClosedContour(points: Coordinate[], originalLength: number, wrapCount: number): Coordinate[] {
    if (points.length <= wrapCount * 2) return points;

    // Remove the wrapped points, keeping only the middle portion
    // But we need to account for the smoothing expanding the point count
    const expansionRatio = points.length / (originalLength + wrapCount * 2);
    const startOffset = Math.floor(wrapCount * expansionRatio);
    const endOffset = Math.floor(wrapCount * expansionRatio);

    return points.slice(startOffset, points.length - endOffset);
}

/**
 * Apply the complete smoothing pipeline to a contour for ultra-smooth strokes.
 * 
 * Pipeline:
 * 1. Handle closed contours (wrap boundary for seamless loop)
 * 2. Douglas-Peucker simplification (reduce noise while preserving shape)
 * 3. Catmull-Rom spline interpolation (create continuous smooth curves)
 * 4. Unwrap closed contours (remove duplicated boundary points)
 * 
 * This pipeline matches the Python hybrid_renderer.py for consistent rendering.
 * The Python version produces excellent "lissage" (smoothing) results.
 */
function smoothContourPipeline(contour: Coordinate[]): Coordinate[] {
    if (contour.length < 3) return contour.slice();

    // Step 1: Prepare closed contour (wrap boundary points)
    const { points: preparedPoints, isClosed } = prepareClosedContour(contour);
    const wrapCount = isClosed ? Math.min(3, Math.floor(contour.length / 4)) : 0;

    // Step 2: Douglas-Peucker simplification to reduce noise
    const simplified = simplifyRDP(preparedPoints, SMOOTHING_RDP_EPSILON);

    // Step 3: Catmull-Rom spline interpolation for continuous curves
    // This matches the Python pipeline which uses RDP → Catmull-Rom (no Chaikin in between)
    const interpolated = interpolateCatmullRom(simplified, SMOOTHING_CATMULL_SEGMENTS);

    // Step 4: Unwrap closed contour if necessary
    if (isClosed && interpolated.length > SMOOTHING_MIN_INTERPOLATED_POINTS) {
        return unwrapClosedContour(interpolated, contour.length, wrapCount);
    }

    return interpolated;
}



/**
 * extractStrokes - version proche du pipeline Python
 * - Utilise une détection d'edges basée sur luminance
 * - Regroupe les points en contours fermés
 * - Applique RDP + Catmull-Rom spline comme Python
 */
function extractStrokes(
    imageData: ImageData,
    minContourPoints: number = DEFAULT_MIN_STROKE_CONTOUR_POINTS,
    edgeThreshold: number = DEFAULT_EDGE_DETECTION_THRESHOLD
): StrokePath[] {
    const { width, height, data } = imageData;
    const edgePoints: Coordinate[] = [];
    const threshold = edgeThreshold;

    // Détection d'edges (luminosité)
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;
            const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

            // Comparer avec voisins droite et bas
            const idxR = (y * width + (x + 1)) * 4;
            const idxD = ((y + 1) * width + x) * 4;
            const lumR = 0.299 * data[idxR] + 0.587 * data[idxR + 1] + 0.114 * data[idxR + 2];
            const lumD = 0.299 * data[idxD] + 0.587 * data[idxD + 1] + 0.114 * data[idxD + 2];

            if (Math.abs(lum - lumR) + Math.abs(lum - lumD) > threshold) {
                edgePoints.push([x, y]);
            }
        }
    }

    if (edgePoints.length === 0) {
        console.warn('[HybridAnimator] No edge points found!');
        return [];
    }
    console.log(`[HybridAnimator] Found ${edgePoints.length} edge points`);

    // Regrouper en contours fermés approximatifs (comme Python)
    // Simple clustering par proximité
    const clusters: Coordinate[][] = [];
    const visited = new Set<string>();
    const maxDist = 4;

    function key(p: Coordinate) { return `${p[0]},${p[1]}`; }

    for (const p of edgePoints) {
        if (visited.has(key(p))) continue;
        const cluster: Coordinate[] = [];
        const queue: Coordinate[] = [p];

        while (queue.length > 0) {
            const curr = queue.pop()!;
            const k = key(curr);
            if (visited.has(k)) continue;
            visited.add(k);
            cluster.push(curr);

            // Chercher voisins proches
            for (const np of edgePoints) {
                if (!visited.has(key(np))) {
                    const dx = np[0] - curr[0];
                    const dy = np[1] - curr[1];
                    if (dx * dx + dy * dy <= maxDist * maxDist) {
                        queue.push(np);
                    }
                }
            }
        }

        if (cluster.length >= minContourPoints) clusters.push(cluster);
    }

    // Appliquer smoothing pipeline Python (RDP + Catmull-Rom)
    const smoothedContours: StrokePath[] = clusters.map(c => ({
        points: smoothContourPipeline(c)
    }));

    // Sort strokes by reading order (Top-Left to Bottom-Right)
    return sortStrokesByReadingOrder(smoothedContours);
}

/**
 * Sort strokes in reading order (Top-Left to Bottom-Right, line by line).
 * This ensures text is written naturally character by character.
 */
function sortStrokesByReadingOrder(strokes: StrokePath[]): StrokePath[] {
    if (strokes.length === 0) return [];

    // 1. Calculate centroids and bounds for each stroke
    const strokeMeta = strokes.map((stroke, index) => {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let sumX = 0, sumY = 0;

        for (const [x, y] of stroke.points) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            sumX += x;
            sumY += y;
        }

        const count = stroke.points.length;
        return {
            index,
            stroke,
            minX,
            minY,
            maxX,
            maxY,
            centerX: sumX / count,
            centerY: sumY / count,
            height: maxY - minY
        };
    });

    // 2. Sort by Y first to roughly order lines
    strokeMeta.sort((a, b) => a.minY - b.minY);

    // 3. Group into lines based on vertical overlap
    const lines: typeof strokeMeta[] = [];
    let currentLine: typeof strokeMeta = [];

    // Heuristic: A new line starts if the next stroke is significantly below the current line's average bottom
    // or if it doesn't overlap vertically with the current line's "core"

    if (strokeMeta.length > 0) {
        currentLine.push(strokeMeta[0]);

        // Track line bounds
        let lineMinY = strokeMeta[0].minY;
        let lineMaxY = strokeMeta[0].maxY;

        for (let i = 1; i < strokeMeta.length; i++) {
            const s = strokeMeta[i];

            // Calculate vertical overlap with current line
            // We use a lenient threshold: if the stroke's top is above the line's bottom (minus some buffer), it's on the same line
            // Or if the stroke's center is close to the line's center

            const lineCenterY = (lineMinY + lineMaxY) / 2;
            const verticalDist = Math.abs(s.centerY - lineCenterY);
            const avgHeight = (s.height + (lineMaxY - lineMinY)) / 2;

            // Threshold: 50% of average height
            if (verticalDist < Math.max(20, avgHeight * 0.8)) {
                // Same line
                currentLine.push(s);
                lineMinY = Math.min(lineMinY, s.minY);
                lineMaxY = Math.max(lineMaxY, s.maxY);
            } else {
                // New line
                lines.push(currentLine);
                currentLine = [s];
                lineMinY = s.minY;
                lineMaxY = s.maxY;
            }
        }
        lines.push(currentLine);
    }

    // 4. Sort each line by X (Left to Right) and flatten
    const sortedStrokes: StrokePath[] = [];

    for (const line of lines) {
        // Sort by minX
        line.sort((a, b) => a.minX - b.minX);

        for (const meta of line) {
            sortedStrokes.push(meta.stroke);
        }
    }

    return sortedStrokes;
}



/**
 * Simplify points with Ramer–Douglas–Peucker algorithm to reduce jitter and points count.
 */
function simplifyRDP(points: Coordinate[], epsilon: number): Coordinate[] {
    if (points.length < 3) return points.slice();

    function perpendicularDistance(pt: Coordinate, lineStart: Coordinate, lineEnd: Coordinate): number {
        const [x, y] = pt;
        const [x1, y1] = lineStart;
        const [x2, y2] = lineEnd;
        const dx = x2 - x1;
        const dy = y2 - y1;
        if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
        const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;
        return Math.hypot(x - projX, y - projY);
    }

    function rdpRecursive(pts: Coordinate[], start: number, end: number, dst: boolean[]) {
        let maxDist = 0;
        let index = 0;
        for (let i = start + 1; i < end; i++) {
            const d = perpendicularDistance(pts[i], pts[start], pts[end]);
            if (d > maxDist) {
                index = i;
                maxDist = d;
            }
        }
        if (maxDist > epsilon) {
            dst[index] = true;
            rdpRecursive(pts, start, index, dst);
            rdpRecursive(pts, index, end, dst);
        }
    }

    const dst = new Array(points.length).fill(false);
    dst[0] = true;
    dst[points.length - 1] = true;
    rdpRecursive(points, 0, points.length - 1, dst);

    const simplified: Coordinate[] = [];
    for (let i = 0; i < points.length; i++) if (dst[i]) simplified.push(points[i]);
    return simplified;
}

/**
 * Chaikin smoothing for corner cutting to smooth jagged paths
 * Uses floating point for smoother curves, only rounds at final output
 */
function smoothChaikin(points: Coordinate[], iterations: number = 4): Coordinate[] {
    if (points.length < 3) return points.slice();

    // Work with floating point precision
    let pts: [number, number][] = points.map(p => [p[0], p[1]]);

    for (let iter = 0; iter < iterations; iter++) {
        const res: [number, number][] = [];
        res.push(pts[0]); // keep first
        for (let i = 0; i < pts.length - 1; i++) {
            const [x1, y1] = pts[i];
            const [x2, y2] = pts[i + 1];
            // Use floating point for smooth interpolation
            const q: [number, number] = [0.75 * x1 + 0.25 * x2, 0.75 * y1 + 0.25 * y2];
            const r: [number, number] = [0.25 * x1 + 0.75 * x2, 0.25 * y1 + 0.75 * y2];
            res.push(q);
            res.push(r);
        }
        res.push(pts[pts.length - 1]); // keep last
        pts = res;
    }

    // Round only at the end for final coordinates
    return pts.map(p => [Math.round(p[0]), Math.round(p[1])] as Coordinate);
}

/**
 * Catmull-Rom spline interpolation for ultra-smooth curves.
 * Uses the standard Catmull-Rom formula (matching Python hybrid_renderer.py) which
 * produces smoother curves than tension-based variants.
 * 
 * This creates C1-continuous curves that pass through all control points with
 * smooth tangent transitions, producing natural-looking curves without visible joints.
 * 
 * @param points - Array of control points
 * @param numSegments - Number of interpolated points between each pair of control points
 * @returns Array of interpolated points forming a smooth curve
 */
function interpolateCatmullRom(
    points: Coordinate[],
    numSegments: number = SMOOTHING_CATMULL_SEGMENTS
): Coordinate[] {
    if (points.length < 2) return points.slice();

    if (points.length === 2) {
        // Simple linear interpolation for just 2 points
        const result: Coordinate[] = [points[0]];
        for (let i = 1; i < numSegments; i++) {
            const t = i / numSegments;
            const x = points[0][0] + t * (points[1][0] - points[0][0]);
            const y = points[0][1] + t * (points[1][1] - points[0][1]);
            result.push([Math.round(x), Math.round(y)]);
        }
        result.push(points[1]);
        return result;
    }

    if (points.length < 4) {
        // Need at least 4 points for Catmull-Rom, fall back to Chaikin
        return smoothChaikin(points, SMOOTHING_CHAIKIN_ITERATIONS);
    }

    const result: Coordinate[] = [];

    // Add the first point
    result.push(points[0]);

    // Interpolate between consecutive points using standard Catmull-Rom formula
    // This matches the Python implementation exactly for consistent rendering
    for (let i = 0; i < points.length - 1; i++) {
        // Get 4 control points (with boundary handling like Python)
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[Math.min(points.length - 1, i + 1)];
        const p3 = points[Math.min(points.length - 1, i + 2)];

        // Interpolate between p1 and p2 using standard Catmull-Rom formula
        for (let j = 1; j < numSegments; j++) {
            const t = j / numSegments;
            const t2 = t * t;
            const t3 = t2 * t;

            // Standard Catmull-Rom formula (matches Python hybrid_renderer.py)
            // This formula uses α=0.5 which is the standard centripetal Catmull-Rom
            const x = 0.5 * (
                (2 * p1[0]) +
                (-p0[0] + p2[0]) * t +
                (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
                (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
            );

            const y = 0.5 * (
                (2 * p1[1]) +
                (-p0[1] + p2[1]) * t +
                (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
                (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
            );

            result.push([Math.round(x), Math.round(y)]);
        }
    }

    // Add the last point
    result.push(points[points.length - 1]);

    return result;
}

/**
 * extractColorRegions - proche Python
 * - Flood fill basé sur ΔE (perceptual color difference)
 * - Merge des pixels similaires
 * - Tri par direction (diagonal / vertical / horizontal)
 */
function extractColorRegions(
    imageData: ImageData,
    tolerance: number = DEFAULT_COLOR_TOLERANCE,
    minRegionSize: number = DEFAULT_MIN_REGION_SIZE,
    fillDirection: 'diagonal' | 'vertical' | 'horizontal' = 'diagonal'
): ColorRegion[] {
    const { width, height, data } = imageData;
    const visited = new Uint8Array(width * height);
    const regions: ColorRegion[] = [];

    function getColor(x: number, y: number): RGB {
        const idx = (y * width + x) * 4;
        return [data[idx], data[idx + 1], data[idx + 2]];
    }

    function floodFill(x0: number, y0: number, baseColor: RGB) {
        const stack: Point[] = [[y0, x0]];
        const pixels: Point[] = [];

        while (stack.length > 0) {
            const [y, x] = stack.pop()!;
            if (x < 0 || x >= width || y < 0 || y >= height) continue;
            const idx = y * width + x;
            if (visited[idx]) continue;

            const color = getColor(x, y);
            if (getColorDifference(color, baseColor, tolerance) <= tolerance && !isWhiteLike(color)) {
                visited[idx] = 1;
                pixels.push([y, x]);

                // Voisins 4-way
                stack.push([y, x + 1]);
                stack.push([y, x - 1]);
                stack.push([y + 1, x]);
                stack.push([y - 1, x]);
            }
        }

        return pixels;
    }

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (visited[idx]) continue;
            const baseColor = getColor(x, y);
            if (isWhiteLike(baseColor)) continue;

            const pixels = floodFill(x, y, baseColor);
            if (pixels.length >= minRegionSize) {
                const centroid: Point = [
                    Math.floor(pixels.reduce((sum, p) => sum + p[0], 0) / pixels.length),
                    Math.floor(pixels.reduce((sum, p) => sum + p[1], 0) / pixels.length)
                ];
                regions.push({
                    color: baseColor,
                    pixels: sortPixelsByDirection(pixels, fillDirection),
                    centroid,
                    size: pixels.length
                });
            }
        }
    }

    console.log(`[HybridAnimator] Found ${regions.length} color regions`);
    return regions;
}


/**
 * HybridImageAnimator - Main class for hybrid rendering animations
 */
export class HybridImageAnimator {
    private width: number;
    private height: number;
    private background: RGBA;
    private strokeDurationRatio: number;
    private colorTolerance: number;
    private minRegionSize: number;
    private strokeWidth: number;
    private fillDirection: 'diagonal' | 'vertical' | 'horizontal';
    private edgeThreshold: number;
    private minContourPoints: number;

    // Source data
    private sourceImageData: ImageData | null = null;
    private strokes: StrokePath[] = [];
    private colorRegions: ColorRegion[] = [];
    private allFillPixels: Point[] = [];
    private totalStrokePoints: number = 0;
    private totalFillPixels: number = 0;

    constructor(config: HybridAnimatorConfig) {
        this.width = config.width;
        this.height = config.height;
        this.background = config.background ?? [255, 255, 255, 255];
        this.strokeDurationRatio = config.strokeDurationRatio ?? 0.7;
        this.colorTolerance = config.colorTolerance ?? DEFAULT_COLOR_TOLERANCE;
        this.minRegionSize = config.minRegionSize ?? DEFAULT_MIN_REGION_SIZE;
        this.strokeWidth = config.strokeWidth ?? DEFAULT_STROKE_WIDTH;
        this.fillDirection = config.fillDirection ?? 'diagonal';
        this.edgeThreshold = config.edgeThreshold ?? DEFAULT_EDGE_DETECTION_THRESHOLD;
        this.minContourPoints = config.minContourPoints ?? DEFAULT_MIN_STROKE_CONTOUR_POINTS;
    }

    /**
     * Load an image for hybrid rendering
     * 
     * @param image - HTMLImageElement or ImageData to load
     * @returns Promise<boolean> - True if loaded successfully
     */
    async loadImage(image: HTMLImageElement | HTMLCanvasElement | ImageData): Promise<boolean> {
        try {
            // Get ImageData from source
            if (image instanceof ImageData) {
                // Resize if needed
                if (image.width !== this.width || image.height !== this.height) {
                    this.sourceImageData = this.resizeImageData(image, this.width, this.height);
                } else {
                    this.sourceImageData = image;
                }
            } else {
                // Create canvas and draw image
                const canvas = document.createElement('canvas');
                canvas.id = generateCanvasId('hybrid-animator-load');
                canvas.width = this.width;
                canvas.height = this.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return false;

                ctx.drawImage(image, 0, 0, this.width, this.height);
                this.sourceImageData = ctx.getImageData(0, 0, this.width, this.height);
            }

            console.log('  🔄 Preprocessing image for hybrid rendering...');

            // Extract strokes
            console.log(`    📝 Extracting strokes (edgeThreshold=${this.edgeThreshold}, minPoints=${this.minContourPoints})...`);
            this.strokes = extractStrokes(this.sourceImageData, this.minContourPoints, this.edgeThreshold);
            this.totalStrokePoints = this.strokes.reduce((sum, s) => sum + s.points.length, 0);
            console.log(`    ✅ Found ${this.strokes.length} strokes with ${this.totalStrokePoints} total points`);

            // Extract color regions
            console.log(`    🎨 Extracting color regions (ΔE < ${this.colorTolerance}, direction: ${this.fillDirection})...`);
            this.colorRegions = extractColorRegions(this.sourceImageData, this.colorTolerance, this.minRegionSize, this.fillDirection);

            // Create a global flattened list of all fill pixels for a continuous sweep
            const rawPixels: Point[] = [];
            for (const region of this.colorRegions) {
                rawPixels.push(...region.pixels);
            }

            // Sort the global list by direction (includes zigzag)
            this.allFillPixels = sortPixelsByDirection(rawPixels, this.fillDirection);
            this.totalFillPixels = this.allFillPixels.length;

            console.log(`    ✅ Found ${this.colorRegions.length} color regions with ${this.totalFillPixels} total pixels`);

            return true;
        } catch (error) {
            console.error('Failed to load image:', error);
            return false;
        }
    }

    /**
     * Load image from URL
     */
    async loadImageFromUrl(url: string): Promise<boolean> {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = async () => {
                const result = await this.loadImage(img);
                resolve(result);
            };

            img.onerror = () => {
                console.error('Failed to load image from URL:', url);
                resolve(false);
            };

            img.src = url;
        });
    }

    /**
     * Resize ImageData to target dimensions
     */
    private resizeImageData(source: ImageData, targetWidth: number, targetHeight: number): ImageData {
        const canvas = document.createElement('canvas');
        canvas.id = generateCanvasId('hybrid-animator-resize-src');
        canvas.width = source.width;
        canvas.height = source.height;
        const ctx = canvas.getContext('2d')!;
        ctx.putImageData(source, 0, 0);

        const resizeCanvas = document.createElement('canvas');
        resizeCanvas.id = generateCanvasId('hybrid-animator-resize-target');
        resizeCanvas.width = targetWidth;
        resizeCanvas.height = targetHeight;
        const resizeCtx = resizeCanvas.getContext('2d')!;
        resizeCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

        return resizeCtx.getImageData(0, 0, targetWidth, targetHeight);
    }

    /**
     * Render a single frame at the specific progress
     */
    renderFrame(progress: number): HybridFrame {
        if (!this.sourceImageData) {
            return {
                imageData: new ImageData(this.width, this.height),
                handPosition: null,
                isStrokePhase: true
            };
        }

        // Clamp progress
        progress = Math.max(0, Math.min(1, progress));

        const strokePhaseEnd = this.strokeDurationRatio;

        // Create canvas
        const canvas = new ImageData(this.width, this.height);
        // Fill background
        const [bgR, bgG, bgB, bgA] = this.background;
        for (let i = 0; i < this.width * this.height; i++) {
            const idx = i * 4;
            canvas.data[idx] = bgR;
            canvas.data[idx + 1] = bgG;
            canvas.data[idx + 2] = bgB;
            canvas.data[idx + 3] = bgA;
        }

        let handPosition: Coordinate | null = null;
        let isStrokePhase = true;

        // Use default stroke color for sketch effect
        const strokeColor = DEFAULT_STROKE_COLOR;

        if (progress <= strokePhaseEnd) {
            // STROKE PHASE
            isStrokePhase = true;
            const strokeProgress = progress / strokePhaseEnd;
            const totalPointsToDraw = Math.floor(this.totalStrokePoints * strokeProgress);

            let pointsDrawn = 0;
            let strokeIdx = 0;
            let pointInStroke = 0;
            let prevPoint: Coordinate | null = null;

            // Draw strokes up to totalPointsToDraw
            while (pointsDrawn < totalPointsToDraw && strokeIdx < this.strokes.length) {
                const stroke = this.strokes[strokeIdx];

                if (pointInStroke < stroke.points.length) {
                    const [x, y] = stroke.points[pointInStroke];
                    handPosition = [x, y];

                    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                        if (prevPoint && pointInStroke > 0) {
                            this.drawStrokeLine(canvas, prevPoint, [x, y], this.strokeWidth, strokeColor);
                        } else {
                            this.drawStrokePoint(canvas, x, y, this.strokeWidth, strokeColor);
                        }
                        prevPoint = [x, y];
                    }

                    pointInStroke++;
                    pointsDrawn++;
                } else {
                    strokeIdx++;
                    pointInStroke = 0;
                    prevPoint = null;
                }
            }
        } else {
            // FILL PHASE
            isStrokePhase = false;

            // 1. Draw ALL strokes first
            for (const stroke of this.strokes) {
                let prevPoint: Coordinate | null = null;
                for (let i = 0; i < stroke.points.length; i++) {
                    const [x, y] = stroke.points[i];
                    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                        if (prevPoint && i > 0) {
                            this.drawStrokeLine(canvas, prevPoint, [x, y], this.strokeWidth, strokeColor);
                        } else {
                            this.drawStrokePoint(canvas, x, y, this.strokeWidth, strokeColor);
                        }
                        prevPoint = [x, y];
                    }
                }
            }

            // 2. Fill regions
            const fillProgress = (progress - strokePhaseEnd) / (1 - strokePhaseEnd);
            const totalPixelsToFill = Math.floor(this.totalFillPixels * fillProgress);

            let pixelsFilled = 0;
            let regionIdx = 0;
            let pixelInRegion = 0;

            while (pixelsFilled < totalPixelsToFill && regionIdx < this.colorRegions.length) {
                const region = this.colorRegions[regionIdx];

                if (pixelInRegion < region.pixels.length) {
                    const [py, px] = region.pixels[pixelInRegion];
                    handPosition = [px, py];

                    if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
                        const idx = (py * this.width + px) * 4;
                        // Copy from source
                        canvas.data[idx] = this.sourceImageData.data[idx];
                        canvas.data[idx + 1] = this.sourceImageData.data[idx + 1];
                        canvas.data[idx + 2] = this.sourceImageData.data[idx + 2];
                        canvas.data[idx + 3] = 255;
                    }

                    pixelInRegion++;
                    pixelsFilled++;
                } else {
                    regionIdx++;
                    pixelInRegion = 0;
                }
            }
        }

        return {
            imageData: canvas,
            handPosition,
            isStrokePhase
        };
    }

    /**
     * Generate hybrid animation frames
     * 
     * @param fps - Frames per second
     * @param duration - Total animation duration in seconds
     * @returns Array of HybridFrame objects
     */
    generateAnimation(fps: number = 30, duration: number = 5.0): HybridFrame[] {
        if (!this.sourceImageData) {
            console.warn('No image loaded. Call loadImage() first.');
            return [];
        }

        const totalFrames = Math.floor(fps * duration);
        const strokeFrames = Math.floor(totalFrames * this.strokeDurationRatio);
        const fillFrames = totalFrames - strokeFrames;

        console.log(`  🎬 Rendering hybrid animation:`);
        console.log(`    - Total: ${totalFrames} frames (${duration.toFixed(1)}s)`);
        console.log(`    - Stroke phase: ${strokeFrames} frames`);
        console.log(`    - Fill phase: ${fillFrames} frames`);

        const results: HybridFrame[] = [];

        // Create reveal mask for fill phase
        const revealMask = new Uint8Array(this.width * this.height);

        // Create stroke canvas for stroke phase - strokes are drawn as lines
        // This creates a "sketch" effect where only the outlines are visible during stroke phase
        const strokeCanvas = new ImageData(this.width, this.height);
        // Initialize with background color
        const [bgR, bgG, bgB, bgA] = this.background;
        for (let i = 0; i < this.width * this.height; i++) {
            const idx = i * 4;
            strokeCanvas.data[idx] = bgR;
            strokeCanvas.data[idx + 1] = bgG;
            strokeCanvas.data[idx + 2] = bgB;
            strokeCanvas.data[idx + 3] = bgA;
        }

        // ==================== PHASE 1: Stroke Animation ====================
        // Draw actual stroke lines (edges/outlines) progressively
        console.log('  📝 Phase 1: Drawing strokes...');

        let pointsDrawn = 0;
        let strokeIdx = 0;
        let pointInStroke = 0;
        let prevPoint: Coordinate | null = null;

        // Use default stroke color for sketch effect
        const strokeColor = DEFAULT_STROKE_COLOR;

        for (let frameIdx = 0; frameIdx < strokeFrames; frameIdx++) {
            // Calculate target points for this frame
            const targetPoints = Math.floor((frameIdx + 1) / strokeFrames * this.totalStrokePoints);
            let pointsToDraw = targetPoints - pointsDrawn;

            // Get current hand position
            let currentPos: Coordinate | null = null;
            if (strokeIdx < this.strokes.length && this.strokes[strokeIdx].points.length > 0) {
                const stroke = this.strokes[strokeIdx];
                const pointIdx = Math.min(pointInStroke, stroke.points.length - 1);
                currentPos = stroke.points[pointIdx];
            }

            // Draw points as actual stroke lines
            while (pointsToDraw > 0 && strokeIdx < this.strokes.length) {
                const stroke = this.strokes[strokeIdx];

                if (pointInStroke < stroke.points.length) {
                    const [x, y] = stroke.points[pointInStroke];
                    currentPos = [x, y];

                    // Draw stroke line from previous point to current point
                    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                        if (prevPoint && pointInStroke > 0) {
                            // Draw line from previous point
                            this.drawStrokeLine(strokeCanvas, prevPoint, [x, y], this.strokeWidth, strokeColor);
                        } else {
                            // First point - draw a dot
                            this.drawStrokePoint(strokeCanvas, x, y, this.strokeWidth, strokeColor);
                        }
                        prevPoint = [x, y];

                        // Also mark in reveal mask for seamless transition to fill phase
                        this.revealCircle(revealMask, x, y, Math.ceil(this.strokeWidth / 2));
                    }

                    pointInStroke++;
                    pointsDrawn++;
                    pointsToDraw--;
                } else {
                    // Move to next stroke
                    strokeIdx++;
                    pointInStroke = 0;
                    prevPoint = null;
                }
            }

            // Create frame from stroke canvas (shows only drawn strokes on background)
            const frameData = new ImageData(
                new Uint8ClampedArray(strokeCanvas.data),
                this.width,
                this.height
            );

            results.push({
                imageData: frameData,
                handPosition: currentPos,
                isStrokePhase: true
            });

            // Progress report
            if (strokeFrames > 0 && (frameIdx + 1) % Math.max(1, Math.floor(strokeFrames / 5)) === 0) {
                console.log(`    Stroke progress: ${Math.round((frameIdx + 1) / strokeFrames * 100)}%`);
            }
        }

        console.log(`  ✅ Stroke phase complete: ${pointsDrawn} points drawn`);

        // ==================== PHASE 2: Fill Animation ====================
        // Reveal color regions progressively, blending with stroke canvas
        console.log('  🎨 Phase 2: Filling colors...');

        let regionsProcessed = 0;
        let pixelsFilled = 0;
        let regionIdx = 0;
        let pixelInRegion = 0;

        // Create a working canvas that starts with the stroke drawing
        const fillCanvas = new ImageData(
            new Uint8ClampedArray(strokeCanvas.data),
            this.width,
            this.height
        );

        for (let frameIdx = 0; frameIdx < fillFrames; frameIdx++) {
            // Calculate target pixels for this frame
            const targetPixels = Math.floor((frameIdx + 1) / fillFrames * this.totalFillPixels);
            let pixelsToFill = targetPixels - pixelsFilled;

            // Get current hand position
            let currentPos: Coordinate | null = null;
            if (regionIdx < this.colorRegions.length) {
                const region = this.colorRegions[regionIdx];
                currentPos = [region.centroid[1], region.centroid[0]]; // [x, y]
            }

            // Fill pixels with actual colors from source image
            while (pixelsToFill > 0 && regionIdx < this.colorRegions.length) {
                const region = this.colorRegions[regionIdx];

                if (pixelInRegion < region.pixels.length) {
                    const [py, px] = region.pixels[pixelInRegion];
                    currentPos = [px, py];

                    // Copy pixel color from source image to fill canvas
                    if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
                        const idx = (py * this.width + px) * 4;
                        fillCanvas.data[idx] = this.sourceImageData!.data[idx];
                        fillCanvas.data[idx + 1] = this.sourceImageData!.data[idx + 1];
                        fillCanvas.data[idx + 2] = this.sourceImageData!.data[idx + 2];
                        fillCanvas.data[idx + 3] = 255;
                        revealMask[py * this.width + px] = 255;
                    }

                    pixelInRegion++;
                    pixelsFilled++;
                    pixelsToFill--;
                } else {
                    // Move to next region
                    regionIdx++;
                    pixelInRegion = 0;
                    regionsProcessed++;
                }
            }

            // Create frame from fill canvas (shows strokes + revealed colors)
            const frameData = new ImageData(
                new Uint8ClampedArray(fillCanvas.data),
                this.width,
                this.height
            );

            results.push({
                imageData: frameData,
                handPosition: currentPos,
                isStrokePhase: false
            });

            // Progress report
            if (fillFrames > 0 && (frameIdx + 1) % Math.max(1, Math.floor(fillFrames / 5)) === 0) {
                console.log(`    Fill progress: ${Math.round((frameIdx + 1) / fillFrames * 100)}%`);
            }
        }

        console.log(`  ✅ Fill phase complete: ${regionsProcessed} regions filled`);

        // Add final frame with complete image
        const finalFrame = new ImageData(
            new Uint8ClampedArray(this.sourceImageData.data),
            this.width,
            this.height
        );
        results.push({
            imageData: finalFrame,
            handPosition: null,
            isStrokePhase: false
        });

        console.log(`  ✅ Hybrid animation complete: ${results.length} total frames`);

        return results;
    }

    /**
     * Reveal a circle area in the mask
     */
    private revealCircle(mask: Uint8Array, x: number, y: number, radius: number): void {
        const r2 = radius * radius;
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (dx * dx + dy * dy <= r2) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                        mask[ny * this.width + nx] = 255;
                    }
                }
            }
        }
    }

    /**
     * Draw a stroke line on the canvas between two points with anti-aliasing.
     * Uses smooth interpolation for high-quality rendering.
     */
    private drawStrokeLine(canvas: ImageData, start: Coordinate, end: Coordinate, thickness: number, color: RGB): void {
        const [x1, y1] = start;
        const [x2, y2] = end;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 0.5) {
            // Points are very close, just draw a single point
            this.drawStrokePointAntiAliased(canvas, x1, y1, thickness, color);
            return;
        }

        // Use sub-pixel stepping for smooth lines
        const steps = Math.max(Math.ceil(dist), 1);
        const stepX = dx / steps;
        const stepY = dy / steps;

        for (let i = 0; i <= steps; i++) {
            const px = x1 + i * stepX;
            const py = y1 + i * stepY;
            this.drawStrokePointAntiAliased(canvas, px, py, thickness, color);
        }
    }

    /**
     * Draw a stroke point (filled circle) on the canvas with anti-aliasing
     * for smoother edges.
     */
    private drawStrokePoint(canvas: ImageData, x: number, y: number, thickness: number, color: RGB): void {
        this.drawStrokePointAntiAliased(canvas, x, y, thickness, color);
    }

    /**
     * Draw an anti-aliased stroke point using distance-based alpha blending.
     * Creates smooth circular points with soft edges.
     */
    private drawStrokePointAntiAliased(canvas: ImageData, x: number, y: number, thickness: number, color: RGB): void {
        const radius = thickness / 2;
        const outerRadius = radius + 0.5; // Extend slightly for anti-aliasing
        const innerRadius = Math.max(0, radius - 0.5);
        const outerR2 = outerRadius * outerRadius;
        const innerR2 = innerRadius * innerRadius;
        const [r, g, b] = color;

        const minX = Math.max(0, Math.floor(x - outerRadius));
        const maxX = Math.min(this.width - 1, Math.ceil(x + outerRadius));
        const minY = Math.max(0, Math.floor(y - outerRadius));
        const maxY = Math.min(this.height - 1, Math.ceil(y + outerRadius));

        for (let py = minY; py <= maxY; py++) {
            for (let px = minX; px <= maxX; px++) {
                const dx = px - x;
                const dy = py - y;
                const d2 = dx * dx + dy * dy;

                if (d2 <= outerR2) {
                    const idx = (py * this.width + px) * 4;

                    if (d2 <= innerR2) {
                        // Fully inside the circle
                        canvas.data[idx] = r;
                        canvas.data[idx + 1] = g;
                        canvas.data[idx + 2] = b;
                        canvas.data[idx + 3] = 255;
                    } else {
                        // Anti-aliased edge - blend based on distance
                        const dist = Math.sqrt(d2);
                        // Normalize alpha to 0-1 range based on distance between inner and outer radius
                        const radiusDiff = outerRadius - innerRadius;
                        const alpha = radiusDiff > 0
                            ? Math.max(0, Math.min(1, (outerRadius - dist) / radiusDiff))
                            : 1;

                        // Alpha blend with existing pixel
                        const existingR = canvas.data[idx];
                        const existingG = canvas.data[idx + 1];
                        const existingB = canvas.data[idx + 2];
                        const existingA = canvas.data[idx + 3] / 255;

                        // Blend colors
                        const newA = alpha + existingA * (1 - alpha);
                        if (newA > 0) {
                            canvas.data[idx] = Math.round((r * alpha + existingR * existingA * (1 - alpha)) / newA);
                            canvas.data[idx + 1] = Math.round((g * alpha + existingG * existingA * (1 - alpha)) / newA);
                            canvas.data[idx + 2] = Math.round((b * alpha + existingB * existingA * (1 - alpha)) / newA);
                            canvas.data[idx + 3] = Math.round(newA * 255);
                        }
                    }
                }
            }
        }
    }

    /**
     * Get the number of strokes extracted
     */
    getStrokeCount(): number {
        return this.strokes.length;
    }

    /**
     * Get the number of color regions extracted
     */
    getColorRegionCount(): number {
        return this.colorRegions.length;
    }

    /**
     * Reset animator state
     */
    reset(): void {
        this.sourceImageData = null;
        this.strokes = [];
        this.colorRegions = [];
        this.totalStrokePoints = 0;
        this.totalFillPixels = 0;
    }
}

/**
 * Convenience function to render a hybrid animation
 */
export async function renderHybridAnimation(
    imageSource: string | HTMLImageElement | HTMLCanvasElement | ImageData,
    options: {
        width?: number;
        height?: number;
        fps?: number;
        duration?: number;
        strokeRatio?: number;
        colorTolerance?: number;
        background?: RGBA;
    } = {}
): Promise<HybridFrame[]> {
    const width = options.width ?? 1280;
    const height = options.height ?? 720;
    const fps = options.fps ?? 30;
    const duration = options.duration ?? 5.0;

    const animator = new HybridImageAnimator({
        width,
        height,
        strokeDurationRatio: options.strokeRatio ?? 0.7,
        colorTolerance: options.colorTolerance ?? DEFAULT_COLOR_TOLERANCE,
        background: options.background ?? [255, 255, 255, 255]
    });

    let loaded = false;

    if (typeof imageSource === 'string') {
        loaded = await animator.loadImageFromUrl(imageSource);
    } else {
        loaded = await animator.loadImage(imageSource);
    }

    if (!loaded) {
        console.error('Failed to load image for hybrid animation');
        return [];
    }

    return animator.generateAnimation(fps, duration);
}

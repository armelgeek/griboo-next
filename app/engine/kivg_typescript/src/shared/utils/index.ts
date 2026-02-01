import { Point, Coordinate, RGB, StrokePath, ColorRegion } from '../types';
import * as ImageProc from '../graphics/image-processing';
import { extractStrokesCore } from '../graphics/stroke-extraction-core';

// Constants
export const WHITE_LIKE_THRESHOLD = 240;
export const SMOOTHING_RDP_EPSILON = 1.5;
export const SMOOTHING_CHAIKIN_ITERATIONS = 3;
export const SMOOTHING_CATMULL_SEGMENTS = 8;
export const SMOOTHING_MIN_INTERPOLATED_POINTS = 10;
export const EDGE_DETECTION_THRESHOLD = 40; // Increased for cleaner Sobel
export const MIN_STROKE_CONTOUR_POINTS = 20; // Increased to filter small noise
export const GAUSSIAN_BLUR_SIGMA = 1.2;

/**
 * Calculate perceptual color difference (simplified ΔE)
 */
export function calculateDeltaE(color1: RGB, color2: RGB): number {
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
export function colorsMatchExact(color1: RGB, color2: RGB): boolean {
    return color1[0] === color2[0] && color1[1] === color2[1] && color1[2] === color2[2];
}

/**
 * Calculate color difference based on tolerance.
 */
export function getColorDifference(color1: RGB, color2: RGB, tolerance: number): number {
    if (tolerance === 0) {
        return colorsMatchExact(color1, color2) ? 0 : Infinity;
    }
    return calculateDeltaE(color1, color2);
}

/**
 * Check if a color is "white-like" (background)
 */
export function isWhiteLike(color: RGB): boolean {
    const [r, g, b] = color;
    const grayValue = 0.299 * r + 0.587 * g + 0.114 * b;
    return grayValue > WHITE_LIKE_THRESHOLD;
}

/**
 * Sort pixels in diagonal order (top-left to bottom-right).
 */
export function sortPixelsDiagonally(pixels: Point[]): Point[] {
    if (pixels.length === 0) return pixels;

    const diagonalBands = new Map<number, Point[]>();

    for (const [row, col] of pixels) {
        const diagIdx = row + col;
        if (!diagonalBands.has(diagIdx)) {
            diagonalBands.set(diagIdx, []);
        }
        diagonalBands.get(diagIdx)!.push([row, col]);
    }

    const sortedDiagIndices = Array.from(diagonalBands.keys()).sort((a, b) => a - b);
    const orderedPixels: Point[] = [];

    for (let i = 0; i < sortedDiagIndices.length; i++) {
        const diagIdx = sortedDiagIndices[i];
        const bandPixels = diagonalBands.get(diagIdx)!;

        if (i % 2 === 0) {
            bandPixels.sort((a, b) => a[0] - b[0]);
        } else {
            bandPixels.sort((a, b) => b[0] - a[0]);
        }

        for (let j = 0; j < bandPixels.length; j++) {
            orderedPixels.push(bandPixels[j]);
        }
    }

    return orderedPixels;
}

/**
 * Sort pixels vertically (top to bottom, left to right).
 */
export function sortPixelsVertically(pixels: Point[]): Point[] {
    if (pixels.length === 0) return pixels;

    const columnBands = new Map<number, Point[]>();

    for (const [row, col] of pixels) {
        if (!columnBands.has(col)) {
            columnBands.set(col, []);
        }
        columnBands.get(col)!.push([row, col]);
    }

    const sortedColIndices = Array.from(columnBands.keys()).sort((a, b) => a - b);
    const orderedPixels: Point[] = [];

    for (let i = 0; i < sortedColIndices.length; i++) {
        const colIdx = sortedColIndices[i];
        const bandPixels = columnBands.get(colIdx)!;

        // Zigzag: alternate direction for each column
        if (i % 2 === 0) {
            bandPixels.sort((a, b) => a[0] - b[0]);
        } else {
            bandPixels.sort((a, b) => b[0] - a[0]);
        }

        for (const p of bandPixels) {
            orderedPixels.push(p);
        }
    }

    return orderedPixels;
}

/**
 * Sort pixels horizontally (left to right, top to bottom).
 */
export function sortPixelsHorizontally(pixels: Point[]): Point[] {
    if (pixels.length === 0) return pixels;

    const rowBands = new Map<number, Point[]>();

    for (const [row, col] of pixels) {
        if (!rowBands.has(row)) {
            rowBands.set(row, []);
        }
        rowBands.get(row)!.push([row, col]);
    }

    const sortedRowIndices = Array.from(rowBands.keys()).sort((a, b) => a - b);
    const orderedPixels: Point[] = [];

    for (let i = 0; i < sortedRowIndices.length; i++) {
        const rowIdx = sortedRowIndices[i];
        const bandPixels = rowBands.get(rowIdx)!;

        // Zigzag: alternate direction for each row
        if (i % 2 === 0) {
            bandPixels.sort((a, b) => a[1] - b[1]);
        } else {
            bandPixels.sort((a, b) => b[1] - a[1]);
        }

        for (const p of bandPixels) {
            orderedPixels.push(p);
        }
    }

    return orderedPixels;
}

/**
 * Sort pixels based on fill direction.
 */
export function sortPixelsByDirection(pixels: Point[], direction: 'diagonal' | 'vertical' | 'horizontal' = 'diagonal'): Point[] {
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
export function isContourClosed(points: Coordinate[], threshold: number = 5): boolean {
    if (points.length < 3) return false;
    const [x1, y1] = points[0];
    const [x2, y2] = points[points.length - 1];
    const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    return dist <= threshold;
}

/**
 * Simplify points with Ramer–Douglas–Peucker algorithm
 */
export function simplifyRDP(points: Coordinate[], epsilon: number): Coordinate[] {
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
 * Catmull-Rom spline interpolation
 */
export function interpolateCatmullRom(
    points: Coordinate[],
    numSegments: number = SMOOTHING_CATMULL_SEGMENTS
): Coordinate[] {
    if (points.length < 2) return points.slice();

    if (points.length === 2) {
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

    const result: Coordinate[] = [];
    result.push(points[0]);

    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[Math.min(points.length - 1, i + 1)];
        const p3 = points[Math.min(points.length - 1, i + 2)];

        for (let j = 1; j < numSegments; j++) {
            const t = j / numSegments;
            const t2 = t * t;
            const t3 = t2 * t;

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

    result.push(points[points.length - 1]);
    return result;
}

/**
 * Prepare contour for smooth closed-loop processing.
 */
export function prepareClosedContour(points: Coordinate[]): { points: Coordinate[], isClosed: boolean } {
    const isClosed = isContourClosed(points);

    if (!isClosed || points.length < 4) {
        return { points: points.slice(), isClosed: false };
    }

    const wrapCount = Math.min(3, Math.floor(points.length / 4));
    const wrapped: Coordinate[] = [];

    for (let i = points.length - wrapCount; i < points.length; i++) {
        wrapped.push(points[i]);
    }

    for (let i = 0; i < points.length; i++) {
        wrapped.push(points[i]);
    }

    for (let i = 0; i < wrapCount; i++) {
        wrapped.push(points[i]);
    }

    return { points: wrapped, isClosed: true };
}

/**
 * Unwrap a closed contour after smoothing.
 */
export function unwrapClosedContour(points: Coordinate[], originalLength: number, wrapCount: number): Coordinate[] {
    if (points.length <= wrapCount * 2) return points;

    const expansionRatio = points.length / (originalLength + wrapCount * 2);
    const startOffset = Math.floor(wrapCount * expansionRatio);
    const endOffset = Math.floor(wrapCount * expansionRatio);

    return points.slice(startOffset, points.length - endOffset);
}

/**
 * Apply the complete smoothing pipeline to a contour.
 */
export function smoothContourPipeline(contour: Coordinate[]): Coordinate[] {
    if (contour.length < 3) return contour.slice();

    const { points: preparedPoints, isClosed } = prepareClosedContour(contour);
    const wrapCount = isClosed ? Math.min(3, Math.floor(contour.length / 4)) : 0;

    const simplified = simplifyRDP(preparedPoints, SMOOTHING_RDP_EPSILON);
    const interpolated = interpolateCatmullRom(simplified, SMOOTHING_CATMULL_SEGMENTS);

    if (isClosed && interpolated.length > SMOOTHING_MIN_INTERPOLATED_POINTS) {
        return unwrapClosedContour(interpolated, contour.length, wrapCount);
    }

    return interpolated;
}

export const DEFAULT_COLOR_TOLERANCE = 10.0;
export const DEFAULT_MIN_REGION_SIZE = 50;
export const DEFAULT_STROKE_WIDTH = 3;

/**
 * Sort strokes in reading order.
 */
export function sortStrokesByReadingOrder(strokes: StrokePath[]): StrokePath[] {
    if (strokes.length === 0) return [];

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

    strokeMeta.sort((a, b) => a.minY - b.minY);

    const lines: typeof strokeMeta[] = [];
    let currentLine: typeof strokeMeta = [];

    if (strokeMeta.length > 0) {
        currentLine.push(strokeMeta[0]);
        let lineMinY = strokeMeta[0].minY;
        let lineMaxY = strokeMeta[0].maxY;

        for (let i = 1; i < strokeMeta.length; i++) {
            const s = strokeMeta[i];
            const lineCenterY = (lineMinY + lineMaxY) / 2;
            const verticalDist = Math.abs(s.centerY - lineCenterY);
            const avgHeight = (s.height + (lineMaxY - lineMinY)) / 2;

            if (verticalDist < Math.max(20, avgHeight * 0.8)) {
                currentLine.push(s);
                lineMinY = Math.min(lineMinY, s.minY);
                lineMaxY = Math.max(lineMaxY, s.maxY);
            } else {
                lines.push(currentLine);
                currentLine = [s];
                lineMinY = s.minY;
                lineMaxY = s.maxY;
            }
        }
        lines.push(currentLine);
    }

    const sortedStrokes: StrokePath[] = [];
    for (const line of lines) {
        line.sort((a, b) => a.minX - b.minX);
        for (const meta of line) {
            sortedStrokes.push(meta.stroke);
        }
    }

    return sortedStrokes;
}

/**
 * Apply Gaussian Blur to grayscale data
 */
export function applyGaussianBlur(
    data: Uint8Array,
    width: number,
    height: number,
    sigma: number = 1.0
): Uint8Array {
    const kernelSize = Math.ceil(sigma * 3) * 2 + 1;
    const kernel = new Float32Array(kernelSize);
    const half = Math.floor(kernelSize / 2);

    // Generate 1D Gaussian kernel
    let sum = 0;
    for (let i = 0; i < kernelSize; i++) {
        const x = i - half;
        kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
        sum += kernel[i];
    }
    for (let i = 0; i < kernelSize; i++) kernel[i] /= sum;

    const temp = new Uint8Array(width * height);
    const result = new Uint8Array(width * height);

    // Horizontal pass
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let val = 0;
            for (let k = 0; k < kernelSize; k++) {
                const kx = Math.min(width - 1, Math.max(0, x + k - half));
                val += data[y * width + kx] * kernel[k];
            }
            temp[y * width + x] = val;
        }
    }

    // Vertical pass
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            let val = 0;
            for (let k = 0; k < kernelSize; k++) {
                const ky = Math.min(height - 1, Math.max(0, y + k - half));
                val += temp[ky * width + x] * kernel[k];
            }
            result[y * width + x] = val;
        }
    }

    return result;
}

/**
 * extractStrokes - version améliorée avec Sobel et Gaussian Blur
 */
/**
 * extractStrokes - Implementation aligned with Frontend (Skeletonization)
 */
export function extractStrokes(
    imageData: { width: number, height: number, data: Uint8ClampedArray | Uint8Array },
    minContourPoints: number = MIN_STROKE_CONTOUR_POINTS
): StrokePath[] {
    const { width, height, data } = imageData;

    // 1. Convert to grayscale
    // Handle both Uint8ClampedArray (ImageData) and Uint8Array
    let gray: Uint8Array;
    if (data instanceof Uint8ClampedArray) {
        // Create a temp ImageData object to use ImageProc.grayscale
        const tempImgData = { data, width, height } as ImageData;
        gray = ImageProc.grayscale(tempImgData);
    } else {
        // If it's already Uint8Array, assume it might be RGBA or Gray?
        // Safest is to assume RGBA if length is w*h*4
        if (data.length === width * height * 4) {
            const tempImgData = { data: new Uint8ClampedArray(data), width, height } as ImageData;
            gray = ImageProc.grayscale(tempImgData);
        } else {
            gray = data; // Assume already grayscale
        }
    }

    // 2. Use shared core stroke extraction logic (same as frontend)
    const rawPaths = extractStrokesCore(gray, width, height);

    // 3. Post-processing and Scaling
    const strokes: StrokePath[] = [];

    for (const points of rawPaths) {
        // Convert ImageProc.Point {x,y} to Coordinate [x,y]
        const coords: Coordinate[] = points.map((p: ImageProc.PixelPoint) => [p.x, p.y]);

        if (coords.length > 2) {
            // V5: Less aggressive simplification to keep details
            const epsilon = 0.5; // Reduced from 2.0+
            let simplified = simplifyRDP(coords, epsilon);

            // V5: Removed sampling to keep all important points

            // V5: Final Smoothing using Catmull-Rom with more segments for fluidity
            strokes.push({
                points: interpolateCatmullRom(simplified, 4)
            });
        } else if (coords.length > 0) {
            strokes.push({ points: coords });
        }
    }

    return sortStrokesByReadingOrder(strokes);
}

/**
 * extractColorRegions - Implementation aligned with Frontend (Flood Fill)
 */
export function extractColorRegions(
    imageData: { width: number, height: number, data: Uint8ClampedArray | Uint8Array },
    tolerance: number = DEFAULT_COLOR_TOLERANCE,
    minRegionSize: number = DEFAULT_MIN_REGION_SIZE,
    fillDirection: 'diagonal' | 'vertical' | 'horizontal' = 'diagonal'
): ColorRegion[] {
    const { width, height, data } = imageData;
    const visited = new Uint8Array(width * height);
    const regions: ColorRegion[] = [];

    // Constants matching frontend
    const NON_WHITE_THRESHOLD = 250;
    const WHITE_LIKE_THRESHOLD = 240;
    const MAX_REGION_SIZE = 1_000_000;

    // Adjust minRegionSize based on image area (logic from frontend)
    const imageArea = width * height;
    const baseSizeMultiplier = imageArea > 1000000 ? 5 : (imageArea > 500000 ? 3 : 1);
    const scaledMinRegionSize = minRegionSize * baseSizeMultiplier;

    const getColor = (x: number, y: number): RGB => {
        const idx = (y * width + x) * 4;
        return [data[idx], data[idx + 1], data[idx + 2]];
    };

    const floodFill = (startX: number, startY: number, startColor: RGB): ColorRegion | null => {
        const pixels: Point[] = []; // [row, col]
        const stack: [number, number][] = [[startX, startY]]; // [x, y]

        while (stack.length > 0) {
            if (pixels.length >= MAX_REGION_SIZE) break;

            const [x, y] = stack.pop()!;
            if (x < 0 || x >= width || y < 0 || y >= height) continue;
            const idx = y * width + x;
            if (visited[idx]) continue;

            const offset = idx * 4;
            const r = data[offset];
            const g = data[offset + 1];
            const b = data[offset + 2];
            const pixColor: RGB = [r, g, b];

            const colorMatches = tolerance === 0
                ? r === startColor[0] && g === startColor[1] && b === startColor[2]
                : calculateDeltaE(startColor, pixColor) <= tolerance;

            if (!colorMatches) continue;

            visited[idx] = 1;
            pixels.push([y, x]); // Store as [row, col]

            stack.push([x + 1, y]);
            stack.push([x - 1, y]);
            stack.push([x, y + 1]);
            stack.push([x, y - 1]);
        }

        if (pixels.length < scaledMinRegionSize) return null;

        let sumRow = 0, sumCol = 0;
        for (const [row, col] of pixels) {
            sumRow += row;
            sumCol += col;
        }

        return {
            color: startColor,
            pixels: sortPixelsByDirection(pixels, fillDirection),
            centroid: [sumRow / pixels.length, sumCol / pixels.length],
            size: pixels.length
        };
    };

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (visited[idx]) continue;

            const startColor = getColor(x, y);

            // Check if background (white-like)
            const [r, g, b] = startColor;
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            if (gray >= NON_WHITE_THRESHOLD) continue;

            const region = floodFill(x, y, startColor);
            if (region) {
                // Double check region average color
                const [rr, rg, rb] = region.color;
                const regionGray = 0.299 * rr + 0.587 * rg + 0.114 * rb;

                if (regionGray <= WHITE_LIKE_THRESHOLD) {
                    regions.push(region);
                }
            }
        }
    }

    // Sort regions (logic from frontend sortRegionsByDirection)
    // Group by color first
    const colorGroups = new Map<string, ColorRegion[]>();
    for (const r of regions) {
        const key = `${r.color[0]},${r.color[1]},${r.color[2]}`;
        if (!colorGroups.has(key)) colorGroups.set(key, []);
        colorGroups.get(key)!.push(r);
    }

    // Sort colors by average position
    const sortedColors = Array.from(colorGroups.keys()).sort((a, b) => {
        const regsA = colorGroups.get(a)!;
        const regsB = colorGroups.get(b)!;
        const avgA = regsA.reduce((sum, r) => sum + (r.centroid[0] + r.centroid[1]), 0) / regsA.length;
        const avgB = regsB.reduce((sum, r) => sum + (r.centroid[0] + r.centroid[1]), 0) / regsB.length;
        return avgA - avgB;
    });

    const sortedRegions: ColorRegion[] = [];
    for (const colorKey of sortedColors) {
        const group = colorGroups.get(colorKey)!;

        // Sort regions within color group
        group.sort((a, b) => {
            if (fillDirection === 'vertical') {
                if (a.centroid[1] !== b.centroid[1]) return a.centroid[1] - b.centroid[1]; // col
                return a.centroid[0] - b.centroid[0]; // row
            } else if (fillDirection === 'horizontal') {
                if (a.centroid[0] !== b.centroid[0]) return a.centroid[0] - b.centroid[0]; // row
                return a.centroid[1] - b.centroid[1]; // col
            } else {
                const diagA = a.centroid[0] + a.centroid[1];
                const diagB = b.centroid[0] + b.centroid[1];
                return diagA - diagB;
            }
        });

        sortedRegions.push(...group);
    }

    return sortedRegions;
}

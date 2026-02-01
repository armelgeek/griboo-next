/**
 * Image drawing and coloring animation module.
 * Provides canvas-based image rendering with progressive reveal effects.
 * 
 * This module is synchronized with the Python implementation in plugins/kivg/core/image.py
 * to ensure consistent behavior across both platforms.
 */

import { type RGBA } from '../../../shared/utils/color_utils';
import { generateCanvasId } from '../infra/utils';

type Point = [number, number]; // [row, col] or [y, x]

/**
 * Coordinate pair for x, y positioning (distinct from Point which is row, col).
 */
type Coordinate = [number, number]; // [x, y]

/**
 * Hand image data structure for overlay rendering.
 */
export interface HandData {
    image: ImageData;
    mask: ImageData;
    maskInv: ImageData;
    width: number;
    height: number;
}

/**
 * Image loading result with metadata.
 */
export interface ImageLoadResult {
    image: ImageData | null;
    width: number;
    height: number;
    hasAlpha: boolean;
}

/**
 * Bounding box coordinates using [x, y] format.
 */
export interface BoundingBox {
    topLeft: Coordinate;
    bottomRight: Coordinate;
}

/**
 * Coloring patterns for progressive image reveal.
 */
export type ColoringPattern = 'diagonal' | 'horizontal' | 'vertical' | 'draw';

/**
 * Result of image analysis for split lengths.
 */
export interface SplitLensResult {
    image_res: string;
    split_lens: number[];
}

/**
 * Configuration for sketch animation.
 */
export interface SketchConfig {
    splitLen: number;
    frameRate: number;
    objectSkipRate: number;
    bgObjectSkipRate: number;
    mainImgDuration: number;
    endColor: boolean;
}

/**
 * Result of sketch initiation.
 */
export interface SketchResult {
    status: boolean;
    message: string;
}

/**
 * Find common divisors of two numbers.
 */
export function commonDivisors(num1: number, num2: number): number[] {
    const divisors: number[] = [];
    const min = Math.min(num1, num2);

    for (let i = 1; i <= min; i++) {
        if (num1 % i === 0 && num2 % i === 0) {
            divisors.push(i);
        }
    }

    return divisors;
}

/**
 * Find nearest standard resolution.
 */
export function findNearestRes(given: number): number {
    const standardRes = [640, 360, 480, 1280, 720, 1920, 1080, 2560, 1440, 3840, 2160, 7680, 4320];
    let minDiff = Infinity;
    let nearest = given;

    for (const res of standardRes) {
        const diff = Math.abs(res - given);
        if (diff < minDiff) {
            minDiff = diff;
            nearest = res;
        }
    }

    return nearest;
}

/**
 * Check if a source string is a URL.
 * 
 * @param source - Source string to check
 * @returns True if the source is a URL
 */
export function isUrl(source: string): boolean {
    return typeof source === 'string' && (source.startsWith('http://') || source.startsWith('https://'));
}

/**
 * Calculate Euclidean distance between array of points and a target point.
 * 
 * @param points - Array of [x, y] points
 * @param target - Target point [x, y]
 * @returns Array of distances
 */
export function eucDist(points: Point[], target: Point): number[] {
    return points.map(p => Math.sqrt(
        Math.pow(p[0] - target[0], 2) + Math.pow(p[1] - target[1], 2)
    ));
}

/**
 * Get extreme coordinates (bounding box) from a binary mask.
 * 
 * @param maskData - ImageData for the mask (255 = foreground)
 * @returns Bounding box with topLeft [x, y] and bottomRight [x, y] coordinates
 */
export function getExtremeCoordinates(maskData: ImageData): BoundingBox {
    const { width, height, data } = maskData;
    let minX = width, minY = height, maxX = 0, maxY = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            // Check if pixel is white (255)
            if (data[idx] === 255 || data[idx + 1] === 255 || data[idx + 2] === 255) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    return {
        topLeft: [minX, minY] as Coordinate,
        bottomRight: [maxX, maxY] as Coordinate
    };
}

/**
 * Load an image from a URL or local path.
 * 
 * This function handles both URL sources (http/https) and data URLs.
 * For browser environments, it uses the Image API.
 * 
 * @param imageSource - URL or path to the image
 * @returns Promise resolving to ImageLoadResult
 */
export async function loadImageFromUrlOrPath(imageSource: string): Promise<ImageLoadResult> {
    // Use HTTP loader for remote URLs
    if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
        const { getGlobalCache } = await import('../../utils/asset_cache');
        const { fetchImage } = await import('../../utils/http_loader');

        const cache = getGlobalCache();

        // Check cache first
        let blob = await cache.get(imageSource);

        if (!blob) {
            // Download with retry logic
            blob = await fetchImage(imageSource, { retries: 3, timeout: 30000 });
            // Store in cache
            await cache.set(imageSource, blob);
        }

        // Convert blob to ImageData
        return new Promise((resolve) => {
            const img = new Image();
            const objectUrl = URL.createObjectURL(blob);

            img.onload = () => {
                URL.revokeObjectURL(objectUrl);
                const canvas = document.createElement('canvas');
                canvas.id = generateCanvasId('image-load');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d', { alpha: true });

                if (!ctx) {
                    resolve({ image: null, width: 0, height: 0, hasAlpha: false });
                    return;
                }

                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, img.width, img.height);

                // Check if image has alpha channel
                let hasAlpha = false;
                for (let i = 3; i < imageData.data.length; i += 4) {
                    if (imageData.data[i] < 255) {
                        hasAlpha = true;
                        break;
                    }
                }

                resolve({
                    image: imageData,
                    width: img.width,
                    height: img.height,
                    hasAlpha
                });
            };

            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                console.warn(`Failed to load image from HTTP: ${imageSource}`);
                resolve({ image: null, width: 0, height: 0, hasAlpha: false });
            };

            img.src = objectUrl;
        });
    }

    // Local path or data URL - use existing logic
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.id = generateCanvasId('image-load');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d', { alpha: true });

            if (!ctx) {
                resolve({ image: null, width: 0, height: 0, hasAlpha: false });
                return;
            }

            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, img.width, img.height);

            // Check if image has alpha channel with non-opaque pixels
            let hasAlpha = false;
            for (let i = 3; i < imageData.data.length; i += 4) {
                if (imageData.data[i] < 255) {
                    hasAlpha = true;
                    break;
                }
            }

            resolve({
                image: imageData,
                width: img.width,
                height: img.height,
                hasAlpha
            });
        };

        img.onerror = () => {
            console.warn(`Failed to load image: ${imageSource}`);
            resolve({ image: null, width: 0, height: 0, hasAlpha: false });
        };

        img.src = imageSource;
    });
}

/**
 * Load an image from a URL or path, preserving alpha channel.
 * 
 * @param imageSource - URL or path to the image
 * @returns Promise resolving to ImageLoadResult with alpha preserved
 */
export async function loadImageWithAlpha(imageSource: string): Promise<ImageLoadResult> {
    return loadImageFromUrlOrPath(imageSource);
}

/**
 * Load and process hand image from paths.
 * 
 * @param handImageSrc - Source for hand image
 * @param handMaskSrc - Source for hand mask image
 * @returns Promise resolving to HandData or null
 */
export async function loadHandFromPaths(
    handImageSrc: string,
    handMaskSrc: string
): Promise<HandData | null> {
    const handResult = await loadImageFromUrlOrPath(handImageSrc);
    const maskResult = await loadImageFromUrlOrPath(handMaskSrc);

    if (!handResult.image || !maskResult.image) {
        return null;
    }

    // Get bounding box from mask
    const bbox = getExtremeCoordinates(maskResult.image);
    const [x1, y1] = bbox.topLeft;
    const [x2, y2] = bbox.bottomRight;
    const croppedWidth = x2 - x1 + 1;
    const croppedHeight = y2 - y1 + 1;

    // Create cropped hand and mask
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.id = generateCanvasId('image-hand-cropped');
    croppedCanvas.width = croppedWidth;
    croppedCanvas.height = croppedHeight;
    const croppedCtx = croppedCanvas.getContext('2d', { alpha: true });

    if (!croppedCtx) return null;

    // Create cropped hand image
    const handCanvas = document.createElement('canvas');
    handCanvas.id = generateCanvasId('image-hand');
    handCanvas.width = handResult.width;
    handCanvas.height = handResult.height;
    const handCtx = handCanvas.getContext('2d');
    if (!handCtx) return null;

    handCtx.putImageData(handResult.image, 0, 0);
    croppedCtx.drawImage(handCanvas, x1, y1, croppedWidth, croppedHeight, 0, 0, croppedWidth, croppedHeight);
    const croppedHand = croppedCtx.getImageData(0, 0, croppedWidth, croppedHeight);

    // Create cropped mask
    const maskCanvas = document.createElement('canvas');
    maskCanvas.id = generateCanvasId('image-mask');
    maskCanvas.width = maskResult.width;
    maskCanvas.height = maskResult.height;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return null;

    maskCtx.putImageData(maskResult.image, 0, 0);
    croppedCtx.clearRect(0, 0, croppedWidth, croppedHeight);
    croppedCtx.drawImage(maskCanvas, x1, y1, croppedWidth, croppedHeight, 0, 0, croppedWidth, croppedHeight);
    const croppedMask = croppedCtx.getImageData(0, 0, croppedWidth, croppedHeight);

    // Create inverted mask
    const maskInvData = new ImageData(croppedWidth, croppedHeight);
    for (let i = 0; i < croppedMask.data.length; i += 4) {
        maskInvData.data[i] = 255 - croppedMask.data[i];
        maskInvData.data[i + 1] = 255 - croppedMask.data[i + 1];
        maskInvData.data[i + 2] = 255 - croppedMask.data[i + 2];
        maskInvData.data[i + 3] = 255;
    }

    // Apply mask to hand (set background to black)
    for (let i = 0; i < croppedHand.data.length; i += 4) {
        const maskVal = croppedMask.data[i] / 255;
        croppedHand.data[i] = Math.round(croppedHand.data[i] * maskVal);
        croppedHand.data[i + 1] = Math.round(croppedHand.data[i + 1] * maskVal);
        croppedHand.data[i + 2] = Math.round(croppedHand.data[i + 2] * maskVal);
        croppedHand.data[i + 3] = 255;
    }

    return {
        image: croppedHand,
        mask: croppedMask,
        maskInv: maskInvData,
        width: croppedWidth,
        height: croppedHeight
    };
}

/**
 * Draw hand overlay on a canvas at specified position.
 * 
 * @param ctx - Canvas 2D rendering context
 * @param handData - Hand image data
 * @param x - X position for hand placement
 * @param y - Y position for hand placement
 * @param canvasWidth - Canvas width
 * @param canvasHeight - Canvas height
 */
export function drawHandOnCanvas(
    ctx: CanvasRenderingContext2D,
    handData: HandData,
    x: number,
    y: number,
    canvasWidth: number,
    canvasHeight: number
): void {
    const { image, maskInv, width: handWd, height: handHt } = handData;

    // Calculate visible region
    const remainingHt = canvasHeight - y;
    const remainingWd = canvasWidth - x;
    const cropHandHt = Math.min(handHt, remainingHt);
    const cropHandWd = Math.min(handWd, remainingWd);

    if (cropHandHt <= 0 || cropHandWd <= 0) return;

    // Get current canvas content
    const currentData = ctx.getImageData(x, y, cropHandWd, cropHandHt);

    // Blend hand onto canvas using mask
    for (let row = 0; row < cropHandHt; row++) {
        for (let col = 0; col < cropHandWd; col++) {
            const srcIdx = (row * handWd + col) * 4;
            const dstIdx = (row * cropHandWd + col) * 4;

            const maskVal = maskInv.data[srcIdx] / 255;

            // Blend: dst * maskInv + hand
            currentData.data[dstIdx] = Math.round(
                currentData.data[dstIdx] * maskVal + image.data[srcIdx]
            );
            currentData.data[dstIdx + 1] = Math.round(
                currentData.data[dstIdx + 1] * maskVal + image.data[srcIdx + 1]
            );
            currentData.data[dstIdx + 2] = Math.round(
                currentData.data[dstIdx + 2] * maskVal + image.data[srcIdx + 2]
            );
        }
    }

    ctx.putImageData(currentData, x, y);
}

/**
 * ColoringAnimation - Utility class for progressive image reveal animations.
 * 
 * Implements various coloring patterns (diagonal, horizontal, vertical, draw)
 * for whiteboard-style animations.
 */
export class ColoringAnimation {
    static readonly PATTERN_DIAGONAL: ColoringPattern = 'diagonal';
    static readonly PATTERN_HORIZONTAL: ColoringPattern = 'horizontal';
    static readonly PATTERN_VERTICAL: ColoringPattern = 'vertical';
    static readonly PATTERN_DRAW: ColoringPattern = 'draw';

    /**
     * Organize pixels into bands based on coloring pattern.
     * 
     * @param height - Image height
     * @param width - Image width
     * @param pattern - Coloring pattern ('diagonal', 'horizontal', 'vertical', 'draw')
     * @param splitLen - Grid cell size for 'draw' pattern (default: 10)
     * @returns List of bands, each containing pixel coordinates [row, col]
     */
    static organizePixelsByPattern(
        height: number,
        width: number,
        pattern: ColoringPattern = 'diagonal',
        splitLen: number = 10
    ): Point[][] {
        const allPixels: Point[] = [];
        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                allPixels.push([row, col]);
            }
        }

        let bands: Point[][] = [];

        if (pattern === 'horizontal') {
            // Group by row, process left to right
            bands = Array.from({ length: height }, () => []);
            for (const [row, col] of allPixels) {
                bands[row].push([row, col]);
            }
            // Sort each row left to right
            for (const band of bands) {
                band.sort((a, b) => a[1] - b[1]);
            }
        } else if (pattern === 'vertical') {
            // Group by column, process top to bottom
            bands = Array.from({ length: width }, () => []);
            for (const [row, col] of allPixels) {
                bands[col].push([row, col]);
            }
            // Sort each column top to bottom
            for (const band of bands) {
                band.sort((a, b) => a[0] - b[0]);
            }
        } else if (pattern === 'draw') {
            // Draw mode: grid-based approach like sketch.py
            // Organize pixels into grid cells and process using nearest-neighbor selection
            bands = this.organizePixelsForDrawMode(height, width, allPixels, splitLen);
        } else {
            // Diagonal zigzag pattern (default)
            const diagonalBands = new Map<number, Point[]>();
            for (const [row, col] of allPixels) {
                const diagIdx = row + col;
                if (!diagonalBands.has(diagIdx)) {
                    diagonalBands.set(diagIdx, []);
                }
                diagonalBands.get(diagIdx)!.push([row, col]);
            }

            const sortedDiags = Array.from(diagonalBands.keys()).sort((a, b) => a - b);
            for (let i = 0; i < sortedDiags.length; i++) {
                const diagIdx = sortedDiags[i];
                const pixels = diagonalBands.get(diagIdx)!;
                // Zigzag: alternate sort direction
                if (i % 2 === 0) {
                    pixels.sort((a, b) => a[0] - b[0]);
                } else {
                    pixels.sort((a, b) => b[0] - a[0]);
                }
                bands.push(pixels);
            }
        }

        return bands;
    }

    /**
     * Organize pixels for draw mode using grid-based nearest-neighbor approach.
     * 
     * This mimics the drawing behavior from sketch.py where the image is divided
     * into grids and drawn progressively by selecting the nearest grid cell.
     * 
     * @param height - Image height
     * @param width - Image width
     * @param allPixels - List of all pixel coordinates [row, col]
     * @param splitLen - Grid cell size
     * @returns List of bands organized by nearest-neighbor grid traversal
     */
    private static organizePixelsForDrawMode(
        _height: number,
        _width: number,
        allPixels: Point[],
        splitLen: number = 10
    ): Point[][] {
        // Group pixels by grid cell
        const gridCells = new Map<string, Point[]>();
        for (const [row, col] of allPixels) {
            const gridRow = Math.floor(row / splitLen);
            const gridCol = Math.floor(col / splitLen);
            const cellKey = `${gridRow},${gridCol}`;
            if (!gridCells.has(cellKey)) {
                gridCells.set(cellKey, []);
            }
            gridCells.get(cellKey)!.push([row, col]);
        }

        // Get all non-empty grid cell indices
        const cellIndices: [number, number][] = [];
        for (const key of gridCells.keys()) {
            const [r, c] = key.split(',').map(Number);
            cellIndices.push([r, c]);
        }

        if (cellIndices.length === 0) {
            return [];
        }

        // Order cells using nearest-neighbor (Euclidean distance) like sketch.py
        // Start from top-left corner (0, 0) for more natural drawing pattern
        const orderedCells: [number, number][] = [];

        // Find the cell closest to top-left (0, 0) to start
        let startCell = cellIndices[0];
        let minStartDist = startCell[0] + startCell[1];
        for (const cell of cellIndices) {
            const dist = cell[0] + cell[1];
            if (dist < minStartDist) {
                minStartDist = dist;
                startCell = cell;
            }
        }
        let currentCell = startCell;
        const remainingCells = new Set(cellIndices.map(c => `${c[0]},${c[1]}`));

        while (remainingCells.size > 0) {
            const currentKey = `${currentCell[0]},${currentCell[1]}`;
            orderedCells.push([...currentCell]);
            remainingCells.delete(currentKey);

            if (remainingCells.size === 0) {
                break;
            }

            // Find nearest remaining cell using Euclidean distance
            let minDist = Infinity;
            let nearestCell: [number, number] = currentCell; // Default to current, will be overwritten

            for (const key of remainingCells) {
                const [r, c] = key.split(',').map(Number);
                const dist = Math.sqrt(
                    Math.pow(r - currentCell[0], 2) +
                    Math.pow(c - currentCell[1], 2)
                );
                if (dist < minDist) {
                    minDist = dist;
                    nearestCell = [r, c];
                }
            }

            currentCell = nearestCell;
        }

        // Create bands from ordered cells
        const bands: Point[][] = [];
        for (const [gridRow, gridCol] of orderedCells) {
            const cellKey = `${gridRow},${gridCol}`;
            const cellPixels = gridCells.get(cellKey);
            if (cellPixels) {
                // Sort pixels within cell for consistent ordering (top-left to bottom-right)
                cellPixels.sort((a, b) => {
                    if (a[0] !== b[0]) return a[0] - b[0];
                    return a[1] - b[1];
                });
                bands.push(cellPixels);
            }
        }

        return bands;
    }

    /**
     * Organize pixels for contour-based draw mode.
     * 
     * Uses edge detection to extract contours from the image and orders pixels
     * to follow these contours smoothly, similar to SVG path drawing.
     * This creates a much smoother reveal effect than grid-based drawing.
     * 
     * @param imageData - Source image data (RGBA format)
     * @param width - Image width
     * @param height - Image height
     * @param smoothFactor - Smoothing factor for contour sampling (default: 3)
     * @returns List of bands organized by contour following, then distance-based fill
     */
    static organizePixelsForContourDraw(
        imageData: Uint8ClampedArray,
        width: number,
        height: number,
        smoothFactor: number = 3
    ): Point[][] {
        // Convert to grayscale for edge detection
        const gray = new Float32Array(width * height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                // Standard grayscale conversion
                gray[y * width + x] = 0.299 * imageData[idx] + 0.587 * imageData[idx + 1] + 0.114 * imageData[idx + 2];
            }
        }

        // Apply Sobel edge detection
        const edges = new Uint8Array(width * height);
        const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
        const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let gx = 0;
                let gy = 0;

                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const pixel = gray[(y + ky) * width + (x + kx)];
                        gx += pixel * sobelX[ky + 1][kx + 1];
                        gy += pixel * sobelY[ky + 1][kx + 1];
                    }
                }

                const magnitude = Math.sqrt(gx * gx + gy * gy);
                edges[y * width + x] = magnitude > 50 ? 255 : 0;
            }
        }

        // Dilate edges slightly for smoother reveal
        const dilatedEdges = new Uint8Array(width * height);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let maxVal = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        maxVal = Math.max(maxVal, edges[(y + dy) * width + (x + dx)]);
                    }
                }
                dilatedEdges[y * width + x] = maxVal;
            }
        }

        // Calculate distance from each pixel to nearest edge
        const distanceFromEdge = new Float32Array(width * height);
        const maxDist = Math.sqrt(width * width + height * height);
        distanceFromEdge.fill(maxDist);

        // First pass: set edge pixels to 0
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (dilatedEdges[y * width + x] > 0) {
                    distanceFromEdge[y * width + x] = 0;
                }
            }
        }

        // Simple distance approximation (Manhattan-like propagation)
        // Forward pass
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (y > 0) {
                    distanceFromEdge[idx] = Math.min(distanceFromEdge[idx], distanceFromEdge[(y - 1) * width + x] + 1);
                }
                if (x > 0) {
                    distanceFromEdge[idx] = Math.min(distanceFromEdge[idx], distanceFromEdge[y * width + (x - 1)] + 1);
                }
            }
        }

        // Backward pass
        for (let y = height - 1; y >= 0; y--) {
            for (let x = width - 1; x >= 0; x--) {
                const idx = y * width + x;
                if (y < height - 1) {
                    distanceFromEdge[idx] = Math.min(distanceFromEdge[idx], distanceFromEdge[(y + 1) * width + x] + 1);
                }
                if (x < width - 1) {
                    distanceFromEdge[idx] = Math.min(distanceFromEdge[idx], distanceFromEdge[y * width + (x + 1)] + 1);
                }
            }
        }

        const bands: Point[][] = [];
        const visited = new Uint8Array(width * height);

        // Phase 1: Collect edge pixels and organize them by connected components
        const edgePixels: Point[] = [];
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (dilatedEdges[y * width + x] > 0) {
                    edgePixels.push([y, x]);
                }
            }
        }

        // Order edge pixels using nearest-neighbor for smooth contour following
        if (edgePixels.length > 0) {
            const orderedEdgePixels: Point[] = [];
            const remaining = new Set(edgePixels.map(p => `${p[0]},${p[1]}`));

            // Start from top-left edge pixel
            let current = edgePixels.reduce((min, p) =>
                (p[0] + p[1] < min[0] + min[1]) ? p : min, edgePixels[0]);

            while (remaining.size > 0) {
                orderedEdgePixels.push(current);
                const key = `${current[0]},${current[1]}`;
                remaining.delete(key);
                visited[current[0] * width + current[1]] = 1;

                if (remaining.size === 0) break;

                // Find nearest unvisited edge pixel
                let minDist = Infinity;
                let nearest: Point = current;

                // First check immediate neighbors (8-connected)
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dy === 0 && dx === 0) continue;
                        const ny = current[0] + dy;
                        const nx = current[1] + dx;
                        if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                            const nkey = `${ny},${nx}`;
                            if (remaining.has(nkey)) {
                                nearest = [ny, nx];
                                minDist = 1;
                                break;
                            }
                        }
                    }
                    if (minDist === 1) break;
                }

                // If no immediate neighbor, find closest one
                if (minDist > 1) {
                    for (const key of remaining) {
                        const [r, c] = key.split(',').map(Number);
                        const dist = Math.abs(r - current[0]) + Math.abs(c - current[1]);
                        if (dist < minDist) {
                            minDist = dist;
                            nearest = [r, c];
                        }
                    }
                }

                current = nearest;
            }

            // Group edge pixels into bands with their neighbors
            // Use smoothFactor directly for clearer code
            const step = Math.max(1, smoothFactor);
            let currentBand: Point[] = [];

            for (let i = 0; i < orderedEdgePixels.length; i++) {
                const [y, x] = orderedEdgePixels[i];
                // Add pixel and its immediate neighbors
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const ny = y + dy;
                        const nx = x + dx;
                        if (ny >= 0 && ny < height && nx >= 0 && nx < width && !visited[ny * width + nx]) {
                            currentBand.push([ny, nx]);
                            visited[ny * width + nx] = 1;
                        }
                    }
                }

                if (currentBand.length >= step * 9 || i === orderedEdgePixels.length - 1) {
                    if (currentBand.length > 0) {
                        bands.push([...currentBand]);
                        currentBand = [];
                    }
                }
            }
        }

        // Phase 2: Fill remaining pixels ordered by distance from edges
        // Find max distance by iterating once (more efficient than Array.from for large images)
        let maxActualDistance = 0;
        for (let i = 0; i < distanceFromEdge.length; i++) {
            const d = distanceFromEdge[i];
            if (d < maxDist && d > maxActualDistance) {
                maxActualDistance = d;
            }
        }
        if (maxActualDistance > 0) {
            const numDistanceBands = Math.min(50, Math.ceil(maxActualDistance) + 1);
            const distanceBands: Point[][] = Array.from({ length: numDistanceBands }, () => []);

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    if (!visited[y * width + x]) {
                        const dist = distanceFromEdge[y * width + x];
                        const bandIdx = Math.min(numDistanceBands - 1, Math.floor(dist * numDistanceBands / (maxActualDistance + 1)));
                        distanceBands[bandIdx].push([y, x]);
                    }
                }
            }

            // Add distance bands (closer to edges first)
            for (const band of distanceBands) {
                if (band.length > 0) {
                    // Sort within each band for consistent ordering
                    band.sort((a, b) => {
                        if (a[0] !== b[0]) return a[0] - b[0];
                        return a[1] - b[1];
                    });
                    bands.push(band);
                }
            }
        }

        // If no edges found (solid color image), fall back to diagonal
        if (bands.length === 0) {
            const diagonalBands = new Map<number, Point[]>();
            for (let row = 0; row < height; row++) {
                for (let col = 0; col < width; col++) {
                    const diagIdx = row + col;
                    if (!diagonalBands.has(diagIdx)) {
                        diagonalBands.set(diagIdx, []);
                    }
                    diagonalBands.get(diagIdx)!.push([row, col]);
                }
            }

            const sortedDiags = Array.from(diagonalBands.keys()).sort((a, b) => a - b);
            for (let i = 0; i < sortedDiags.length; i++) {
                const diagIdx = sortedDiags[i];
                const pixels = diagonalBands.get(diagIdx)!;
                if (i % 2 === 0) {
                    pixels.sort((a, b) => a[0] - b[0]);
                } else {
                    pixels.sort((a, b) => b[0] - a[0]);
                }
                bands.push(pixels);
            }
        }

        return bands;
    }

    /**
     * Generate pixel reveal order based on pattern.
     * 
     * @param height - Image height
     * @param width - Image width
     * @param pattern - Coloring pattern
     * @param splitLen - Grid cell size for 'draw' pattern (default: 10)
     * @returns Flat list of pixels in reveal order
     */
    static getPixelRevealOrder(
        height: number,
        width: number,
        pattern: ColoringPattern = 'diagonal',
        splitLen: number = 10
    ): Point[] {
        const bands = this.organizePixelsByPattern(height, width, pattern, splitLen);
        const orderedPixels: Point[] = [];
        for (const band of bands) {
            orderedPixels.push(...band);
        }
        return orderedPixels;
    }

    /**
     * Generate pixel reveal order based on pattern with image data for contour-based draw mode.
     * 
     * @param imageData - Image data for contour extraction (only used with 'draw' pattern)
     * @param width - Image width
     * @param height - Image height
     * @param pattern - Coloring pattern
     * @param splitLen - Smooth factor for 'draw' pattern (default: 3)
     * @returns Flat list of pixels in reveal order
     */
    static getPixelRevealOrderWithImage(
        imageData: Uint8ClampedArray,
        width: number,
        height: number,
        pattern: ColoringPattern = 'diagonal',
        splitLen: number = 3
    ): Point[] {
        let bands: Point[][];

        if (pattern === 'draw') {
            bands = this.organizePixelsForContourDraw(imageData, width, height, splitLen);
        } else {
            bands = this.organizePixelsByPattern(height, width, pattern, splitLen);
        }

        const orderedPixels: Point[] = [];
        for (const band of bands) {
            orderedPixels.push(...band);
        }
        return orderedPixels;
    }
}

/**
 * ImageDrawer - Canvas-based image drawing with animation support.
 * 
 * Provides methods to draw images on canvas with various animation effects
 * including whiteboard-style reveal and coloring patterns.
 */
export class ImageDrawer {
    readonly width: number;
    readonly height: number;
    readonly background: RGBA;

    private _canvas: HTMLCanvasElement;
    private _ctx: CanvasRenderingContext2D;
    private _frames: ImageData[];

    constructor(
        width: number = 512,
        height: number = 512,
        background: RGBA = [255, 255, 255, 255]
    ) {
        this.width = width;
        this.height = height;
        this.background = background;

        this._canvas = document.createElement('canvas');
        this._canvas.id = generateCanvasId('image-animator');
        this._canvas.width = width;
        this._canvas.height = height;

        const ctx = this._canvas.getContext('2d', { alpha: true });
        if (!ctx) {
            throw new Error('Failed to get 2D context');
        }
        this._ctx = ctx;

        this._frames = [];
        this.clear();
    }

    /**
     * Clear the canvas to background color.
     */
    clear(): void {
        const [r, g, b, a] = this.background;
        this._ctx.clearRect(0, 0, this.width, this.height);
        if (a > 0) {
            this._ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
            this._ctx.fillRect(0, 0, this.width, this.height);
        }
        this._frames = [];
    }

    /**
     * Load an image from URL or data URL.
     */
    async loadImage(src: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
            img.src = src;
        });
    }

    /**
     * Draw an image onto the canvas at specified position.
     */
    drawImage(
        image: HTMLImageElement | HTMLCanvasElement,
        x: number = 0,
        y: number = 0,
        width?: number,
        height?: number,
        opacity: number = 1.0
    ): void {
        const drawWidth = width ?? image.width;
        const drawHeight = height ?? image.height;

        this._ctx.save();
        this._ctx.globalAlpha = opacity;
        this._ctx.drawImage(image, x, y, drawWidth, drawHeight);
        this._ctx.restore();
    }

    /**
     * Draw an image with progressive coloring animation.
     * 
     * @param image - Image to draw
     * @param options - Animation options
     * @returns Array of animation frames as ImageData
     */
    async drawImageWithColoring(
        image: HTMLImageElement | HTMLCanvasElement,
        options: {
            pattern?: ColoringPattern;
            fps?: number;
            duration?: number;
            x?: number;
            y?: number;
            width?: number;
            height?: number;
            splitLen?: number;
        } = {}
    ): Promise<ImageData[]> {
        const {
            pattern = 'diagonal',
            fps = 30,
            duration = 3.0,
            x = 0,
            y = 0,
            width = image.width,
            height = image.height,
            splitLen = 10
        } = options;

        this._frames = [];

        // Create temporary canvas for source image
        const srcCanvas = document.createElement('canvas');
        srcCanvas.id = generateCanvasId('image-animator-src');
        srcCanvas.width = width;
        srcCanvas.height = height;
        const srcCtx = srcCanvas.getContext('2d');
        if (!srcCtx) {
            throw new Error('Failed to get source context');
        }
        srcCtx.drawImage(image, 0, 0, width, height);
        const srcData = srcCtx.getImageData(0, 0, width, height);

        // Get pixel reveal order - use contour-based for 'draw' pattern
        let orderedPixels: Point[];
        if (pattern === 'draw') {
            // Use contour-based ordering with image data for smoother reveal
            orderedPixels = ColoringAnimation.getPixelRevealOrderWithImage(
                srcData.data, width, height, pattern, splitLen
            );
        } else {
            orderedPixels = ColoringAnimation.getPixelRevealOrder(height, width, pattern, splitLen);
        }
        const totalPixels = orderedPixels.length;
        const numFrames = Math.floor(fps * duration);
        const pixelsPerFrame = Math.max(1, Math.floor(totalPixels / numFrames));

        // Create reveal mask
        const mask = new Uint8Array(width * height);
        let lastPixelIdx = 0; // Track last revealed pixel for O(n) complexity

        for (let frameIdx = 0; frameIdx <= numFrames; frameIdx++) {
            const pixelsToReveal = Math.min(frameIdx * pixelsPerFrame, totalPixels);

            // Update mask - only process new pixels since last frame
            for (let i = lastPixelIdx; i < Math.min(pixelsToReveal, orderedPixels.length); i++) {
                const [row, col] = orderedPixels[i];
                mask[row * width + col] = 255;
            }
            lastPixelIdx = Math.min(pixelsToReveal, orderedPixels.length);

            // Create frame
            this.clear();
            const frameData = this._ctx.getImageData(0, 0, this.width, this.height);

            // Apply masked image
            for (let row = 0; row < height; row++) {
                for (let col = 0; col < width; col++) {
                    const canvasX = x + col;
                    const canvasY = y + row;

                    if (canvasX >= 0 && canvasX < this.width &&
                        canvasY >= 0 && canvasY < this.height) {
                        const maskVal = mask[row * width + col] / 255;
                        const srcIdx = (row * width + col) * 4;
                        const dstIdx = (canvasY * this.width + canvasX) * 4;

                        if (maskVal > 0) {
                            const invMask = 1 - maskVal;
                            frameData.data[dstIdx] = Math.round(
                                maskVal * srcData.data[srcIdx] + invMask * frameData.data[dstIdx]
                            );
                            frameData.data[dstIdx + 1] = Math.round(
                                maskVal * srcData.data[srcIdx + 1] + invMask * frameData.data[dstIdx + 1]
                            );
                            frameData.data[dstIdx + 2] = Math.round(
                                maskVal * srcData.data[srcIdx + 2] + invMask * frameData.data[dstIdx + 2]
                            );
                            frameData.data[dstIdx + 3] = Math.max(
                                frameData.data[dstIdx + 3],
                                srcData.data[srcIdx + 3]
                            );
                        }
                    }
                }
            }

            this._frames.push(frameData);
        }

        return this._frames;
    }

    /**
     * Get stored animation frames.
     */
    getFrames(): ImageData[] {
        return [...this._frames];
    }

    /**
     * Get current canvas as ImageData.
     */
    getImageData(): ImageData {
        return this._ctx.getImageData(0, 0, this.width, this.height);
    }

    /**
     * Get the underlying canvas element.
     */
    getCanvas(): HTMLCanvasElement {
        return this._canvas;
    }

    /**
     * Get canvas as data URL.
     */
    toDataURL(type: string = 'image/png', quality?: number): string {
        return this._canvas.toDataURL(type, quality);
    }

    /**
     * Download the canvas as an image file.
     */
    async download(filename: string = 'image.png'): Promise<void> {
        const blob = await new Promise<Blob | null>((resolve) => {
            this._canvas.toBlob(resolve);
        });

        if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            URL.revokeObjectURL(url);
        }
    }
}

/**
 * Calculate split lengths for an image.
 * 
 * Finds compatible split lengths based on image dimensions
 * after adjusting to nearest standard resolution.
 * 
 * @param width - Image width
 * @param height - Image height
 * @returns Split lengths result with compatible values
 */
export function getSplitLens(width: number, height: number): SplitLensResult {
    const aspectRatio = width / height;
    const adjustedHeight = findNearestRes(height);
    const newAspectWidth = Math.round(adjustedHeight * aspectRatio);
    const adjustedWidth = findNearestRes(newAspectWidth);

    const splitLens = commonDivisors(adjustedHeight, adjustedWidth);

    return {
        image_res: `${adjustedWidth} x ${adjustedHeight}`,
        split_lens: splitLens
    };
}

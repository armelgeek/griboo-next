/**
 * Region Detection Worker
 * 
 * Performs heavy image processing tasks in a background thread:
 * - Flood-fill based color region detection
 * - Uses bulk memory access for optimal performance
 * 
 * This worker receives raw pixel data (Uint8ClampedArray) and returns
 * detected regions without blocking the main UI thread.
 */

// ============================================================================
// Type Definitions (duplicated to avoid import issues in worker)
// ============================================================================

interface PixelPoint {
    x: number;
    y: number;
}

interface ColorRegion {
    color: [number, number, number];
    pixels: PixelPoint[];
    centroid: PixelPoint;
    size: number;
}

interface DetectRegionsInput {
    type: 'detectRegions';
    imageData: Uint8ClampedArray;
    width: number;
    height: number;
    channels: number;
    colorTolerance: number;
    minRegionSize: number;
    pixelScale: number;
}

interface DetectRegionsOutput {
    type: 'result';
    regions: ColorRegion[];
    processingTimeMs: number;
}

type WorkerInput = DetectRegionsInput;
type WorkerOutput = DetectRegionsOutput | { type: 'error'; message: string };

// ============================================================================
// Color Utilities
// ============================================================================

const LUMA_R = 0.299;
const LUMA_G = 0.587;
const LUMA_B = 0.114;

function calculateDeltaE(c1: [number, number, number], c2: [number, number, number]): number {
    const dr = c1[0] - c2[0];
    const dg = c1[1] - c2[1];
    const db = c1[2] - c2[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
}

function calculateGrayscale(color: [number, number, number]): number {
    // OpenCV uses BGR format, so: [0]=B, [1]=G, [2]=R
    // Grayscale = 0.299*R + 0.587*G + 0.114*B
    return LUMA_R * color[2] + LUMA_G * color[1] + LUMA_B * color[0];
}

// ============================================================================
// Region Detection (Bulk Memory Access)
// ============================================================================

function detectRegions(input: DetectRegionsInput): ColorRegion[] {
    const { imageData, width, height, channels, colorTolerance, minRegionSize, pixelScale } = input;

    const visited = new Uint8Array(width * height);
    const regions: ColorRegion[] = [];

    // Python constants for thresholds
    const NON_WHITE_THRESHOLD = 250;
    const WHITE_LIKE_THRESHOLD = 240;

    // Scale minRegionSize by area (pixelScale^2)
    const scaledMinRegionSize = Math.round(minRegionSize * pixelScale * pixelScale);

    // Maximum pixels per region to prevent memory issues
    const MAX_REGION_SIZE = 1_000_000;

    const floodFill = (startX: number, startY: number, startColor: [number, number, number]): ColorRegion | null => {
        const pixels: PixelPoint[] = [];
        const stack: PixelPoint[] = [{ x: startX, y: startY }];

        while (stack.length > 0) {
            // Check region size limit
            if (pixels.length >= MAX_REGION_SIZE) {
                break;
            }

            const { x, y } = stack.pop()!;
            if (x < 0 || x >= width || y < 0 || y >= height) continue;

            const pixIdx = y * width + x;
            if (visited[pixIdx]) continue;

            // OPTIMIZED: Direct bulk array access instead of ucharPtr()
            const offset = pixIdx * channels;
            const pixColor: [number, number, number] = [
                imageData[offset],
                imageData[offset + 1],
                imageData[offset + 2]
            ];

            const colorMatches = colorTolerance === 0
                ? pixColor[0] === startColor[0] && pixColor[1] === startColor[1] && pixColor[2] === startColor[2]
                : calculateDeltaE(startColor, pixColor) <= colorTolerance;

            if (!colorMatches) continue;

            visited[pixIdx] = 1;
            pixels.push({ x, y });

            // 4-connectivity (matching Python)
            stack.push({ x: x + 1, y });
            stack.push({ x: x - 1, y });
            stack.push({ x, y: y + 1 });
            stack.push({ x, y: y - 1 });
        }

        // Filter by scaled minimum size
        if (pixels.length < scaledMinRegionSize) return null;

        // Calculate centroid
        let sumX = 0, sumY = 0;
        for (const p of pixels) {
            sumX += p.x;
            sumY += p.y;
        }

        return {
            color: startColor,
            pixels,
            centroid: { x: sumX / pixels.length, y: sumY / pixels.length },
            size: pixels.length
        };
    };

    for (let startY = 0; startY < height; startY++) {
        for (let startX = 0; startX < width; startX++) {
            const idx = startY * width + startX;
            if (visited[idx]) continue;

            // OPTIMIZED: Direct bulk array access
            const offset = idx * channels;
            const startColor: [number, number, number] = [
                imageData[offset],
                imageData[offset + 1],
                imageData[offset + 2]
            ];

            // Calculate grayscale to filter out white pixels
            const gray = calculateGrayscale(startColor);

            // Skip white pixels
            if (gray >= NON_WHITE_THRESHOLD) continue;

            const region = floodFill(startX, startY, startColor);
            if (region && region.pixels.length >= scaledMinRegionSize) {
                // Filter out white-like regions
                const regionGray = calculateGrayscale(region.color);
                if (regionGray <= WHITE_LIKE_THRESHOLD) {
                    regions.push(region);
                }
            }
        }
    }

    return regions;
}

// ============================================================================
// Worker Message Handler
// ============================================================================

self.onmessage = (event: MessageEvent<WorkerInput>) => {
    const startTime = performance.now();

    try {
        const input = event.data;

        if (input.type === 'detectRegions') {
            const regions = detectRegions(input);
            const endTime = performance.now();

            const output: DetectRegionsOutput = {
                type: 'result',
                regions,
                processingTimeMs: endTime - startTime
            };

            self.postMessage(output);
        }
    } catch (error) {
        const output: WorkerOutput = {
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error in worker'
        };
        self.postMessage(output);
    }
};

// Signal that worker is ready
self.postMessage({ type: 'ready' });

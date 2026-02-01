/**
 * Image Processing Utilities
 * 
 * Native JavaScript implementations of image processing algorithms
 * to replace OpenCV.js dependencies.
 */

export interface PixelPoint {
    x: number;
    y: number;
}

/**
 * Convert RGBA ImageData to Grayscale (Uint8Array)
 */
export function grayscale(imageData: ImageData): Uint8Array {
    const { data, width, height } = imageData;
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
        // Standard luma coefficients: 0.299R + 0.587G + 0.114B
        gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return gray;
}

/**
 * Apply Gaussian Blur to a grayscale image
 */
export function gaussianBlur(data: Uint8Array, width: number, height: number, radius: number = 1): Uint8Array {
    const output = new Uint8Array(data.length);
    const kernel = createGaussianKernel(radius);
    const kSize = kernel.length;
    const kOffset = Math.floor(kSize / 2);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0;
            for (let ky = 0; ky < kSize; ky++) {
                for (let kx = 0; kx < kSize; kx++) {
                    const iy = Math.min(height - 1, Math.max(0, y + ky - kOffset));
                    const ix = Math.min(width - 1, Math.max(0, x + kx - kOffset));
                    sum += data[iy * width + ix] * kernel[ky][kx];
                }
            }
            output[y * width + x] = sum;
        }
    }
    return output;
}

function createGaussianKernel(radius: number): number[][] {
    const size = radius * 2 + 1;
    const kernel: number[][] = [];
    const sigma = radius / 2;
    let sum = 0;

    for (let y = 0; y < size; y++) {
        kernel[y] = [];
        for (let x = 0; x < size; x++) {
            const dx = x - radius;
            const dy = y - radius;
            const val = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma)) / (2 * Math.PI * sigma * sigma);
            kernel[y][x] = val;
            sum += val;
        }
    }

    // Normalize
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            kernel[y][x] /= sum;
        }
    }
    return kernel;
}

/**
 * Adaptive Thresholding (Mean)
 */
export function adaptiveThreshold(data: Uint8Array, width: number, height: number, blockSize: number = 15, C: number = 2): Uint8Array {
    const output = new Uint8Array(data.length);
    const offset = Math.floor(blockSize / 2);

    // Use integral image for O(1) mean calculation
    const integral = new Uint32Array((width + 1) * (height + 1));
    for (let y = 0; y < height; y++) {
        let rowSum = 0;
        for (let x = 0; x < width; x++) {
            rowSum += data[y * width + x];
            integral[(y + 1) * (width + 1) + (x + 1)] = integral[y * (width + 1) + (x + 1)] + rowSum;
        }
    }

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const x1 = Math.max(0, x - offset);
            const y1 = Math.max(0, y - offset);
            const x2 = Math.min(width - 1, x + offset);
            const y2 = Math.min(height - 1, y + offset);

            const count = (x2 - x1 + 1) * (y2 - y1 + 1);
            const sum = integral[(y2 + 1) * (width + 1) + (x2 + 1)]
                - integral[y1 * (width + 1) + (x2 + 1)]
                - integral[(y2 + 1) * (width + 1) + x1]
                + integral[y1 * (width + 1) + x1];

            const mean = sum / count;
            // If pixel is darker than mean-C, it's a stroke (set to 255 = white in binary)
            // If pixel is lighter than mean-C, it's background (set to 0 = black in binary)
            output[y * width + x] = data[y * width + x] < (mean - C) ? 255 : 0;
        }
    }
    return output;
}

/**
 * Dilation
 */
export function dilate(data: Uint8Array, width: number, height: number, size: number = 3): Uint8Array {
    const output = new Uint8Array(data.length);
    const offset = Math.floor(size / 2);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let max = 0;
            for (let ky = -offset; ky <= offset; ky++) {
                for (let kx = -offset; kx <= offset; kx++) {
                    const iy = y + ky;
                    const ix = x + kx;
                    if (iy >= 0 && iy < height && ix >= 0 && ix < width) {
                        max = Math.max(max, data[iy * width + ix]);
                    }
                }
            }
            output[y * width + x] = max;
        }
    }
    return output;
}

/**
 * Erosion
 */
export function erode(data: Uint8Array, width: number, height: number, size: number = 3): Uint8Array {
    const output = new Uint8Array(data.length);
    const offset = Math.floor(size / 2);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let min = 255;
            for (let ky = -offset; ky <= offset; ky++) {
                for (let kx = -offset; kx <= offset; kx++) {
                    const iy = y + ky;
                    const ix = x + kx;
                    if (iy >= 0 && iy < height && ix >= 0 && ix < width) {
                        min = Math.min(min, data[iy * width + ix]);
                    }
                }
            }
            output[y * width + x] = min;
        }
    }
    return output;
}

/**
 * Morphological Closing (Dilate then Erode)
 * Used to fill small holes in strokes while maintaining stroke width
 */
export function closing(data: Uint8Array, width: number, height: number, size: number = 3): Uint8Array {
    const dilated = dilate(data, width, height, size);
    return erode(dilated, width, height, size);
}

/**
 * Zhang-Suen Thinning Algorithm
 */
export function thinning(data: Uint8Array, width: number, height: number): Uint8Array {
    let dst = new Uint8Array(data);
    let changed = true;
    const pixelsToRemove = new Int32Array(width * height);

    while (changed) {
        changed = false;

        // Step 1
        let removeCount = 0;
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                if (dst[idx] === 0) continue;

                const p2 = dst[(y - 1) * width + x] > 0 ? 1 : 0;
                const p3 = dst[(y - 1) * width + x + 1] > 0 ? 1 : 0;
                const p4 = dst[y * width + x + 1] > 0 ? 1 : 0;
                const p5 = dst[(y + 1) * width + x + 1] > 0 ? 1 : 0;
                const p6 = dst[(y + 1) * width + x] > 0 ? 1 : 0;
                const p7 = dst[(y + 1) * width + x - 1] > 0 ? 1 : 0;
                const p8 = dst[y * width + x - 1] > 0 ? 1 : 0;
                const p9 = dst[(y - 1) * width + x - 1] > 0 ? 1 : 0;

                const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
                if (B < 2 || B > 6) continue;

                const A = (p2 === 0 && p3 === 1 ? 1 : 0) +
                    (p3 === 0 && p4 === 1 ? 1 : 0) +
                    (p4 === 0 && p5 === 1 ? 1 : 0) +
                    (p5 === 0 && p6 === 1 ? 1 : 0) +
                    (p6 === 0 && p7 === 1 ? 1 : 0) +
                    (p7 === 0 && p8 === 1 ? 1 : 0) +
                    (p8 === 0 && p9 === 1 ? 1 : 0) +
                    (p9 === 0 && p2 === 1 ? 1 : 0);

                if (A === 1 && (p2 * p4 * p6 === 0) && (p4 * p6 * p8 === 0)) {
                    pixelsToRemove[removeCount++] = idx;
                    changed = true;
                }
            }
        }
        for (let i = 0; i < removeCount; i++) dst[pixelsToRemove[i]] = 0;

        // Step 2
        removeCount = 0;
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                if (dst[idx] === 0) continue;

                const p2 = dst[(y - 1) * width + x] > 0 ? 1 : 0;
                const p3 = dst[(y - 1) * width + x + 1] > 0 ? 1 : 0;
                const p4 = dst[y * width + x + 1] > 0 ? 1 : 0;
                const p5 = dst[(y + 1) * width + x + 1] > 0 ? 1 : 0;
                const p6 = dst[(y + 1) * width + x] > 0 ? 1 : 0;
                const p7 = dst[(y + 1) * width + x - 1] > 0 ? 1 : 0;
                const p8 = dst[y * width + x - 1] > 0 ? 1 : 0;
                const p9 = dst[(y - 1) * width + x - 1] > 0 ? 1 : 0;

                const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
                if (B < 2 || B > 6) continue;

                const A = (p2 === 0 && p3 === 1 ? 1 : 0) +
                    (p3 === 0 && p4 === 1 ? 1 : 0) +
                    (p4 === 0 && p5 === 1 ? 1 : 0) +
                    (p5 === 0 && p6 === 1 ? 1 : 0) +
                    (p6 === 0 && p7 === 1 ? 1 : 0) +
                    (p7 === 0 && p8 === 1 ? 1 : 0) +
                    (p8 === 0 && p9 === 1 ? 1 : 0) +
                    (p9 === 0 && p2 === 1 ? 1 : 0);

                if (A === 1 && (p2 * p4 * p8 === 0) && (p2 * p6 * p8 === 0)) {
                    pixelsToRemove[removeCount++] = idx;
                    changed = true;
                }
            }
        }
        for (let i = 0; i < removeCount; i++) dst[pixelsToRemove[i]] = 0;
    }
    return dst;
}

/**
 * Trace skeleton paths from a thinned binary image
 */
export function traceSkeleton(data: Uint8Array, width: number, height: number): PixelPoint[][] {
    const visited = new Uint8Array(data.length);
    const paths: PixelPoint[][] = [];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (data[idx] > 0 && !visited[idx]) {
                const path: PixelPoint[] = [];
                let currX = x;
                let currY = y;

                // Simple greedy neighbor follower
                while (true) {
                    const currIdx = currY * width + currX;
                    visited[currIdx] = 1;
                    path.push({ x: currX, y: currY });

                    // Look for unvisited neighbors (8-connectivity)
                    let found = false;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const nx = currX + dx;
                            const ny = currY + dy;
                            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                const nIdx = ny * width + nx;
                                if (data[nIdx] > 0 && !visited[nIdx]) {
                                    currX = nx;
                                    currY = ny;
                                    found = true;
                                    break;
                                }
                            }
                        }
                        if (found) break;
                    }
                    if (!found) break;
                }
                if (path.length > 1) paths.push(path);
            }
        }
    }
    return paths;
}

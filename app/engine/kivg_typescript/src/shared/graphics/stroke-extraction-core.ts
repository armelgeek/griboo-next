/**
 * Shared Stroke Extraction Logic
 * 
 * This module contains the core stroke extraction algorithm used by both
 * frontend and server implementations to ensure 100% identical behavior.
 */

import { Point } from '../types';
import * as ImageProc from './image-processing';
import { PixelPoint } from './image-processing';

// Re-export types for consistency
export type { PixelPoint };
export type { Point };

/**
 * Core stroke extraction algorithm - SHARED between frontend and server
 * 
 * This is the single source of truth for stroke extraction logic.
 * Both frontend (hybrid_layer_animator.ts) and server (utils.ts) use this.
 * 
 * @param gray - Grayscale image data (0-255, where 0 is black, 255 is white)
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @returns Array of stroke paths, where each path is an array of points
 */
export function extractStrokesCore(
    gray: Uint8Array,
    width: number,
    height: number
): PixelPoint[][] {
    // V5 STROKE EXTRACTION PIPELINE

    // 1. Global threshold pre-filter
    const STROKE_DARKNESS_THRESHOLD = STROKE_EXTRACTION_PARAMS.DARKNESS_THRESHOLD;
    const darkPixelsOnly = new Uint8Array(gray.length);
    for (let i = 0; i < gray.length; i++) {
        darkPixelsOnly[i] = gray[i] < STROKE_DARKNESS_THRESHOLD ? gray[i] : 255;
    }

    // 2. Adaptive Thresholding
    const binary = ImageProc.adaptiveThreshold(
        darkPixelsOnly,
        width,
        height,
        STROKE_EXTRACTION_PARAMS.ADAPTIVE_BLOCK_SIZE,
        STROKE_EXTRACTION_PARAMS.ADAPTIVE_C
    );

    // 3. Morphological opening: REDUCED AGGRESSIVENESS (size 1 instead of 2)
    // This keeps finer details and avoids merging close but separate lines
    // If size is 1, erode/dilate with 1x1 kernel does nothing if offset is 0.
    // Let's use a very small denoising or skip it if we want maximum detail.
    const denoised = ImageProc.erode(binary, width, height, 1);
    const opened = ImageProc.dilate(denoised, width, height, 1);

    // 4. Thinning to get skeleton
    const skeleton = ImageProc.thinning(opened, width, height);

    // 5. Trace skeleton to get raw paths
    const rawPaths = ImageProc.traceSkeleton(skeleton, width, height);

    // 6. V5 IMPROVEMENT: Intelligent segment linking
    // Link segments that are close and go in the same direction
    const linkedPaths = ImageProc.linkSegments(rawPaths, 15, Math.PI / 4);

    // 7. V5 IMPROVEMENT: Fluid smoothing
    // Apply smoothing to each path for a more "hand-drawn" feel
    const smoothedPaths = linkedPaths.map(path => ImageProc.smoothPath(path));

    return smoothedPaths;
}

/**
 * Parameters for stroke extraction
 * Centralized to ensure consistency across frontend and server
 */
export const STROKE_EXTRACTION_PARAMS = {
    /** Only pixels darker than this threshold are considered potential strokes */
    DARKNESS_THRESHOLD: 50,

    /** Block size for adaptive thresholding */
    ADAPTIVE_BLOCK_SIZE: 15,

    /** Constant C for adaptive thresholding */
    ADAPTIVE_C: 2,

    /** Size of morphological operations (erosion/dilation) */
    // V5: Reduced from 2 to 1 for more detail
    MORPHOLOGICAL_SIZE: 1,
} as const;

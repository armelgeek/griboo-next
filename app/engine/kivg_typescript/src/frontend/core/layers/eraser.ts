/**
 * Eraser Module for Kivg Core
 * 
 * Provides eraser effect management for layers and scenes in doodle animations.
 * 
 * Features:
 * - Layer eraser animation (reverse drawing effect - elements erase as they were drawn)
 * - Scene eraser animation (erase all layers in scene)
 * - Synchronization: erasing can match drawing duration
 * - Direction control (normal or reversed)
 * - Eraser style options (progressive, fast, by sections)
 * 
 * Usage:
 *     import { LayerEraser, generateEraserFrames } from './core/eraser';
 *     
 *     const eraser = new LayerEraser({ style: 'progressive' });
 *     const { frames, positions } = eraser.generateFrames(sourceImage, 60);
 */

import { generateCanvasId } from '../infra/utils';

/**
 * Constants for natural hand wiggle during erasing.
 */
export const DEFAULT_WIGGLE_AMPLITUDE = 20;
export const DEFAULT_WIGGLE_FREQUENCY = 4.0;

// Wiggle oscillation parameters
const WIGGLE_PRIMARY_Y_RATIO = 0.6;
const WIGGLE_SECONDARY_FREQUENCY_RATIO = 1.7;
const WIGGLE_SECONDARY_X_RATIO = 0.4;
const WIGGLE_SECONDARY_Y_RATIO = 0.3;
const WIGGLE_SECONDARY_X_PHASE = 0.5;
const WIGGLE_SECONDARY_Y_PHASE = 0.3;
const WIGGLE_TERTIARY_FREQUENCY_RATIO = 3.1;
const WIGGLE_TERTIARY_X_RATIO = 0.25;
const WIGGLE_TERTIARY_Y_RATIO = 0.2;
const WIGGLE_TERTIARY_X_PHASE = 0.8;
const WIGGLE_TERTIARY_Y_PHASE = 1.2;

/**
 * Eraser style constants.
 */
export const EraserStyle = {
    PROGRESSIVE: 'progressive',
    FAST: 'fast',
    BY_SECTIONS: 'by_sections',
    REVERSE: 'reverse',
    SIMULTANEOUS: 'simultaneous',
    DIAGONAL: 'diagonal',
    HORIZONTAL: 'horizontal',
    VERTICAL: 'vertical',
    DIAGONAL_SVG: 'diagonal_svg',
    DIAGONAL_OVERLAY: 'diagonal_overlay',
    HORIZONTAL_SVG: 'horizontal_svg',
    VERTICAL_SVG: 'vertical_svg'
} as const;

export type EraserStyleType = typeof EraserStyle[keyof typeof EraserStyle];

/**
 * Eraser direction constants.
 */
export const EraserDirection = {
    NORMAL: 'normal',
    REVERSED: 'reversed',
    INSIDE_OUT: 'inside_out',
    OUTSIDE_IN: 'outside_in'
} as const;

export type EraserDirectionType = typeof EraserDirection[keyof typeof EraserDirection];

/**
 * Point coordinate [x, y].
 */
export type Point = [number, number];

/**
 * Eraser hand data structure.
 */
export interface EraserHandData {
    image: ImageData;
    mask: ImageData;
    maskInv: Uint8Array; // Changed from Float32Array to Uint8Array for integer math
    height: number;
    width: number;
}

/**
 * Configuration for layer eraser.
 */
export interface LayerEraserConfig {
    style?: EraserStyleType;
    direction?: EraserDirectionType;
    durationRatio?: number;
    backgroundColor?: [number, number, number];
    eraserImagePath?: string;
    eraserMaskPath?: string;
    colorTolerance?: number;
}

/**
 * Result of eraser frame generation.
 */
export interface EraserFrameResult {
    frames: ImageData[];
    positions: Point[];
}

/**
 * Configuration for slide eraser.
 */
export interface SlideEraserConfig {
    enabled: boolean;
    duration: number;
    delayAfterAnimations?: number;
    pattern?: string;
    backgroundColor?: [number, number, number];
    showEraser?: boolean;
    radius?: number;
    handImage?: string;
    handOffset?: [number, number];
    handScale?: number;
}

/**
 * Load eraser image from URL.
 */


/**
 * Load and prepare eraser hand image and mask using Web Worker.
 */
export async function loadEraserHand(
    eraserPath: string,
    maskPath?: string
): Promise<EraserHandData | null> {
    return new Promise((resolve) => {
        const worker = new Worker(
            // @ts-ignore
            new URL('../../workers/eraser.worker.ts', import.meta.url),
            { type: 'module' }
        );

        worker.onmessage = (e) => {
            const { type, data, message } = e.data;

            if (type === 'success') {
                // Reconstruct ImageData
                const image = new ImageData(
                    new Uint8ClampedArray(data.imageBuffer),
                    data.width,
                    data.height
                );

                const mask = new ImageData(
                    new Uint8ClampedArray(data.maskBuffer),
                    data.width,
                    data.height
                );

                const maskInv = new Uint8Array(data.maskInvBuffer);

                resolve({
                    image,
                    mask,
                    maskInv,
                    width: data.width,
                    height: data.height
                });
            } else {
                console.error('Eraser worker error:', message);
                resolve(null);
            }
            worker.terminate();
        };

        worker.onerror = (e) => {
            console.error('Eraser worker error:', e.message);
            resolve(null);
            worker.terminate();
        };

        worker.postMessage({
            type: 'loadEraser',
            eraserPath,
            maskPath
        });
    });
}

/**
 * Create mask from alpha channel.
 * Optimized using Uint32Array for bulk pixel processing.
 * Kept for fallback or other uses.
 */
export function createMaskFromAlpha(imageData: ImageData): ImageData {
    const mask = new ImageData(imageData.width, imageData.height);
    const src32 = new Uint32Array(imageData.data.buffer);
    const dst32 = new Uint32Array(mask.data.buffer);
    const len = src32.length;

    for (let i = 0; i < len; i++) {
        // Little-endian: ABGR
        // alpha is bits 24-31
        const alpha = src32[i] >>> 24;

        // We want grayscale alpha: R=alpha, G=alpha, B=alpha, A=255
        // Memory: alpha, alpha, alpha, 255
        // LE u32: 255(24-31) alpha(16-23) alpha(8-15) alpha(0-7)
        dst32[i] = (255 << 24) | (alpha << 16) | (alpha << 8) | alpha;
    }
    return mask;
}

/**
 * Draw eraser hand on canvas at specified position.
 */
/**
 * Draw eraser hand on canvas at specified position.
 * Optimized for performance using integer math and direct array access.
 */
export function drawEraserOnCanvas(
    ctx: CanvasRenderingContext2D,
    eraserData: EraserHandData,
    x: number,
    y: number
): void {
    const { image, maskInv, width: eraserWd, height: eraserHt } = eraserData;
    const canvasW = ctx.canvas.width;
    const canvasH = ctx.canvas.height;

    // Calculate visible region
    const x1 = Math.max(0, x);
    const y1 = Math.max(0, y);
    const x2 = Math.min(canvasW, x + eraserWd);
    const y2 = Math.min(canvasH, y + eraserHt);

    if (x2 <= x1 || y2 <= y1) return;

    const srcX1 = Math.max(0, -x);
    const srcY1 = Math.max(0, -y);

    // Get current canvas content
    const currentData = ctx.getImageData(x1, y1, x2 - x1, y2 - y1);

    // Direct typed array access
    const dstData = currentData.data;
    const srcData = image.data;
    const dstWidth = x2 - x1;
    const height = y2 - y1;

    // Pre-calculate offsets to avoid multiplication in inner loop
    let srcRowOffset = srcY1 * eraserWd + srcX1;
    let dstRowOffset = 0;

    for (let dy = 0; dy < height; dy++) {
        let srcIdx = srcRowOffset;
        let dstIdx = dstRowOffset;

        for (let dx = 0; dx < dstWidth; dx++) {
            // maskInv is now Uint8Array (0-255)
            // 0 means fully transparent (replace with eraser pixel)
            // 255 means fully opaque (keep original pixel)
            // But wait, maskInv logic in loadEraserHand:
            // maskInv = 255 - alpha.
            // If alpha=255 (opaque hand), maskInv=0.
            // If alpha=0 (transparent hand), maskInv=255.

            // Formula: dst = dst * maskInv + src
            // If maskInv=255 (transparent hand), dst = dst * 1 + src (src should be 0)
            // If maskInv=0 (opaque hand), dst = dst * 0 + src (src is hand color)

            const maskVal = maskInv[srcIdx];

            // Integer math optimization:
            // (a * b) >> 8 is roughly (a * b) / 256
            // We add 128 for rounding before shifting

            // R
            dstData[dstIdx] = (dstData[dstIdx] * maskVal + srcData[srcIdx * 4] * 255 + 128) >> 8;
            // G
            dstData[dstIdx + 1] = (dstData[dstIdx + 1] * maskVal + srcData[srcIdx * 4 + 1] * 255 + 128) >> 8;
            // B
            dstData[dstIdx + 2] = (dstData[dstIdx + 2] * maskVal + srcData[srcIdx * 4 + 2] * 255 + 128) >> 8;

            // Alpha - usually we keep original alpha or blend?
            // Original code:
            // currentData.data[dstIdx + 3] = 255; // Implicitly? No, it wasn't modifying alpha in original code?
            // Wait, original code was:
            // currentData.data[dstIdx + 3] = Math.round(currentData.data[dstIdx + 3] * maskVal + image.data[eraserIdx + 3]);
            // Let's keep it consistent
            dstData[dstIdx + 3] = (dstData[dstIdx + 3] * maskVal + srcData[srcIdx * 4 + 3] * 255 + 128) >> 8;

            srcIdx++;
            dstIdx += 4;
        }

        srcRowOffset += eraserWd;
        dstRowOffset += dstWidth * 4;
    }

    ctx.putImageData(currentData, x1, y1);
}

/**
 * Add natural wiggle motion to a position.
 */
export function addWiggleToPosition(
    baseX: number,
    baseY: number,
    frameIdx: number,
    numFrames: number,
    amplitude: number = DEFAULT_WIGGLE_AMPLITUDE,
    frequency: number = DEFAULT_WIGGLE_FREQUENCY
): Point {
    if (numFrames < 1) {
        throw new Error(`numFrames must be >= 1, got ${numFrames}`);
    }

    const t = frameIdx / numFrames;

    // Primary oscillation
    const primaryX = amplitude * Math.sin(2 * Math.PI * frequency * t);
    const primaryY = amplitude * WIGGLE_PRIMARY_Y_RATIO * Math.cos(2 * Math.PI * frequency * t);

    // Secondary oscillation
    const secondaryFreq = frequency * WIGGLE_SECONDARY_FREQUENCY_RATIO;
    const secondaryX = amplitude * WIGGLE_SECONDARY_X_RATIO * Math.sin(
        2 * Math.PI * secondaryFreq * t + WIGGLE_SECONDARY_X_PHASE
    );
    const secondaryY = amplitude * WIGGLE_SECONDARY_Y_RATIO * Math.cos(
        2 * Math.PI * secondaryFreq * t + WIGGLE_SECONDARY_Y_PHASE
    );

    // Tertiary oscillation
    const tertiaryFreq = frequency * WIGGLE_TERTIARY_FREQUENCY_RATIO;
    const tertiaryX = amplitude * WIGGLE_TERTIARY_X_RATIO * Math.sin(
        2 * Math.PI * tertiaryFreq * t + WIGGLE_TERTIARY_X_PHASE
    );
    const tertiaryY = amplitude * WIGGLE_TERTIARY_Y_RATIO * Math.cos(
        2 * Math.PI * tertiaryFreq * t + WIGGLE_TERTIARY_Y_PHASE
    );

    const wiggleX = Math.round(primaryX + secondaryX + tertiaryX);
    const wiggleY = Math.round(primaryY + secondaryY + tertiaryY);

    return [baseX + wiggleX, baseY + wiggleY];
}

/**
 * Add wiggle motion to a list of positions.
 */
export function addWiggleToPositions(
    positions: Point[],
    amplitude: number = DEFAULT_WIGGLE_AMPLITUDE,
    frequency: number = DEFAULT_WIGGLE_FREQUENCY
): Point[] {
    if (!positions.length) return positions;

    const numFrames = positions.length;
    return positions.map((pos, i) =>
        addWiggleToPosition(pos[0], pos[1], i, numFrames, amplitude, frequency)
    );
}

/**
 * Organize pixels by diagonal pattern for erasing.
 */
export function organizePixelsByDiagonalPattern(
    height: number,
    width: number
): Point[][] {
    const diagonalBands = new Map<number, Point[]>();

    for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
            const diagIdx = row + col;
            if (!diagonalBands.has(diagIdx)) {
                diagonalBands.set(diagIdx, []);
            }
            diagonalBands.get(diagIdx)!.push([col, row]);
        }
    }

    const sortedDiags = Array.from(diagonalBands.keys()).sort((a, b) => a - b);
    const bands: Point[][] = [];

    for (let i = 0; i < sortedDiags.length; i++) {
        const diagIdx = sortedDiags[i];
        const pixels = diagonalBands.get(diagIdx)!;
        // Zigzag: alternate sort direction
        if (i % 2 === 0) {
            pixels.sort((a, b) => a[1] - b[1]);
        } else {
            pixels.sort((a, b) => b[1] - a[1]);
        }
        bands.push(pixels);
    }

    return bands;
}

/**
 * Organize pixels by pattern for erasing.
 */
export function organizePixelsByPattern(
    height: number,
    width: number,
    pattern: string = 'diagonal'
): Point[][] {
    if (pattern === 'horizontal' || pattern === EraserStyle.HORIZONTAL) {
        const bands: Point[][] = Array.from({ length: height }, () => []);
        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                bands[row].push([col, row]);
            }
        }
        return bands;
    }

    if (pattern === 'vertical' || pattern === EraserStyle.VERTICAL) {
        const bands: Point[][] = Array.from({ length: width }, () => []);
        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                bands[col].push([col, row]);
            }
        }
        return bands;
    }

    // Default: diagonal zigzag pattern
    return organizePixelsByDiagonalPattern(height, width);
}

/**
 * Layer eraser for individual layers.
 */
export class LayerEraser {
    style: EraserStyleType;
    direction: EraserDirectionType;
    durationRatio: number;
    backgroundColor: [number, number, number];
    colorTolerance: number;
    eraserData: EraserHandData | null = null;

    constructor(config: LayerEraserConfig = {}) {
        this.style = config.style ?? EraserStyle.PROGRESSIVE;
        this.direction = config.direction ?? EraserDirection.NORMAL;
        this.durationRatio = config.durationRatio ?? 1.0;
        this.backgroundColor = config.backgroundColor ?? [255, 255, 255];
        this.colorTolerance = config.colorTolerance ?? DEFAULT_COLOR_TOLERANCE;

        if (config.eraserImagePath) {
            // Load asynchronously - caller should await loadEraser()
        }
    }

    /**
     * Load eraser images.
     */
    async loadEraser(eraserPath: string, maskPath?: string): Promise<boolean> {
        this.eraserData = await loadEraserHand(eraserPath, maskPath);
        return this.eraserData !== null;
    }

    /**
     * Calculate erase order based on style and direction.
     */
    calculateEraseOrder(
        drawSequence: Point[],
        layerBounds?: [number, number, number, number]
    ): Point[] {
        if (!drawSequence.length) return [];

        let baseSequence: Point[];

        if (this.direction === EraserDirection.NORMAL) {
            baseSequence = [...drawSequence];
        } else if (this.direction === EraserDirection.REVERSED) {
            baseSequence = [...drawSequence].reverse();
        } else if (this.direction === EraserDirection.INSIDE_OUT || this.direction === EraserDirection.OUTSIDE_IN) {
            let centerX: number, centerY: number;

            if (layerBounds) {
                centerX = layerBounds[0] + layerBounds[2] / 2;
                centerY = layerBounds[1] + layerBounds[3] / 2;
            } else {
                const xs = drawSequence.map(p => p[0]);
                const ys = drawSequence.map(p => p[1]);
                centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
                centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
            }

            const distanceFromCenter = (p: Point) =>
                Math.pow(p[0] - centerX, 2) + Math.pow(p[1] - centerY, 2);

            if (this.direction === EraserDirection.INSIDE_OUT) {
                baseSequence = [...drawSequence].sort((a, b) => distanceFromCenter(a) - distanceFromCenter(b));
            } else {
                baseSequence = [...drawSequence].sort((a, b) => distanceFromCenter(b) - distanceFromCenter(a));
            }
        } else {
            baseSequence = [...drawSequence];
        }

        // Apply style-based modifications
        if (this.style === EraserStyle.FAST) {
            // Skip every other point
            baseSequence = baseSequence.filter((_, i) => i % 2 === 0);
        } else if (this.style === EraserStyle.BY_SECTIONS) {
            const sectionSize = Math.max(1, Math.floor(baseSequence.length / 10));
            const sections: Point[][] = [];
            for (let i = 0; i < baseSequence.length; i += sectionSize) {
                sections.push(baseSequence.slice(i, i + sectionSize));
            }
            // Interleave points from sections
            const result: Point[] = [];
            const maxLen = sections.length > 0 ? Math.max(...sections.map(s => s.length)) : 0;
            for (let i = 0; i < maxLen; i++) {
                for (const section of sections) {
                    if (i < section.length) {
                        result.push(section[i]);
                    }
                }
            }
            baseSequence = result;
        }

        return baseSequence;
    }

    /**
     * Generate erase path based on pattern and dimensions.
     * Shared utility for both pre-generation and progressive generation.
     * 
     * @private
     */
    private generateErasePath(
        width: number,
        height: number,
        eraseRadius: number,
        useWhiteboardWipe: boolean
    ): Point[] {
        let erasePath: Point[];

        if (useWhiteboardWipe) {
            // Horizontal zigzag wiping motion
            erasePath = [];
            const stripHeight = Math.max(10, eraseRadius * 2 / 3);
            const stepSize = Math.max(5, eraseRadius / 2);
            let currentY = 0;
            let direction = 1;

            while (currentY < height) {
                const xValues = direction === 1
                    ? Array.from({ length: Math.ceil(width / stepSize) }, (_, i) => i * stepSize)
                    : Array.from({ length: Math.ceil(width / stepSize) }, (_, i) => width - 1 - i * stepSize);

                for (const x of xValues) {
                    if (x >= 0 && x < width) {
                        erasePath.push([x, currentY]);
                    }
                }

                currentY += stripHeight;
                direction *= -1;
            }
        } else {
            // Simple diagonal pattern
            const bands = organizePixelsByDiagonalPattern(height, width);
            erasePath = bands.flat();
        }

        if (!erasePath.length) {
            erasePath = [[Math.floor(width / 2), Math.floor(height / 2)]];
        }

        return erasePath;
    }

    /**
     * Generate erase frames using whiteboard wipe pattern.
     * Simplified version - sweeps entire canvas without content detection.
     */
    generateEraseFrames(
        sourceImage: ImageData,
        numFrames: number,
        eraseRadius: number = 30,
        showEraser: boolean = true,
        useWhiteboardWipe: boolean = true
    ): EraserFrameResult {
        const { width, height } = sourceImage;
        const frames: ImageData[] = [];
        const positions: Point[] = [];

        // Generate erase path using shared helper - simple sweep across canvas
        const erasePath = this.generateErasePath(width, height, eraseRadius, useWhiteboardWipe);

        // Create canvas for drawing
        const canvas = document.createElement('canvas');
        canvas.id = generateCanvasId('eraser-frames');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
            return { frames: [], positions: [] };
        }

        // OPTIMIZATION: Create a second canvas for eraser hand to avoid full canvas restore
        // This canvas is temporary and will be garbage collected after function returns
        let eraserCanvas: HTMLCanvasElement | null = null;
        let eraserCtx: CanvasRenderingContext2D | null = null;
        try {
            if (showEraser && this.eraserData) {
                eraserCanvas = document.createElement('canvas');
                eraserCanvas.id = generateCanvasId('eraser-hand-temp');
                eraserCanvas.width = width;
                eraserCanvas.height = height;
                eraserCtx = eraserCanvas.getContext('2d', { willReadFrequently: true });
            }

            // Copy source to canvas
            ctx.putImageData(sourceImage, 0, 0);

            const totalPoints = erasePath.length;
            let lastPointIdx = 0;

            for (let frameIdx = 0; frameIdx <= numFrames; frameIdx++) {
                const progress = frameIdx === numFrames ? 1.0 : (frameIdx + 1) / (numFrames + 1);
                const pointsToProcess = Math.min(Math.floor(totalPoints * progress), totalPoints);

                // Erase new points using circular brush
                // For full-scene wipes, paint with background color directly to avoid transparency issues
                // For partial erases (occlusion culling), use destination-out to preserve transparency
                if (useWhiteboardWipe) {
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.fillStyle = `rgb(${this.backgroundColor[0]}, ${this.backgroundColor[1]}, ${this.backgroundColor[2]})`;
                } else {
                    ctx.globalCompositeOperation = 'destination-out';
                    ctx.fillStyle = 'black'; // Color doesn't matter for destination-out
                }

                for (let i = lastPointIdx; i < pointsToProcess; i++) {
                    const [x, y] = erasePath[i];
                    ctx.beginPath();
                    ctx.arc(x, y, eraseRadius, 0, 2 * Math.PI);
                    ctx.fill();
                }

                ctx.globalCompositeOperation = 'source-over';

                lastPointIdx = pointsToProcess;

                // Get current position for eraser hand
                let currentPos: Point;
                if (lastPointIdx > 0 && lastPointIdx <= totalPoints) {
                    currentPos = erasePath[Math.min(lastPointIdx - 1, totalPoints - 1)];
                } else if (totalPoints > 0) {
                    currentPos = erasePath[0];
                } else {
                    currentPos = [Math.floor(width / 2), Math.floor(height / 2)];
                }
                positions.push(currentPos);

                // OPTIMIZATION: Composite eraser hand on separate canvas instead of restoring/redrawing
                if (showEraser && this.eraserData && eraserCtx && frameIdx < numFrames) {
                    // Copy current erased content to eraser canvas
                    eraserCtx.clearRect(0, 0, width, height);
                    eraserCtx.drawImage(canvas, 0, 0);
                    // Draw eraser hand on top
                    drawEraserOnCanvas(eraserCtx, this.eraserData, currentPos[0], currentPos[1]);
                    // Capture frame from eraser canvas
                    frames.push(eraserCtx.getImageData(0, 0, width, height));
                } else {
                    // Capture frame from main canvas
                    frames.push(ctx.getImageData(0, 0, width, height));
                }
            }
        } finally {
            // Explicit cleanup (though browser will GC these anyway)
            eraserCanvas = null;
            eraserCtx = null;
        }

        return { frames, positions };
    }

    /**
     * Create a progressive eraser context for lazy frame generation.
     * This method calculates the erase path upfront (fast operation) but generates
     * frames on-demand during animation, significantly improving startup time.
     * Simplified version - no content detection, just sweeps the entire canvas.
     * 
     * @returns ProgressiveEraseContext or null if creation fails
     */
    createProgressiveEraseContext(
        sourceImage: ImageData,
        eraseRadius: number = 30,
        useWhiteboardWipe: boolean = true
    ): ProgressiveEraseContext | null {
        const { width, height } = sourceImage;

        // Generate erase path using shared helper (fast operation)
        const erasePath = this.generateErasePath(width, height, eraseRadius, useWhiteboardWipe);

        // Create persistent canvas with source image
        const canvas = document.createElement('canvas');
        canvas.id = generateCanvasId('progressive-eraser');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
            return null;
        }

        // Copy source to canvas
        ctx.putImageData(sourceImage, 0, 0);

        return new ProgressiveEraseContext(
            canvas,
            ctx,
            erasePath,
            eraseRadius,
            this.backgroundColor,
            this.eraserData
        );
    }
}

/**
 * Progressive erase context for lazy frame generation.
 * Generates frames on-demand during animation instead of pre-generating all frames.
 * Simplified version - sweeps entire canvas without content detection.
 */
export class ProgressiveEraseContext {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private erasePath: Point[];
    private eraseRadius: number;
    private backgroundColor: [number, number, number];
    private eraserData: EraserHandData | null;
    private lastProcessedIndex: number = 0;
    private eraserCanvas: HTMLCanvasElement | null = null;
    private eraserCtx: CanvasRenderingContext2D | null = null;

    constructor(
        canvas: HTMLCanvasElement,
        ctx: CanvasRenderingContext2D,
        erasePath: Point[],
        eraseRadius: number,
        backgroundColor: [number, number, number],
        eraserData: EraserHandData | null
    ) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.erasePath = erasePath;
        this.eraseRadius = eraseRadius;
        this.backgroundColor = backgroundColor;
        this.eraserData = eraserData;

        // Create secondary canvas for eraser hand if needed
        if (eraserData) {
            this.eraserCanvas = document.createElement('canvas');
            this.eraserCanvas.id = generateCanvasId('progressive-eraser-hand');
            this.eraserCanvas.width = canvas.width;
            this.eraserCanvas.height = canvas.height;
            this.eraserCtx = this.eraserCanvas.getContext('2d', { willReadFrequently: true });
        }
    }

    /**
     * Generate a single frame for the given progress (0.0 to 1.0).
     * This is called during animation for each frame.
     * Simplified version - hand always shows during sweep.
     * 
     * @param progress Animation progress from 0.0 (start) to 1.0 (complete)
     * @param showEraser Whether to show the eraser hand in the frame
     * @returns Object containing the frame ImageData and current position
     */
    generateFrame(progress: number, showEraser: boolean = true): {
        frame: ImageData,
        position: Point
    } {
        // Clamp progress to [0, 1]
        progress = Math.max(0, Math.min(1, progress));

        const totalPoints = this.erasePath.length;
        const pointsToProcess = Math.min(Math.floor(totalPoints * progress), totalPoints);

        // Erase new points since last frame
        // CRITICAL FIX: Use destination-out to make pixels transparent
        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.fillStyle = 'black';

        for (let i = this.lastProcessedIndex; i < pointsToProcess; i++) {
            const [x, y] = this.erasePath[i];
            this.ctx.beginPath();
            this.ctx.arc(x, y, this.eraseRadius, 0, 2 * Math.PI);
            this.ctx.fill();
        }

        this.ctx.globalCompositeOperation = 'source-over';

        this.lastProcessedIndex = pointsToProcess;

        // Get current position
        let currentPos: Point;
        if (this.lastProcessedIndex > 0 && this.lastProcessedIndex <= totalPoints) {
            currentPos = this.erasePath[Math.min(this.lastProcessedIndex - 1, totalPoints - 1)];
        } else if (totalPoints > 0) {
            currentPos = this.erasePath[0];
        } else {
            currentPos = [Math.floor(this.canvas.width / 2), Math.floor(this.canvas.height / 2)];
        }

        // Generate frame with or without eraser hand
        let frame: ImageData;
        if (showEraser && this.eraserData && this.eraserCtx && progress < 1.0) {
            // Draw erased content + eraser hand on secondary canvas
            this.eraserCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.eraserCtx.drawImage(this.canvas, 0, 0);
            drawEraserOnCanvas(this.eraserCtx, this.eraserData, currentPos[0], currentPos[1]);
            frame = this.eraserCtx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        } else {
            // Just return the erased content
            frame = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        }

        return { frame, position: currentPos };
    }

    /**
     * Get the erase path (useful for hand overlay animations).
     */
    getErasePath(): Point[] {
        return this.erasePath;
    }

    /**
     * Get the total number of points in the erase path.
     */
    getTotalPoints(): number {
        return this.erasePath.length;
    }

    /**
     * Clean up temporary resources.
     * Note: The main canvas and ctx are intentionally NOT cleaned up as they contain
     * the final erased state that may be needed after animation completes.
     * Only temporary eraser hand compositing resources are cleaned.
     */
    cleanup(): void {
        this.eraserCanvas = null;
        this.eraserCtx = null;
        // Main canvas/ctx persist to maintain final erased state
    }
}

/**
 * Generate eraser frames using diagonal pattern.
 * Simplified version - sweeps entire canvas without content detection.
 */
export function generateEraserFramesDiagonal(
    sourceImage: ImageData,
    numFrames: number = 105,
    pattern: string = 'diagonal',
    backgroundColor: [number, number, number] = [255, 255, 255],
    showEraser: boolean = true,
    radius: number = 30,
    addHandWiggle: boolean = true,
    wiggleAmplitude: number = DEFAULT_WIGGLE_AMPLITUDE,
    wiggleFrequency: number = DEFAULT_WIGGLE_FREQUENCY
): EraserFrameResult {
    const eraser = new LayerEraser({
        style: pattern as EraserStyleType,
        backgroundColor
    });

    const useWhiteboardWipe = pattern !== 'diagonal';
    const result = eraser.generateEraseFrames(
        sourceImage,
        numFrames,
        radius,
        showEraser,
        useWhiteboardWipe
    );

    // Apply hand wiggle if requested
    if (addHandWiggle && result.positions.length > 0) {
        result.positions = addWiggleToPositions(
            result.positions,
            wiggleAmplitude,
            wiggleFrequency
        );
    }

    return result;
}

/**
 * Generate slide eraser configuration.
 */
export function generateSlideEraserConfig(
    duration: number = 3.5,
    delayAfterAnimations: number = 0.0,
    pattern: string = 'diagonal',
    backgroundColor: [number, number, number] = [255, 255, 255],
    showEraser: boolean = true
): SlideEraserConfig {
    return {
        enabled: true,
        duration,
        delayAfterAnimations,
        pattern,
        backgroundColor,
        showEraser
    };
}

/**
 * Apply slide eraser effect.
 * Simplified version - sweeps entire canvas without content detection.
 */
export async function applySlideEraser(
    currentFrame: ImageData,
    eraserConfig: SlideEraserConfig,
    frameRate: number = 30
): Promise<EraserFrameResult> {
    if (!eraserConfig.enabled) {
        return { frames: [], positions: [] };
    }

    const duration = eraserConfig.duration ?? 3.5;
    const pattern = eraserConfig.pattern ?? 'diagonal';
    const backgroundColor = eraserConfig.backgroundColor ?? [255, 255, 255];
    const showEraser = eraserConfig.showEraser ?? true;
    const radius = eraserConfig.radius ?? 30;

    const numFrames = Math.max(1, Math.floor(duration * frameRate));

    return generateEraserFramesDiagonal(
        currentFrame,
        numFrames,
        pattern,
        backgroundColor,
        showEraser,
        radius,
        true,
        DEFAULT_WIGGLE_AMPLITUDE,
        DEFAULT_WIGGLE_FREQUENCY
    );
}

/**
 * Generate delay frames (static frames) before eraser animation.
 */
export function generateDelayFrames(
    currentFrame: ImageData,
    delaySeconds: number,
    frameRate: number = 30
): ImageData[] {
    if (delaySeconds <= 0) return [];

    const numFrames = Math.max(1, Math.floor(delaySeconds * frameRate));
    const frames: ImageData[] = [];

    for (let i = 0; i < numFrames; i++) {
        // Create a copy of the current frame
        const frameCopy = new ImageData(currentFrame.width, currentFrame.height);
        frameCopy.data.set(currentFrame.data);
        frames.push(frameCopy);
    }

    return frames;
}

/**
 * Default alpha threshold for determining transparent pixels.
 * Pixels with alpha below this value are considered transparent/background.
 */
export const DEFAULT_ALPHA_THRESHOLD = 10;

/**
 * Default color tolerance for background pixel detection.
 * Used to determine if a pixel color is close enough to the background color.
 */
export const DEFAULT_COLOR_TOLERANCE = 5;

/**
 * Check if a pixel is close to the background color (within tolerance).
 */
export function isBackgroundPixel(
    r: number,
    g: number,
    b: number,
    alpha: number,
    backgroundColor: [number, number, number],
    tolerance: number = DEFAULT_COLOR_TOLERANCE
): boolean {
    // Transparent pixels are considered background
    if (alpha < DEFAULT_ALPHA_THRESHOLD) {
        return true;
    }

    // Check color difference
    const rDiff = Math.abs(r - backgroundColor[0]);
    const gDiff = Math.abs(g - backgroundColor[1]);
    const bDiff = Math.abs(b - backgroundColor[2]);

    return rDiff <= tolerance && gDiff <= tolerance && bDiff <= tolerance;
}

/**
 * Check if an area contains non-background content.
 */
export function hasContentInArea(
    imageData: ImageData,
    x: number,
    y: number,
    radius: number,
    backgroundColor: [number, number, number],
    tolerance: number = DEFAULT_COLOR_TOLERANCE
): boolean {
    const x1 = Math.max(0, x - radius);
    const x2 = Math.min(imageData.width, x + radius + 1);
    const y1 = Math.max(0, y - radius);
    const y2 = Math.min(imageData.height, y + radius + 1);

    for (let py = y1; py < y2; py++) {
        for (let px = x1; px < x2; px++) {
            const idx = (py * imageData.width + px) * 4;
            if (!isBackgroundPixel(
                imageData.data[idx],
                imageData.data[idx + 1],
                imageData.data[idx + 2],
                imageData.data[idx + 3],
                backgroundColor,
                tolerance
            )) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Rubber (Eraser) Tool for direct pixel manipulation.
 */
export class Rubber {
    static readonly CIRCLE = 'circle';
    static readonly SQUARE = 'square';

    radius: number;
    shape: string;
    backgroundColor: [number, number, number];
    softness: number;
    colorTolerance: number;
    private _mask: Float32Array;

    constructor(
        radius: number = 20,
        shape: string = 'circle',
        backgroundColor: [number, number, number] = [255, 255, 255],
        softness: number = 0.0,
        colorTolerance: number = DEFAULT_COLOR_TOLERANCE
    ) {
        this.radius = Math.max(1, radius);
        this.shape = shape === Rubber.SQUARE ? Rubber.SQUARE : Rubber.CIRCLE;
        this.backgroundColor = backgroundColor;
        this.softness = Math.max(0, Math.min(1, softness));
        this.colorTolerance = colorTolerance;
        this._mask = this._createMask();
    }

    private _createMask(): Float32Array {
        const size = this.radius * 2 + 1;
        const center = this.radius;
        const mask = new Float32Array(size * size);

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const dist = this.shape === Rubber.CIRCLE
                    ? Math.sqrt(Math.pow(x - center, 2) + Math.pow(y - center, 2))
                    : Math.max(Math.abs(x - center), Math.abs(y - center));

                if (this.softness > 0) {
                    const innerRadius = this.radius * (1 - this.softness);
                    mask[y * size + x] = Math.max(0, Math.min(1,
                        1 - (dist - innerRadius) / (this.radius - innerRadius + 1e-6)
                    ));
                } else {
                    mask[y * size + x] = dist <= this.radius ? 1.0 : 0.0;
                }
            }
        }

        return mask;
    }

    /**
     * Check if there's content to erase at a specific position.
     * Returns true if any pixels in the eraser area are not background.
     */
    hasContentToErase(imageData: ImageData, centerX: number, centerY: number): boolean {
        return hasContentInArea(
            imageData,
            centerX,
            centerY,
            this.radius,
            this.backgroundColor,
            this.colorTolerance
        );
    }

    /**
     * Apply eraser effect at a specific position.
     * Only erases pixels that are not already the background color.
     */
    applyEraser(
        imageData: ImageData,
        centerX: number,
        centerY: number
    ): ImageData {
        const result = new ImageData(imageData.width, imageData.height);
        result.data.set(imageData.data);

        const maskSize = this.radius * 2 + 1;
        const halfSize = this.radius;

        const y1Img = Math.max(0, centerY - halfSize);
        const y2Img = Math.min(imageData.height, centerY + halfSize + 1);
        const x1Img = Math.max(0, centerX - halfSize);
        const x2Img = Math.min(imageData.width, centerX + halfSize + 1);

        const y1Mask = halfSize - (centerY - y1Img);
        const x1Mask = halfSize - (centerX - x1Img);

        for (let y = y1Img; y < y2Img; y++) {
            for (let x = x1Img; x < x2Img; x++) {
                const maskY = y1Mask + (y - y1Img);
                const maskX = x1Mask + (x - x1Img);
                const maskVal = this._mask[maskY * maskSize + maskX];

                if (maskVal > 0) {
                    const idx = (y * imageData.width + x) * 4;

                    // Check if pixel is already close to background color using utility function
                    if (isBackgroundPixel(
                        result.data[idx],
                        result.data[idx + 1],
                        result.data[idx + 2],
                        result.data[idx + 3],
                        this.backgroundColor,
                        this.colorTolerance
                    )) {
                        continue;
                    }

                    result.data[idx] = Math.round(
                        this.backgroundColor[0] * maskVal + result.data[idx] * (1 - maskVal)
                    );
                    result.data[idx + 1] = Math.round(
                        this.backgroundColor[1] * maskVal + result.data[idx + 1] * (1 - maskVal)
                    );
                    result.data[idx + 2] = Math.round(
                        this.backgroundColor[2] * maskVal + result.data[idx + 2] * (1 - maskVal)
                    );
                }
            }
        }

        return result;
    }

    /**
     * Erase along a path of coordinates.
     */
    eraseAlongPath(imageData: ImageData, pathCoords: Point[]): ImageData {
        let result = imageData;
        for (const [x, y] of pathCoords) {
            result = this.applyEraser(result, x, y);
        }
        return result;
    }
}

/**
 * Apply eraser effect at a specific position (convenience function).
 */
export function applyEraser(
    imageData: ImageData,
    centerX: number,
    centerY: number,
    radius: number = 20,
    backgroundColor: [number, number, number] = [255, 255, 255],
    shape: string = 'circle'
): ImageData {
    const rubber = new Rubber(radius, shape, backgroundColor);
    return rubber.applyEraser(imageData, centerX, centerY);
}

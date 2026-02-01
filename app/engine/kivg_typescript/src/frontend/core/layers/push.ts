/**
 * Push Animation Module for Kivg Core
 * 
 * Provides push animation functionality for moving objects across the canvas.
 * This is the centralized push module for the Griboo engine.
 * 
 * Features:
 * - Push animation with hand overlay
 * - Customizable start and end positions
 * - Easing functions for smooth motion
 * - Support for shapes and images
 * - Hand offset configuration
 * 
 * Usage:
 *     import { PushAnimation, createPushAnimation, generatePushFrames } from './core/push';
 *     
 *     const pushAnim = createPushAnimation({
 *         startPosition: [100, 500],
 *         endPosition: [800, 500],
 *         duration: 2.0,
 *         easing: 'ease_out'
 *     });
 *     
 *     const frames = await pushAnim.generateFrames(objectImage, [1920, 1080], 30);
 */

import { AnimationTransition } from '../logic/easing';

// Default hand offset relative to the pushed object
export const DEFAULT_HAND_OFFSET: [number, number] = [-80, -50];

// Default push hand paths
export const DEFAULT_PUSH_HAND_PATH = '/hand/push_hand_real.png';
export const DEFAULT_PUSH_HAND_MASK_PATH = '/hand/push_hand_mask.png';

/**
 * Configuration for push animation.
 */
export interface PushConfig {
    startPosition: [number, number];
    endPosition: [number, number];
    duration: number;
    easing: string;
    handOffset: [number, number];
    handImagePath?: string;
    handMaskPath?: string;
}

/**
 * Default push configuration.
 */
export function createDefaultPushConfig(): PushConfig {
    return {
        startPosition: [100, 500],
        endPosition: [800, 500],
        duration: 2.0,
        easing: 'ease_out',
        handOffset: [...DEFAULT_HAND_OFFSET]
    };
}

/**
 * Data structure for push hand rendering.
 */
export interface PushHandData {
    image: ImageData;
    mask: ImageData;
    maskInv: Float32Array; // Normalized 0-1
    maskInv3ch: Float32Array; // 3-channel inverted mask for blending
    height: number;
    width: number;
}

/**
 * Easing type map for push animations.
 */
type EasingMethod = (progress: number) => number;

const easingMap: Record<string, EasingMethod> = {
    'linear': AnimationTransition.linear,
    'ease_in': AnimationTransition.inQuad,
    'ease_out': AnimationTransition.outQuad,
    'ease_in_out': AnimationTransition.inOutQuad,
    'in_quad': AnimationTransition.inQuad,
    'out_quad': AnimationTransition.outQuad,
    'in_out_quad': AnimationTransition.inOutQuad,
    'in_cubic': AnimationTransition.inCubic,
    'out_cubic': AnimationTransition.outCubic,
    'in_out_cubic': AnimationTransition.inOutCubic,
    'in_elastic': AnimationTransition.inElastic,
    'out_elastic': AnimationTransition.outElastic,
    'in_out_elastic': AnimationTransition.inOutElastic,
    'in_bounce': AnimationTransition.inBounce,
    'out_bounce': AnimationTransition.outBounce,
    'in_out_bounce': AnimationTransition.inOutBounce,
    'in_back': AnimationTransition.inBack,
    'out_back': AnimationTransition.outBack,
    'in_out_back': AnimationTransition.inOutBack,
    'in_expo': AnimationTransition.inExpo,
    'out_expo': AnimationTransition.outExpo,
    'in_out_expo': AnimationTransition.inOutExpo,
};

/**
 * Load and prepare push hand image and mask.
 * 
 * @param handPath - Path or URL to push hand image
 * @param maskPath - Path or URL to push hand mask
 * @returns Promise resolving to PushHandData or null if loading fails
 */
export async function loadPushHand(
    handPath: string = DEFAULT_PUSH_HAND_PATH,
    maskPath: string = DEFAULT_PUSH_HAND_MASK_PATH
): Promise<PushHandData | null> {
    try {
        // Load hand image
        const handResult = await loadImage(handPath);
        if (!handResult) {
            console.warn(`⚠️ Push hand not found at ${handPath}`);
            return null;
        }

        // Load mask image
        const maskResult = await loadImage(maskPath);

        // Create canvas for hand image
        const handCanvas = document.createElement('canvas');
        handCanvas.width = handResult.width;
        handCanvas.height = handResult.height;
        const handCtx = handCanvas.getContext('2d');
        if (!handCtx) return null;

        handCtx.drawImage(handResult, 0, 0);
        const handImageData = handCtx.getImageData(0, 0, handResult.width, handResult.height);

        // Create mask data
        let maskImageData: ImageData;
        if (maskResult) {
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = handResult.width;
            maskCanvas.height = handResult.height;
            const maskCtx = maskCanvas.getContext('2d');
            if (!maskCtx) return null;

            maskCtx.drawImage(maskResult, 0, 0, handResult.width, handResult.height);
            maskImageData = maskCtx.getImageData(0, 0, handResult.width, handResult.height);
        } else {
            // Use alpha channel from hand image as mask, or create a default mask
            maskImageData = new ImageData(handResult.width, handResult.height);
            for (let i = 0; i < handImageData.data.length; i += 4) {
                const alpha = handImageData.data[i + 3];
                maskImageData.data[i] = alpha;
                maskImageData.data[i + 1] = alpha;
                maskImageData.data[i + 2] = alpha;
                maskImageData.data[i + 3] = 255;
            }
        }

        // Create inverted mask (normalized 0-1)
        const pixelCount = handResult.width * handResult.height;
        const maskInv = new Float32Array(pixelCount);
        const maskInv3ch = new Float32Array(pixelCount * 3);

        for (let i = 0; i < pixelCount; i++) {
            const maskVal = maskImageData.data[i * 4]; // Use red channel
            const invNormalized = (255 - maskVal) / 255.0;
            maskInv[i] = invNormalized;
            maskInv3ch[i * 3] = invNormalized;
            maskInv3ch[i * 3 + 1] = invNormalized;
            maskInv3ch[i * 3 + 2] = invNormalized;
        }

        return {
            image: handImageData,
            mask: maskImageData,
            maskInv,
            maskInv3ch,
            height: handResult.height,
            width: handResult.width
        };
    } catch (error) {
        console.error(`❌ Error loading push hand: ${error}`);
        return null;
    }
}

/**
 * Helper function to load an image.
 */
async function loadImage(src: string): Promise<HTMLImageElement | null> {
    // Use HTTP loader for remote URLs
    if (src.startsWith('http://') || src.startsWith('https://')) {
        const { getGlobalCache } = await import('../../utils/asset_cache');
        const { fetchImage } = await import('../../utils/http_loader');

        const cache = getGlobalCache();

        // Check cache first
        let blob = await cache.get(src);

        if (!blob) {
            // Download with retry logic
            try {
                blob = await fetchImage(src, { retries: 3, timeout: 30000 });
                // Store in cache
                await cache.set(src, blob);
            } catch (error) {
                console.error(`Failed to fetch image from ${src}:`, error);
                return null;
            }
        }

        // Convert blob to Image
        return new Promise((resolve) => {
            const img = new Image();
            const objectUrl = URL.createObjectURL(blob);

            img.onload = () => {
                URL.revokeObjectURL(objectUrl);
                resolve(img);
            };

            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                resolve(null);
            };

            img.src = objectUrl;
        });
    }

    // Local path - use standard Image API
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

/**
 * Apply easing function to push animation progress.
 * Uses the AnimationTransition class for consistent easing across the engine.
 * 
 * @param progress - Linear progress value (0.0 to 1.0)
 * @param easingType - Type of easing function
 * @returns Eased progress value
 */
export function applyPushEasing(progress: number, easingType: string = 'out_cubic'): number {
    const easingMethod = easingMap[easingType] ?? AnimationTransition.outCubic;
    return easingMethod(progress);
}

/**
 * Overlay push hand on a frame at the specified position.
 * 
 * @param frameData - ImageData to overlay hand on
 * @param handData - PushHandData with hand image and masks
 * @param handX - X position for hand placement
 * @param handY - Y position for hand placement
 * @returns Modified ImageData with hand overlaid
 */
export function overlayHandOnFrame(
    frameData: ImageData,
    handData: PushHandData,
    handX: number,
    handY: number
): ImageData {
    const frameW = frameData.width;
    const frameH = frameData.height;
    const handHt = handData.height;
    const handWd = handData.width;

    // Calculate visible region
    const handX1 = Math.max(0, handX);
    const handY1 = Math.max(0, handY);
    const handX2 = Math.min(frameW, handX + handWd);
    const handY2 = Math.min(frameH, handY + handHt);

    // Source region for the hand
    const handSrcX1 = Math.max(0, -handX);
    const handSrcY1 = Math.max(0, -handY);

    // Apply hand with transparency
    if (handX2 > handX1 && handY2 > handY1) {
        for (let y = handY1; y < handY2; y++) {
            for (let x = handX1; x < handX2; x++) {
                const srcX = handSrcX1 + (x - handX1);
                const srcY = handSrcY1 + (y - handY1);

                const srcIdx = (srcY * handWd + srcX);
                const dstIdx = (y * frameW + x) * 4;
                const handIdx = srcIdx * 4;

                const maskVal = handData.maskInv[srcIdx];

                // Blend: frame * maskInv + hand
                frameData.data[dstIdx] = Math.round(
                    frameData.data[dstIdx] * maskVal + handData.image.data[handIdx]
                );
                frameData.data[dstIdx + 1] = Math.round(
                    frameData.data[dstIdx + 1] * maskVal + handData.image.data[handIdx + 1]
                );
                frameData.data[dstIdx + 2] = Math.round(
                    frameData.data[dstIdx + 2] * maskVal + handData.image.data[handIdx + 2]
                );
            }
        }
    }

    return frameData;
}

/**
 * Overlay an object on a frame, treating near-white pixels as transparent.
 * 
 * @param frameData - ImageData to overlay object on
 * @param objectData - ImageData of the object
 * @param x - X position for object placement
 * @param y - Y position for object placement
 * @param whiteThreshold - Pixels with all channels above this are considered transparent
 * @returns Modified ImageData with object overlaid
 */
export function overlayObjectOnFrame(
    frameData: ImageData,
    objectData: ImageData,
    x: number,
    y: number,
    whiteThreshold: number = 250
): ImageData {
    const frameW = frameData.width;
    const frameH = frameData.height;
    const objW = objectData.width;
    const objH = objectData.height;

    // Calculate visible region
    const objX1 = Math.max(0, x);
    const objY1 = Math.max(0, y);
    const objX2 = Math.min(frameW, x + objW);
    const objY2 = Math.min(frameH, y + objH);

    // Source region for the object
    const srcX1 = Math.max(0, -x);
    const srcY1 = Math.max(0, -y);

    // Copy non-white pixels
    if (objX2 > objX1 && objY2 > objY1) {
        for (let dy = objY1; dy < objY2; dy++) {
            for (let dx = objX1; dx < objX2; dx++) {
                const srcX = srcX1 + (dx - objX1);
                const srcY = srcY1 + (dy - objY1);

                const srcIdx = (srcY * objW + srcX) * 4;
                const dstIdx = (dy * frameW + dx) * 4;

                // Check if any channel is below threshold (non-white)
                if (objectData.data[srcIdx] < whiteThreshold ||
                    objectData.data[srcIdx + 1] < whiteThreshold ||
                    objectData.data[srcIdx + 2] < whiteThreshold) {
                    frameData.data[dstIdx] = objectData.data[srcIdx];
                    frameData.data[dstIdx + 1] = objectData.data[srcIdx + 1];
                    frameData.data[dstIdx + 2] = objectData.data[srcIdx + 2];
                    frameData.data[dstIdx + 3] = objectData.data[srcIdx + 3];
                }
            }
        }
    }

    return frameData;
}

/**
 * Push animation class for moving objects across the canvas.
 * 
 * This class manages the animation of pushing/sliding objects from
 * one position to another with optional hand overlay.
 */
export class PushAnimation {
    config: PushConfig;
    handData: PushHandData | null = null;
    private _frames: ImageData[] = [];

    /**
     * Initialize push animation.
     * 
     * @param config - PushConfig object with animation settings
     */
    constructor(config?: Partial<PushConfig>) {
        this.config = { ...createDefaultPushConfig(), ...config };
    }

    /**
     * Load push hand image.
     * 
     * @returns Promise resolving to true if successful, false otherwise
     */
    async loadHand(): Promise<boolean> {
        const handPath = this.config.handImagePath ?? DEFAULT_PUSH_HAND_PATH;
        const maskPath = this.config.handMaskPath ?? DEFAULT_PUSH_HAND_MASK_PATH;

        this.handData = await loadPushHand(handPath, maskPath);
        return this.handData !== null;
    }

    /**
     * Generate push animation frames.
     * 
     * @param objectImg - ImageData of the object being pushed
     * @param canvasSize - [width, height] of the canvas
     * @param frameRate - Frames per second (default: 30)
     * @param backgroundColor - Background color as RGBA array (default: white)
     * @param includeHand - Whether to include hand overlay (default: true)
     * @param finalHoldFrames - Number of frames to hold at end position (default: 10)
     * @returns Promise resolving to array of animation frames (ImageData)
     */
    async generateFrames(
        objectImg: ImageData,
        canvasSize: [number, number],
        frameRate: number = 30,
        backgroundColor: [number, number, number, number] = [255, 255, 255, 255],
        includeHand: boolean = true,
        finalHoldFrames: number = 10
    ): Promise<ImageData[]> {
        if (includeHand && !this.handData) {
            await this.loadHand();
        }

        const [canvasW, canvasH] = canvasSize;
        const numFrames = Math.floor(this.config.duration * frameRate);

        const [startX, startY] = this.config.startPosition;
        const [endX, endY] = this.config.endPosition;
        const [handOffsetX, handOffsetY] = this.config.handOffset;

        this._frames = [];

        console.log(`🫸 Push animation: ${numFrames} frames over ${this.config.duration}s`);
        console.log(`   Position: (${startX}, ${startY}) -> (${endX}, ${endY})`);
        console.log(`   Object: ${objectImg.width}x${objectImg.height}`);

        // Generate animation frames
        for (let frameIdx = 0; frameIdx < numFrames; frameIdx++) {
            // Calculate progress with easing
            const t = frameIdx / Math.max(numFrames - 1, 1);
            const tEased = applyPushEasing(t, this.config.easing);

            // Interpolate position
            const currentX = Math.round(startX + (endX - startX) * tEased);
            const currentY = Math.round(startY + (endY - startY) * tEased);

            // Create frame with background
            const frame = new ImageData(canvasW, canvasH);
            for (let i = 0; i < frame.data.length; i += 4) {
                frame.data[i] = backgroundColor[0];
                frame.data[i + 1] = backgroundColor[1];
                frame.data[i + 2] = backgroundColor[2];
                frame.data[i + 3] = backgroundColor[3];
            }

            // Place object at current position
            overlayObjectOnFrame(frame, objectImg, currentX, currentY);

            // Place hand if available
            if (includeHand && this.handData) {
                const handX = currentX + handOffsetX;
                const handY = currentY + handOffsetY;
                overlayHandOnFrame(frame, this.handData, handX, handY);
            }

            this._frames.push(frame);
        }

        // Add final hold frames (without hand)
        if (finalHoldFrames > 0) {
            const finalFrame = new ImageData(canvasW, canvasH);
            for (let i = 0; i < finalFrame.data.length; i += 4) {
                finalFrame.data[i] = backgroundColor[0];
                finalFrame.data[i + 1] = backgroundColor[1];
                finalFrame.data[i + 2] = backgroundColor[2];
                finalFrame.data[i + 3] = backgroundColor[3];
            }
            overlayObjectOnFrame(finalFrame, objectImg, endX, endY);

            for (let i = 0; i < finalHoldFrames; i++) {
                // Clone final frame
                const holdFrame = new ImageData(canvasW, canvasH);
                holdFrame.data.set(finalFrame.data);
                this._frames.push(holdFrame);
            }
        }

        console.log(`✅ Push animation complete: ${this._frames.length} frames total`);

        return this._frames;
    }

    /**
     * Get stored animation frames.
     */
    getFrames(): ImageData[] {
        return [...this._frames];
    }
}

/**
 * Create a push animation with the given parameters.
 * 
 * @param startPosition - Starting position [x, y]
 * @param endPosition - Ending position [x, y]
 * @param duration - Animation duration in seconds
 * @param easing - Easing function type
 * @param handOffset - Optional hand offset [x, y]
 * @returns PushAnimation instance
 */
export function createPushAnimation(
    startPosition: [number, number],
    endPosition: [number, number],
    duration: number = 2.0,
    easing: string = 'ease_out',
    handOffset?: [number, number]
): PushAnimation {
    return new PushAnimation({
        startPosition,
        endPosition,
        duration,
        easing,
        handOffset: handOffset ?? [...DEFAULT_HAND_OFFSET]
    });
}

/**
 * Generate push animation frames (convenience function).
 * 
 * @param objectImg - ImageData of the object being pushed
 * @param canvasSize - [width, height] of the canvas
 * @param startPosition - Starting position [x, y]
 * @param endPosition - Ending position [x, y]
 * @param duration - Animation duration in seconds
 * @param frameRate - Frames per second
 * @param easing - Easing function type
 * @param includeHand - Whether to include hand overlay
 * @param backgroundColor - Background color as RGBA array
 * @returns Promise resolving to array of animation frames
 */
export async function generatePushFrames(
    objectImg: ImageData,
    canvasSize: [number, number],
    startPosition: [number, number],
    endPosition: [number, number],
    duration: number = 2.0,
    frameRate: number = 30,
    easing: string = 'ease_out',
    includeHand: boolean = true,
    backgroundColor: [number, number, number, number] = [255, 255, 255, 255]
): Promise<ImageData[]> {
    const pushAnim = createPushAnimation(
        startPosition,
        endPosition,
        duration,
        easing
    );

    return pushAnim.generateFrames(
        objectImg,
        canvasSize,
        frameRate,
        backgroundColor,
        includeHand
    );
}

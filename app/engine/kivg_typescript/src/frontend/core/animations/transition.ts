/**
 * Transition Module for Kivg Core
 * 
 * Provides transition effects for slides and scenes in doodle animations.
 * 
 * Features:
 * - Scene transition effects (fade, wipe, push, iris, etc.)
 * - Transition eraser animation (erase scene before transition)
 * - Easing functions for smooth transitions
 * - Configurable transition duration and styles
 * 
 * Usage:
 *     import { SceneTransition, createTransition, TransitionType } from './core/transition';
 *     
 *     const transition = new SceneTransition({ type: 'fade', duration: 0.7 });
 *     const frames = transition.generateFrames(frame1, frame2, 30);
 */

import { AnimationTransition } from '../logic/easing';

/**
 * Available transition types.
 */
export const TransitionType = {
    NONE: 'none',
    FADE: 'fade',
    WIPE: 'wipe',
    WIPE_LEFT: 'wipe_left',
    WIPE_RIGHT: 'wipe_right',
    WIPE_UP: 'wipe_up',
    WIPE_DOWN: 'wipe_down',
    PUSH_LEFT: 'push_left',
    PUSH_RIGHT: 'push_right',
    PUSH_UP: 'push_up',
    PUSH_DOWN: 'push_down',
    SLIDE_LEFT: 'slide_left',
    SLIDE_RIGHT: 'slide_right',
    SLIDE_UP: 'slide_up',
    SLIDE_DOWN: 'slide_down',
    SLIDE_TOP: 'slide_top',
    SLIDE_BOTTOM: 'slide_bottom',
    IRIS: 'iris',
    FADE_TO_BLACK: 'fade_to_black',
    FADE_TO_WHITE: 'fade_to_white',
    ERASE_BOARD: 'erase_board',
    ERASE_SCENE: 'erase_scene',
    ERASER: 'eraser',
    PAN: 'pan',
    ZOOM: 'zoom',
    ZOOM_OUT_IN: 'zoom_out_in',
    REVEAL: 'reveal',
    SLIDE: 'slide',
    CROSSFADE_BLUR: 'crossfade_blur',
    DISSOLVE: 'dissolve',
    MORPH: 'morph',
    BOX_IN: 'box_in',
    BOX_OUT: 'box_out',
    DIAGONAL_WIPE: 'diagonal_wipe',
    ROTATE: 'rotate',
    ROTATE_TRANSITION: 'rotate_transition',
    SPIN_TRANSITION: 'spin_transition',
    CLOCK_WIPE: 'clock_wipe',
    RADIAL_WIPE: 'radial_wipe',
    BOUNCE: 'bounce',
    BOUNCE_TRANSITION: 'bounce_transition',
    FLIP: 'flip',
    FLIP_TRANSITION: 'flip_transition',
    // Additional transitions from Python implementation
    SWING_TRANSITION: 'swing_transition',
    RUBBER_BAND: 'rubber_band',
    JACK_IN_BOX: 'jack_in_box',
    LIGHTSPEED_TRANSITION: 'lightspeed_transition',
    ROLL_TRANSITION: 'roll_transition',
    ROTATE_IN_OUT: 'rotate_in_out',
    SCENE_SLIDE: 'scene_slide'
} as const;

export type TransitionTypeValue = typeof TransitionType[keyof typeof TransitionType];

/**
 * Transition direction constants.
 */
export const TransitionDirection = {
    LEFT_TO_RIGHT: 'left_to_right',
    RIGHT_TO_LEFT: 'right_to_left',
    TOP_TO_BOTTOM: 'top_to_bottom',
    BOTTOM_TO_TOP: 'bottom_to_top',
    CENTER_OUT: 'center_out',
    EDGES_IN: 'edges_in'
} as const;

export type TransitionDirectionValue = typeof TransitionDirection[keyof typeof TransitionDirection];

/**
 * Transition easing types.
 */
export const TransitionEasing = {
    LINEAR: 'linear',
    EASE_IN: 'ease_in',
    EASE_OUT: 'ease_out',
    EASE_IN_OUT: 'ease_in_out',
    BOUNCE: 'bounce',
    ELASTIC: 'elastic'
} as const;

export type TransitionEasingValue = typeof TransitionEasing[keyof typeof TransitionEasing];

/**
 * Apply easing function to progress value.
 */
export function applyEasing(progress: number, easing: string): number {
    if (easing === 'linear' || easing === TransitionEasing.LINEAR) {
        return AnimationTransition.linear(progress);
    }
    if (easing === 'ease_in' || easing === TransitionEasing.EASE_IN) {
        return AnimationTransition.inQuad(progress);
    }
    if (easing === 'ease_out' || easing === TransitionEasing.EASE_OUT) {
        return AnimationTransition.outQuad(progress);
    }
    if (easing === 'ease_in_out' || easing === TransitionEasing.EASE_IN_OUT) {
        return AnimationTransition.inOutQuad(progress);
    }
    if (easing === 'bounce' || easing === TransitionEasing.BOUNCE) {
        const bounceProgress = AnimationTransition.inOutQuad(progress);
        return bounceProgress + 0.1 * Math.sin(bounceProgress * Math.PI * 4);
    }
    if (easing === 'elastic' || easing === TransitionEasing.ELASTIC) {
        return AnimationTransition.outElastic(progress);
    }
    return progress;
}

/**
 * Configuration for scene transition.
 */
export interface TransitionConfig {
    type?: TransitionTypeValue;
    duration?: number;
    easing?: string;
    eraserConfig?: EraserTransitionConfig;
}

/**
 * Configuration for eraser transition.
 */
export interface EraserTransitionConfig {
    pattern?: string;
    direction?: string;
    backgroundColor?: [number, number, number];
    rows?: number;
}

/**
 * Scene transition manager for creating transitions between scenes.
 */
export class SceneTransition {
    transitionType: TransitionTypeValue;
    duration: number;
    easing: string;
    eraserConfig: EraserTransitionConfig | null;

    constructor(config: TransitionConfig = {}) {
        this.transitionType = config.type ?? TransitionType.FADE;
        this.duration = config.duration ?? 0.7;
        this.easing = config.easing ?? 'ease_out';
        this.eraserConfig = config.eraserConfig ?? null;
    }

    /**
     * Generate transition frames between two frames.
     */
    generateFrames(
        frame1: ImageData,
        frame2: ImageData,
        numFrames: number
    ): ImageData[] {
        if (this.transitionType === TransitionType.NONE || numFrames === 0) {
            return [];
        }

        // Ensure frames have same dimensions
        const width = frame1.width;
        const height = frame1.height;

        let resizedFrame2 = frame2;
        if (frame2.width !== width || frame2.height !== height) {
            resizedFrame2 = this._resizeImageData(frame2, width, height);
        }

        // Generate frames based on transition type
        switch (this.transitionType) {
            case TransitionType.FADE:
                return this._generateFade(frame1, resizedFrame2, numFrames);

            case TransitionType.WIPE:
            case TransitionType.WIPE_RIGHT:
                return this._generateWipe(frame1, resizedFrame2, numFrames, 'right');

            case TransitionType.WIPE_LEFT:
                return this._generateWipe(frame1, resizedFrame2, numFrames, 'left');

            case TransitionType.WIPE_DOWN:
                return this._generateWipe(frame1, resizedFrame2, numFrames, 'down');

            case TransitionType.WIPE_UP:
                return this._generateWipe(frame1, resizedFrame2, numFrames, 'up');

            case TransitionType.PUSH_LEFT:
            case TransitionType.SLIDE_LEFT:
                return this._generatePush(frame1, resizedFrame2, numFrames, 'left');

            case TransitionType.PUSH_RIGHT:
            case TransitionType.SLIDE_RIGHT:
                return this._generatePush(frame1, resizedFrame2, numFrames, 'right');

            case TransitionType.PUSH_UP:
            case TransitionType.SLIDE_UP:
            case TransitionType.SLIDE_TOP:
                return this._generatePush(frame1, resizedFrame2, numFrames, 'up');

            case TransitionType.PUSH_DOWN:
            case TransitionType.SLIDE_DOWN:
            case TransitionType.SLIDE_BOTTOM:
                return this._generatePush(frame1, resizedFrame2, numFrames, 'down');

            case TransitionType.IRIS:
                return this._generateIris(frame1, resizedFrame2, numFrames);

            case TransitionType.FADE_TO_BLACK:
                return this._generateFadeThrough(frame1, resizedFrame2, numFrames, [0, 0, 0]);

            case TransitionType.FADE_TO_WHITE:
                return this._generateFadeThrough(frame1, resizedFrame2, numFrames, [255, 255, 255]);

            case TransitionType.DIAGONAL_WIPE:
                return this._generateDiagonalWipe(frame1, resizedFrame2, numFrames);

            case TransitionType.CLOCK_WIPE:
            case TransitionType.RADIAL_WIPE:
                return this._generateClockWipe(frame1, resizedFrame2, numFrames);

            case TransitionType.DISSOLVE:
            case TransitionType.MORPH:
                return this._generateDissolve(frame1, resizedFrame2, numFrames);

            case TransitionType.CROSSFADE_BLUR:
                return this._generateCrossfadeBlur(frame1, resizedFrame2, numFrames);

            case TransitionType.FLIP:
            case TransitionType.FLIP_TRANSITION:
                return this._generateFlip(frame1, resizedFrame2, numFrames);

            case TransitionType.BOUNCE:
            case TransitionType.BOUNCE_TRANSITION:
                return this._generateBounce(frame1, resizedFrame2, numFrames);

            case TransitionType.ROTATE:
            case TransitionType.ROTATE_TRANSITION:
            case TransitionType.SPIN_TRANSITION:
            case TransitionType.ROTATE_IN_OUT:
                return this._generateRotate(frame1, resizedFrame2, numFrames);

            case TransitionType.SWING_TRANSITION:
                return this._generateSwing(frame1, resizedFrame2, numFrames);

            case TransitionType.RUBBER_BAND:
                return this._generateRubberBand(frame1, resizedFrame2, numFrames);

            case TransitionType.JACK_IN_BOX:
                return this._generateJackInBox(frame1, resizedFrame2, numFrames);

            case TransitionType.LIGHTSPEED_TRANSITION:
                return this._generateLightSpeed(frame1, resizedFrame2, numFrames);

            case TransitionType.ROLL_TRANSITION:
                return this._generateRoll(frame1, resizedFrame2, numFrames);

            // SCENE_SLIDE and SLIDE are aliases for the same slide transition effect
            // Both push the old scene out to the left while bringing the new scene in from the right
            case TransitionType.SCENE_SLIDE:
            case TransitionType.SLIDE:
                return this._generateSlide(frame1, resizedFrame2, numFrames);

            default:
                return this._generateFade(frame1, resizedFrame2, numFrames);
        }
    }

    private _resizeImageData(imageData: ImageData, width: number, height: number): ImageData {
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return imageData;

        ctx.putImageData(imageData, 0, 0);

        const resizedCanvas = document.createElement('canvas');
        resizedCanvas.width = width;
        resizedCanvas.height = height;
        const resizedCtx = resizedCanvas.getContext('2d');
        if (!resizedCtx) return imageData;

        resizedCtx.drawImage(canvas, 0, 0, width, height);
        return resizedCtx.getImageData(0, 0, width, height);
    }

    private _blendFrames(
        frame1: ImageData,
        frame2: ImageData,
        alpha: number
    ): ImageData {
        const result = new ImageData(frame1.width, frame1.height);
        const beta = 1 - alpha;

        for (let i = 0; i < result.data.length; i += 4) {
            result.data[i] = Math.round(frame1.data[i] * beta + frame2.data[i] * alpha);
            result.data[i + 1] = Math.round(frame1.data[i + 1] * beta + frame2.data[i + 1] * alpha);
            result.data[i + 2] = Math.round(frame1.data[i + 2] * beta + frame2.data[i + 2] * alpha);
            result.data[i + 3] = 255;
        }

        return result;
    }

    private _generateFade(
        frame1: ImageData,
        frame2: ImageData,
        numFrames: number
    ): ImageData[] {
        const frames: ImageData[] = [];

        for (let i = 0; i < numFrames; i++) {
            const progress = (i + 1) / (numFrames + 1);
            const easedProgress = applyEasing(progress, this.easing);
            frames.push(this._blendFrames(frame1, frame2, easedProgress));
        }

        return frames;
    }

    private _generateWipe(
        frame1: ImageData,
        frame2: ImageData,
        numFrames: number,
        direction: string
    ): ImageData[] {
        const frames: ImageData[] = [];
        const { width, height } = frame1;

        for (let i = 0; i < numFrames; i++) {
            const progress = (i + 1) / (numFrames + 1);
            const easedProgress = applyEasing(progress, this.easing);

            const result = new ImageData(width, height);
            result.data.set(frame1.data);

            if (direction === 'right') {
                const split = Math.floor(width * easedProgress);
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < split; x++) {
                        const idx = (y * width + x) * 4;
                        result.data[idx] = frame2.data[idx];
                        result.data[idx + 1] = frame2.data[idx + 1];
                        result.data[idx + 2] = frame2.data[idx + 2];
                        result.data[idx + 3] = frame2.data[idx + 3];
                    }
                }
            } else if (direction === 'left') {
                const split = Math.floor(width * (1 - easedProgress));
                for (let y = 0; y < height; y++) {
                    for (let x = split; x < width; x++) {
                        const idx = (y * width + x) * 4;
                        result.data[idx] = frame2.data[idx];
                        result.data[idx + 1] = frame2.data[idx + 1];
                        result.data[idx + 2] = frame2.data[idx + 2];
                        result.data[idx + 3] = frame2.data[idx + 3];
                    }
                }
            } else if (direction === 'down') {
                const split = Math.floor(height * easedProgress);
                for (let y = 0; y < split; y++) {
                    for (let x = 0; x < width; x++) {
                        const idx = (y * width + x) * 4;
                        result.data[idx] = frame2.data[idx];
                        result.data[idx + 1] = frame2.data[idx + 1];
                        result.data[idx + 2] = frame2.data[idx + 2];
                        result.data[idx + 3] = frame2.data[idx + 3];
                    }
                }
            } else { // up
                const split = Math.floor(height * (1 - easedProgress));
                for (let y = split; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const idx = (y * width + x) * 4;
                        result.data[idx] = frame2.data[idx];
                        result.data[idx + 1] = frame2.data[idx + 1];
                        result.data[idx + 2] = frame2.data[idx + 2];
                        result.data[idx + 3] = frame2.data[idx + 3];
                    }
                }
            }

            frames.push(result);
        }

        return frames;
    }

    private _generatePush(
        frame1: ImageData,
        frame2: ImageData,
        numFrames: number,
        direction: string
    ): ImageData[] {
        const frames: ImageData[] = [];
        const { width, height } = frame1;

        // Create canvases for manipulation
        const canvas1 = document.createElement('canvas');
        canvas1.width = width;
        canvas1.height = height;
        const ctx1 = canvas1.getContext('2d');

        const canvas2 = document.createElement('canvas');
        canvas2.width = width;
        canvas2.height = height;
        const ctx2 = canvas2.getContext('2d');

        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = width;
        resultCanvas.height = height;
        const resultCtx = resultCanvas.getContext('2d');

        if (!ctx1 || !ctx2 || !resultCtx) {
            return this._generateFade(frame1, frame2, numFrames);
        }

        ctx1.putImageData(frame1, 0, 0);
        ctx2.putImageData(frame2, 0, 0);

        for (let i = 0; i < numFrames; i++) {
            const progress = (i + 1) / (numFrames + 1);
            const easedProgress = applyEasing(progress, this.easing);

            resultCtx.fillStyle = 'white';
            resultCtx.fillRect(0, 0, width, height);

            if (direction === 'left') {
                const offset = Math.floor(width * easedProgress);
                resultCtx.drawImage(canvas1, -offset, 0);
                resultCtx.drawImage(canvas2, width - offset, 0);
            } else if (direction === 'right') {
                const offset = Math.floor(width * easedProgress);
                resultCtx.drawImage(canvas1, offset, 0);
                resultCtx.drawImage(canvas2, offset - width, 0);
            } else if (direction === 'up') {
                const offset = Math.floor(height * easedProgress);
                resultCtx.drawImage(canvas1, 0, -offset);
                resultCtx.drawImage(canvas2, 0, height - offset);
            } else { // down
                const offset = Math.floor(height * easedProgress);
                resultCtx.drawImage(canvas1, 0, offset);
                resultCtx.drawImage(canvas2, 0, offset - height);
            }

            frames.push(resultCtx.getImageData(0, 0, width, height));
        }

        return frames;
    }

    private _generateIris(
        frame1: ImageData,
        frame2: ImageData,
        numFrames: number
    ): ImageData[] {
        const frames: ImageData[] = [];
        const { width, height } = frame1;
        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.sqrt(width * width + height * height) / 2;

        for (let i = 0; i < numFrames; i++) {
            const progress = (i + 1) / (numFrames + 1);
            const easedProgress = applyEasing(progress, this.easing);
            const radius = maxRadius * easedProgress;

            const result = new ImageData(width, height);

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const dist = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
                    const idx = (y * width + x) * 4;

                    if (dist <= radius) {
                        result.data[idx] = frame2.data[idx];
                        result.data[idx + 1] = frame2.data[idx + 1];
                        result.data[idx + 2] = frame2.data[idx + 2];
                        result.data[idx + 3] = frame2.data[idx + 3];
                    } else {
                        result.data[idx] = frame1.data[idx];
                        result.data[idx + 1] = frame1.data[idx + 1];
                        result.data[idx + 2] = frame1.data[idx + 2];
                        result.data[idx + 3] = frame1.data[idx + 3];
                    }
                }
            }

            frames.push(result);
        }

        return frames;
    }

    private _generateFadeThrough(
        frame1: ImageData,
        frame2: ImageData,
        numFrames: number,
        color: [number, number, number]
    ): ImageData[] {
        const frames: ImageData[] = [];

        // Create color frame
        const colorFrame = new ImageData(frame1.width, frame1.height);
        for (let i = 0; i < colorFrame.data.length; i += 4) {
            colorFrame.data[i] = color[0];
            colorFrame.data[i + 1] = color[1];
            colorFrame.data[i + 2] = color[2];
            colorFrame.data[i + 3] = 255;
        }

        for (let i = 0; i < numFrames; i++) {
            const progress = (i + 1) / (numFrames + 1);

            if (progress < 0.5) {
                // Fade to color
                const alpha = progress * 2;
                frames.push(this._blendFrames(frame1, colorFrame, alpha));
            } else {
                // Fade from color
                const alpha = (progress - 0.5) * 2;
                frames.push(this._blendFrames(colorFrame, frame2, alpha));
            }
        }

        return frames;
    }

    private _generateDiagonalWipe(
        frame1: ImageData,
        frame2: ImageData,
        numFrames: number
    ): ImageData[] {
        const frames: ImageData[] = [];
        const { width, height } = frame1;
        const maxDiagonal = width + height;

        for (let i = 0; i < numFrames; i++) {
            const progress = (i + 1) / (numFrames + 1);
            const easedProgress = applyEasing(progress, this.easing);
            const threshold = maxDiagonal * easedProgress;

            const result = new ImageData(width, height);

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    const diagonal = x + y;

                    if (diagonal < threshold) {
                        result.data[idx] = frame2.data[idx];
                        result.data[idx + 1] = frame2.data[idx + 1];
                        result.data[idx + 2] = frame2.data[idx + 2];
                        result.data[idx + 3] = frame2.data[idx + 3];
                    } else {
                        result.data[idx] = frame1.data[idx];
                        result.data[idx + 1] = frame1.data[idx + 1];
                        result.data[idx + 2] = frame1.data[idx + 2];
                        result.data[idx + 3] = frame1.data[idx + 3];
                    }
                }
            }

            frames.push(result);
        }

        return frames;
    }

    private _generateClockWipe(
        frame1: ImageData,
        frame2: ImageData,
        numFrames: number
    ): ImageData[] {
        const frames: ImageData[] = [];
        const { width, height } = frame1;
        const centerX = width / 2;
        const centerY = height / 2;

        for (let i = 0; i < numFrames; i++) {
            const progress = (i + 1) / (numFrames + 1);
            const easedProgress = applyEasing(progress, this.easing);
            const angleEnd = 360 * easedProgress;

            const result = new ImageData(width, height);

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const dx = x - centerX;
                    const dy = y - centerY;
                    let angle = (Math.atan2(dy, dx) * 180 / Math.PI + 90) % 360;
                    if (angle < 0) angle += 360;

                    const idx = (y * width + x) * 4;

                    if (angle < angleEnd) {
                        result.data[idx] = frame2.data[idx];
                        result.data[idx + 1] = frame2.data[idx + 1];
                        result.data[idx + 2] = frame2.data[idx + 2];
                        result.data[idx + 3] = frame2.data[idx + 3];
                    } else {
                        result.data[idx] = frame1.data[idx];
                        result.data[idx + 1] = frame1.data[idx + 1];
                        result.data[idx + 2] = frame1.data[idx + 2];
                        result.data[idx + 3] = frame1.data[idx + 3];
                    }
                }
            }

            frames.push(result);
        }

        return frames;
    }

    private _generateDissolve(
        frame1: ImageData,
        frame2: ImageData,
        numFrames: number
    ): ImageData[] {
        const frames: ImageData[] = [];
        const { width, height } = frame1;

        // Create canvas for resizing
        const canvas1 = document.createElement('canvas');
        canvas1.width = width;
        canvas1.height = height;
        const ctx1 = canvas1.getContext('2d');

        const canvas2 = document.createElement('canvas');
        canvas2.width = width;
        canvas2.height = height;
        const ctx2 = canvas2.getContext('2d');

        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = width;
        resultCanvas.height = height;
        const resultCtx = resultCanvas.getContext('2d');

        if (!ctx1 || !ctx2 || !resultCtx) {
            return this._generateFade(frame1, frame2, numFrames);
        }

        ctx1.putImageData(frame1, 0, 0);
        ctx2.putImageData(frame2, 0, 0);

        for (let i = 0; i < numFrames; i++) {
            const progress = (i + 1) / (numFrames + 1);
            const easedProgress = applyEasing(progress, this.easing);

            // Slight zoom effect on frame1
            const scale1 = 1.0 + 0.1 * easedProgress;
            // Slight zoom effect on frame2
            const scale2 = 1.1 - 0.1 * easedProgress;

            resultCtx.fillStyle = 'white';
            resultCtx.fillRect(0, 0, width, height);

            // Draw scaled frame1
            resultCtx.globalAlpha = 1 - easedProgress;
            const offset1 = ((scale1 - 1) * width) / 2;
            resultCtx.drawImage(
                canvas1,
                -offset1,
                -offset1,
                width * scale1,
                height * scale1
            );

            // Draw scaled frame2
            resultCtx.globalAlpha = easedProgress;
            const newW2 = width * scale2;
            const newH2 = height * scale2;
            const offset2X = (width - newW2) / 2;
            const offset2Y = (height - newH2) / 2;
            resultCtx.drawImage(
                canvas2,
                offset2X,
                offset2Y,
                newW2,
                newH2
            );

            resultCtx.globalAlpha = 1;
            frames.push(resultCtx.getImageData(0, 0, width, height));
        }

        return frames;
    }

    private _generateCrossfadeBlur(
        frame1: ImageData,
        frame2: ImageData,
        numFrames: number
    ): ImageData[] {
        // Note: Canvas doesn't have native Gaussian blur, so we'll use CSS filter via OffscreenCanvas if available
        // For now, we fall back to a simple fade
        // In a production environment, you would use WebGL or a library like stackblur-canvas
        return this._generateFade(frame1, frame2, numFrames);
    }

    private _generateFlip(
        frame1: ImageData,
        frame2: ImageData,
        numFrames: number
    ): ImageData[] {
        const frames: ImageData[] = [];
        const { width, height } = frame1;

        const canvas1 = document.createElement('canvas');
        canvas1.width = width;
        canvas1.height = height;
        const ctx1 = canvas1.getContext('2d');

        const canvas2 = document.createElement('canvas');
        canvas2.width = width;
        canvas2.height = height;
        const ctx2 = canvas2.getContext('2d');

        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = width;
        resultCanvas.height = height;
        const resultCtx = resultCanvas.getContext('2d');

        if (!ctx1 || !ctx2 || !resultCtx) {
            return this._generateFade(frame1, frame2, numFrames);
        }

        ctx1.putImageData(frame1, 0, 0);
        ctx2.putImageData(frame2, 0, 0);

        for (let i = 0; i < numFrames; i++) {
            const progress = (i + 1) / (numFrames + 1);

            resultCtx.fillStyle = 'white';
            resultCtx.fillRect(0, 0, width, height);

            if (progress < 0.5) {
                // Flip frame1 out
                const localProgress = progress * 2;
                const scaleX = 1.0 - localProgress;
                const newW = Math.max(1, Math.floor(width * scaleX));
                const offsetX = (width - newW) / 2;

                resultCtx.drawImage(canvas1, offsetX, 0, newW, height);
            } else {
                // Flip frame2 in
                const localProgress = (progress - 0.5) * 2;
                const scaleX = localProgress;
                const newW = Math.max(1, Math.floor(width * scaleX));
                const offsetX = (width - newW) / 2;

                resultCtx.drawImage(canvas2, offsetX, 0, newW, height);
            }

            frames.push(resultCtx.getImageData(0, 0, width, height));
        }

        return frames;
    }

    private _generateBounce(
        frame1: ImageData,
        frame2: ImageData,
        numFrames: number
    ): ImageData[] {
        const frames: ImageData[] = [];

        for (let i = 0; i < numFrames; i++) {
            const progress = (i + 1) / (numFrames + 1);
            const bounceProgress = applyEasing(progress, 'bounce');
            const clampedProgress = Math.max(0, Math.min(1, bounceProgress));

            frames.push(this._blendFrames(frame1, frame2, clampedProgress));
        }

        return frames;
    }

    private _generateRotate(
        frame1: ImageData,
        frame2: ImageData,
        numFrames: number
    ): ImageData[] {
        const frames: ImageData[] = [];
        const { width, height } = frame1;

        const canvas1 = document.createElement('canvas');
        canvas1.width = width;
        canvas1.height = height;
        const ctx1 = canvas1.getContext('2d');

        const canvas2 = document.createElement('canvas');
        canvas2.width = width;
        canvas2.height = height;
        const ctx2 = canvas2.getContext('2d');

        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = width;
        resultCanvas.height = height;
        const resultCtx = resultCanvas.getContext('2d');

        if (!ctx1 || !ctx2 || !resultCtx) {
            return this._generateFade(frame1, frame2, numFrames);
        }

        ctx1.putImageData(frame1, 0, 0);
        ctx2.putImageData(frame2, 0, 0);

        for (let i = 0; i < numFrames; i++) {
            const progress = (i + 1) / (numFrames + 1);
            const easedProgress = applyEasing(progress, this.easing);

            resultCtx.fillStyle = 'white';
            resultCtx.fillRect(0, 0, width, height);

            if (easedProgress < 0.5) {
                // Rotate frame1 out
                const localProgress = easedProgress * 2;
                const angle = (90 * localProgress) * Math.PI / 180;
                const scale = 1.0 - 0.5 * localProgress;

                resultCtx.save();
                resultCtx.translate(width / 2, height / 2);
                resultCtx.rotate(angle);
                resultCtx.scale(scale, scale);
                resultCtx.drawImage(canvas1, -width / 2, -height / 2);
                resultCtx.restore();
            } else {
                // Rotate frame2 in
                const localProgress = (easedProgress - 0.5) * 2;
                const angle = (-90 + 90 * localProgress) * Math.PI / 180;
                const scale = 0.5 + 0.5 * localProgress;

                resultCtx.save();
                resultCtx.translate(width / 2, height / 2);
                resultCtx.rotate(angle);
                resultCtx.scale(scale, scale);
                resultCtx.drawImage(canvas2, -width / 2, -height / 2);
                resultCtx.restore();
            }

            frames.push(resultCtx.getImageData(0, 0, width, height));
        }

        return frames;
    }

    private _generateSwing(
        frame1: ImageData,
        frame2: ImageData,
        numFrames: number
    ): ImageData[] {
        const frames: ImageData[] = [];
        const { width, height } = frame1;

        const canvas1 = document.createElement('canvas');
        canvas1.width = width;
        canvas1.height = height;
        const ctx1 = canvas1.getContext('2d');

        const canvas2 = document.createElement('canvas');
        canvas2.width = width;
        canvas2.height = height;
        const ctx2 = canvas2.getContext('2d');

        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = width;
        resultCanvas.height = height;
        const resultCtx = resultCanvas.getContext('2d');

        if (!ctx1 || !ctx2 || !resultCtx) {
            return this._generateFade(frame1, frame2, numFrames);
        }

        ctx1.putImageData(frame1, 0, 0);
        ctx2.putImageData(frame2, 0, 0);

        for (let i = 0; i < numFrames; i++) {
            const progress = (i + 1) / (numFrames + 1);

            resultCtx.fillStyle = 'white';
            resultCtx.fillRect(0, 0, width, height);

            if (progress < 0.5) {
                // Swing frame1 out
                const localProgress = progress * 2;
                const angle = (20 * Math.sin(localProgress * Math.PI * 2)) * Math.PI / 180;
                const alpha = 1 - localProgress;

                resultCtx.save();
                resultCtx.globalAlpha = alpha;
                resultCtx.translate(width / 2, 0);
                resultCtx.rotate(angle);
                resultCtx.drawImage(canvas1, -width / 2, 0);
                resultCtx.restore();
            } else {
                // Swing frame2 in
                const localProgress = (progress - 0.5) * 2;
                const angle = (20 * Math.sin((1 - localProgress) * Math.PI * 2)) * Math.PI / 180;
                const alpha = localProgress;

                resultCtx.save();
                resultCtx.globalAlpha = alpha;
                resultCtx.translate(width / 2, 0);
                resultCtx.rotate(angle);
                resultCtx.drawImage(canvas2, -width / 2, 0);
                resultCtx.restore();
            }

            frames.push(resultCtx.getImageData(0, 0, width, height));
        }

        return frames;
    }

    private _generateRubberBand(
        frame1: ImageData,
        frame2: ImageData,
        numFrames: number
    ): ImageData[] {
        const frames: ImageData[] = [];
        const { width, height } = frame1;

        const canvas1 = document.createElement('canvas');
        canvas1.width = width;
        canvas1.height = height;
        const ctx1 = canvas1.getContext('2d');

        const canvas2 = document.createElement('canvas');
        canvas2.width = width;
        canvas2.height = height;
        const ctx2 = canvas2.getContext('2d');

        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = width;
        resultCanvas.height = height;
        const resultCtx = resultCanvas.getContext('2d');

        if (!ctx1 || !ctx2 || !resultCtx) {
            return this._generateFade(frame1, frame2, numFrames);
        }

        ctx1.putImageData(frame1, 0, 0);
        ctx2.putImageData(frame2, 0, 0);

        for (let i = 0; i < numFrames; i++) {
            const progress = (i + 1) / (numFrames + 1);

            resultCtx.fillStyle = 'white';
            resultCtx.fillRect(0, 0, width, height);

            if (progress < 0.5) {
                // Stretch frame1 out
                const localProgress = progress * 2;
                const scaleX = 1.0 + 0.3 * Math.sin(localProgress * Math.PI * 2);
                const scaleY = 1.0 - 0.2 * Math.sin(localProgress * Math.PI * 2);
                const alpha = 1 - localProgress;

                resultCtx.save();
                resultCtx.globalAlpha = alpha;
                resultCtx.translate(width / 2, height / 2);
                resultCtx.scale(scaleX, scaleY);
                resultCtx.drawImage(canvas1, -width / 2, -height / 2);
                resultCtx.restore();
            } else {
                // Bounce frame2 in
                const localProgress = (progress - 0.5) * 2;
                const scaleX = 1.0 + 0.3 * Math.sin((1 - localProgress) * Math.PI * 2);
                const scaleY = 1.0 - 0.2 * Math.sin((1 - localProgress) * Math.PI * 2);
                const alpha = localProgress;

                resultCtx.save();
                resultCtx.globalAlpha = alpha;
                resultCtx.translate(width / 2, height / 2);
                resultCtx.scale(scaleX, scaleY);
                resultCtx.drawImage(canvas2, -width / 2, -height / 2);
                resultCtx.restore();
            }

            frames.push(resultCtx.getImageData(0, 0, width, height));
        }

        return frames;
    }

    private _generateJackInBox(
        frame1: ImageData,
        frame2: ImageData,
        numFrames: number
    ): ImageData[] {
        const frames: ImageData[] = [];
        const { width, height } = frame1;

        const canvas1 = document.createElement('canvas');
        canvas1.width = width;
        canvas1.height = height;
        const ctx1 = canvas1.getContext('2d');

        const canvas2 = document.createElement('canvas');
        canvas2.width = width;
        canvas2.height = height;
        const ctx2 = canvas2.getContext('2d');

        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = width;
        resultCanvas.height = height;
        const resultCtx = resultCanvas.getContext('2d');

        if (!ctx1 || !ctx2 || !resultCtx) {
            return this._generateFade(frame1, frame2, numFrames);
        }

        ctx1.putImageData(frame1, 0, 0);
        ctx2.putImageData(frame2, 0, 0);

        for (let i = 0; i < numFrames; i++) {
            const progress = (i + 1) / (numFrames + 1);

            resultCtx.fillStyle = 'white';
            resultCtx.fillRect(0, 0, width, height);

            if (progress < 0.3) {
                // Fade out frame1
                const alpha = 1 - (progress / 0.3);
                resultCtx.globalAlpha = alpha;
                resultCtx.drawImage(canvas1, 0, 0);
                resultCtx.globalAlpha = 1;
            } else {
                // Jack in box for frame2
                const localProgress = (progress - 0.3) / 0.7;
                const scale = 0.1 + 0.9 * localProgress;
                const wobble = (30 * Math.sin(localProgress * Math.PI * 4) * (1 - localProgress)) * Math.PI / 180;

                resultCtx.save();
                resultCtx.translate(width / 2, height);
                resultCtx.rotate(wobble);
                resultCtx.scale(scale, scale);
                resultCtx.drawImage(canvas2, -width / 2, -height);
                resultCtx.restore();
            }

            frames.push(resultCtx.getImageData(0, 0, width, height));
        }

        return frames;
    }

    private _generateLightSpeed(
        frame1: ImageData,
        frame2: ImageData,
        numFrames: number
    ): ImageData[] {
        const frames: ImageData[] = [];
        const { width, height } = frame1;

        const canvas1 = document.createElement('canvas');
        canvas1.width = width;
        canvas1.height = height;
        const ctx1 = canvas1.getContext('2d');

        const canvas2 = document.createElement('canvas');
        canvas2.width = width;
        canvas2.height = height;
        const ctx2 = canvas2.getContext('2d');

        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = width;
        resultCanvas.height = height;
        const resultCtx = resultCanvas.getContext('2d');

        if (!ctx1 || !ctx2 || !resultCtx) {
            return this._generateFade(frame1, frame2, numFrames);
        }

        ctx1.putImageData(frame1, 0, 0);
        ctx2.putImageData(frame2, 0, 0);

        for (let i = 0; i < numFrames; i++) {
            const progress = (i + 1) / (numFrames + 1);

            resultCtx.fillStyle = 'white';
            resultCtx.fillRect(0, 0, width, height);

            if (progress < 0.5) {
                // Light speed out for frame1
                const localProgress = progress * 2;
                const offset = Math.floor(width * localProgress);
                const skew = 0.3 * localProgress;

                resultCtx.save();
                resultCtx.transform(1, 0, skew, 1, 0, 0);
                resultCtx.globalAlpha = 1 - localProgress;
                resultCtx.drawImage(canvas1, offset, 0);
                resultCtx.restore();
            } else {
                // Light speed in for frame2
                const localProgress = (progress - 0.5) * 2;
                const offset = Math.floor(width * (1 - localProgress));
                const skew = 0.3 * (1 - localProgress);

                resultCtx.save();
                resultCtx.transform(1, 0, -skew, 1, 0, 0);
                resultCtx.globalAlpha = localProgress;
                resultCtx.drawImage(canvas2, -offset, 0);
                resultCtx.restore();
            }

            frames.push(resultCtx.getImageData(0, 0, width, height));
        }

        return frames;
    }

    private _generateRoll(
        frame1: ImageData,
        frame2: ImageData,
        numFrames: number
    ): ImageData[] {
        const frames: ImageData[] = [];
        const { width, height } = frame1;

        const canvas1 = document.createElement('canvas');
        canvas1.width = width;
        canvas1.height = height;
        const ctx1 = canvas1.getContext('2d');

        const canvas2 = document.createElement('canvas');
        canvas2.width = width;
        canvas2.height = height;
        const ctx2 = canvas2.getContext('2d');

        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = width;
        resultCanvas.height = height;
        const resultCtx = resultCanvas.getContext('2d');

        if (!ctx1 || !ctx2 || !resultCtx) {
            return this._generateFade(frame1, frame2, numFrames);
        }

        ctx1.putImageData(frame1, 0, 0);
        ctx2.putImageData(frame2, 0, 0);

        for (let i = 0; i < numFrames; i++) {
            const progress = (i + 1) / (numFrames + 1);

            resultCtx.fillStyle = 'white';
            resultCtx.fillRect(0, 0, width, height);

            if (progress < 0.5) {
                // Roll out frame1
                const localProgress = progress * 2;
                const angle = (120 * localProgress) * Math.PI / 180;
                const offset = Math.floor(width * localProgress);

                resultCtx.save();
                resultCtx.globalAlpha = 1 - localProgress;
                resultCtx.translate(width / 2, height / 2);
                resultCtx.rotate(angle);
                resultCtx.drawImage(canvas1, -width / 2 + offset, -height / 2);
                resultCtx.restore();
            } else {
                // Roll in frame2
                const localProgress = (progress - 0.5) * 2;
                const angle = (-120 * (1 - localProgress)) * Math.PI / 180;
                const offset = Math.floor(width * (1 - localProgress));

                resultCtx.save();
                resultCtx.globalAlpha = localProgress;
                resultCtx.translate(width / 2, height / 2);
                resultCtx.rotate(angle);
                resultCtx.drawImage(canvas2, -width / 2 - offset, -height / 2);
                resultCtx.restore();
            }

            frames.push(resultCtx.getImageData(0, 0, width, height));
        }

        return frames;
    }

    private _generateSlide(
        frame1: ImageData,
        frame2: ImageData,
        numFrames: number
    ): ImageData[] {
        const frames: ImageData[] = [];
        const { width, height } = frame1;

        const canvas1 = document.createElement('canvas');
        canvas1.width = width;
        canvas1.height = height;
        const ctx1 = canvas1.getContext('2d');

        const canvas2 = document.createElement('canvas');
        canvas2.width = width;
        canvas2.height = height;
        const ctx2 = canvas2.getContext('2d');

        const resultCanvas = document.createElement('canvas');
        resultCanvas.width = width;
        resultCanvas.height = height;
        const resultCtx = resultCanvas.getContext('2d');

        if (!ctx1 || !ctx2 || !resultCtx) {
            return this._generateFade(frame1, frame2, numFrames);
        }

        ctx1.putImageData(frame1, 0, 0);
        ctx2.putImageData(frame2, 0, 0);

        for (let i = 0; i < numFrames; i++) {
            const progress = (i + 1) / (numFrames + 1);
            const easedProgress = applyEasing(progress, this.easing);
            const offset = Math.floor(width * easedProgress);

            resultCtx.fillStyle = 'white';
            resultCtx.fillRect(0, 0, width, height);

            // frame1 slides out to left
            resultCtx.drawImage(canvas1, -offset, 0);

            // frame2 slides in from right
            resultCtx.drawImage(canvas2, width - offset, 0);

            frames.push(resultCtx.getImageData(0, 0, width, height));
        }

        return frames;
    }
}

/**
 * Generate transition configuration dictionary.
 */
export function generateTransitionConfig(
    transitionType: TransitionTypeValue = TransitionType.FADE,
    duration: number = 0.7,
    easing: string = 'ease_out',
    eraserEnabled: boolean = false,
    eraserPattern: string = 'zigzag',
    backgroundColor: [number, number, number] = [255, 255, 255]
): TransitionConfig {
    const config: TransitionConfig = {
        type: transitionType,
        duration,
        easing
    };

    if (eraserEnabled) {
        config.eraserConfig = {
            pattern: eraserPattern,
            backgroundColor
        };
    }

    return config;
}

/**
 * Create a SceneTransition instance with configuration.
 */
export function createTransition(
    transitionType: TransitionTypeValue = TransitionType.FADE,
    duration: number = 0.7,
    easing: string = 'ease_out',
    eraserConfig?: EraserTransitionConfig
): SceneTransition {
    return new SceneTransition({
        type: transitionType,
        duration,
        easing,
        eraserConfig
    });
}

/**
 * Generate fade transition frames (convenience function).
 */
export function generateFadeTransition(
    frame1: ImageData,
    frame2: ImageData,
    numFrames: number,
    easing: string = 'ease_out'
): ImageData[] {
    const transition = new SceneTransition({
        type: TransitionType.FADE,
        easing
    });
    return transition.generateFrames(frame1, frame2, numFrames);
}

/**
 * Generate wipe transition frames (convenience function).
 */
export function generateWipeTransition(
    frame1: ImageData,
    frame2: ImageData,
    numFrames: number,
    direction: 'left' | 'right' | 'up' | 'down' = 'right',
    easing: string = 'ease_out'
): ImageData[] {
    const typeMap = {
        left: TransitionType.WIPE_LEFT,
        right: TransitionType.WIPE_RIGHT,
        up: TransitionType.WIPE_UP,
        down: TransitionType.WIPE_DOWN
    };

    const transition = new SceneTransition({
        type: typeMap[direction],
        easing
    });
    return transition.generateFrames(frame1, frame2, numFrames);
}

/**
 * Generate push transition frames (convenience function).
 */
export function generatePushTransition(
    frame1: ImageData,
    frame2: ImageData,
    numFrames: number,
    direction: 'left' | 'right' | 'up' | 'down' = 'left',
    easing: string = 'ease_out'
): ImageData[] {
    const typeMap = {
        left: TransitionType.PUSH_LEFT,
        right: TransitionType.PUSH_RIGHT,
        up: TransitionType.PUSH_UP,
        down: TransitionType.PUSH_DOWN
    };

    const transition = new SceneTransition({
        type: typeMap[direction],
        easing
    });
    return transition.generateFrames(frame1, frame2, numFrames);
}

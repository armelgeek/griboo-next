/**
 * Exit Animation Module for Kivg Core
 * 
 * Provides exit animation effects for layers in doodle animations.
 * Synchronized with the Python implementation in griboo-engine.py.
 * 
 * Features:
 * - Fade animations (fade_out, fadeOut)
 * - Slide animations (slide_out_left, slide_out_right, slide_out_top, slide_out_bottom)
 * - Zoom animations (zoom_out)
 * - Bounce animations (bounce_out, bounceOutDown, bounceOutUp, etc.)
 * - Rotate animations (rotate_out, spin_out)
 * - Flip animations (flip_out_x, flip_out_y)
 * - Blur animations (blur_out, focus_out)
 * - Elastic animations (elastic_out)
 * - Scale animations (scale_out, scale_down)
 * 
 * Usage:
 *     import { applyExitAnimation, ExitAnimationType } from './core/exit_animation';
 *     
 *     const animatedFrame = applyExitAnimation(frame, {
 *         type: 'fade_out',
 *         duration: 0.8
 *     }, frameIndex, totalFrames, fps);
 */

import { AnimationTransition } from '../logic/easing';

/**
 * Available exit animation types.
 */
export const ExitAnimationType = {
    // Basic animations
    NONE: 'none',
    FADE_OUT: 'fade_out',
    FADEOUT: 'fadeOut',

    // Slide animations
    SLIDE_OUT_LEFT: 'slide_out_left',
    SLIDE_OUT_RIGHT: 'slide_out_right',
    SLIDE_OUT_TOP: 'slide_out_top',
    SLIDE_OUT_BOTTOM: 'slide_out_bottom',

    // Zoom animations
    ZOOM_OUT: 'zoom_out',

    // Bounce animations
    BOUNCE_OUT: 'bounce_out',
    BOUNCE_OUT_DOWN: 'bounceOutDown',
    BOUNCE_OUT_UP: 'bounceOutUp',
    BOUNCE_OUT_LEFT: 'bounceOutLeft',
    BOUNCE_OUT_RIGHT: 'bounceOutRight',

    // Rotate/Spin animations
    ROTATE_OUT: 'rotate_out',
    SPIN_OUT: 'spin_out',

    // Flip animations
    FLIP_OUT_X: 'flip_out_x',
    FLIP_OUT_HORIZONTAL: 'flip_out_horizontal',
    FLIP_OUT_Y: 'flip_out_y',
    FLIP_OUT_VERTICAL: 'flip_out_vertical',

    // Scale animations
    SCALE_OUT: 'scale_out',
    SCALE_DOWN: 'scale_down',

    // Blur/Focus
    BLUR_OUT: 'blur_out',
    FOCUS_OUT: 'focus_out',

    // Elastic
    ELASTIC_OUT: 'elastic_out',

    // Fade variants from Animate.css
    FADEOUTDOWN: 'fadeOutDown',
    FADEOUTLEFT: 'fadeOutLeft',
    FADEOUTRIGHT: 'fadeOutRight',
    FADEOUTUP: 'fadeOutUp',

    // Zoom variants from Animate.css
    ZOOMOUTDOWN: 'zoomOutDown',
    ZOOMOUTLEFT: 'zoomOutLeft',
    ZOOMOUTRIGHT: 'zoomOutRight',
    ZOOMOUTUP: 'zoomOutUp',

    // LightSpeed
    LIGHTSPEEDOUTLEFT: 'lightSpeedOutLeft',
    LIGHTSPEEDOUTRIGHT: 'lightSpeedOutRight',

    // Roll
    ROLLOUT: 'rollOut',

    // Eraser (special exit)
    ERASER: 'eraser',

    // Back exits (animate.css)
    BACKOUTDOWN: 'backOutDown',
    BACKOUTLEFT: 'backOutLeft',
    BACKOUTRIGHT: 'backOutRight',
    BACKOUTUP: 'backOutUp',

    // Additional fade variants
    FADEOUTDOWNBIG: 'fadeOutDownBig',
    FADEOUTLEFTBIG: 'fadeOutLeftBig',
    FADEOUTRIGHTBIG: 'fadeOutRightBig',
    FADEOUTUPBIG: 'fadeOutUpBig',
    FADEOUTTOPLEFT: 'fadeOutTopLeft',
    FADEOUTTOPRIGHT: 'fadeOutTopRight',
    FADEOUTBOTTOMLEFT: 'fadeOutBottomLeft',
    FADEOUTBOTTOMRIGHT: 'fadeOutBottomRight',

    // Flip variants (animate.css)
    FLIPOUTX: 'flipOutX',
    FLIPOUTY: 'flipOutY',

    // Rotate variants
    ROTATEOUT: 'rotateOut',
    ROTATEOUTDOWNLEFT: 'rotateOutDownLeft',
    ROTATEOUTDOWNRIGHT: 'rotateOutDownRight',
    ROTATEOUTUPLEFT: 'rotateOutUpLeft',
    ROTATEOUTUPRIGHT: 'rotateOutUpRight',

    // Slide variants (animate.css naming)
    SLIDEOUTDOWN: 'slideOutDown',
    SLIDEOUTLEFT: 'slideOutLeft',
    SLIDEOUTRIGHT: 'slideOutRight',
    SLIDEOUTUP: 'slideOutUp',

    // Zoom variants
    ZOOMOUT: 'zoomOut',

    // Hinge (special)
    HINGE: 'hinge'
} as const;

export type ExitAnimationTypeValue = typeof ExitAnimationType[keyof typeof ExitAnimationType];

/**
 * Exit animation configuration.
 */
export interface ExitAnimationConfig {
    type: ExitAnimationTypeValue | string;
    duration?: number;
    easing?: string;
}

/**
 * Apply easing function to progress value.
 */
function applyEasing(progress: number, easing: string): number {
    switch (easing) {
        case 'linear':
            return AnimationTransition.linear(progress);
        case 'ease_in':
        case 'in_quad':
            return AnimationTransition.inQuad(progress);
        case 'ease_out':
        case 'out_quad':
            return AnimationTransition.outQuad(progress);
        case 'ease_in_out':
        case 'in_out_quad':
            return AnimationTransition.inOutQuad(progress);
        case 'bounce_out':
        case 'out_bounce':
            return AnimationTransition.outBounce(progress);
        case 'bounce_in':
        case 'in_bounce':
            return AnimationTransition.inBounce(progress);
        case 'elastic_out':
        case 'out_elastic':
            return AnimationTransition.outElastic(progress);
        case 'elastic_in':
        case 'in_elastic':
            return AnimationTransition.inElastic(progress);
        default:
            return AnimationTransition.inOutQuad(progress);
    }
}

/**
 * Create a white ImageData of the same size.
 */
function createWhiteFrame(width: number, height: number): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = 255;     // R
        data[i + 1] = 255; // G
        data[i + 2] = 255; // B
        data[i + 3] = 255; // A
    }
    return new ImageData(data, width, height);
}

/**
 * Blend two frames with alpha value.
 */
function blendFrames(frame1: ImageData, frame2: ImageData, alpha: number): ImageData {
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

/**
 * Apply exit animation to a frame.
 * 
 * @param frame - The frame to animate (ImageData)
 * @param animationConfig - Animation configuration
 * @param frameIndex - Current frame index in the animation (from start of exit)
 * @param totalFrames - Total number of frames in the exit animation
 * @param frameRate - Frame rate of the video
 * @returns Animated frame as ImageData
 */
export function applyExitAnimation(
    frame: ImageData,
    animationConfig: ExitAnimationConfig,
    frameIndex: number,
    _totalFrames: number,
    frameRate: number
): ImageData {
    if (!animationConfig || animationConfig.type === 'none') {
        return frame;
    }

    const animType = animationConfig.type || 'fade_out';
    const duration = animationConfig.duration ?? 0.8;
    const animFrames = Math.floor(duration * frameRate);

    if (frameIndex >= animFrames) {
        // Animation complete, return white frame
        return createWhiteFrame(frame.width, frame.height);
    }

    const { width, height } = frame;
    const rawProgress = frameIndex / animFrames;
    const progress = applyEasing(rawProgress, 'ease_in_out');

    // Create canvas for manipulation
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return frame;

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = width;
    srcCanvas.height = height;
    const srcCtx = srcCanvas.getContext('2d');
    if (!srcCtx) return frame;
    srcCtx.putImageData(frame, 0, 0);

    // Handle different animation types
    switch (animType) {
        case 'fade_out':
        case 'fadeOut': {
            const white = createWhiteFrame(width, height);
            return blendFrames(frame, white, progress);
        }

        case 'slide_out_left': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(width * progress);
            ctx.drawImage(srcCanvas, -offset, 0);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'slide_out_right': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(width * progress);
            ctx.drawImage(srcCanvas, offset, 0);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'slide_out_top': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(height * progress);
            ctx.drawImage(srcCanvas, 0, -offset);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'slide_out_bottom': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(height * progress);
            ctx.drawImage(srcCanvas, 0, offset);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'zoom_out': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scale = 1.0 + 0.5 * progress;
            const newW = Math.floor(width * scale);
            const newH = Math.floor(height * scale);

            // Crop to fit original size
            const srcX = (newW - width) / 2 / scale;
            const srcY = (newH - height) / 2 / scale;
            ctx.drawImage(srcCanvas, -srcX, -srcY, width, height);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'bounce_out': {
            const bounceProgress = applyEasing(rawProgress, 'bounce_in');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scale = Math.max(0.1, 1.0 - 0.7 * bounceProgress);
            const newW = Math.floor(width * scale);
            const newH = Math.floor(height * scale);
            const offsetX = (width - newW) / 2;
            const offsetY = (height - newH) / 2;
            ctx.drawImage(srcCanvas, offsetX, offsetY, newW, newH);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'rotate_out':
        case 'spin_out': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const angle = (360 * progress) * Math.PI / 180;
            const scale = Math.max(0.1, 1.0 - 0.9 * progress);

            ctx.save();
            ctx.translate(width / 2, height / 2);
            ctx.rotate(angle);
            ctx.scale(scale, scale);
            ctx.drawImage(srcCanvas, -width / 2, -height / 2);
            ctx.restore();
            return ctx.getImageData(0, 0, width, height);
        }

        case 'flip_out_x':
        case 'flip_out_horizontal': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scaleY = Math.max(0.01, 1.0 - progress);
            const newH = Math.max(1, Math.floor(height * scaleY));
            const offsetY = (height - newH) / 2;
            ctx.drawImage(srcCanvas, 0, offsetY, width, newH);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'flip_out_y':
        case 'flip_out_vertical': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scaleX = Math.max(0.01, 1.0 - progress);
            const newW = Math.max(1, Math.floor(width * scaleX));
            const offsetX = (width - newW) / 2;
            ctx.drawImage(srcCanvas, offsetX, 0, newW, height);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'scale_out':
        case 'scale_down': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scale = Math.max(0.1, 1.0 - 0.8 * progress);
            const newW = Math.floor(width * scale);
            const newH = Math.floor(height * scale);
            const offsetX = (width - newW) / 2;
            const offsetY = (height - newH) / 2;
            ctx.globalAlpha = 1 - progress * 0.5;
            ctx.drawImage(srcCanvas, offsetX, offsetY, newW, newH);
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'elastic_out': {
            const elasticProgress = applyEasing(rawProgress, 'elastic_in');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scale = Math.max(0.1, Math.min(2.0, 1.0 - elasticProgress));
            const newW = Math.floor(width * scale);
            const newH = Math.floor(height * scale);
            const offsetX = (width - newW) / 2;
            const offsetY = (height - newH) / 2;
            ctx.drawImage(srcCanvas, offsetX, offsetY, newW, newH);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'bounceOutDown': {
            const bounceProgress = applyEasing(rawProgress, 'bounce_in');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(height * bounceProgress);
            ctx.drawImage(srcCanvas, 0, offset);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'bounceOutUp': {
            const bounceProgress = applyEasing(rawProgress, 'bounce_in');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(height * bounceProgress);
            ctx.drawImage(srcCanvas, 0, -offset);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'bounceOutLeft': {
            const bounceProgress = applyEasing(rawProgress, 'bounce_in');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(width * bounceProgress);
            ctx.drawImage(srcCanvas, -offset, 0);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'bounceOutRight': {
            const bounceProgress = applyEasing(rawProgress, 'bounce_in');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(width * bounceProgress);
            ctx.drawImage(srcCanvas, offset, 0);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'fadeOutDown': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(height * 0.3 * progress);
            ctx.globalAlpha = 1 - progress;
            ctx.drawImage(srcCanvas, 0, offset);
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'fadeOutUp': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(height * 0.3 * progress);
            ctx.globalAlpha = 1 - progress;
            ctx.drawImage(srcCanvas, 0, -offset);
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'fadeOutLeft': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(width * 0.3 * progress);
            ctx.globalAlpha = 1 - progress;
            ctx.drawImage(srcCanvas, -offset, 0);
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'fadeOutRight': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(width * 0.3 * progress);
            ctx.globalAlpha = 1 - progress;
            ctx.drawImage(srcCanvas, offset, 0);
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'zoomOutDown': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scale = 1.0 - 0.6 * progress;
            const offset = Math.floor(height * 0.5 * progress);
            ctx.globalAlpha = 1 - progress;
            ctx.save();
            ctx.translate(width / 2, height / 2 + offset);
            ctx.scale(scale, scale);
            ctx.drawImage(srcCanvas, -width / 2, -height / 2);
            ctx.restore();
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'zoomOutLeft': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scale = 1.0 - 0.6 * progress;
            const offset = Math.floor(width * 0.5 * progress);
            ctx.globalAlpha = 1 - progress;
            ctx.save();
            ctx.translate(width / 2 - offset, height / 2);
            ctx.scale(scale, scale);
            ctx.drawImage(srcCanvas, -width / 2, -height / 2);
            ctx.restore();
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'zoomOutRight': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scale = 1.0 - 0.6 * progress;
            const offset = Math.floor(width * 0.5 * progress);
            ctx.globalAlpha = 1 - progress;
            ctx.save();
            ctx.translate(width / 2 + offset, height / 2);
            ctx.scale(scale, scale);
            ctx.drawImage(srcCanvas, -width / 2, -height / 2);
            ctx.restore();
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'lightSpeedOutLeft': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(width * progress);
            const skew = 0.3 * progress;

            ctx.save();
            ctx.transform(1, 0, skew, 1, 0, 0);
            ctx.globalAlpha = 1 - progress;
            ctx.drawImage(srcCanvas, -offset, 0);
            ctx.restore();
            return ctx.getImageData(0, 0, width, height);
        }

        case 'lightSpeedOutRight': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(width * progress);
            const skew = -0.3 * progress;

            ctx.save();
            ctx.transform(1, 0, skew, 1, 0, 0);
            ctx.globalAlpha = 1 - progress;
            ctx.drawImage(srcCanvas, offset, 0);
            ctx.restore();
            return ctx.getImageData(0, 0, width, height);
        }

        case 'rollOut': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const angle = (120 * progress) * Math.PI / 180;
            const offset = Math.floor(width * progress);

            ctx.save();
            ctx.globalAlpha = 1 - progress;
            ctx.translate(width / 2, height / 2);
            ctx.rotate(angle);
            ctx.drawImage(srcCanvas, -width / 2 + offset, -height / 2);
            ctx.restore();
            return ctx.getImageData(0, 0, width, height);
        }

        // Back exits
        case 'backOutDown': {
            const backProgress = applyEasing(rawProgress, 'bounce_in');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scale = 1.0 - 0.3 * backProgress;
            const offset = Math.floor(height * backProgress);

            ctx.save();
            ctx.globalAlpha = 1 - backProgress;
            ctx.translate(width / 2, height / 2 + offset);
            ctx.scale(scale, scale);
            ctx.drawImage(srcCanvas, -width / 2, -height / 2);
            ctx.restore();
            return ctx.getImageData(0, 0, width, height);
        }

        case 'backOutUp': {
            const backProgress = applyEasing(rawProgress, 'bounce_in');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scale = 1.0 - 0.3 * backProgress;
            const offset = Math.floor(height * backProgress);

            ctx.save();
            ctx.globalAlpha = 1 - backProgress;
            ctx.translate(width / 2, height / 2 - offset);
            ctx.scale(scale, scale);
            ctx.drawImage(srcCanvas, -width / 2, -height / 2);
            ctx.restore();
            return ctx.getImageData(0, 0, width, height);
        }

        case 'backOutLeft': {
            const backProgress = applyEasing(rawProgress, 'bounce_in');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scale = 1.0 - 0.3 * backProgress;
            const offset = Math.floor(width * backProgress);

            ctx.save();
            ctx.globalAlpha = 1 - backProgress;
            ctx.translate(width / 2 - offset, height / 2);
            ctx.scale(scale, scale);
            ctx.drawImage(srcCanvas, -width / 2, -height / 2);
            ctx.restore();
            return ctx.getImageData(0, 0, width, height);
        }

        case 'backOutRight': {
            const backProgress = applyEasing(rawProgress, 'bounce_in');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scale = 1.0 - 0.3 * backProgress;
            const offset = Math.floor(width * backProgress);

            ctx.save();
            ctx.globalAlpha = 1 - backProgress;
            ctx.translate(width / 2 + offset, height / 2);
            ctx.scale(scale, scale);
            ctx.drawImage(srcCanvas, -width / 2, -height / 2);
            ctx.restore();
            return ctx.getImageData(0, 0, width, height);
        }

        // Additional fade variants
        case 'fadeOutDownBig': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(height * progress);
            ctx.globalAlpha = 1 - progress;
            ctx.drawImage(srcCanvas, 0, offset);
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'fadeOutLeftBig': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(width * progress);
            ctx.globalAlpha = 1 - progress;
            ctx.drawImage(srcCanvas, -offset, 0);
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'fadeOutRightBig': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(width * progress);
            ctx.globalAlpha = 1 - progress;
            ctx.drawImage(srcCanvas, offset, 0);
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'fadeOutUpBig': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(height * progress);
            ctx.globalAlpha = 1 - progress;
            ctx.drawImage(srcCanvas, 0, -offset);
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'fadeOutTopLeft': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offsetX = Math.floor(width * 0.25 * progress);
            const offsetY = Math.floor(height * 0.25 * progress);
            ctx.globalAlpha = 1 - progress;
            ctx.drawImage(srcCanvas, -offsetX, -offsetY);
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'fadeOutTopRight': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offsetX = Math.floor(width * 0.25 * progress);
            const offsetY = Math.floor(height * 0.25 * progress);
            ctx.globalAlpha = 1 - progress;
            ctx.drawImage(srcCanvas, offsetX, -offsetY);
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'fadeOutBottomLeft': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offsetX = Math.floor(width * 0.25 * progress);
            const offsetY = Math.floor(height * 0.25 * progress);
            ctx.globalAlpha = 1 - progress;
            ctx.drawImage(srcCanvas, -offsetX, offsetY);
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'fadeOutBottomRight': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offsetX = Math.floor(width * 0.25 * progress);
            const offsetY = Math.floor(height * 0.25 * progress);
            ctx.globalAlpha = 1 - progress;
            ctx.drawImage(srcCanvas, offsetX, offsetY);
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        // Flip variants
        case 'flipOutX': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scaleY = Math.max(0.01, 1.0 - progress);
            ctx.globalAlpha = 1 - progress;
            const newH = Math.max(1, Math.floor(height * scaleY));
            const offsetY = (height - newH) / 2;
            ctx.drawImage(srcCanvas, 0, offsetY, width, newH);
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'flipOutY': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scaleX = Math.max(0.01, 1.0 - progress);
            ctx.globalAlpha = 1 - progress;
            const newW = Math.max(1, Math.floor(width * scaleX));
            const offsetX = (width - newW) / 2;
            ctx.drawImage(srcCanvas, offsetX, 0, newW, height);
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        // Rotate variants
        case 'rotateOut': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const angle = (200 * progress) * Math.PI / 180;
            ctx.globalAlpha = 1 - progress;
            ctx.save();
            ctx.translate(width / 2, height / 2);
            ctx.rotate(angle);
            ctx.drawImage(srcCanvas, -width / 2, -height / 2);
            ctx.restore();
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'rotateOutDownLeft': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const angle = (45 * progress) * Math.PI / 180;
            ctx.globalAlpha = 1 - progress;
            ctx.save();
            ctx.translate(0, height);
            ctx.rotate(angle);
            ctx.drawImage(srcCanvas, 0, -height);
            ctx.restore();
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'rotateOutDownRight': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const angle = (-45 * progress) * Math.PI / 180;
            ctx.globalAlpha = 1 - progress;
            ctx.save();
            ctx.translate(width, height);
            ctx.rotate(angle);
            ctx.drawImage(srcCanvas, -width, -height);
            ctx.restore();
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'rotateOutUpLeft': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const angle = (-45 * progress) * Math.PI / 180;
            ctx.globalAlpha = 1 - progress;
            ctx.save();
            ctx.translate(0, 0);
            ctx.rotate(angle);
            ctx.drawImage(srcCanvas, 0, 0);
            ctx.restore();
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'rotateOutUpRight': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const angle = (45 * progress) * Math.PI / 180;
            ctx.globalAlpha = 1 - progress;
            ctx.save();
            ctx.translate(width, 0);
            ctx.rotate(angle);
            ctx.drawImage(srcCanvas, -width, 0);
            ctx.restore();
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        // Slide variants (animate.css naming)
        case 'slideOutDown': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(height * progress);
            ctx.drawImage(srcCanvas, 0, offset);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'slideOutUp': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(height * progress);
            ctx.drawImage(srcCanvas, 0, -offset);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'slideOutLeft': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(width * progress);
            ctx.drawImage(srcCanvas, -offset, 0);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'slideOutRight': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(width * progress);
            ctx.drawImage(srcCanvas, offset, 0);
            return ctx.getImageData(0, 0, width, height);
        }

        // Zoom out
        case 'zoomOut': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scale = 1.0 - 0.7 * progress;
            ctx.globalAlpha = 1 - progress;
            ctx.save();
            ctx.translate(width / 2, height / 2);
            ctx.scale(scale, scale);
            ctx.drawImage(srcCanvas, -width / 2, -height / 2);
            ctx.restore();
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        // Hinge (special dramatic exit)
        case 'hinge': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);

            // Hinge swings from top-left corner
            let angle: number;
            let offsetY: number;

            if (progress < 0.2) {
                // Swing right
                angle = (80 * progress / 0.2) * Math.PI / 180;
                offsetY = 0;
            } else if (progress < 0.4) {
                // Swing left
                const t = (progress - 0.2) / 0.2;
                angle = (80 - 160 * t) * Math.PI / 180;
                offsetY = 0;
            } else if (progress < 0.6) {
                // Swing right again
                const t = (progress - 0.4) / 0.2;
                angle = (-80 + 140 * t) * Math.PI / 180;
                offsetY = 0;
            } else if (progress < 0.8) {
                // Swing left again
                const t = (progress - 0.6) / 0.2;
                angle = (60 - 90 * t) * Math.PI / 180;
                offsetY = 0;
            } else {
                // Fall down
                const t = (progress - 0.8) / 0.2;
                angle = -30 * Math.PI / 180;
                offsetY = height * 2 * t;
            }

            ctx.globalAlpha = progress < 0.8 ? 1 : (1 - (progress - 0.8) / 0.2);
            ctx.save();
            ctx.translate(0, 0);
            ctx.rotate(angle);
            ctx.drawImage(srcCanvas, 0, offsetY);
            ctx.restore();
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        // Eraser exit animation - simulates erasing effect with zigzag pattern
        case 'eraser': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);

            // Generate zigzag eraser path
            const eraserRadius = Math.max(20, Math.min(width, height) / 15);
            const stepSize = eraserRadius / 2;
            const stripHeight = eraserRadius * 2 / 3;

            // Build the path of points to erase
            const erasePath: [number, number][] = [];
            let currentY = 0;
            let direction = 1;

            while (currentY < height) {
                if (direction === 1) {
                    for (let x = 0; x < width; x += stepSize) {
                        erasePath.push([x, currentY]);
                    }
                } else {
                    for (let x = width - 1; x >= 0; x -= stepSize) {
                        erasePath.push([x, currentY]);
                    }
                }
                currentY += stripHeight;
                direction *= -1;
            }

            // Calculate how many points to "unerase" (show) based on reverse progress
            // At progress=0, show all content; at progress=1, show nothing
            const totalPoints = erasePath.length;
            const pointsToErase = Math.floor(totalPoints * progress);

            // Draw source content first
            ctx.drawImage(srcCanvas, 0, 0);

            // Erase points (draw white circles over them)
            for (let i = 0; i < pointsToErase; i++) {
                const [x, y] = erasePath[i];
                ctx.beginPath();
                ctx.arc(x, y, eraserRadius, 0, 2 * Math.PI);
                ctx.fillStyle = 'white';
                ctx.fill();
            }

            return ctx.getImageData(0, 0, width, height);
        }

        default:
            // Default to fade_out for unknown types
            const white = createWhiteFrame(width, height);
            return blendFrames(frame, white, progress);
    }
}

/**
 * Check if a string is a valid exit animation type.
 */
export function isValidExitAnimation(type: string): boolean {
    return Object.values(ExitAnimationType).includes(type as ExitAnimationTypeValue);
}

/**
 * Get the default duration for an exit animation type.
 */
export function getDefaultExitDuration(type: ExitAnimationTypeValue | string): number {
    // Bouncy animations need more time
    if (type.includes('bounce') || type.includes('elastic')) {
        return 1.2;
    }
    // Default duration
    return 0.8;
}

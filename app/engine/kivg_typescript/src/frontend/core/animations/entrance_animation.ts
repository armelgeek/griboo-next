/**
 * Entrance Animation Module for Kivg Core
 * 
 * Provides entrance animation effects for layers in doodle animations.
 * Synchronized with the Python implementation in griboo-engine.py.
 * 
 * Features:
 * - Fade animations (fade_in, fadeblack, fadewhite)
 * - Slide animations (slide_in_left, slide_in_right, slide_in_top, slide_in_bottom)
 * - Zoom animations (zoom_in, distance)
 * - Push animations (push_from_left, push_from_right, push_from_top, push_from_bottom)
 * - Wipe animations (wipeleft, wiperight, wipeup, wipedown)
 * - Circle animations (circleopen, circleclose, rectcrop)
 * - Bounce animations (bounce_in, bounceInDown, bounceInUp, etc.)
 * - Rotate animations (rotate_in, spin_in)
 * - Flip animations (flip_in_x, flip_in_y)
 * - Elastic/Back animations (elastic_in, back_in)
 * - Animate.css style animations (bounce, flash, pulse, tada, etc.)
 * 
 * Usage:
 *     import { applyEntranceAnimation, EntranceAnimationType } from './core/entrance_animation';
 *     
 *     const animatedFrame = applyEntranceAnimation(frame, {
 *         type: 'bounce_in',
 *         duration: 1.0
 *     }, frameIndex, totalFrames, fps);
 */

import { AnimationTransition } from '../logic/easing';

/**
 * Available entrance animation types.
 */
export const EntranceAnimationType = {
    // Basic animations
    NONE: 'none',
    FADE_IN: 'fade_in',
    FADEBLACK: 'fadeblack',
    FADEWHITE: 'fadewhite',

    // Slide animations
    SLIDE_IN_LEFT: 'slide_in_left',
    SLIDE_IN_RIGHT: 'slide_in_right',
    SLIDE_IN_TOP: 'slide_in_top',
    SLIDE_IN_BOTTOM: 'slide_in_bottom',

    // Zoom animations
    ZOOM_IN: 'zoom_in',
    DISTANCE: 'distance',

    // Push animations
    PUSH_FROM_LEFT: 'push_from_left',
    PUSH_FROM_RIGHT: 'push_from_right',
    PUSH_FROM_TOP: 'push_from_top',
    PUSH_FROM_BOTTOM: 'push_from_bottom',
    PUSH_DIAGONAL: 'push_diagonal',
    PUSH_HORIZONTALLY: 'push_horizontally',

    // Pop/Appear
    POP: 'pop',
    APPEAR: 'appear',

    // Reveal
    REVEAL: 'reveal',
    DRAW: 'draw',
    TYPEWRITER: 'typewriter',
    PUSH: 'push',

    // Wipe animations
    WIPELEFT: 'wipeleft',
    WIPERIGHT: 'wiperight',
    WIPEUP: 'wipeup',
    WIPEDOWN: 'wipedown',

    // Slide aliases
    SLIDELEFT: 'slideleft',
    SLIDERIGHT: 'slideright',
    SLIDEUP: 'slideup',
    SLIDEDOWN: 'slidedown',

    // Smooth slide
    SMOOTHLEFT: 'smoothleft',
    SMOOTHRIGHT: 'smoothright',
    SMOOTHUP: 'smoothup',
    SMOOTHDOWN: 'smoothdown',

    // Circle animations
    CIRCLECROP: 'circlecrop',
    CIRCLEOPEN: 'circleopen',
    CIRCLECLOSE: 'circleclose',
    RECTCROP: 'rectcrop',

    // Bounce animations
    BOUNCE_IN: 'bounce_in',
    BOUNCE: 'bounce',
    BOUNCE_IN_DOWN: 'bounceInDown',
    BOUNCE_IN_UP: 'bounceInUp',
    BOUNCE_IN_LEFT: 'bounceInLeft',
    BOUNCE_IN_RIGHT: 'bounceInRight',

    // Rotate/Spin animations
    ROTATE_IN: 'rotate_in',
    SPIN_IN: 'spin_in',

    // Flip animations
    FLIP_IN_X: 'flip_in_x',
    FLIP_IN_HORIZONTAL: 'flip_in_horizontal',
    FLIP_IN_Y: 'flip_in_y',
    FLIP_IN_VERTICAL: 'flip_in_vertical',
    FLIPINX: 'flipInX',
    FLIPINY: 'flipInY',

    // Scale pulse
    SCALE_PULSE: 'scale_pulse',

    // Blur/Focus
    BLUR_IN: 'blur_in',
    FOCUS_IN: 'focus_in',

    // Elastic/Back
    ELASTIC_IN: 'elastic_in',
    BACK_IN: 'back_in',

    // Animate.css style - Attention Seekers
    FLASH: 'flash',
    PULSE: 'pulse',
    RUBBERBAND: 'rubberBand',
    SHAKEX: 'shakeX',
    SHAKEY: 'shakeY',
    HEADSHAKE: 'headShake',
    SWING: 'swing',
    TADA: 'tada',
    WOBBLE: 'wobble',
    JELLO: 'jello',
    HEARTBEAT: 'heartBeat',

    // Fade variants from Animate.css
    FADEIN: 'fadeIn',
    FADEINDOWN: 'fadeInDown',
    FADEINLEFT: 'fadeInLeft',
    FADEINUP: 'fadeInUp',
    FADEINTOPLEFT: 'fadeInTopLeft',
    FADEINTOPRIGHT: 'fadeInTopRight',
    FADEINBOTTOMLEFT: 'fadeInBottomLeft',

    // Zoom variants from Animate.css
    ZOOMINDOWN: 'zoomInDown',
    ZOOMINLEFT: 'zoomInLeft',
    ZOOMINRIGHT: 'zoomInRight',

    // LightSpeed
    LIGHTSPEEDINLEFT: 'lightSpeedInLeft',
    LIGHTSPEEDINRIGHT: 'lightSpeedInRight',

    // Roll
    ROLLIN: 'rollIn',

    // Rotate variants
    ROTATEINDOWNRIGHT: 'rotateInDownRight',
    ROTATEINUPLEFT: 'rotateInUpLeft',
    ROTATEINDOWNLEFT: 'rotateInDownLeft',
    ROTATEINUPRIGHT: 'rotateInUpRight',

    // Special
    HINGE: 'hinge',
    JACKINTHEBOX: 'jackInTheBox',

    // Back entrances (animate.css)
    BACKINDOWN: 'backInDown',
    BACKINLEFT: 'backInLeft',
    BACKINRIGHT: 'backInRight',
    BACKINUP: 'backInUp',

    // Additional fade variants
    FADEINRIGHT: 'fadeInRight',
    FADEINDOWNBIG: 'fadeInDownBig',
    FADEINLEFTBIG: 'fadeInLeftBig',
    FADEINRIGHTBIG: 'fadeInRightBig',
    FADEINUPBIG: 'fadeInUpBig',
    FADEINBOTTOMRIGHT: 'fadeInBottomRight',

    // Additional zoom variants
    ZOOMIN: 'zoomIn',
    ZOOMINUP: 'zoomInUp',

    // Slide variants (animate.css naming)
    SLIDEINDOWN: 'slideInDown',
    SLIDEINLEFT: 'slideInLeft',
    SLIDEINRIGHT: 'slideInRight',
    SLIDEINUP: 'slideInUp',

    // Flip (animate.css)
    FLIP: 'flip'
} as const;

export type EntranceAnimationTypeValue = typeof EntranceAnimationType[keyof typeof EntranceAnimationType];

/**
 * Entrance animation configuration.
 */
export interface EntranceAnimationConfig {
    type: EntranceAnimationTypeValue | string;
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
        case 'back_out':
        case 'out_back':
            return AnimationTransition.outBack(progress);
        case 'back_in':
        case 'in_back':
            return AnimationTransition.inBack(progress);
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
 * Create a black ImageData of the same size.
 */
function createBlackFrame(width: number, height: number): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = 0;       // R
        data[i + 1] = 0;   // G
        data[i + 2] = 0;   // B
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
 * Apply entrance animation to a frame.
 * 
 * @param frame - The frame to animate (ImageData)
 * @param animationConfig - Animation configuration
 * @param frameIndex - Current frame index in the animation
 * @param totalFrames - Total number of frames in the animation
 * @param frameRate - Frame rate of the video
 * @returns Animated frame as ImageData
 */
export function applyEntranceAnimation(
    frame: ImageData,
    animationConfig: EntranceAnimationConfig,
    frameIndex: number,
    _totalFrames: number,
    frameRate: number
): ImageData {
    if (!animationConfig || animationConfig.type === 'none') {
        return frame;
    }

    const animType = animationConfig.type || 'fade_in';
    const duration = animationConfig.duration ?? 1.0;
    const animFrames = Math.floor(duration * frameRate);

    if (frameIndex >= animFrames) {
        return frame;
    }

    const { width, height } = frame;
    const rawProgress = frameIndex / animFrames;

    // Apply easing based on animation type
    let progress: number;
    if (animType.startsWith('push_')) {
        progress = applyEasing(rawProgress, 'ease_out');
    } else {
        progress = applyEasing(rawProgress, 'ease_in_out');
    }

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
        case 'fade_in':
        case 'fadeIn': {
            const white = createWhiteFrame(width, height);
            return blendFrames(white, frame, progress);
        }

        case 'fadeblack': {
            const black = createBlackFrame(width, height);
            return blendFrames(black, frame, progress);
        }

        case 'fadewhite': {
            const white = createWhiteFrame(width, height);
            return blendFrames(white, frame, progress);
        }

        case 'slide_in_left': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(width * (1 - progress));
            ctx.drawImage(srcCanvas, offset, 0);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'slide_in_right': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(width * (1 - progress));
            ctx.drawImage(srcCanvas, -offset, 0);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'slide_in_top': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(height * (1 - progress));
            ctx.drawImage(srcCanvas, 0, offset);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'slide_in_bottom': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(height * (1 - progress));
            ctx.drawImage(srcCanvas, 0, -offset);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'zoom_in': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scale = 0.5 + 0.5 * progress;
            const newW = Math.floor(width * scale);
            const newH = Math.floor(height * scale);
            const offsetX = (width - newW) / 2;
            const offsetY = (height - newH) / 2;
            ctx.drawImage(srcCanvas, offsetX, offsetY, newW, newH);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'distance': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scale = 0.1 + 0.9 * progress;
            const newW = Math.floor(width * scale);
            const newH = Math.floor(height * scale);
            const offsetX = (width - newW) / 2;
            const offsetY = (height - newH) / 2;
            ctx.drawImage(srcCanvas, offsetX, offsetY, newW, newH);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'push_from_left': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(width * (1 - progress));
            ctx.drawImage(srcCanvas, offset, 0);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'push_from_right': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(width * (1 - progress));
            ctx.drawImage(srcCanvas, -offset, 0);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'push_from_top': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(height * (1 - progress));
            ctx.drawImage(srcCanvas, 0, offset);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'push_from_bottom': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(height * (1 - progress));
            ctx.drawImage(srcCanvas, 0, -offset);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'pop':
        case 'appear':
            return frame;

        case 'reveal': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const revealHeight = Math.floor(height * progress);
            if (revealHeight > 0) {
                ctx.drawImage(srcCanvas, 0, 0, width, revealHeight, 0, 0, width, revealHeight);
            }
            return ctx.getImageData(0, 0, width, height);
        }

        case 'wipeleft': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const revealWidth = Math.floor(width * progress);
            if (revealWidth > 0) {
                ctx.drawImage(srcCanvas, width - revealWidth, 0, revealWidth, height,
                    width - revealWidth, 0, revealWidth, height);
            }
            return ctx.getImageData(0, 0, width, height);
        }

        case 'wiperight': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const revealWidth = Math.floor(width * progress);
            if (revealWidth > 0) {
                ctx.drawImage(srcCanvas, 0, 0, revealWidth, height, 0, 0, revealWidth, height);
            }
            return ctx.getImageData(0, 0, width, height);
        }

        case 'wipeup': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const revealHeight = Math.floor(height * progress);
            if (revealHeight > 0) {
                ctx.drawImage(srcCanvas, 0, height - revealHeight, width, revealHeight,
                    0, height - revealHeight, width, revealHeight);
            }
            return ctx.getImageData(0, 0, width, height);
        }

        case 'wipedown': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const revealHeight = Math.floor(height * progress);
            if (revealHeight > 0) {
                ctx.drawImage(srcCanvas, 0, 0, width, revealHeight, 0, 0, width, revealHeight);
            }
            return ctx.getImageData(0, 0, width, height);
        }

        case 'circleopen':
        case 'circlecrop': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const centerX = width / 2;
            const centerY = height / 2;
            const maxRadius = Math.sqrt(width * width + height * height) / 2;
            const radius = Math.floor(maxRadius * progress);

            ctx.save();
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(srcCanvas, 0, 0);
            ctx.restore();
            return ctx.getImageData(0, 0, width, height);
        }

        case 'rectcrop': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const revealW = Math.floor(width * progress);
            const revealH = Math.floor(height * progress);
            const x1 = (width - revealW) / 2;
            const y1 = (height - revealH) / 2;

            if (revealW > 0 && revealH > 0) {
                ctx.drawImage(srcCanvas, x1, y1, revealW, revealH, x1, y1, revealW, revealH);
            }
            return ctx.getImageData(0, 0, width, height);
        }

        case 'bounce_in': {
            const bounceProgress = applyEasing(rawProgress, 'bounce_out');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scale = 0.3 + 0.7 * bounceProgress;
            const newW = Math.floor(width * scale);
            const newH = Math.floor(height * scale);
            const offsetX = (width - newW) / 2;
            const offsetY = (height - newH) / 2;
            ctx.drawImage(srcCanvas, offsetX, offsetY, newW, newH);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'rotate_in':
        case 'spin_in': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const angle = (360 * (1 - progress)) * Math.PI / 180;
            const scale = 0.1 + 0.9 * progress;

            ctx.save();
            ctx.translate(width / 2, height / 2);
            ctx.rotate(angle);
            ctx.scale(scale, scale);
            ctx.drawImage(srcCanvas, -width / 2, -height / 2);
            ctx.restore();
            return ctx.getImageData(0, 0, width, height);
        }

        case 'flip_in_x':
        case 'flip_in_horizontal':
        case 'flipInX': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scaleY = progress;
            const newH = Math.max(1, Math.floor(height * scaleY));
            const offsetY = (height - newH) / 2;
            ctx.drawImage(srcCanvas, 0, offsetY, width, newH);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'flip_in_y':
        case 'flip_in_vertical':
        case 'flipInY': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scaleX = progress;
            const newW = Math.max(1, Math.floor(width * scaleX));
            const offsetX = (width - newW) / 2;
            ctx.drawImage(srcCanvas, offsetX, 0, newW, height);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'scale_pulse': {
            const pulseProgress = applyEasing(rawProgress, 'ease_in_out');
            let scale: number;
            if (pulseProgress < 0.5) {
                scale = 0.5 + 1.0 * (pulseProgress * 2);
            } else {
                scale = 1.5 - 0.5 * ((pulseProgress - 0.5) * 2);
            }

            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const newW = Math.floor(width * scale);
            const newH = Math.floor(height * scale);
            const offsetX = (width - newW) / 2;
            const offsetY = (height - newH) / 2;

            if (scale <= 1.0) {
                ctx.drawImage(srcCanvas, offsetX, offsetY, newW, newH);
            } else {
                const srcX = (newW - width) / 2 / scale;
                const srcY = (newH - height) / 2 / scale;
                ctx.drawImage(srcCanvas, -srcX, -srcY, width, height);
            }
            return ctx.getImageData(0, 0, width, height);
        }

        case 'elastic_in': {
            const elasticProgress = applyEasing(rawProgress, 'elastic_out');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scale = Math.max(0.1, Math.min(2.0, 0.1 + 0.9 * elasticProgress));
            const newW = Math.floor(width * scale);
            const newH = Math.floor(height * scale);
            const offsetX = (width - newW) / 2;
            const offsetY = (height - newH) / 2;
            ctx.drawImage(srcCanvas, offsetX, offsetY, newW, newH);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'back_in': {
            const backProgress = applyEasing(rawProgress, 'back_out');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(width * (1 - backProgress));
            if (backProgress <= 1.0 && offset >= 0 && offset < width) {
                ctx.drawImage(srcCanvas, offset, 0);
            } else if (offset < 0) {
                ctx.drawImage(srcCanvas, 0, 0);
            }
            return ctx.getImageData(0, 0, width, height);
        }

        case 'bounce': {
            const bounceProgress = applyEasing(rawProgress, 'bounce_out');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const bounceHeight = Math.floor(height * 0.3 * (1 - bounceProgress));
            ctx.drawImage(srcCanvas, 0, bounceHeight);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'bounceInDown': {
            const bounceProgress = applyEasing(rawProgress, 'bounce_out');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(height * (1 - bounceProgress));
            ctx.drawImage(srcCanvas, 0, -offset);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'bounceInUp': {
            const bounceProgress = applyEasing(rawProgress, 'bounce_out');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(height * (1 - bounceProgress));
            ctx.drawImage(srcCanvas, 0, offset);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'bounceInLeft': {
            const bounceProgress = applyEasing(rawProgress, 'bounce_out');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(width * (1 - bounceProgress));
            ctx.drawImage(srcCanvas, offset, 0);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'bounceInRight': {
            const bounceProgress = applyEasing(rawProgress, 'bounce_out');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(width * (1 - bounceProgress));
            ctx.drawImage(srcCanvas, -offset, 0);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'tada': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scale = 1.0 - 0.1 * Math.sin(rawProgress * Math.PI * 6);
            const angle = (3 * Math.sin(rawProgress * Math.PI * 6)) * Math.PI / 180;

            ctx.save();
            ctx.translate(width / 2, height / 2);
            ctx.rotate(angle);
            ctx.scale(scale, scale);
            ctx.drawImage(srcCanvas, -width / 2, -height / 2);
            ctx.restore();
            return ctx.getImageData(0, 0, width, height);
        }

        case 'heartBeat': {
            const beatCycle = (rawProgress * 2) % 1.0;
            let scale: number;
            if (beatCycle < 0.2) {
                scale = 1.0 + 0.3 * (beatCycle / 0.2);
            } else if (beatCycle < 0.4) {
                scale = 1.3 - 0.2 * ((beatCycle - 0.2) / 0.2);
            } else if (beatCycle < 0.6) {
                scale = 1.1 + 0.2 * ((beatCycle - 0.4) / 0.2);
            } else {
                scale = 1.3 - 0.3 * ((beatCycle - 0.6) / 0.4);
            }

            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);

            ctx.save();
            ctx.translate(width / 2, height / 2);
            ctx.scale(scale, scale);
            ctx.drawImage(srcCanvas, -width / 2, -height / 2);
            ctx.restore();
            return ctx.getImageData(0, 0, width, height);
        }

        case 'lightSpeedInLeft': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(width * (1 - progress));
            const skew = 0.3 * (1 - progress);

            ctx.save();
            ctx.transform(1, 0, skew, 1, 0, 0);
            ctx.globalAlpha = progress;
            ctx.drawImage(srcCanvas, -offset, 0);
            ctx.restore();
            return ctx.getImageData(0, 0, width, height);
        }

        case 'lightSpeedInRight': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(width * (1 - progress));
            const skew = -0.3 * (1 - progress);

            ctx.save();
            ctx.transform(1, 0, skew, 1, 0, 0);
            ctx.globalAlpha = progress;
            ctx.drawImage(srcCanvas, offset, 0);
            ctx.restore();
            return ctx.getImageData(0, 0, width, height);
        }

        case 'rollIn': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const angle = (-120 * (1 - progress)) * Math.PI / 180;
            const offset = Math.floor(width * (1 - progress));

            ctx.save();
            ctx.globalAlpha = progress;
            ctx.translate(width / 2, height / 2);
            ctx.rotate(angle);
            ctx.drawImage(srcCanvas, -width / 2 - offset, -height / 2);
            ctx.restore();
            return ctx.getImageData(0, 0, width, height);
        }

        case 'jackInTheBox': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scale = 0.1 + 0.9 * progress;
            const angle = (30 * Math.sin(rawProgress * Math.PI * 2) * (1 - progress)) * Math.PI / 180;

            ctx.save();
            ctx.translate(width / 2, height);
            ctx.rotate(angle);
            ctx.scale(scale, scale);
            ctx.drawImage(srcCanvas, -width / 2, -height);
            ctx.restore();
            return ctx.getImageData(0, 0, width, height);
        }

        // Back entrances
        case 'backInDown': {
            const backProgress = applyEasing(rawProgress, 'back_out');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scale = 0.7 + 0.3 * backProgress;
            const offset = Math.floor(height * (1 - backProgress));

            ctx.save();
            ctx.globalAlpha = Math.min(1, backProgress * 2);
            ctx.translate(width / 2, height / 2 - offset);
            ctx.scale(scale, scale);
            ctx.drawImage(srcCanvas, -width / 2, -height / 2);
            ctx.restore();
            return ctx.getImageData(0, 0, width, height);
        }

        case 'backInUp': {
            const backProgress = applyEasing(rawProgress, 'back_out');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scale = 0.7 + 0.3 * backProgress;
            const offset = Math.floor(height * (1 - backProgress));

            ctx.save();
            ctx.globalAlpha = Math.min(1, backProgress * 2);
            ctx.translate(width / 2, height / 2 + offset);
            ctx.scale(scale, scale);
            ctx.drawImage(srcCanvas, -width / 2, -height / 2);
            ctx.restore();
            return ctx.getImageData(0, 0, width, height);
        }

        case 'backInLeft': {
            const backProgress = applyEasing(rawProgress, 'back_out');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scale = 0.7 + 0.3 * backProgress;
            const offset = Math.floor(width * (1 - backProgress));

            ctx.save();
            ctx.globalAlpha = Math.min(1, backProgress * 2);
            ctx.translate(width / 2 - offset, height / 2);
            ctx.scale(scale, scale);
            ctx.drawImage(srcCanvas, -width / 2, -height / 2);
            ctx.restore();
            return ctx.getImageData(0, 0, width, height);
        }

        case 'backInRight': {
            const backProgress = applyEasing(rawProgress, 'back_out');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scale = 0.7 + 0.3 * backProgress;
            const offset = Math.floor(width * (1 - backProgress));

            ctx.save();
            ctx.globalAlpha = Math.min(1, backProgress * 2);
            ctx.translate(width / 2 + offset, height / 2);
            ctx.scale(scale, scale);
            ctx.drawImage(srcCanvas, -width / 2, -height / 2);
            ctx.restore();
            return ctx.getImageData(0, 0, width, height);
        }

        // Additional Fade variants
        case 'fadeInRight': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(width * 0.25 * (1 - progress));
            ctx.globalAlpha = progress;
            ctx.drawImage(srcCanvas, offset, 0);
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'fadeInDownBig': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(height * (1 - progress));
            ctx.globalAlpha = progress;
            ctx.drawImage(srcCanvas, 0, -offset);
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'fadeInLeftBig': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(width * (1 - progress));
            ctx.globalAlpha = progress;
            ctx.drawImage(srcCanvas, offset, 0);
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'fadeInRightBig': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(width * (1 - progress));
            ctx.globalAlpha = progress;
            ctx.drawImage(srcCanvas, -offset, 0);
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'fadeInUpBig': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(height * (1 - progress));
            ctx.globalAlpha = progress;
            ctx.drawImage(srcCanvas, 0, offset);
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'fadeInBottomRight': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offsetX = Math.floor(width * 0.25 * (1 - progress));
            const offsetY = Math.floor(height * 0.25 * (1 - progress));
            ctx.globalAlpha = progress;
            ctx.drawImage(srcCanvas, -offsetX, -offsetY);
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        // Zoom variants
        case 'zoomIn': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scale = 0.3 + 0.7 * progress;
            const newW = Math.floor(width * scale);
            const newH = Math.floor(height * scale);
            const offsetX = (width - newW) / 2;
            const offsetY = (height - newH) / 2;
            ctx.globalAlpha = progress;
            ctx.drawImage(srcCanvas, offsetX, offsetY, newW, newH);
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'zoomInUp': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const scale = 0.3 + 0.7 * progress;
            const offset = Math.floor(height * 0.5 * (1 - progress));
            ctx.globalAlpha = progress;
            ctx.save();
            ctx.translate(width / 2, height / 2 + offset);
            ctx.scale(scale, scale);
            ctx.drawImage(srcCanvas, -width / 2, -height / 2);
            ctx.restore();
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        // Rotate variants
        case 'rotateInDownLeft': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const angle = (-45 * (1 - progress)) * Math.PI / 180;
            ctx.globalAlpha = progress;
            ctx.save();
            ctx.translate(0, height);
            ctx.rotate(angle);
            ctx.drawImage(srcCanvas, 0, -height);
            ctx.restore();
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'rotateInUpRight': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const angle = (45 * (1 - progress)) * Math.PI / 180;
            ctx.globalAlpha = progress;
            ctx.save();
            ctx.translate(width, height);
            ctx.rotate(angle);
            ctx.drawImage(srcCanvas, -width, -height);
            ctx.restore();
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        // Slide variants (animate.css naming)
        case 'slideInDown': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(height * (1 - progress));
            ctx.drawImage(srcCanvas, 0, -offset);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'slideInUp': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(height * (1 - progress));
            ctx.drawImage(srcCanvas, 0, offset);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'slideInLeft': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(width * (1 - progress));
            ctx.drawImage(srcCanvas, offset, 0);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'slideInRight': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            const offset = Math.floor(width * (1 - progress));
            ctx.drawImage(srcCanvas, -offset, 0);
            return ctx.getImageData(0, 0, width, height);
        }

        // Flip animation
        case 'flip': {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);

            // Flip is a 3D-like animation with rotation
            const angle = Math.PI * (1 - progress);
            const scaleX = Math.abs(Math.cos(angle));

            if (scaleX > 0.01) {
                const newW = Math.max(1, Math.floor(width * scaleX));
                const offsetX = (width - newW) / 2;
                ctx.drawImage(srcCanvas, offsetX, 0, newW, height);
            }
            return ctx.getImageData(0, 0, width, height);
        }

        // Attention seekers (with proper animation)
        case 'shakeX': {
            const shakeAmount = 10 * Math.sin(rawProgress * Math.PI * 8) * (1 - progress);
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(srcCanvas, shakeAmount, 0);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'shakeY': {
            const shakeAmount = 10 * Math.sin(rawProgress * Math.PI * 8) * (1 - progress);
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(srcCanvas, 0, shakeAmount);
            return ctx.getImageData(0, 0, width, height);
        }

        case 'headShake': {
            const shakeAmount = 6 * Math.sin(rawProgress * Math.PI * 6) * (1 - progress);
            const angle = 0.03 * Math.sin(rawProgress * Math.PI * 6) * (1 - progress);
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            ctx.save();
            ctx.translate(width / 2, height / 2);
            ctx.rotate(angle);
            ctx.drawImage(srcCanvas, -width / 2 + shakeAmount, -height / 2);
            ctx.restore();
            return ctx.getImageData(0, 0, width, height);
        }

        case 'wobble': {
            const wobbleAngle = 15 * Math.sin(rawProgress * Math.PI * 5) * (1 - progress) * Math.PI / 180;
            const wobbleX = width * 0.25 * Math.sin(rawProgress * Math.PI * 2.5) * (1 - progress);
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            ctx.save();
            ctx.translate(width / 2, height / 2);
            ctx.rotate(wobbleAngle);
            ctx.drawImage(srcCanvas, -width / 2 + wobbleX, -height / 2);
            ctx.restore();
            return ctx.getImageData(0, 0, width, height);
        }

        case 'jello': {
            const skewX = 12.5 * Math.sin(rawProgress * Math.PI * 4) * (1 - progress);
            const skewY = 12.5 * Math.sin(rawProgress * Math.PI * 4 + Math.PI / 4) * (1 - progress);
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            ctx.save();
            ctx.translate(width / 2, height / 2);
            ctx.transform(1, skewY * Math.PI / 180, skewX * Math.PI / 180, 1, 0, 0);
            ctx.drawImage(srcCanvas, -width / 2, -height / 2);
            ctx.restore();
            return ctx.getImageData(0, 0, width, height);
        }

        case 'rubberBand': {
            let scaleX = 1.0;
            let scaleY = 1.0;
            if (rawProgress < 0.3) {
                scaleX = 1.0 + 0.25 * (rawProgress / 0.3);
                scaleY = 1.0 - 0.25 * (rawProgress / 0.3);
            } else if (rawProgress < 0.4) {
                const t = (rawProgress - 0.3) / 0.1;
                scaleX = 1.25 - 0.5 * t;
                scaleY = 0.75 + 0.5 * t;
            } else if (rawProgress < 0.5) {
                const t = (rawProgress - 0.4) / 0.1;
                scaleX = 0.75 + 0.4 * t;
                scaleY = 1.25 - 0.4 * t;
            } else if (rawProgress < 0.65) {
                const t = (rawProgress - 0.5) / 0.15;
                scaleX = 1.15 - 0.2 * t;
                scaleY = 0.85 + 0.2 * t;
            } else if (rawProgress < 0.75) {
                const t = (rawProgress - 0.65) / 0.1;
                scaleX = 0.95 + 0.05 * t;
                scaleY = 1.05 - 0.05 * t;
            } else {
                scaleX = 1.0;
                scaleY = 1.0;
            }

            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            ctx.save();
            ctx.translate(width / 2, height / 2);
            ctx.scale(scaleX, scaleY);
            ctx.drawImage(srcCanvas, -width / 2, -height / 2);
            ctx.restore();
            return ctx.getImageData(0, 0, width, height);
        }

        case 'flash': {
            // Flash effect: opacity pulses
            const flashOpacity = Math.abs(Math.sin(rawProgress * Math.PI * 2));
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            ctx.globalAlpha = flashOpacity;
            ctx.drawImage(srcCanvas, 0, 0);
            ctx.globalAlpha = 1;
            return ctx.getImageData(0, 0, width, height);
        }

        case 'pulse': {
            // Pulse effect: scale up and down
            const pulseScale = 1.0 + 0.05 * Math.sin(rawProgress * Math.PI * 2);
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            ctx.save();
            ctx.translate(width / 2, height / 2);
            ctx.scale(pulseScale, pulseScale);
            ctx.drawImage(srcCanvas, -width / 2, -height / 2);
            ctx.restore();
            return ctx.getImageData(0, 0, width, height);
        }

        default:
            // Default to fade_in for unknown types
            const white = createWhiteFrame(width, height);
            return blendFrames(white, frame, progress);
    }
}

/**
 * Check if a string is a valid entrance animation type.
 */
export function isValidEntranceAnimation(type: string): boolean {
    return Object.values(EntranceAnimationType).includes(type as EntranceAnimationTypeValue);
}

/**
 * Get the default duration for an animation type.
 */
export function getDefaultDuration(type: EntranceAnimationTypeValue | string): number {
    // Pop and appear are instant
    if (type === 'pop' || type === 'appear') {
        return 0;
    }
    // Bouncy animations need more time
    if (type.includes('bounce') || type.includes('elastic')) {
        return 1.5;
    }
    // Default duration
    return 1.0;
}

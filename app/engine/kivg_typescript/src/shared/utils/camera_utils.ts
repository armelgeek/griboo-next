import { AnimationTransition } from '../core/easing';
import { CameraConfig, CameraPosition, CameraSize } from '../types';

/**
 * Easing type map for camera animations.
 */
type EasingMethod = (progress: number) => number;

const easingMap: Record<string, EasingMethod> = {
    'linear': AnimationTransition.linear,
    'ease_in': AnimationTransition.inQuad,
    'ease_out': AnimationTransition.outQuad,
    'ease_in_out': AnimationTransition.inOutQuad,
    'ease_in_cubic': AnimationTransition.inCubic,
    'ease_out_cubic': AnimationTransition.outCubic,
    'in_quad': AnimationTransition.inQuad,
    'out_quad': AnimationTransition.outQuad,
    'in_out_quad': AnimationTransition.inOutQuad,
    'in_cubic': AnimationTransition.inCubic,
    'out_cubic': AnimationTransition.outCubic,
    'in_out_cubic': AnimationTransition.inOutCubic,
    'in_bounce': AnimationTransition.inBounce,
    'out_bounce': AnimationTransition.outBounce,
    'in_out_bounce': AnimationTransition.inOutBounce,
    'bounce_in': AnimationTransition.inBounce,
    'bounce_out': AnimationTransition.outBounce,
    'bounce_in_out': AnimationTransition.inOutBounce,
    'in_elastic': AnimationTransition.inElastic,
    'out_elastic': AnimationTransition.outElastic,
    'in_out_elastic': AnimationTransition.inOutElastic,
    'elastic_in': AnimationTransition.inElastic,
    'elastic_out': AnimationTransition.outElastic,
    'elastic_in_out': AnimationTransition.inOutElastic,
    'in_back': AnimationTransition.inBack,
    'out_back': AnimationTransition.outBack,
    'in_out_back': AnimationTransition.inOutBack,
    'back_in': AnimationTransition.inBack,
    'back_out': AnimationTransition.outBack,
    'back_in_out': AnimationTransition.inOutBack,
    'in_expo': AnimationTransition.inExpo,
    'out_expo': AnimationTransition.outExpo,
    'in_out_expo': AnimationTransition.inOutExpo
};

/**
 * Apply easing function to progress value.
 */
export function easingFunction(progress: number, easingType: string = 'linear'): number {
    const method = easingMap[easingType] ?? AnimationTransition.linear;
    return method(progress);
}

/**
 * Interpolate between two camera configurations.
 * Adds a 20% pause at the beginning of the transition before the animation starts.
 */
export function interpolateCamera(
    prevCamera: CameraConfig,
    nextCamera: CameraConfig,
    progress: number,
    easing: string = 'ease_out'
): CameraConfig {
    // Add 20% pause at the beginning
    // If progress < 0.2, stay at prevCamera (no movement)
    // If progress >= 0.2, interpolate over the remaining 80%
    const PAUSE_RATIO = 0.2;
    const adjustedProgress = progress < PAUSE_RATIO
        ? 0
        : (progress - PAUSE_RATIO) / (1 - PAUSE_RATIO);

    const easedProgress = easingFunction(adjustedProgress, easing);

    const prevZoom = prevCamera.zoom ?? 1.0;
    const nextZoom = nextCamera.zoom ?? 1.0;
    const prevPos = prevCamera.position ?? { x: 0.5, y: 0.5 };
    const nextPos = nextCamera.position ?? { x: 0.5, y: 0.5 };

    const currentZoom = prevZoom + (nextZoom - prevZoom) * easedProgress;
    const currentPos: CameraPosition = {
        x: prevPos.x + (nextPos.x - prevPos.x) * easedProgress,
        y: prevPos.y + (nextPos.y - prevPos.y) * easedProgress
    };

    // Interpolate size if both cameras have it
    let currentSize: CameraSize | null = null;
    const prevSize = prevCamera.size;
    const nextSize = nextCamera.size;

    if (prevSize && nextSize) {
        currentSize = {
            width: prevSize.width + (nextSize.width - prevSize.width) * easedProgress,
            height: prevSize.height + (nextSize.height - prevSize.height) * easedProgress
        };
    } else if (nextSize) {
        currentSize = nextSize;
    }

    return {
        zoom: currentZoom,
        position: currentPos,
        size: currentSize
    };
}

/**
 * Calculate camera settings to fit a bounding box within a viewport.
 * @param bounds - The bounding box to fit {left, top, right, bottom}
 * @param targetSize - The size of the viewport (output size) {width, height}
 * @param virtualSize - The size of the virtual canvas {width, height}
 * @param padding - Optional padding in pixels
 * @returns CameraConfig with optimal zoom and position
 */
export function calculateCameraForBounds(
    bounds: any,
    targetSize: { width: number; height: number },
    virtualSize: { width: number; height: number },
    padding: number = 20
): CameraConfig {
    const left = bounds.left !== undefined ? bounds.left : bounds.x;
    const top = bounds.top !== undefined ? bounds.top : bounds.y;
    const right = bounds.right !== undefined ? bounds.right : (bounds.x + bounds.width);
    const bottom = bounds.bottom !== undefined ? bounds.bottom : (bounds.y + bounds.height);

    const contentW = right - left + padding * 2;
    const contentH = bottom - top + padding * 2;

    const zoomX = targetSize.width / contentW;
    const zoomY = targetSize.height / contentH;
    const zoom = Math.min(zoomX, zoomY);

    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;

    // Position is normalized (0.0 to 1.0) relative to the VIRTUAL canvas
    return {
        zoom,
        position: {
            x: centerX / virtualSize.width,
            y: centerY / virtualSize.height
        }
    };
}

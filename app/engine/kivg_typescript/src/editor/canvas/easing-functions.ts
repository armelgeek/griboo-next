/**
 * Easing functions and interpolation utilities for camera animations
 */

export interface Position {
    x: number;
    y: number;
}

/**
 * Available easing function types
 */
export type EasingType =
    | 'linear'
    | 'ease_in'
    | 'ease_out'
    | 'ease_in_out'
    | 'bounce'
    | 'elastic';

/**
 * Easing functions collection
 */
const easingFunctions: Record<string, (t: number) => number> = {
    linear: (t: number) => t,
    ease_in: (t: number) => t * t,
    ease_out: (t: number) => t * (2 - t),
    ease_in_out: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    bounce: (t: number) => {
        if (t < 1 / 2.75) {
            return 7.5625 * t * t;
        } else if (t < 2 / 2.75) {
            t -= 1.5 / 2.75;
            return 7.5625 * t * t + 0.75;
        } else if (t < 2.5 / 2.75) {
            t -= 2.25 / 2.75;
            return 7.5625 * t * t + 0.9375;
        } else {
            t -= 2.625 / 2.75;
            return 7.5625 * t * t + 0.984375;
        }
    },
    elastic: (t: number) => {
        if (t === 0 || t === 1) return t;
        const p = 0.3;
        const s = p / 4;
        return Math.pow(2, -10 * t) * Math.sin(((t - s) * (2 * Math.PI)) / p) + 1;
    },
};

/**
 * Get an easing function by name
 * @param name - Name of the easing function
 * @returns Easing function
 */
export const getEasingFunction = (name?: string): ((t: number) => number) => {
    if (!name || !easingFunctions[name]) {
        return easingFunctions.ease_out;
    }
    return easingFunctions[name];
};

/**
 * Interpolate between two values using an easing function
 * @param from - Start value
 * @param to - End value
 * @param progress - Progress value between 0 and 1
 * @param easing - Easing function name
 * @returns Interpolated value
 */
export const interpolate = (
    from: number,
    to: number,
    progress: number,
    easing?: string
): number => {
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const easingFn = getEasingFunction(easing);
    const easedProgress = easingFn(clampedProgress);
    return from + (to - from) * easedProgress;
};

/**
 * Interpolate between two positions using an easing function
 * @param from - Start position
 * @param to - End position
 * @param progress - Progress value between 0 and 1
 * @param easing - Easing function name
 * @returns Interpolated position
 */
export const interpolatePosition = (
    from: Position,
    to: Position,
    progress: number,
    easing?: string
): Position => {
    return {
        x: interpolate(from.x, to.x, progress, easing),
        y: interpolate(from.y, to.y, progress, easing),
    };
};

export default {
    getEasingFunction,
    interpolate,
    interpolatePosition,
};

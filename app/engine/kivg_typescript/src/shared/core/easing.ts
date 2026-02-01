/**
 * Easing/transition functions for animations.
 * Ported from Kivy's AnimationTransition class.
 * These are pure mathematical functions shared between frontend and backend.
 */

export class AnimationTransition {
    /**
     * Linear transition (no easing).
     */
    static linear(progress: number): number {
        return progress;
    }

    /**
     * Quadratic ease-in.
     */
    static inQuad(progress: number): number {
        return progress * progress;
    }

    /**
     * Quadratic ease-out.
     */
    static outQuad(progress: number): number {
        return -1.0 * progress * (progress - 2.0);
    }

    /**
     * Quadratic ease-in-out.
     */
    static inOutQuad(progress: number): number {
        let p = progress * 2;
        if (p < 1) {
            return 0.5 * p * p;
        }
        p -= 1.0;
        return -0.5 * (p * (p - 2.0) - 1.0);
    }

    /**
     * Cubic ease-in.
     */
    static inCubic(progress: number): number {
        return progress * progress * progress;
    }

    /**
     * Cubic ease-out.
     */
    static outCubic(progress: number): number {
        const p = progress - 1.0;
        return p * p * p + 1.0;
    }

    /**
     * Cubic ease-in-out.
     */
    static inOutCubic(progress: number): number {
        let p = progress * 2;
        if (p < 1) {
            return 0.5 * p * p * p;
        }
        p -= 2;
        return 0.5 * (p * p * p + 2.0);
    }

    /**
     * Quartic ease-in.
     */
    static inQuart(progress: number): number {
        return progress * progress * progress * progress;
    }

    /**
     * Quartic ease-out.
     */
    static outQuart(progress: number): number {
        const p = progress - 1.0;
        return -1.0 * (p * p * p * p - 1.0);
    }

    /**
     * Quartic ease-in-out.
     */
    static inOutQuart(progress: number): number {
        let p = progress * 2;
        if (p < 1) {
            return 0.5 * p * p * p * p;
        }
        p -= 2;
        return -0.5 * (p * p * p * p - 2.0);
    }

    /**
     * Quintic ease-in.
     */
    static inQuint(progress: number): number {
        return progress * progress * progress * progress * progress;
    }

    /**
     * Quintic ease-out.
     */
    static outQuint(progress: number): number {
        const p = progress - 1.0;
        return p * p * p * p * p + 1.0;
    }

    /**
     * Quintic ease-in-out.
     */
    static inOutQuint(progress: number): number {
        let p = progress * 2;
        if (p < 1) {
            return 0.5 * p * p * p * p * p;
        }
        p -= 2.0;
        return 0.5 * (p * p * p * p * p + 2.0);
    }

    /**
     * Sinusoidal ease-in.
     */
    static inSine(progress: number): number {
        return -1.0 * Math.cos(progress * (Math.PI / 2.0)) + 1.0;
    }

    /**
     * Sinusoidal ease-out.
     */
    static outSine(progress: number): number {
        return Math.sin(progress * (Math.PI / 2.0));
    }

    /**
     * Sinusoidal ease-in-out.
     */
    static inOutSine(progress: number): number {
        return -0.5 * (Math.cos(Math.PI * progress) - 1.0);
    }

    /**
     * Exponential ease-in.
     */
    static inExpo(progress: number): number {
        if (progress === 0) {
            return 0.0;
        }
        return Math.pow(2, 10 * (progress - 1.0));
    }

    /**
     * Exponential ease-out.
     */
    static outExpo(progress: number): number {
        if (progress === 1.0) {
            return 1.0;
        }
        return -Math.pow(2, -10 * progress) + 1.0;
    }

    /**
     * Exponential ease-in-out.
     */
    static inOutExpo(progress: number): number {
        if (progress === 0) {
            return 0.0;
        }
        if (progress === 1.0) {
            return 1.0;
        }
        let p = progress * 2;
        if (p < 1) {
            return 0.5 * Math.pow(2, 10 * (p - 1.0));
        }
        p -= 1.0;
        return 0.5 * (-Math.pow(2, -10 * p) + 2.0);
    }

    /**
     * Circular ease-in.
     */
    static inCirc(progress: number): number {
        return -1.0 * (Math.sqrt(1.0 - progress * progress) - 1.0);
    }

    /**
     * Circular ease-out.
     */
    static outCirc(progress: number): number {
        const p = progress - 1.0;
        return Math.sqrt(1.0 - p * p);
    }

    /**
     * Circular ease-in-out.
     */
    static inOutCirc(progress: number): number {
        let p = progress * 2;
        if (p < 1) {
            return -0.5 * (Math.sqrt(1.0 - p * p) - 1.0);
        }
        p -= 2.0;
        return 0.5 * (Math.sqrt(1.0 - p * p) + 1.0);
    }

    /**
     * Elastic ease-in.
     */
    static inElastic(progress: number): number {
        const p = 0.3;
        const s = p / 4.0;
        let q = progress;
        if (q === 1) {
            return 1.0;
        }
        q -= 1.0;
        return -(Math.pow(2, 10 * q) * Math.sin((q - s) * (2 * Math.PI) / p));
    }

    /**
     * Elastic ease-out.
     */
    static outElastic(progress: number): number {
        const p = 0.3;
        const s = p / 4.0;
        const q = progress;
        if (q === 1) {
            return 1.0;
        }
        return Math.pow(2, -10 * q) * Math.sin((q - s) * (2 * Math.PI) / p) + 1.0;
    }

    /**
     * Elastic ease-in-out.
     */
    static inOutElastic(progress: number): number {
        const p = 0.3 * 1.5;
        const s = p / 4.0;
        let q = progress * 2;
        if (q === 2) {
            return 1.0;
        }
        if (q < 1) {
            q -= 1.0;
            return -0.5 * (Math.pow(2, 10 * q) * Math.sin((q - s) * (2.0 * Math.PI) / p));
        } else {
            q -= 1.0;
            return Math.pow(2, -10 * q) * Math.sin((q - s) * (2.0 * Math.PI) / p) * 0.5 + 1.0;
        }
    }

    /**
     * Back ease-in (overshoots then comes back).
     */
    static inBack(progress: number): number {
        return progress * progress * ((1.70158 + 1.0) * progress - 1.70158);
    }

    /**
     * Back ease-out.
     */
    static outBack(progress: number): number {
        const p = progress - 1.0;
        return p * p * ((1.70158 + 1) * p + 1.70158) + 1.0;
    }

    /**
     * Back ease-in-out.
     */
    static inOutBack(progress: number): number {
        let p = progress * 2.0;
        const s = 1.70158 * 1.525;
        if (p < 1) {
            return 0.5 * (p * p * ((s + 1.0) * p - s));
        }
        p -= 2.0;
        return 0.5 * (p * p * ((s + 1.0) * p + s) + 2.0);
    }

    /**
     * Internal bounce calculation.
     */
    private static outBounceInternal(t: number, d: number): number {
        let p = t / d;
        if (p < (1.0 / 2.75)) {
            return 7.5625 * p * p;
        } else if (p < (2.0 / 2.75)) {
            p -= (1.5 / 2.75);
            return 7.5625 * p * p + 0.75;
        } else if (p < (2.5 / 2.75)) {
            p -= (2.25 / 2.75);
            return 7.5625 * p * p + 0.9375;
        } else {
            p -= (2.625 / 2.75);
            return 7.5625 * p * p + 0.984375;
        }
    }

    /**
     * Internal bounce calculation.
     */
    private static inBounceInternal(t: number, d: number): number {
        return 1.0 - AnimationTransition.outBounceInternal(d - t, d);
    }

    /**
     * Bounce ease-in.
     */
    static inBounce(progress: number): number {
        return AnimationTransition.inBounceInternal(progress, 1.0);
    }

    /**
     * Bounce ease-out.
     */
    static outBounce(progress: number): number {
        return AnimationTransition.outBounceInternal(progress, 1.0);
    }

    /**
     * Bounce ease-in-out.
     */
    static inOutBounce(progress: number): number {
        const p = progress * 2.0;
        if (p < 1.0) {
            return AnimationTransition.inBounceInternal(p, 1.0) * 0.5;
        }
        return AnimationTransition.outBounceInternal(p - 1.0, 1.0) * 0.5 + 0.5;
    }
}

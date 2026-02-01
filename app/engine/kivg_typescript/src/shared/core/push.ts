import { AnimationTransition } from './easing';

/**
 * Apply easing function to push animation progress.
 * Uses the AnimationTransition class for consistent easing across the engine.
 * 
 * @param progress - Linear progress value (0.0 to 1.0)
 * @param easingType - Type of easing function
 * @returns Eased progress value
 */
export function applyPushEasing(progress: number, easingType: string = 'out_cubic'): number {
    const easingMap: Record<string, (p: number) => number> = {
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

    const easingMethod = easingMap[easingType] ?? AnimationTransition.outCubic;
    return easingMethod(progress);
}

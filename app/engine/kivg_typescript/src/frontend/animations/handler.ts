/**
 * AnimationHandler manages animation creation and sequencing.
 * Centralized handler for all types of animations.
 */

import { Animation, Wait } from '../core/animations/animation';

import type { AnimationContext } from '../core/logic/data_classes';
import { ShapeAnimator } from './animation_shapes';

type AnimationCallback = (animation: Animation, widget: any) => void;
type ProgressCallback = (animation: Animation, widget: any, progress: number) => void;

interface AnimationConfig {
    id_: string;
    from_?: string;
    t?: string;
    d?: number;
    [key: string]: any;
}

/**
 * Centralized handler for all types of animations.
 */
export class AnimationHandler {
    /**
     * Create a sequence or parallel animation from multiple animations.
     * 
     * @param animations - Array of Animation objects
     * @param sequential - If true, animations run in sequence, otherwise in parallel
     * @returns Combined Animation object or null if animations array is empty
     */
    static createAnimationSequence(
        animations: Animation[],
        sequential: boolean = true
    ): Animation | null {
        if (animations.length === 0) {
            return null;
        }

        let combined = animations[0];

        for (let i = 1; i < animations.length; i++) {
            if (sequential) {
                combined = combined.then(animations[i]); // Sequential
            } else {
                combined = combined.and(animations[i]); // Parallel
            }
        }

        return combined;
    }

    /**
     * Add a fade-in animation for shape filling.
     * 
     * @param anim - Base animation to add fill animation to
     * @param widget - Widget to animate
     * @param onProgressCallback - Callback for animation progress
     * @returns Animation with fill effect added
     */
    static addFillAnimation(
        anim: Animation,
        _widget: any,
        onProgressCallback?: ProgressCallback
    ): Animation {
        const fillAnim = new Animation({
            duration: 0.4,
            meshOpacity: 1
        });

        if (onProgressCallback) {
            fillAnim.bind({ onProgress: onProgressCallback });
        }

        return anim.then(fillAnim);
    }

    /**
     * Prepare and start an animation.
     * 
     * @param anim - Animation to start
     * @param widget - Widget to animate
     * @param onProgressCallback - Callback for animation progress
     * @param onCompleteCallback - Callback for animation completion
     */
    static prepareAndStartAnimation(
        anim: Animation,
        widget: any,
        onProgressCallback?: ProgressCallback,
        onCompleteCallback?: AnimationCallback
    ): void {
        Animation.cancelAll(widget);

        if (onProgressCallback) {
            anim.bind({ onProgress: onProgressCallback });
        }

        if (onCompleteCallback) {
            anim.bind({ onComplete: onCompleteCallback });
        }

        anim.start(widget);
    }

    /**
     * Set up animations for a shape using ShapeAnimator.
     * 
     * @param caller - The caller object (usually main instance)
     * @param context - AnimationContext with animation parameters
     * @returns Array of Animation objects
     */
    static setupShapeAnimations(
        caller: any,
        context: AnimationContext
    ): Animation[] | null {
        return ShapeAnimator.setupAnimation(caller, context);
    }

    /**
     * Prepare animations for shapes based on configuration.
     * 
     * @param caller - Object calling the animation
     * @param widget - Widget to animate
     * @param animConfigList - Array of animation configuration objects
     * @param closedShapes - SVG path data organized by shape ID
     * @param svgSize - SVG dimensions [width, height]
     * @param svgFile - SVG file path
     * @returns Array of tuples [shapeId, animation] for the shapes
     */
    static prepareShapeAnimations(
        caller: any,
        widget: any,
        animConfigList: AnimationConfig[],
        closedShapes: Record<string, any>,
        svgSize: [number, number],
        svgFile: string,
        sequential: boolean = false
    ): Array<[string, Animation]> {
        const animationList: Array<[string, Animation]> = [];

        for (const config of animConfigList) {
            // Create animation context
            const context: AnimationContext = {
                widget,
                shapeId: config.id_,
                direction: config.from_ ?? '',
                transition: config.t ?? 'out_sine',
                duration: config.d ?? 0.3,
                closedShapes,
                swSize: svgSize,
                svgFile
            };

            // Get animation list from ShapeAnimator
            const animList = AnimationHandler.setupShapeAnimations(caller, context);

            if (animList && animList.length > 0) {
                // Combine animations based on sequencing preference
                const combinedAnim = AnimationHandler.createAnimationSequence(
                    animList,
                    sequential
                );

                if (combinedAnim) {
                    animationList.push([config.id_, combinedAnim]);
                }
            }
        }

        return animationList;
    }

    /**
     * Start a sequence of shape animations with delays.
     * 
     * @param animationList - Array of tuples [shapeId, animation]
     * @param widget - Widget to animate
     * @param delay - Delay between animations in seconds
     * @param onProgressCallback - Optional callback for each animation progress
     * @param onCompleteCallback - Optional callback when all animations complete
     */
    static startAnimationSequence(
        animationList: Array<[string, Animation]>,
        widget: any,
        delay: number = 0,
        onProgressCallback?: ProgressCallback,
        onCompleteCallback?: () => void
    ): void {
        if (animationList.length === 0) {
            if (onCompleteCallback) {
                onCompleteCallback();
            }
            return;
        }

        // Create a sequence of animations
        let sequence: Animation | null = null;

        for (let i = 0; i < animationList.length; i++) {
            const [_shapeId, anim] = animationList[i];

            if (onProgressCallback) {
                anim.bind({ onProgress: onProgressCallback });
            }

            if (!sequence) {
                sequence = anim;
            } else {
                if (delay > 0) {
                    sequence = sequence.then(new Wait(delay)).then(anim);
                } else {
                    sequence = sequence.then(anim);
                }
            }
        }

        if (sequence) {
            if (onCompleteCallback) {
                sequence.bind({ onComplete: onCompleteCallback });
            }
            sequence.start(widget);
        }
    }

    /**
     * Create a looping animation.
     * 
     * @param animation - Animation to loop
     * @param widget - Widget to animate
     * @param iterations - Number of iterations (0 for infinite)
     * @param onIterationComplete - Callback called after each iteration
     */
    static createLoopingAnimation(
        animation: Animation,
        widget: any,
        iterations: number = 0,
        onIterationComplete?: (iteration: number) => void
    ): void {
        let currentIteration = 0;

        const startIteration = () => {
            if (iterations > 0 && currentIteration >= iterations) {
                return;
            }

            currentIteration++;

            animation.bind({
                onComplete: () => {
                    if (onIterationComplete) {
                        onIterationComplete(currentIteration);
                    }
                    startIteration();
                }
            });

            animation.start(widget);
        };

        startIteration();
    }

    /**
     * Pause all active animations on a widget.
     * 
     * @param widget - Widget to pause animations on
     */
    static pauseAllAnimations(widget: any): void {
        Animation.pauseAll(widget);
    }

    static resumeAnimations(widget: any): void {
        Animation.resumeAll(widget);
    }
}
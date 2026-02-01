import { Layer } from "../layer";
import { AnimationType, AnimationConfig } from "../types";
import { AnimationTransition } from "../../core/logic/easing";
import { completeTimingPrecision } from "../utils/timing-precision";
import { isDebugEnabled } from "../../../shared/config/debug_config";
import { calculateAnimationState, AnimationState } from "../../../shared/core/animation_logic";
import { RevealHandStrategy } from "./hand-overlay-manager";

export class LayerAnimator {
    // Cache for getTotalLength() to avoid expensive DOM reflows during animation
    // Key: SVGPathElement, Value: cached length
    private static pathLengthCache: WeakMap<SVGPathElement, number> = new WeakMap();
    private static revealStrategy = new RevealHandStrategy();

    /**
     * Preload path length into cache to avoid expensive calculations during animation.
     * Should be called during the preload phase for paths that will use draw animations.
     * 
     * @param path The SVG path element to cache the length for
     * @returns The cached length
     */
    static preloadPathLength(path: SVGPathElement): number {
        let length = this.pathLengthCache.get(path);
        if (length === undefined) {
            length = path.getTotalLength();
            this.pathLengthCache.set(path, length);
        }
        return length;
    }

    /**
     * Seek animation to a specific progress.
     */
    static seek(
        layer: Layer,
        type: AnimationType,
        config: AnimationConfig,
        progress: number,
        exitType?: AnimationType,
        exitProgress?: number,
        emphasisType?: any,
        emphasisProgress?: number,
        emphasisIntensity?: number
    ): void {
        const startState = layer.getInitialState();

        // Apply easing only to entrance if progress < 1
        const easing = config.easing || 'outCubic';
        const easedProgress = progress < 1 ? this.applyEasing(progress, easing) : 1;

        this.applyFrame(
            layer,
            type,
            startState,
            null,
            easedProgress,
            false,
            exitType,
            exitProgress,
            emphasisType,
            emphasisProgress,
            emphasisIntensity
        );
    }

    static animate(layer: Layer, type: AnimationType, config: AnimationConfig, initialProgress: number = 0): Promise<void> {
        const duration = config.duration || 1000;
        const easing = config.easing || 'outCubic';

        // Settle ratio configurable via config.settleRatio
        // Default 0.25 (25%), increased from 0.2 for better timing precision margin
        const SETTLE_RATIO = config.settleRatio !== undefined ? config.settleRatio : 0.25;

        // Effective duration for animation is total duration minus settle time
        const settleTimeMs = duration * SETTLE_RATIO;
        const animDuration = Math.max(100, duration - settleTimeMs);

        // PERFORMANCE: During warm-up, we only want to ensure resources are ready
        // and potentially set the final state, but not play the full animation loop.
        if (config.warmUp) {
            const startState = layer.captureState();
            this.applyFrame(layer, type, startState, null, 1, true);
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            // CRITICAL: If we are resuming from a non-zero progress, we MUST use the absolute
            // initial state as the startState. Otherwise, relative animations (like slide_in)
            // will calculate an incorrect endState relative to the current partial position.
            // ALSO: If we are starting from 0, we use getInitialState() to avoid using
            // any visual state that might have been set by initializeEntranceState() (which hides the layer).
            const startState = (initialProgress >= 0) ? layer.getInitialState() : layer.captureState();
            let startTime: number | null = null;
            let totalPausedTime = 0;
            const animationStartTime = performance.now();

            const animateFrame = async (timestamp: number) => {
                if (layer.isStopped) {
                    resolve();
                    return;
                }

                const wasPaused = layer.isPaused;
                const pauseStart = wasPaused ? performance.now() : 0;
                await layer.checkPlaybackState();
                if (wasPaused) {
                    const pauseDuration = performance.now() - pauseStart;
                    totalPausedTime += pauseDuration;
                }

                if (!startTime) {
                    startTime = timestamp;
                    // Adjust startTime if we are starting from a specific progress
                    if (initialProgress > 0) {
                        startTime -= (animDuration * initialProgress);
                    }
                }

                // Adjust for pause duration
                const elapsed = timestamp - startTime - totalPausedTime;
                const rawProgress = Math.min(elapsed / animDuration, 1);
                const easedProgress = this.applyEasing(rawProgress, easing);

                this.applyFrame(layer, type, startState, null, easedProgress, config.warmUp);

                if (rawProgress < 1) {
                    requestAnimationFrame(animateFrame);
                } else {
                    this.applyFrame(layer, type, startState, null, 1, config.warmUp);

                    // PRECISION TIMING: Use centralized utility for consistent timing
                    completeTimingPrecision(
                        animationStartTime,
                        duration,
                        (s) => layer.wait(s)
                    ).then(() => {
                        const actualDuration = performance.now() - animationStartTime;
                        const roundedActual = Math.round(actualDuration);
                        const roundedExpected = Math.round(duration);
                        if (isDebugEnabled()) {
                            console.log(`[LayerAnimator] Layer ${layer.getConfig().id} (${type}): Expected ${roundedExpected}ms, Actual ${roundedActual}ms`);
                        }
                        resolve();
                    });
                }
            };

            requestAnimationFrame(animateFrame);
        });
    }

    static animateExit(layer: Layer, exitType: AnimationType, config: AnimationConfig): Promise<void> {
        const duration = config.duration || 1000;
        const easing = config.easing || 'inCubic'; // Default to in for exit

        return new Promise((resolve) => {
            const startState = layer.captureState(); // Capture current state (full visibility)
            const animationStartTime = performance.now();

            const animateFrame = (timestamp: number) => {
                if (layer.isStopped) {
                    resolve();
                    return;
                }

                // Adjust for pause duration logic if needed (skipping for simplicity in exit)

                const elapsed = timestamp - animationStartTime;
                const rawProgress = Math.min(elapsed / duration, 1);
                const easedProgress = this.applyEasing(rawProgress, easing);

                // For exit: type='none', exitType=exitType, exitProgress=easedProgress
                this.applyFrame(layer, 'none', startState, null, 1, false, exitType, easedProgress);

                if (rawProgress < 1) {
                    requestAnimationFrame(animateFrame);
                } else {
                    // Ensure final state
                    this.applyFrame(layer, 'none', startState, null, 1, false, exitType, 1);
                    resolve();
                }
            };
            requestAnimationFrame(animateFrame);
        });
    }

    static animateEmphasis(layer: Layer, emphasisConfig: any, duration: number): Promise<void> {
        return new Promise((resolve) => {
            const startState = layer.getInitialState();
            let totalPausedTime = 0;
            const startTime = performance.now();
            const type = layer.getConfig().entrance_animation?.type || 'none';

            const animateFrame = async (timestamp: number) => {
                if (layer.isStopped) {
                    resolve();
                    return;
                }

                const wasPaused = layer.isPaused;
                const pauseStart = wasPaused ? performance.now() : 0;
                await layer.checkPlaybackState();
                if (wasPaused) {
                    totalPausedTime += (performance.now() - pauseStart);
                }

                const elapsed = timestamp - startTime - totalPausedTime;
                const totalProgress = Math.min(elapsed / (duration * 1000), 1);

                // Calculate emphasis progress (looping)
                const emphasisCycleDuration = emphasisConfig.duration || 1.0;
                const elapsedSinceStart = (timestamp - startTime - totalPausedTime) / 1000;
                const delay = emphasisConfig.delay || 0;
                const activeTime = elapsedSinceStart - delay;

                let emphasisProgress: number | undefined = undefined;
                if (activeTime >= 0) {
                    emphasisProgress = (activeTime % emphasisCycleDuration) / emphasisCycleDuration;
                }

                this.applyFrame(
                    layer,
                    type as AnimationType,
                    startState,
                    null,
                    1, // Entrance is finished
                    false,
                    undefined,
                    0,
                    emphasisConfig.type,
                    emphasisProgress,
                    emphasisConfig.intensity ?? 1.0
                );

                if (totalProgress < 1) {
                    requestAnimationFrame(animateFrame);
                } else {
                    resolve();
                }
            };
            requestAnimationFrame(animateFrame);
        });
    }

    /**
     * Appartient une fonction d'easing.
     */
    private static applyEasing(progress: number, easingName?: string): number {
        if (!easingName || easingName === "linear") {
            return AnimationTransition.linear(progress);
        }

        const easingMap: Record<string, string> = {
            ease_in: "inQuad",
            ease_out: "outQuad",
            ease_in_out: "inOutQuad",
            ease_in_cubic: "inCubic",
            ease_out_cubic: "outCubic",
            ease_in_out_cubic: "inOutCubic",
            ease_in_back: "inBack",
            ease_out_back: "outBack",
            ease_in_out_back: "inOutBack",
        };

        const mappedEasing = easingMap[easingName] || easingName;
        const easingFunction = (AnimationTransition as any)[mappedEasing];

        if (typeof easingFunction === "function") {
            return easingFunction(progress);
        }

        return AnimationTransition.linear(progress);
    }

    /**
     * Interpolates between keyframes based on progress.
     */
    private static interpolateKeyframes(progress: number, keyframes: any[]): any {
        let frame = keyframes[0];
        for (let i = 0; i < keyframes.length - 1; i++) {
            if (progress >= keyframes[i].p && progress <= keyframes[i + 1].p) {
                const t = (progress - keyframes[i].p) / (keyframes[i + 1].p - keyframes[i].p);
                const nextFrame = keyframes[i + 1];
                const currentFrame = keyframes[i];

                frame = { ...currentFrame };

                // Interpolate all numeric properties
                for (const key in currentFrame) {
                    if (key !== 'p' && typeof currentFrame[key] === 'number' && typeof nextFrame[key] === 'number') {
                        frame[key] = currentFrame[key] + (nextFrame[key] - currentFrame[key]) * t;
                    }
                }
                break;
            }
        }
        return frame;
    }

    /**
     * Applique une frame d'animation sur le layer.
     */
    private static applyFrame(
        layer: Layer,
        type: AnimationType,
        startState: any,
        _endState: any,
        progress: number,
        warmUp: boolean = false,
        exitType?: AnimationType,
        exitProgress?: number,
        emphasisType?: any,
        emphasisProgress?: number,
        emphasisIntensity?: number
    ): void {
        const element = layer.getElement();

        // Skip opacity changes during warm-up
        const setOpacity = (opacity: number) => {
            if (!warmUp) {
                layer.setOpacity(opacity);
            }
        };

        const initialAnimState: AnimationState = {
            position: { ...startState.position },
            scale: startState.scale ?? 1,
            rotation: startState.rotation ?? 0,
            opacity: startState.opacity ?? 1,
            scaleX: startState.scaleX ?? 1,
            scaleY: startState.scaleY ?? 1,
            skewX: startState.skewX ?? 0
        };

        const currentState = calculateAnimationState(
            type,
            progress,
            initialAnimState,
            exitType,
            exitProgress,
            emphasisType,
            emphasisProgress,
            emphasisIntensity
        );

        // Apply shared state
        layer.setPosition(currentState.position.x, currentState.position.y);
        layer.setScale(currentState.scale);
        layer.setRotation(currentState.rotation);
        setOpacity(currentState.opacity);

        if (currentState.skewX !== undefined) {
            layer.setSkewX(currentState.skewX);
        }

        // Handle non-uniform scaling if present
        if (currentState.scaleX !== 1 || currentState.scaleY !== 1) {
            if (element) {
                // We let layer.applyTransform handle the transform string construction
                // but we need to ensure scaleX/scaleY are updated in config
                (layer.getConfig() as any).scaleX = currentState.scaleX;
                (layer.getConfig() as any).scaleY = currentState.scaleY;
                // Trigger transform update
                layer.setPosition(currentState.position.x, currentState.position.y);
            }
        }

        // Handle specific logic for some types that need more than just transform/opacity
        if (currentState.strokeProgress !== undefined) {
            const strokeProgress = currentState.strokeProgress;

            if (type === 'draw') {
                if (element && element.tagName === 'path') {
                    const path = element as SVGPathElement;
                    let length = this.pathLengthCache.get(path);
                    if (length === undefined) {
                        length = path.getTotalLength();
                        this.pathLengthCache.set(path, length);
                    }

                    path.style.strokeDasharray = length.toString();
                    path.style.strokeDashoffset = (length * (1 - strokeProgress)).toString();
                }
            }
            // typewriter and char_fade are handled by specialized layers
        }

        if (currentState.revealProgress !== undefined) {
            const revealProgress = currentState.revealProgress;
            const pattern = currentState.revealPattern;

            if (element) {
                let clipPathId = element.getAttribute('clip-path');
                let clipPath: SVGClipPathElement | null = null;

                if (clipPathId && clipPathId.startsWith('url(#')) {
                    const id = clipPathId.substring(5, clipPathId.length - 1);
                    clipPath = document.getElementById(id) as unknown as SVGClipPathElement;
                }

                if (!clipPath) {
                    const id = `clip-${layer.getConfig().id}-${Math.random().toString(36).substr(2, 9)}`;
                    clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
                    clipPath.setAttribute('id', id);
                    clipPath.setAttribute('clipPathUnits', 'objectBoundingBox');

                    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                    clipPath.appendChild(polygon);

                    // Find the root SVG element
                    let svg = element.ownerSVGElement;
                    if (!svg) {
                        // If not in DOM yet, try to find it via parent nodes
                        let parent = element.parentElement;
                        while (parent && parent.tagName.toLowerCase() !== 'svg') {
                            parent = parent.parentElement;
                        }
                        svg = parent as unknown as SVGSVGElement;
                    }

                    if (svg) {
                        let defs = svg.querySelector('defs');
                        if (!defs) {
                            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                            svg.insertBefore(defs, svg.firstChild);
                        }
                        defs.appendChild(clipPath);
                        element.setAttribute('clip-path', `url(#${id})`);
                    } else {
                        // If still no SVG, we might be in a detached fragment
                        // We'll try to find or create a defs in the closest fragment/element
                        let root: Node = element;
                        while (root.parentNode) root = root.parentNode;

                        let defs = (root as any).querySelector?.('defs');
                        if (!defs && (root as any).appendChild) {
                            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                            (root as any).appendChild(defs);
                        }
                        if (defs) {
                            defs.appendChild(clipPath);
                            element.setAttribute('clip-path', `url(#${id})`);
                        }
                    }
                }

                const polygon = clipPath.querySelector('polygon');
                if (!polygon) return;

                // Reveal patterns
                let points = "";
                if (pattern === 'horizontal') {
                    points = `0,0 ${revealProgress},0 ${revealProgress},1 0,1`;
                } else if (pattern === 'vertical') {
                    points = `0,0 1,0 1,${revealProgress} 0,${revealProgress}`;
                } else {
                    // Diagonal reveal from top-left to bottom-right (default)
                    const p = revealProgress * 2;
                    if (p <= 1) {
                        // Triangle growing from top-left
                        points = `0,0 ${p},0 0,${p}`;
                    } else {
                        // Trapezoid/Pentagon filling the rest
                        const p2 = p - 1;
                        points = `0,0 1,0 1,${p2} ${p2},1 0,1`;
                    }
                }
                polygon.setAttribute('points', points);

                // Update hand position for reveal animation
                const handManager = layer.getHandOverlayManager();
                if (handManager && handManager.isEnabled()) {
                    const proxy = layer.getOcclusionProxy();
                    const canvas = layer.getHandOverlayCanvas();

                    // Temporarily use RevealHandStrategy
                    const originalStrategy = handManager.getStrategy();
                    handManager.setStrategy(new RevealHandStrategy());

                    handManager.updateHandPosition(revealProgress, {
                        proxy,
                        revealPattern: pattern || 'diagonal',
                        isGlobalProxy: true
                    }, canvas || undefined, (p) => layer.transformToGlobal(p));

                    if (Math.random() < 0.05) {
                        console.log(`[Animator] Reveal Hand Update: progress=${revealProgress.toFixed(2)}, proxy=(${proxy.x.toFixed(1)}, ${proxy.y.toFixed(1)})`);
                    }

                    // Restore original strategy
                    if (originalStrategy) handManager.setStrategy(originalStrategy);
                }
            }
        } else if (currentState.eraseProgress !== undefined) {
            const eraseProgress = currentState.eraseProgress;
            const pattern = 'diagonal'; // Default to diagonal for now

            if (element) {
                let clipPathId = element.getAttribute('clip-path');
                let clipPath: SVGClipPathElement | null = null;

                if (clipPathId && clipPathId.startsWith('url(#')) {
                    const id = clipPathId.substring(5, clipPathId.length - 1);
                    clipPath = document.getElementById(id) as unknown as SVGClipPathElement;
                }

                if (!clipPath) {
                    const id = `clip-erase-${layer.getConfig().id}-${Math.random().toString(36).substr(2, 9)}`;
                    clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
                    clipPath.setAttribute('id', id);
                    clipPath.setAttribute('clipPathUnits', 'objectBoundingBox');

                    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                    clipPath.appendChild(polygon);

                    // Find root SVG (reusing logic from reveal)
                    let root: Node = element;
                    while (root.parentNode && (root.parentNode as any).tagName !== 'svg') {
                        root = root.parentNode;
                    }
                    // Try to find SVG parent more reliably
                    let svg = element.ownerSVGElement;
                    if (!svg) {
                        let parent = element.parentElement;
                        while (parent && parent.tagName.toLowerCase() !== 'svg') parent = parent.parentElement;
                        svg = parent as unknown as SVGSVGElement;
                    }

                    if (svg) {
                        let defs = svg.querySelector('defs');
                        if (!defs) {
                            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                            svg.insertBefore(defs, svg.firstChild);
                        }
                        defs.appendChild(clipPath);
                        element.setAttribute('clip-path', `url(#${id})`);
                    }
                }

                const polygon = clipPath.querySelector('polygon');
                if (!polygon) return;

                // Eraser patterns (inverse of reveal)
                // We want to define the VISIBLE part.
                // As progress goes 0->1, visible part shrinks.
                // Diagonal erase: starts top-left, moves to bottom-right.
                // Visible part is the bottom-right remnant.

                let points = "";
                const p = eraseProgress * 2;

                // Reuse logic from Scene.ts but normalized to 0-1 coords
                // Visible area logic:
                if (p <= 1) {
                    // Trapezoid/Pentagon reduced from full rect
                    // Top-left corner is cut off.
                    // Cut line goes from (p, 0) to (0, p)
                    // Visible polygon: (p,0) (1,0) (1,1) (0,1) (0,p)
                    points = `${p},0 1,0 1,1 0,1 0,${p}`;
                } else {
                    // Triangle shrinking at bottom-right
                    // Cut line goes from (1, p-1) to (p-1, 1)
                    // Visible polygon: (1, p-1) (1,1) (p-1,1)
                    const p2 = p - 1;
                    points = `1,${p2} 1,1 ${p2},1`;
                }

                polygon.setAttribute('points', points);

                // Update hand position
                const handManager = layer.getHandOverlayManager();
                if (handManager && handManager.isEnabled()) {
                    const proxy = layer.getOcclusionProxy();
                    const canvas = layer.getHandOverlayCanvas();

                    // updateHandPosition logic.
                    // RevealHandStrategy calculates position based on proxy and pattern (diagonal),
                    // which matches our eraser mask logic (growing erased area from top-left).
                    const originalStrategy = handManager.getStrategy();
                    handManager.setStrategy(new RevealHandStrategy());

                    // We pass eraseProgress directly. Reveal calls it 'revealProgress' but it's just 'progress' argument.
                    // The pattern 'diagonal' will move hand from top-left to bottom-right.

                    handManager.updateHandPosition(eraseProgress, {
                        proxy,
                        revealPattern: 'diagonal', // RevealStrategy expects 'revealPattern'
                        isGlobalProxy: true
                    }, canvas || undefined, (p) => layer.transformToGlobal(p));

                    // Restore original strategy
                    if (originalStrategy) handManager.setStrategy(originalStrategy);
                }
            }

        } else if (element && element.hasAttribute('clip-path')) {
            // ... existing cleanup logic ...
            const clipPathId = element.getAttribute('clip-path');
            if (clipPathId && (clipPathId.includes('clip-') || clipPathId.includes('clip-erase-'))) {
                const id = clipPathId.substring(5, clipPathId.length - 1);
                const clipPath = document.getElementById(id);
                if (clipPath) {
                    // Reset to full visibility
                    const rect = clipPath.querySelector('rect');
                    if (rect) {
                        rect.setAttribute('width', '1');
                        rect.setAttribute('height', '1');
                    }
                    const polygon = clipPath.querySelector('polygon');
                    if (polygon) {
                        polygon.setAttribute('points', '0,0 1,0 1,1 0,1');
                    }
                }
            }
        }
    }
}

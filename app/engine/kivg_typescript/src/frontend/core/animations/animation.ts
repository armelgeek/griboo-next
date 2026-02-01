/**
 * Animation module for canvas-based rendering.
 * Provides a standalone animation system with property interpolation.
 */

import { AnimationTransition } from '../logic/easing';

type AnimationCallback = (animation: Animation, widget: any) => void;
type ProgressCallback = (animation: Animation, widget: any, progress: number) => void;
type FrameCallback = (widget: any, progress: number) => void;
type TransitionFunction = (progress: number) => number;

interface AnimationOptions {
    duration?: number;
    d?: number;
    transition?: string | TransitionFunction;
    t?: string | TransitionFunction;
    [key: string]: any;
}

interface WidgetAnimationState {
    widget: any;
    properties: Map<string, [any, any]>;
    startTime: number | null;
    isPaused: boolean;
    pausedAt: number | null;
    totalPausedTime: number;
}

/**
 * Simple animation class for property interpolation.
 */
export class Animation {
    private static _instances: Set<Animation> = new Set();

    private _duration: number;
    private _transition: TransitionFunction;
    private _transitionName: string;
    private _animatedProperties: Record<string, any>;
    private _widgets: Map<number, WidgetAnimationState>;

    private _onStartCallbacks: AnimationCallback[];
    private _onProgressCallbacks: ProgressCallback[];
    private _onCompleteCallbacks: AnimationCallback[];

    private _widgetIdCounter = 0;
    private _widgetIdMap: WeakMap<any, number>;

    constructor(options: AnimationOptions) {
        this._duration = options.d ?? options.duration ?? 1.0;
        this._transitionName = (options.t ?? options.transition ?? 'linear') as string;

        if (typeof this._transitionName === 'string') {
            // Convert snake_case to camelCase for transition names
            const camelCase = this._transitionName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            this._transition = (AnimationTransition as any)[camelCase] || AnimationTransition.linear;
        } else {
            this._transition = this._transitionName as TransitionFunction;
        }

        // Extract animated properties (excluding duration and transition)
        const { d, duration, t, transition, ...animProps } = options;
        this._animatedProperties = animProps;

        this._widgets = new Map();
        this._widgetIdMap = new WeakMap();

        this._onStartCallbacks = [];
        this._onProgressCallbacks = [];
        this._onCompleteCallbacks = [];
    }

    get duration(): number {
        return this._duration;
    }

    get transition(): TransitionFunction {
        return this._transition;
    }

    get animatedProperties(): Record<string, any> {
        return this._animatedProperties;
    }

    /**
     * Bind callbacks to animation events.
     */
    bind(callbacks: {
        onStart?: AnimationCallback;
        onProgress?: ProgressCallback;
        onComplete?: AnimationCallback;
    }): void {
        if (callbacks.onStart) {
            this._onStartCallbacks.push(callbacks.onStart);
        }
        if (callbacks.onProgress) {
            this._onProgressCallbacks.push(callbacks.onProgress);
        }
        if (callbacks.onComplete) {
            this._onCompleteCallbacks.push(callbacks.onComplete);
        }
    }

    /**
     * Unbind callbacks from animation events.
     */
    unbind(callbacks: {
        onStart?: AnimationCallback;
        onProgress?: ProgressCallback;
        onComplete?: AnimationCallback;
    }): void {
        if (callbacks.onStart) {
            const idx = this._onStartCallbacks.indexOf(callbacks.onStart);
            if (idx !== -1) this._onStartCallbacks.splice(idx, 1);
        }
        if (callbacks.onProgress) {
            const idx = this._onProgressCallbacks.indexOf(callbacks.onProgress);
            if (idx !== -1) this._onProgressCallbacks.splice(idx, 1);
        }
        if (callbacks.onComplete) {
            const idx = this._onCompleteCallbacks.indexOf(callbacks.onComplete);
            if (idx !== -1) this._onCompleteCallbacks.splice(idx, 1);
        }
    }

    private _dispatch(event: 'onStart' | 'onProgress' | 'onComplete', widget: any, progress?: number): void {
        if (event === 'onStart') {
            this._onStartCallbacks.forEach(cb => cb(this, widget));
        } else if (event === 'onProgress' && progress !== undefined) {
            this._onProgressCallbacks.forEach(cb => cb(this, widget, progress));
        } else if (event === 'onComplete') {
            this._onCompleteCallbacks.forEach(cb => cb(this, widget));
        }
    }

    private _getWidgetId(widget: any): number {
        if (!this._widgetIdMap.has(widget)) {
            this._widgetIdMap.set(widget, ++this._widgetIdCounter);
        }
        return this._widgetIdMap.get(widget)!;
    }

    /**
     * Start the animation on a widget/object.
     */
    start(widget: any): void {
        this.stop(widget);
        this._initialize(widget);
        Animation._instances.add(this);
        this._dispatch('onStart', widget);
    }

    /**
     * Stop the animation, triggering onComplete.
     */
    stop(widget: any): void {
        const uid = this._getWidgetId(widget);
        if (this._widgets.has(uid)) {
            this._widgets.delete(uid);
            this._dispatch('onComplete', widget);
        }
        this.cancel(widget);
    }

    /**
     * Pause the animation for a widget.
     */
    pause(widget: any): void {
        const uid = this._getWidgetId(widget);
        const state = this._widgets.get(uid);
        if (state && !state.isPaused) {
            state.isPaused = true;
            state.pausedAt = performance.now();
        }
    }

    /**
     * Resume the animation for a widget.
     */
    resume(widget: any): void {
        const uid = this._getWidgetId(widget);
        const state = this._widgets.get(uid);
        if (state && state.isPaused && state.pausedAt !== null) {
            state.totalPausedTime += performance.now() - state.pausedAt;
            state.isPaused = false;
            state.pausedAt = null;
        }
    }

    /**
     * Cancel the animation without triggering onComplete.
     */
    cancel(widget: any): void {
        const uid = this._getWidgetId(widget);
        if (this._widgets.has(uid)) {
            this._widgets.delete(uid);
        }
        if (this._widgets.size === 0 && Animation._instances.has(this)) {
            Animation._instances.delete(this);
        }
    }

    /**
     * Cancel all animations on a widget.
     */
    static cancelAll(widget: any, ...properties: string[]): void {
        for (const animation of Array.from(Animation._instances)) {
            if (properties.length > 0) {
                properties.forEach(prop => animation.cancelProperty(widget, prop));
            } else {
                animation.cancel(widget);
            }
        }
    }

    /**
     * Pause all active animations on a widget.
     */
    static pauseAll(widget: any): void {
        for (const animation of Array.from(Animation._instances)) {
            animation.pause(widget);
        }
    }

    /**
     * Resume all paused animations on a widget.
     */
    static resumeAll(widget: any): void {
        for (const animation of Array.from(Animation._instances)) {
            animation.resume(widget);
        }
    }

    /**
     * Cancel animation of a specific property.
     */
    cancelProperty(widget: any, prop: string): void {
        const uid = this._getWidgetId(widget);
        const state = this._widgets.get(uid);
        if (state) {
            state.properties.delete(prop);
            if (state.properties.size === 0) {
                this.cancel(widget);
            }
        }
    }

    /**
     * Check if widget still has properties to animate.
     */
    havePropertiesToAnimate(widget: any): boolean {
        const uid = this._getWidgetId(widget);
        const state = this._widgets.get(uid);
        return state !== undefined && state.properties.size > 0;
    }

    private _initialize(widget: any): void {
        const uid = this._getWidgetId(widget);
        const properties = new Map<string, [any, any]>();

        // Store initial values
        for (const [key, target] of Object.entries(this._animatedProperties)) {
            const original = widget[key];
            let originalValue: any;

            if (Array.isArray(original)) {
                originalValue = [...original];
            } else if (original && typeof original === 'object') {
                originalValue = { ...original };
            } else {
                originalValue = original;
            }

            properties.set(key, [originalValue, target]);
        }

        this._widgets.set(uid, {
            widget,
            properties,
            startTime: null,
            isPaused: false,
            pausedAt: null,
            totalPausedTime: 0
        });
    }

    /**
     * Update animation state.
     * Returns true if animation is still running, false if complete.
     */
    update(_dt: number, widget: any): boolean {
        const uid = this._getWidgetId(widget);
        const anim = this._widgets.get(uid);

        if (!anim || anim.isPaused) {
            return anim ? true : false;
        }

        if (anim.startTime === null) {
            anim.startTime = performance.now();
        }

        const elapsed = (performance.now() - anim.startTime - anim.totalPausedTime) / 1000;

        // Calculate progress
        const progress = this._duration > 0 ? Math.min(1.0, elapsed / this._duration) : 1.0;
        const t = this._transition(progress);

        // Update properties
        for (const [key, [startVal, endVal]] of anim.properties.entries()) {
            const value = this._calculate(startVal, endVal, t);
            widget[key] = value;
        }

        this._dispatch('onProgress', widget, progress);

        // Check if complete
        if (progress >= 1.0) {
            this.stop(widget);
            return false;
        }

        return true;
    }

    private _calculate(a: any, b: any, t: number): any {
        if (Array.isArray(a)) {
            return a.map((val, i) => this._calculate(val, b[i], t));
        } else if (a && typeof a === 'object' && !Array.isArray(a)) {
            const result: any = {};
            for (const key in a) {
                result[key] = this._calculate(a[key], b[key] ?? 0, t);
            }
            return result;
        } else {
            return a * (1 - t) + b * t;
        }
    }

    /**
     * Run animation synchronously and return all frames.
     * Useful for generating animation frames for export.
     */
    animateSync(widget: any, fps: number = 60, onFrame?: FrameCallback): number[] {
        const frames: number[] = [];
        const numFrames = Math.max(1, Math.floor(this._duration * fps));

        // Store initial values
        const initialValues: Record<string, any> = {};
        for (const key of Object.keys(this._animatedProperties)) {
            initialValues[key] = widget[key];
        }

        for (let i = 0; i <= numFrames; i++) {
            const progress = numFrames > 0 ? i / numFrames : 1.0;
            const t = this._transition(progress);

            // Update properties
            for (const [key, target] of Object.entries(this._animatedProperties)) {
                const startVal = initialValues[key];
                const value = this._calculate(startVal, target, t);
                widget[key] = value;
            }

            // Call frame callback
            if (onFrame) {
                onFrame(widget, progress);
            }

            frames.push(progress);
        }

        return frames;
    }

    /**
     * Create sequential animation (this + other).
     */
    then(other: Animation): Sequence {
        return new Sequence(this, other);
    }

    /**
     * Create parallel animation (this & other).
     */
    and(other: Animation): Parallel {
        return new Parallel(this, other);
    }
}

/**
 * Wait animation - does nothing for a specified duration.
 * Useful for delays in sequences.
 */
export class Wait extends Animation {
    constructor(duration: number) {
        super({ duration });
    }
}

/**
 * Base class for compound animations (Sequence and Parallel).
 */
abstract class CompoundAnimation extends Animation {
    protected anim1!: Animation;
    protected anim2!: Animation;

    constructor() {
        super({ duration: 0 });
    }

    havePropertiesToAnimate(widget: any): boolean {
        return (
            this.anim1.havePropertiesToAnimate(widget) ||
            this.anim2.havePropertiesToAnimate(widget)
        );
    }

    get animatedProperties(): Record<string, any> {
        return {
            ...this.anim1.animatedProperties,
            ...this.anim2.animatedProperties
        };
    }
}

/**
 * Sequential animation - runs animations one after another.
 */
export class Sequence extends CompoundAnimation {
    private _widgetStates: Map<number, boolean>;
    private _sequenceWidgetIdMap: WeakMap<any, number>;
    private _sequenceWidgetIdCounter = 0;
    repeat: boolean = false;

    constructor(anim1: Animation, anim2: Animation) {
        super();
        this.anim1 = anim1;
        this.anim2 = anim2;
        this._widgetStates = new Map();
        this._sequenceWidgetIdMap = new WeakMap();
    }

    get duration(): number {
        return this.anim1.duration + this.anim2.duration;
    }

    private _getSequenceWidgetId(widget: any): number {
        if (!this._sequenceWidgetIdMap.has(widget)) {
            this._sequenceWidgetIdMap.set(widget, ++this._sequenceWidgetIdCounter);
        }
        return this._sequenceWidgetIdMap.get(widget)!;
    }

    start(widget: any): void {
        this.stop(widget);
        const uid = this._getSequenceWidgetId(widget);
        this._widgetStates.set(uid, true);

        const onAnim1Complete = (_anim: Animation, w: any) => {
            if (this._widgetStates.has(this._getSequenceWidgetId(w))) {
                this.anim2.start(w);
            }
        };

        const onAnim2Complete = (_anim: Animation, w: any) => {
            const wid = this._getSequenceWidgetId(w);
            if (!this._widgetStates.has(wid)) {
                return;
            }
            if (this.repeat) {
                this.anim1.start(w);
            } else {
                this.stop(w);
            }
        };

        this.anim1.bind({ onComplete: onAnim1Complete });
        this.anim2.bind({ onComplete: onAnim2Complete });

        this.anim1.start(widget);
    }

    stop(widget: any): void {
        const uid = this._getSequenceWidgetId(widget);
        if (this._widgetStates.has(uid)) {
            this._widgetStates.delete(uid);
            this.anim1.stop(widget);
            this.anim2.stop(widget);
        }
    }

    pause(widget: any): void {
        this.anim1.pause(widget);
        this.anim2.pause(widget);
    }

    resume(widget: any): void {
        this.anim1.resume(widget);
        this.anim2.resume(widget);
    }

    cancel(widget: any): void {
        const uid = this._getSequenceWidgetId(widget);
        if (this._widgetStates.has(uid)) {
            this._widgetStates.delete(uid);
        }
        this.anim1.cancel(widget);
        this.anim2.cancel(widget);
    }
    animateSync(widget: any, fps: number = 60, onFrame?: FrameCallback): number[] {
        const frames1 = this.anim1.animateSync(widget, fps, onFrame);
        const frames2 = this.anim2.animateSync(widget, fps, onFrame);
        return [...frames1, ...frames2];
    }
}

/**
 * Parallel animation - runs animations simultaneously.
 */
export class Parallel extends CompoundAnimation {
    private _widgetStates: Map<number, { complete: number }>;
    private _parallelWidgetIdMap: WeakMap<any, number>;
    private _parallelWidgetIdCounter = 0;

    constructor(anim1: Animation, anim2: Animation) {
        super();
        this.anim1 = anim1;
        this.anim2 = anim2;
        this._widgetStates = new Map();
        this._parallelWidgetIdMap = new WeakMap();
    }

    get duration(): number {
        return Math.max(this.anim1.duration, this.anim2.duration);
    }

    private _getParallelWidgetId(widget: any): number {
        if (!this._parallelWidgetIdMap.has(widget)) {
            this._parallelWidgetIdMap.set(widget, ++this._parallelWidgetIdCounter);
        }
        return this._parallelWidgetIdMap.get(widget)!;
    }

    start(widget: any): void {
        this.stop(widget);
        const uid = this._getParallelWidgetId(widget);
        this._widgetStates.set(uid, { complete: 0 });

        const onAnimComplete = (_anim: Animation, w: any) => {
            const wid = this._getParallelWidgetId(w);
            const state = this._widgetStates.get(wid);
            if (state) {
                state.complete += 1;
                if (state.complete >= 2) {
                    this.stop(w);
                }
            }
        };

        this.anim1.bind({ onComplete: onAnimComplete });
        this.anim2.bind({ onComplete: onAnimComplete });

        this.anim1.start(widget);
        this.anim2.start(widget);
    }

    stop(widget: any): void {
        const uid = this._getParallelWidgetId(widget);
        if (this._widgetStates.has(uid)) {
            this._widgetStates.delete(uid);
        }
        this.anim1.cancel(widget);
        this.anim2.cancel(widget);
    }

    pause(widget: any): void {
        this.anim1.pause(widget);
        this.anim2.pause(widget);
    }

    resume(widget: any): void {
        this.anim1.resume(widget);
        this.anim2.resume(widget);
    }

    cancel(widget: any): void {
        const uid = this._getParallelWidgetId(widget);
        if (this._widgetStates.has(uid)) {
            this._widgetStates.delete(uid);
        }
        this.anim1.cancel(widget);
        this.anim2.cancel(widget);
    }
}
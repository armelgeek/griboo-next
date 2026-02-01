import { LayerConfig, OcclusionProxy, WhiteboardConfig } from '../types';
import { TimingManager } from '../infra/timing_manager';
import { calculateAnimationState, AnimationState } from './animation_logic';

/**
 * Base class for all layers (frontend and server).
 * Contains platform-agnostic logic for configuration, timing, and transformations.
 */
export abstract class BaseLayer {
    protected config: LayerConfig;
    protected isPrepared: boolean = false;
    protected handsConfig?: WhiteboardConfig['hands'];
    protected viewportScale: number = 1.0;

    constructor(config: LayerConfig, handsConfig?: WhiteboardConfig['hands'], viewportScale: number = 1.0) {
        this.config = config;
        this.handsConfig = handsConfig;
        this.viewportScale = viewportScale;
    }

    /**
     * Set the viewport scale for this layer
     */
    public setViewportScale(scale: number): void {
        this.viewportScale = scale;
    }

    /**
     * Set global hand configuration for this layer
     */
    public setGlobalHandsConfig(config: WhiteboardConfig['hands']): void {
        this.handsConfig = config;
    }

    /**
     * Get the layer configuration
     */
    getConfig(): LayerConfig {
        return this.config;
    }

    /**
     * Check if the layer is prepared
     */
    getIsPrepared(): boolean {
        return this.isPrepared;
    }

    /**
     * Check if the layer is centered.
     * Most layers in this engine are centered by default.
     */
    isCentered(): boolean {
        const config = this.config as any;
        const isText = config.type === 'text' || config.text_config || config.text;
        const shapeConfig = config.shape_config || {};
        const shapeType = shapeConfig.shape || config.shape;

        return !!(
            isText ||
            config.type === 'svg' ||
            config.type === 'kivg' ||
            ['circle', 'ellipse', 'star', 'triangle', 'polygon', 'hexagon', 'rectangle', 'square'].includes(shapeType)
        );
    }

    /**
     * Calculate animation progress (0-1) based on scene time
     */
    protected getAnimationProgress(time: number): number {
        const timing = TimingManager.calculateLayerTiming(this.config);
        const relativeTime = time - timing.entranceDelay;

        if (relativeTime < 0) return 0;
        if (relativeTime >= timing.animationDuration) return 1;

        return relativeTime / timing.animationDuration;
    }

    /**
     * Calculate exit animation progress (0-1) based on scene time
     */
    protected getExitProgress(time: number): number {
        const timing = TimingManager.calculateLayerTiming(this.config);
        const exitStartTime = timing.occlusionDuration + timing.entranceDelay + timing.animationDuration + timing.pauseDuration;
        const relativeTime = time - exitStartTime;

        if (relativeTime < 0) return 0;
        const exitAnimDuration = TimingManager.getLayerExitDuration(this.config);
        if (exitAnimDuration <= 0) return 0;
        if (relativeTime >= exitAnimDuration) return 1;

        return relativeTime / exitAnimDuration;
    }

    /**
     * Calculate scene time from entrance animation progress
     */
    protected getTimeFromEntranceProgress(progress: number): number {
        const timing = TimingManager.calculateLayerTiming(this.config);
        return timing.entranceDelay + progress * timing.animationDuration;
    }

    /**
     * Check if the layer is visible at the given time
     */
    isVisible(time: number): boolean {
        const timing = TimingManager.calculateLayerTiming(this.config);
        if (time < timing.entranceDelay) return false;

        // If there's an exit animation, we check if it's finished
        if (this.config.exit_animation && this.config.exit_animation.type !== 'none') {
            if (time >= timing.totalDuration) return false;
        }

        return true;
    }

    /**
     * Transform a point from local coordinates to global scene coordinates based on layer transform
     */
    transformToGlobal(point: { x: number, y: number }): { x: number, y: number } {
        let x = point.x;
        let y = point.y;

        if (this.isCentered()) {
            x -= (this.config.width || 0) / 2;
            y -= (this.config.height || 0) / 2;
        }

        const pos = this.config.position || { x: 0, y: 0 };
        const scaleX = this.config.scaleX ?? this.config.scale ?? 1;
        const scaleY = this.config.scaleY ?? this.config.scale ?? 1;
        const rotation = this.config.rotation ?? 0;

        // 1. Scale
        x *= scaleX;
        y *= scaleY;

        // 2. Rotate
        if (rotation !== 0) {
            const rad = (rotation * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const rx = x * cos - y * sin;
            const ry = x * sin + y * cos;
            x = rx;
            y = ry;
        }

        // 3. Translate
        x += pos.x;
        y += pos.y;

        return { x, y };
    }

    /**
     * Calculates the animated transform state for a given animation progress.
     */
    protected getAnimatedTransform(progress: number, exitProgress: number): AnimationState {
        const startState: AnimationState = {
            position: this.config.position ? { ...this.config.position } : { x: 0, y: 0 },
            scale: this.config.scale ?? 1,
            rotation: this.config.rotation ?? 0,
            opacity: this.config.opacity ?? 1,
            scaleX: this.config.scaleX ?? this.config.scale ?? 1,
            scaleY: this.config.scaleY ?? this.config.scale ?? 1,
            skewX: this.config.skewX ?? 0
        };

        const animType = this.config.entrance_animation?.type || 'draw';
        const exitType = this.config.exit_animation?.type || 'fade_out';

        return calculateAnimationState(
            animType,
            progress,
            startState,
            exitType,
            exitProgress
        );
    }

    /**
     * Apply a transform state to a point.
     */
    protected applyTransformToPoint(x: number, y: number, state: AnimationState): { x: number; y: number } {
        // 1. Scale
        const scaleX = state.scaleX ?? state.scale ?? 1;
        const scaleY = state.scaleY ?? state.scale ?? 1;
        x *= scaleX;
        y *= scaleY;

        // 2. Skew
        if (state.skewX) {
            const skewRad = (state.skewX * Math.PI) / 180;
            x += y * Math.tan(skewRad);
        }

        // 3. Rotate
        if (state.rotation !== 0) {
            const rad = (state.rotation * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const rx = x * cos - y * sin;
            const ry = x * sin + y * cos;
            x = rx;
            y = ry;
        }

        // 4. Translate
        x += state.position.x;
        y += state.position.y;

        return { x, y };
    }

    /**
     * Transform a point from local coordinates to global scene coordinates based on layer transform AND animation.
     */
    transformToGlobalAnimated(point: { x: number; y: number }, time: number): { x: number; y: number } {
        const progress = this.getAnimationProgress(time);
        const exitProgress = this.getExitProgress(time);
        const currentState = this.getAnimatedTransform(progress, exitProgress);

        let x = point.x;
        let y = point.y;

        if (this.isCentered()) {
            x -= (this.config.width || 0) / 2;
            y -= (this.config.height || 0) / 2;
        }

        return this.applyTransformToPoint(x, y, currentState);
    }

    /**
     * Get the occlusion proxy for this layer at a specific time.
     * @param time - Scene time in seconds. If undefined, returns the base proxy.
     * @param forceFull - If true, returns the full bounds regardless of current time.
     */
    getOcclusionProxy(time?: number, forceFull: boolean = false): OcclusionProxy {
        let pos = this.config.position || { x: 0, y: 0 };
        let scaleX = this.config.scaleX ?? this.config.scale ?? 1;
        let scaleY = this.config.scaleY ?? this.config.scale ?? 1;
        let rotation = this.config.rotation ?? 0;
        let opacity = this.config.opacity ?? 1;

        if (forceFull || time !== undefined) {
            const progress = forceFull ? 1.0 : this.getAnimationProgress(time!);
            const exitProgress = forceFull ? 0.0 : this.getExitProgress(time!);

            const startState: AnimationState = {
                position: { ...pos },
                scale: this.config.scale ?? 1,
                scaleX,
                scaleY,
                rotation,
                opacity
            };

            const animType = this.config.entrance_animation?.type || 'draw';
            const exitType = this.config.exit_animation?.type || 'fade_out';

            const currentState = calculateAnimationState(
                animType,
                progress,
                startState,
                exitType,
                exitProgress
            );

            pos = currentState.position;
            scaleX = currentState.scaleX ?? currentState.scale ?? 1;
            scaleY = currentState.scaleY ?? currentState.scale ?? 1;
            rotation = currentState.rotation;
            opacity = currentState.opacity;
        }

        const width = this.config.width || 0;
        const height = this.config.height || 0;

        // Determine proxy type and handle centering
        const shapeConfig = (this.config as any).shape_config || {};
        const shapeType = shapeConfig.shape || this.config.shape || 'rect';

        let proxyType: 'rect' | 'circle' | 'ellipse' | 'path' = 'rect';
        if (shapeType === 'circle') proxyType = 'circle';
        else if (shapeType === 'ellipse') proxyType = 'ellipse';
        else if (shapeType === 'path' || shapeType === 'svg') proxyType = 'path';

        let x = pos.x;
        let y = pos.y;

        // If it's a rect-type proxy but the layer is centered, we need to shift x/y to top-left
        // because OcclusionLogic expects top-left for 'rect' type.
        const w = width * scaleX;
        const h = height * scaleY;

        let left = x;
        let top = y;

        if (this.isCentered() || proxyType === 'circle' || proxyType === 'ellipse') {
            left -= w / 2;
            top -= h / 2;
        }

        return {
            type: proxyType,
            x: x,
            y: y,
            width: w,
            height: h,
            logicalWidth: w,
            logicalHeight: h,
            opacity: opacity,
            left: left,
            right: left + w,
            top: top,
            bottom: top + h
        };
    }
}

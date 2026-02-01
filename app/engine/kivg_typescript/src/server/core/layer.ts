import { CanvasRenderingContext2D } from 'canvas';
import { LayerConfig, OcclusionProxy, Coordinate, WhiteboardConfig, EmphasisAnimationType } from '../../shared/types';
import { HandOverlayManager } from './hand_overlay_manager';
import { BaseLayer } from '../../shared/core/layer';
import { calculateAnimationState, AnimationState } from '../../shared/core/animation_logic';
import { TimingManager, LayerTimingBreakdown } from '../../shared/infra/timing_manager';
import { EraserHandStrategy } from '../../shared/core/hand_overlay_manager';

/**
 * Base class for server-side layers.
 * Platform-specific logic for rendering and animation.
 */
export abstract class ServerLayer extends BaseLayer {
    protected handOverlayManager: HandOverlayManager | null = null;
    protected occlusionMaskPaths: { path: Coordinate[], radius: number, startTime: number, duration: number, upperLayer?: ServerLayer }[] = [];
    protected absoluteTiming: LayerTimingBreakdown | null = null;
    protected currentHandPosition: { x: number, y: number, rotation?: number } | null = null;
    protected cameraTransform: { zoom: number, position: { x: number, y: number }, virtualSize: { width: number, height: number } } | null = null;

    protected activeOcclusionPath: { path: Coordinate[], radius: number, startTime: number, duration: number, showEraser: boolean } | null = null;
    protected declare handsConfig?: WhiteboardConfig['hands'];

    protected eraserHandManager: HandOverlayManager | null = null;

    constructor(config: LayerConfig, handsConfig?: WhiteboardConfig['hands']) {
        super(config);
        this.handsConfig = handsConfig;

        const handOverlay = config.handOverlay;
        const isHandEnabled = typeof handOverlay === 'object' ? handOverlay.enabled !== false : handOverlay !== false;

        if (isHandEnabled) {
            const overlayConfig = typeof handOverlay === 'object' ? handOverlay : undefined;
            this.handOverlayManager = new HandOverlayManager(overlayConfig);
        }

        // Initialize eraser hand manager if occlusion is enabled
        // Note: Eraser is only shown during occlusion culling, which is controlled at scene level
        // This initializes the manager but it won't be used unless scene.occlusionCulling is true
        if (config.occlusionCulling !== false || config.exit_animation?.type === 'eraser') {
            this.eraserHandManager = new HandOverlayManager({ enabled: true, preset: 'eraser' });
        }
    }

    /**
     * Prepare the layer (load assets, etc.)
     * This is the public entry point that ensures preparation happens only once.
     */
    public async prepare(): Promise<void> {
        if (this.isPrepared) return;
        await this.doPrepare();
        this.isPrepared = true;
    }

    /**
     * Internal preparation logic to be implemented by subclasses.
     * Subclasses should call super.doPrepare().
     */
    protected async doPrepare(): Promise<void> {
        if (this.handOverlayManager && this.config.handOverlay !== false) {
            let overlayConfig = typeof this.config.handOverlay === 'object' ? { ...this.config.handOverlay } : {};

            // Apply default preset if enabled but no preset or image is specified
            if (overlayConfig.enabled !== false && !overlayConfig.preset && !overlayConfig.imageUrl) {
                const defaultPreset = this.getDefaultHandPreset();
                if (defaultPreset) {
                    overlayConfig.preset = defaultPreset;
                }
            }

            await this.handOverlayManager.initialize(overlayConfig, this.handsConfig);
            this.handOverlayManager.setViewportScale(this.viewportScale);
        }
        if (this.eraserHandManager) {
            await this.eraserHandManager.initialize({ enabled: true, preset: 'eraser' }, this.handsConfig);
            this.eraserHandManager.setStrategy(new EraserHandStrategy());
        }
    }

    /**
     * Set the absolute timing for this layer (calculated by the scene)
     */
    setAbsoluteTiming(timing: LayerTimingBreakdown): void {
        this.absoluteTiming = timing;
    }

    /**
     * Get the absolute timing for this layer
     */
    getAbsoluteTiming(): LayerTimingBreakdown | null {
        return this.absoluteTiming;
    }

    /**
     * Set the camera transform for this layer (matching frontend)
     */
    setCameraTransform(zoom: number, position: { x: number, y: number }, virtualSize: { width: number, height: number }): void {
        this.cameraTransform = { zoom, position, virtualSize };
    }

    /**
     * Get the animation progress (0-1) at a specific time.
     */
    public getAnimationProgress(time: number): number {
        if (this.absoluteTiming) {
            const relativeTime = time - this.absoluteTiming.entranceDelay;
            if (relativeTime < 0) return 0;
            if (this.absoluteTiming.animationDuration <= 0) return 1;
            if (relativeTime >= this.absoluteTiming.animationDuration) return 1;
            return relativeTime / this.absoluteTiming.animationDuration;
        }
        return super.getAnimationProgress(time);
    }

    /**
     * Override exit progress to use absolute timing if available
     */
    protected getExitProgress(time: number): number {
        if (this.absoluteTiming) {
            const exitStartTime = this.absoluteTiming.occlusionDuration +
                this.absoluteTiming.entranceDelay +
                this.absoluteTiming.animationDuration +
                this.absoluteTiming.pauseDuration;
            const relativeTime = time - exitStartTime;
            if (relativeTime < 0) return 0;
            if (this.absoluteTiming.exitDuration <= 0) return 0;
            if (relativeTime >= this.absoluteTiming.exitDuration) return 1;
            return relativeTime / this.absoluteTiming.exitDuration;
        }
        return super.getExitProgress(time);
    }

    /**
     * Override visibility to use absolute timing if available
     */
    isVisible(time: number): boolean {
        if (this.absoluteTiming) {
            const EPSILON = 0.00001;
            if (time < this.absoluteTiming.entranceDelay - EPSILON) return false;

            // If there's an exit animation, we check if it's finished
            if (this.config.exit_animation && this.config.exit_animation.type !== 'none') {
                if (time >= this.absoluteTiming.totalDuration - EPSILON) return false;
            }

            // Otherwise it stays visible until the scene ends
            return true;
        }
        return super.isVisible(time);
    }

    /**
     * Render the layer at a specific scene time.
     * @param ctx - Canvas context
     * @param time - Current scene time in seconds
     */
    async render(ctx: CanvasRenderingContext2D, time: number): Promise<void> {
        this.currentHandPosition = null; // Reset for this frame
        if (!this.isVisible(time)) return;

        // If we have occlusion paths that are active at this time, we need to use a temporary canvas
        // to avoid erasing the background (which causes black areas).
        const hasActiveOcclusion = this.occlusionMaskPaths.some(p => time >= p.startTime);

        if (hasActiveOcclusion) {
            const { createCanvas } = require('canvas');
            const tempCanvas = createCanvas(ctx.canvas.width, ctx.canvas.height);
            const tempCtx = tempCanvas.getContext('2d');

            // Copy current global transform to temp context if needed, 
            // but doRender usually handles its own transforms.
            // However, we need to make sure the temp canvas is used for the entire layer rendering.

            await this.doRender(tempCtx as any, time);
            await this.applyOcclusionMask(tempCtx as any, time);

            // Draw the temp canvas onto the main context
            ctx.drawImage(tempCanvas, 0, 0);
        } else {
            await this.doRender(ctx, time);
        }
    }

    /**
     * Subclasses implement this to perform actual rendering.
     */
    protected abstract doRender(ctx: CanvasRenderingContext2D, time: number): Promise<void>;

    /**
     * Render the layer's shape as a black mask for occlusion.
     * Default implementation uses the occlusion proxy.
     * @param forceFull If true, renders the complete shape regardless of current animation progress.
     */
    public async renderAsMask(ctx: CanvasRenderingContext2D, time: number, forceFull: boolean = false): Promise<void> {
        const progress = forceFull ? 1.0 : this.getAnimationProgress(time);
        const exitProgress = forceFull ? 0.0 : this.getExitProgress(time);

        // If the layer is not yet visible and we're not forcing full, nothing to mask
        if (!forceFull && !this.isVisible(time)) return;

        ctx.save();
        // We use a black fill for the mask
        ctx.fillStyle = 'black';

        const animType = this.config.entrance_animation?.type || 'draw';

        // For 'draw' and 'typewriter' animations, we only want to mask the part that is already drawn
        // However, for simplicity and consistency with the frontend's <use> approach,
        // we can just call doRender with a special flag or context if needed.
        // But for now, using the proxy is a good approximation if it respects progress.

        if (animType === 'reveal_diagonal' || animType === 'reveal_horizontal' || animType === 'reveal_vertical') {
            // For reveal animations, the proxy should ideally be clipped by the reveal pattern
            // but since we're using the proxy which is already animated, it might be enough.
            const proxy = this.getOcclusionProxy(time, forceFull);
            const { OcclusionLogic } = require('../../shared/core/occlusion_logic');
            OcclusionLogic.drawProxy(ctx, proxy);
        } else {
            // For draw/typewriter, the proxy is usually the full bounds.
            // To match the frontend's progressive reveal, we should ideally render the actual content.
            // For now, let's use the proxy but we might need to refine this.
            const proxy = this.getOcclusionProxy(time, forceFull);
            const { OcclusionLogic } = require('../../shared/core/occlusion_logic');
            OcclusionLogic.drawProxy(ctx, proxy);
        }

        ctx.restore();
    }

    /**
     * Get the layer configuration
     */
    getConfig(): LayerConfig {
        return this.config;
    }

    /**
     * Get the type of this layer (e.g., "ShapeLayer")
     */
    public getLayerType(): string {
        return this.constructor.name;
    }

    /**
     * Get the type of entrance animation (e.g., "draw")
     */
    public getAnimationType(): string {
        return this.config.entrance_animation?.type || 'none';
    }

    /**
     * Apply common transformations to the context
     */
    protected applyTransform(ctx: CanvasRenderingContext2D, progress: number, time: number): void {
        const pos = this.config.position || { x: 0, y: 0 };
        const scale = this.config.scale ?? 1;
        const rotation = this.config.rotation ?? 0;
        const opacity = this.config.opacity ?? 1;

        const startState: AnimationState = {
            position: { ...pos },
            scale,
            rotation,
            opacity,
            scaleX: this.config.scaleX ?? this.config.scale ?? 1,
            scaleY: this.config.scaleY ?? this.config.scale ?? 1,
            skewX: this.config.skewX ?? 0
        };

        const animType = this.config.entrance_animation?.type || 'draw';
        const exitType = this.config.exit_animation?.type || 'none';
        const exitProgress = this.getExitProgress(time);

        // Calculate Emphasis State
        let emphasisType: EmphasisAnimationType | undefined;
        let emphasisProgress: number | undefined;
        let emphasisIntensity: number | undefined;

        if (this.config.emphasis_animation && this.absoluteTiming) {
            const emphasisConfig = this.config.emphasis_animation;
            const emphasisStartTime = this.absoluteTiming.entranceDelay + this.absoluteTiming.animationDuration;
            const emphasisEndTime = emphasisStartTime + this.absoluteTiming.pauseDuration; // Emphasis happens during pause

            // Allow emphasis overlap into exit? Usually stops at exit.

            if (time >= emphasisStartTime && time < emphasisEndTime) {
                const elapsed = time - emphasisStartTime;
                const delay = emphasisConfig.delay || 0;
                const activeTime = elapsed - delay;

                if (activeTime >= 0) {
                    const duration = emphasisConfig.duration || 1;
                    const iterations = emphasisConfig.iterations || Infinity; // Default infinite like CSS? Or 1? CSS defaults 1 usually, but usually we want it to loop while waiting.
                    // The frontend "iterations" default is 1 in basic config, but loop logic handles it. 

                    // If explicit iterations, check bounds
                    const currentIteration = Math.floor(activeTime / duration);

                    if (iterations === Infinity || currentIteration < iterations) {
                        emphasisType = emphasisConfig.type as EmphasisAnimationType;
                        emphasisProgress = (activeTime % duration) / duration;
                        emphasisIntensity = emphasisConfig.intensity ?? 1.0;
                    }
                }
            }
        }

        const currentState = calculateAnimationState(
            animType,
            progress,
            startState,
            exitType,
            exitProgress,
            emphasisType,
            emphasisProgress,
            emphasisIntensity
        );

        let x = currentState.position.x;
        let y = currentState.position.y;

        ctx.translate(x, y);

        // Handle non-uniform scaling
        const scaleX = currentState.scaleX ?? currentState.scale;
        const scaleY = currentState.scaleY ?? currentState.scale;
        ctx.scale(scaleX, scaleY);

        // Handle skew
        if (currentState.skewX) {
            ctx.transform(1, 0, Math.tan((currentState.skewX * Math.PI) / 180), 1, 0, 0);
        }

        ctx.rotate((currentState.rotation * Math.PI) / 180);

        ctx.globalAlpha *= currentState.opacity;

        // Handle Reveal/Eraser Clipping
        if (currentState.revealProgress !== undefined || currentState.eraseProgress !== undefined) {
            const width = this.config.width || 0;
            const height = this.config.height || 0;

            // If centered (common for shapes/text), (0,0) is in the middle.
            // Adjust rect coordinates based on centering.
            const isCentered = (this as any).isCentered?.() ?? true;
            const minX = isCentered ? -width / 2 : 0;
            const minY = isCentered ? -height / 2 : 0;

            if (currentState.revealProgress !== undefined) {
                const p = currentState.revealProgress;
                const pattern = currentState.revealPattern || 'horizontal';

                ctx.beginPath();
                if (pattern === 'horizontal') {
                    ctx.rect(minX, minY, width * p, height);
                } else if (pattern === 'vertical') {
                    ctx.rect(minX, minY, width, height * p);
                } else if (pattern === 'diagonal') {
                    const combined = p * 2;
                    if (combined <= 1) {
                        ctx.moveTo(minX, minY);
                        ctx.lineTo(minX + width * combined, minY);
                        ctx.lineTo(minX, minY + height * combined);
                    } else {
                        const p2 = combined - 1;
                        ctx.moveTo(minX, minY);
                        ctx.lineTo(minX + width, minY);
                        ctx.lineTo(minX + width, minY + height * p2);
                        ctx.lineTo(minX + width * p2, minY + height);
                        ctx.lineTo(minX, minY + height);
                    }
                }
                ctx.closePath();
                ctx.clip();
            }

            if (currentState.eraseProgress !== undefined) {
                const p = currentState.eraseProgress;
                // Eraser is 'destination-out', so we want to clip AWAY the erased part.
                // However, ctx.clip() is for what stays.
                // So we clip the part that is NOT YET erased.
                ctx.beginPath();
                // Simple horizontal erase from left to right (can be improved to zigzag)
                ctx.rect(minX + width * p, minY, width * (1 - p), height);
                ctx.closePath();
                ctx.clip();
            }
        }
    }

    /**
     * Set the active occlusion path for this layer (the one it performs on others)
     */
    setActiveOcclusionPath(path: Coordinate[], radius: number, startTime: number, duration: number, showEraser: boolean = true): void {
        this.activeOcclusionPath = { path, radius, startTime, duration, showEraser };
    }

    /**
     * Get the current hand position for this layer at the given time.
     * Returns null if no hand should be shown.
     */
    getHandPosition(time: number): { x: number, y: number, rotation?: number } | null {
        if (!this.isVisible(time)) return null;
        if (this.currentHandPosition) return this.currentHandPosition;

        // Exit Animation: Eraser
        const exitProgress = this.getExitProgress(time);
        if (this.config.exit_animation?.type === 'eraser' && exitProgress > 0 && exitProgress < 1) {
            if (this.eraserHandManager) {
                const width = this.config.width || 0;
                const height = this.config.height || 0;
                const isCentered = (this as any).isCentered?.() ?? true;
                const minX = isCentered ? -width / 2 : 0;
                const minY = isCentered ? -height / 2 : 0;

                // Position hand at the leading edge of the erase zone
                const p = exitProgress;
                const handX = minX + width * p;
                const handY = minY + height / 2 + 20 * Math.sin(p * Math.PI * 10); // Subtle zigzag

                return this.eraserHandManager.calculateHandPosition(p, {
                    currentErasePosition: { x: handX, y: handY }
                }, (pt) => this.transformToGlobalAnimated(pt, time));
            }
        }

        // Check if we are in an occlusion phase (caused by this layer)
        if (this.activeOcclusionPath && this.eraserHandManager) {
            const { path, startTime, duration, showEraser } = this.activeOcclusionPath;

            // Only show the eraser hand if showEraser is enabled
            if (showEraser && time >= startTime && time < startTime + duration) {
                const elapsed = time - startTime;
                const progress = duration > 0 ? Math.min(elapsed / duration, 1) : 1;

                const currentPathIdx = Math.floor(progress * (path.length - 1));
                const currentPoint = path[currentPathIdx];
                const nextPoint = path[currentPathIdx + 1];

                const layerData = {
                    currentErasePosition: { x: currentPoint[0], y: currentPoint[1] },
                    nextErasePosition: nextPoint ? { x: nextPoint[0], y: nextPoint[1] } : undefined
                };

                return this.eraserHandManager.calculateHandPosition(progress, layerData);
            }
        }

        if (!this.handOverlayManager) return null;
        const progress = this.getAnimationProgress(time);
        if (progress <= 0 || progress >= 1.0) return null;
        const layerData = this.getLayerDataForHand(progress);
        return this.handOverlayManager.calculateHandPosition(progress, layerData, (p) => this.transformToGlobalAnimated(p, time));
    }

    /**
     * Subclasses can override this to provide a default hand preset.
     */
    protected getDefaultHandPreset(): string | undefined {
        return 'drawing';
    }

    /**
     * Subclasses can override this to provide data for the hand strategy.
     */
    protected getLayerDataForHand(progress: number): any {
        return {};
    }

    getHandOverlayManager(): HandOverlayManager | null {
        return this.handOverlayManager;
    }

    /**
     * Get the active hand manager for the given time.
     * Returns eraserHandManager during occlusion (if showEraser is true), otherwise handOverlayManager.
     */
    public getActiveHandManager(time: number): HandOverlayManager | null {
        if (this.activeOcclusionPath && this.eraserHandManager) {
            const { startTime, duration, showEraser } = this.activeOcclusionPath;
            if (showEraser && time >= startTime && time < startTime + duration) {
                return this.eraserHandManager;
            }
        }
        return this.handOverlayManager;
    }

    /**
     * Add an occlusion path to be applied as a mask.
     */
    addOcclusionPath(path: Coordinate[], radius: number, startTime: number, duration: number, upperLayer?: ServerLayer): void {
        this.occlusionMaskPaths.push({ path, radius, startTime, duration, upperLayer });
    }

    /**
     * Apply the occlusion mask to the context.
     * Stage 1: Progressive zigzag erase (before drawing).
     * Stage 2: Full static shape mask (during/after drawing).
     */
    public async applyOcclusionMask(ctx: CanvasRenderingContext2D, time: number): Promise<void> {
        if (this.occlusionMaskPaths.length === 0) return;

        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';

        for (const { path, radius, startTime, duration, upperLayer } of this.occlusionMaskPaths) {
            if (time < startTime) continue;

            // 1. Render the zigzag eraser path (Stage 1: Progressive erase)
            if (time < startTime + duration) {
                const elapsed = time - startTime;
                const progress = duration > 0 ? Math.min(elapsed / duration, 1) : 1;
                const currentPathIdx = Math.floor(progress * (path.length - 1));

                if (currentPathIdx >= 0) {
                    ctx.save();
                    // Add feathering to match frontend
                    ctx.shadowColor = 'black';
                    ctx.shadowBlur = 4; // Matches frontend feathering

                    ctx.beginPath();
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.lineWidth = radius * 2;
                    ctx.strokeStyle = 'black'; // Color doesn't matter with destination-out

                    ctx.moveTo(path[0][0], path[0][1]);
                    for (let i = 1; i <= currentPathIdx; i++) {
                        ctx.lineTo(path[i][0], path[i][1]);
                    }
                    ctx.stroke();
                    ctx.restore();
                }
            } else {
                // 2. Render the full static shape mask (Stage 2: After erase is complete)
                // This ensures the area remains erased even after the zigzag animation finishes
                if (upperLayer) {
                    await upperLayer.renderAsMask(ctx, time, true);
                } else {
                    // Fallback to full zigzag path if no upper layer reference
                    ctx.beginPath();
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.lineWidth = radius * 2;
                    ctx.strokeStyle = 'black';
                    ctx.moveTo(path[0][0], path[0][1]);
                    for (let i = 1; i < path.length; i++) {
                        ctx.lineTo(path[i][0], path[i][1]);
                    }
                    ctx.stroke();
                }
            }

            // 3. Also render the upper layer's current state as a mask (Stage 3: Progressive reveal)
            // This handles the case where the upper layer is currently animating (drawing/revealing)
            // and should occlude what's behind it.
            if (upperLayer && time >= upperLayer.getAbsoluteTiming()!.entranceDelay) {
                await upperLayer.renderAsMask(ctx, time, false);
            }
        }

        ctx.restore();
    }
    /**
     * Get the current position of the layer at a specific time.
     * This is useful for logging and debugging synchronization.
     */
    public getCurrentPosition(time: number): { x: number, y: number } {
        const progress = this.getAnimationProgress(time);
        const exitProgress = this.getExitProgress(time);
        const state = this.getAnimatedTransform(progress, exitProgress);
        return { x: state.position.x, y: state.position.y };
    }
}

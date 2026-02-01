import { createCanvas, CanvasRenderingContext2D, Canvas } from 'canvas';
import { SceneConfig, RGBA, CameraKeyframe, WhiteboardConfig } from '../../shared/types';
import { ServerLayer } from './layer';
import { ServerLayerFactory } from './layer_factory';
import { TimingManager, LayerTimingBreakdown } from '../../shared/infra/timing_manager';
import { ServerTimingMonitor } from './timing_monitor';
import { BackgroundRenderer } from '../rendering/background_renderer';
import { ServerCameraController } from './camera';
import { ServerOcclusionManager } from './occlusion_manager';
import { Logger } from '../../shared/infra/logger';

export class ServerScene {
    private config: SceneConfig;
    private layers: ServerLayer[] = [];
    private width: number;
    private height: number;
    private background: RGBA;
    private backgroundRenderer: BackgroundRenderer | null = null;
    private cameraController: ServerCameraController | null = null;

    constructor(config: SceneConfig, width: number, height: number, background: RGBA = [255, 255, 255, 255], handsConfig?: WhiteboardConfig['hands']) {
        this.config = config;
        this.width = width;
        this.height = height;
        this.background = background;

        // Initialize background renderer if config has background
        if (config.background) {
            this.backgroundRenderer = new BackgroundRenderer(config.background);
        }

        if (config.layers) {
            this.layers = config.layers.map(layerConfig => ServerLayerFactory.create(layerConfig, handsConfig));
        }

        // Initialize camera controller if config has camera
        if (config.camera) {
            this.cameraController = new ServerCameraController(
                this.width,
                this.height,
                config.camera.initial,
                config.camera.virtualSize,
                config.camera.followMode
            );
            if (config.camera.keyframes) {
                config.camera.keyframes.forEach(kf => this.cameraController!.addKeyframe(kf));
            }
        }
    }

    /**
     * Prepare all layers in the scene
     */
    async prepare(): Promise<void> {
        // Prepare background if available
        if (this.backgroundRenderer) {
            await this.backgroundRenderer.prepare();
        }

        // Prepare all layers first so they can update their config and calculate bounds
        await Promise.all(this.layers.map(layer => layer.prepare()));

        // Calculate sequential timing for layers and align with camera
        let currentStartTime = 0;
        const drawSpeed = this.config.timingConfig?.drawSpeed ?? 1.0;
        const sceneOcclusionDuration = this.config.occlusionCulling ? TimingManager.getOcclusionDuration(this.config) : 0;

        const updatedKeyframes: CameraKeyframe[] = this.config.camera?.keyframes ? JSON.parse(JSON.stringify(this.config.camera.keyframes)) : [];

        // 1. First Pass: Handle layers and camera keyframes with targetLayerId
        for (let i = 0; i < this.layers.length; i++) {
            const layer = this.layers[i];
            const layerConfig = layer.getConfig();

            // Determine if this layer is a camera target
            const cameraKfIndex = updatedKeyframes.findIndex(kf => kf.targetLayerId === layerConfig.id);

            if (cameraKfIndex !== -1) {
                const kf = updatedKeyframes[cameraKfIndex];
                const transitionDuration = kf.transitionDuration || 0;

                // SEQUENTIAL EXECUTION: Camera arrives at the element FIRST, then the layer
                // animation begins. This mimics a real camera that pans to a subject before
                // seeing the drawing/animation start.

                // Camera transition starts at currentStartTime
                const transitionStart = currentStartTime;
                // Camera arrives at the element after the transition completes
                const cameraArrivalTime = transitionStart + transitionDuration;

                // Shift the keyframe to align with the arrival time
                const shift = cameraArrivalTime - (kf.startTime || 0);

                if (shift !== 0) {
                    // Shift this and all subsequent keyframes
                    for (let j = cameraKfIndex; j < updatedKeyframes.length; j++) {
                        updatedKeyframes[j].startTime = Math.max(0, (updatedKeyframes[j].startTime || 0) + shift);
                    }
                }

                // Layer starts AFTER the camera arrives
                currentStartTime = cameraArrivalTime;

                // IMPORTANT: When targeted by a camera, we ignore the layer's internal delay
                // to avoid "double-delaying" (camera delay + layer delay).
                if (layerConfig.entrance_animation) {
                    layerConfig.entrance_animation.delay = 0;
                }
            }

            // Determine occlusion
            let occlusionDuration = 0;
            if (sceneOcclusionDuration > 0 && i > 0) {
                for (let j = 0; j < i; j++) {
                    if (TimingManager.doLayersOverlap(layer, this.layers[j])) {
                        occlusionDuration = sceneOcclusionDuration;
                        break;
                    }
                }
            }

            // Calculate timing for this layer
            const timing = TimingManager.calculateLayerTiming(layerConfig, drawSpeed, occlusionDuration);

            // Set absolute timing
            const absoluteTiming = {
                ...timing,
                entranceDelay: currentStartTime + occlusionDuration + timing.entranceDelay,
                totalDuration: currentStartTime + timing.totalDuration
            };
            layer.setAbsoluteTiming(absoluteTiming);

            // Update currentStartTime for next layer
            currentStartTime += timing.totalDuration;

            // Ensure NEXT camera transition doesn't start until this layer is finished drawing
            if (cameraKfIndex !== -1 && cameraKfIndex < updatedKeyframes.length - 1) {
                const drawingFinished = absoluteTiming.entranceDelay + absoluteTiming.animationDuration;
                const nextKf = updatedKeyframes[cameraKfIndex + 1];
                const nextTransitionStart = (nextKf.startTime || 0) - (nextKf.transitionDuration || 0);

                if (nextTransitionStart < drawingFinished) {
                    const shift = drawingFinished - nextTransitionStart;
                    for (let j = cameraKfIndex + 1; j < updatedKeyframes.length; j++) {
                        updatedKeyframes[j].startTime = (updatedKeyframes[j].startTime || 0) + shift;
                    }
                }
            }
        }

        // 2. Second Pass: Handle camera keyframes WITHOUT targetLayerId
        // These should be placed sequentially after the last timed event if startTime is missing
        let lastCameraEndTime = 0;
        for (let i = 0; i < updatedKeyframes.length; i++) {
            const kf = updatedKeyframes[i];

            if (kf.startTime === undefined) {
                // If it's the first keyframe, it starts after its transition
                const transitionDuration = kf.transitionDuration || 0;

                // Start after the previous camera's hold period or after the current layer sequence
                kf.startTime = Math.max(lastCameraEndTime + transitionDuration, currentStartTime);
            }

            // The camera "ends" its stay at this keyframe after pauseTime
            const holdDuration = (kf.pauseTime || 0);
            lastCameraEndTime = (kf.startTime || 0) + holdDuration;
        }

        // Update camera controller and config with shifted keyframes
        if (updatedKeyframes.length > 0) {
            if (this.config.camera) {
                this.config.camera.keyframes = updatedKeyframes;
            }
            if (this.cameraController) {
                this.cameraController.clearKeyframes();
                updatedKeyframes.forEach(kf => this.cameraController!.addKeyframe(kf));
            }
        }

        // Perform occlusion culling detection
        this.performOcclusionCulling();
    }

    /**
     * Detect overlapping layers and generate occlusion masks.
     * FIXED: Now matches frontend logic exactly:
     * - Detection uses 0.5 margin ratio for sensitive overlap detection
     * - Intersection calculation uses configured margin ratio (default 0.1)
     * - Erase zone uses ensureMinimumEraseZone to guarantee proper erasing
     */
    private performOcclusionCulling(): void {
        // Use scene-level configuration
        const occlusionConfig = this.config.occlusionCullingConfig || {};
        const radius = occlusionConfig.radius ?? 30;
        // Use 0.5 margin ratio for detection (50% of size) to make detection very sensitive - matches frontend
        const detectionMarginRatio = 0.5;
        // Use configured margin ratio or default to 0.1 (10%) for intersection calculation - matches frontend
        const intersectionMarginRatio = occlusionConfig.intersectionMarginRatio ?? 0.1;

        for (let j = 0; j < this.layers.length; j++) {
            const upperLayer = this.layers[j];
            const upperTiming = upperLayer.getAbsoluteTiming();

            // Only process if this layer has an occlusion phase
            if (!upperTiming || upperTiming.occlusionDuration <= 0) continue;

            const upperConfig = upperLayer.getConfig();
            if (upperConfig.occlusionMode === 'none') continue;

            const upperProxy = upperLayer.getOcclusionProxy();
            const lowerLayersToErase: ServerLayer[] = [];

            // Find all layers BELOW this one that should be partially erased
            for (let i = 0; i < j; i++) {
                const lowerLayer = this.layers[i];
                const lowerConfig = lowerLayer.getConfig();

                if (lowerConfig.occlusionCulling === false || lowerConfig.occlusionMode === 'none') {
                    continue;
                }

                const lowerProxy = lowerLayer.getOcclusionProxy();
                // Use sensitive detection margin ratio (0.5) - matches frontend
                if (ServerOcclusionManager.proxiesIntersect(lowerProxy, upperProxy, detectionMarginRatio)) {
                    lowerLayersToErase.push(lowerLayer);
                }
            }

            if (lowerLayersToErase.length > 0) {
                const lowerProxies = lowerLayersToErase.map(l => l.getOcclusionProxy());
                // Use configured margin ratio for intersection calculation - matches frontend
                const intersection = ServerOcclusionManager.getUnionIntersectionRect(upperProxy, lowerProxies, intersectionMarginRatio);
                if (intersection) {
                    // FIXED: Use the actual intersection rectangle (matching frontend logic)
                    // Apply ensureMinimumEraseZone to ensure proper erasing
                    const eraseZone = ServerOcclusionManager.ensureMinimumEraseZone(intersection, radius);

                    const path = ServerOcclusionManager.generateZigzagPath(
                        eraseZone.left,
                        eraseZone.top,
                        eraseZone.right,
                        eraseZone.bottom,
                        radius
                    );

                    const startTime = upperTiming.entranceDelay - upperTiming.occlusionDuration;
                    const duration = upperTiming.occlusionDuration;
                    const showEraser = occlusionConfig.showEraser !== false; // Default to true

                    // Set the path on the upper layer for hand positioning
                    upperLayer.setActiveOcclusionPath(path, radius, startTime, duration, showEraser);

                    // Add the path and upper layer reference to all lower layers for mask rendering
                    for (const lowerLayer of lowerLayersToErase) {
                        lowerLayer.addOcclusionPath(path, radius, startTime, duration, upperLayer);
                    }
                }
            }
        }
    }

    /**
     * Get total duration of the scene in seconds
     */
    getDuration(): number {
        // Since we converted delays to absolute times in prepare(),
        // the total duration is the maximum end time of any layer.
        let maxEndTime = 0;
        const drawSpeed = this.config.timingConfig?.drawSpeed ?? 1.0;

        for (const layer of this.layers) {
            const timing = layer.getAbsoluteTiming();
            if (timing && timing.totalDuration > maxEndTime) {
                maxEndTime = timing.totalDuration;
            }
        }

        // Add transition duration
        // Note: TimingManager.calculateSceneTiming adds transition duration at the end
        // Transition duration should not be affected by drawSpeed - only layer animations should be affected
        const transitionDuration = this.config.transition?.duration ?? 0;
        let calculatedDuration = maxEndTime + transitionDuration;

        // Also account for camera keyframes
        if (this.config.camera?.keyframes) {
            for (const kf of this.config.camera.keyframes) {
                const kfEnd = (kf.startTime || 0) + (kf.pauseTime || 0);
                if (kfEnd > calculatedDuration) {
                    calculatedDuration = kfEnd;
                }
            }
        }

        return Math.max(this.config.duration || 0, calculatedDuration);
    }

    getConfig(): SceneConfig {
        return this.config;
    }

    /**
     * Render a single frame at a specific time
     * @param time - Time in seconds
     * @param monitor - Optional timing monitor to track progress
     * @param renderHands - Whether to render hand overlays (default: true)
     * @param targetWidth - Target width for the rendered frame (optional)
     * @param targetHeight - Target height for the rendered frame (optional)
     * @returns Buffer containing the PNG image data
     */
    async renderFrame(time: number, monitor?: ServerTimingMonitor, renderHands: boolean = true, targetWidth?: number, targetHeight?: number): Promise<Buffer> {
        const drawWidth = targetWidth || this.width;
        const drawHeight = targetHeight || this.height;

        // 1. Create native resolution canvas
        const canvas = createCanvas(drawWidth, drawHeight);

        // 2. Update layer camera transforms (virtual space)
        if (this.cameraController) {
            const config = this.cameraController.getConfigAtTime(time, this.layers);
            const zoom = config.zoom || 1.0;
            const position = config.position || { x: 0.5, y: 0.5 };
            const virtualSize = this.config.camera?.virtualSize || { width: this.width, height: this.height };

            for (const layer of this.layers) {
                layer.setCameraTransform(zoom, position, virtualSize);
            }
        }

        // 3. Render scene content directly to high-res canvas (renders everything vectorially sharp)
        // This now handles background, camera transforms, layers, and hands
        await this.renderToCanvas(canvas, time, monitor, renderHands, drawWidth, drawHeight);

        return canvas.toBuffer('image/png');
    }

    /**
     * Render the scene directly to a provided canvas
     * @param canvas - The canvas to render to
     * @param time - Time in seconds
     * @param monitor - Optional timing monitor to track progress
     * @param renderHands - Whether to render hand overlays (default: true)
     * @param targetWidth - Target width for the rendered frame (optional)
     * @param targetHeight - Target height for the rendered frame (optional)
     */
    async renderToCanvas(canvas: Canvas, time: number, monitor?: ServerTimingMonitor, renderHands: boolean = true, targetWidth?: number, targetHeight?: number): Promise<void> {
        const ctx = canvas.getContext('2d');
        const drawWidth = targetWidth || canvas.width;
        const drawHeight = targetHeight || canvas.height;

        // Set high-quality rendering properties
        ctx.imageSmoothingEnabled = true;
        (ctx as any).imageSmoothingQuality = 'high';
        (ctx as any).antialias = 'subpixel'; // node-canvas specific setting if available
        (ctx as any).patternQuality = 'best';
        (ctx as any).quality = 'best';

        // Draw background
        if (this.backgroundRenderer) {
            this.backgroundRenderer.render(ctx, drawWidth, drawHeight, time);
        } else {
            // Fallback to simple RGBA background
            ctx.fillStyle = `rgba(${this.background[0]}, ${this.background[1]}, ${this.background[2]}, ${this.background[3] / 255})`;
            ctx.fillRect(0, 0, drawWidth, drawHeight);
        }

        // Determine coordinate system scaling
        const hasCamera = this.cameraController && this.cameraController.isActive();
        const virtualWidth = this.config.camera?.virtualSize?.width || this.width;
        const virtualHeight = this.config.camera?.virtualSize?.height || this.height;
        const viewportScale = Math.min(drawWidth / virtualWidth, drawHeight / virtualHeight);



        let finalZoom = viewportScale;
        let translateX = 0;
        let translateY = 0;

        if (hasCamera) {
            const cameraConfig = this.cameraController!.getConfigAtTime(time, this.layers);
            const zoom = cameraConfig.zoom || 1.0;
            const position = cameraConfig.position || { x: 0.5, y: 0.5 };

            finalZoom = zoom * viewportScale;


            const centerX = virtualWidth * position.x;
            const centerY = virtualHeight * position.y;

            translateX = drawWidth / 2 - centerX * finalZoom;
            translateY = drawHeight / 2 - centerY * finalZoom;
        }

        // Apply transformations for this target resolution
        ctx.save();
        if (hasCamera) {
            ctx.translate(translateX, translateY);
        }
        ctx.scale(finalZoom, finalZoom);

        // Render layers sequentially (respecting order)
        for (const layer of this.layers) {
            await layer.render(ctx, time);

            // Track timing metrics if monitor is provided
            if (monitor) {
                const progress = layer.getAnimationProgress(time);
                const timing = layer.getAbsoluteTiming();
                if (timing) {
                    monitor.trackProgress(
                        layer.getConfig().id,
                        layer.getLayerType(),
                        layer.getAnimationType(),
                        time,
                        progress,
                        timing.animationDuration * 1000,
                        timing.entranceDelay,
                        timing.entranceDelay + timing.animationDuration
                    );
                }
            }
        }

        // Render hand overlays on top (if enabled)
        if (renderHands) {
            // Target scale for hands should be relative to a 800px design width
            const targetResScale = drawWidth / 800;
            // Since ctx is already scaled by finalZoom, we need to divide target scale by finalZoom
            // to get the correct relative scale for the hand image.
            const handRenderScale = targetResScale / finalZoom;

            for (const layer of this.layers) {
                const handPos = layer.getHandPosition(time);
                if (handPos && handPos.x !== undefined && handPos.y !== undefined) {
                    const handManager = layer.getActiveHandManager(time);
                    if (handManager) {
                        handManager.renderHandAt(ctx, handPos.x, handPos.y, handPos.rotation || 0, handRenderScale);
                    }
                }
            }
        }

        ctx.restore();
    }

    /**
     * Get the camera controller for this scene
     */
    public getCameraController(): ServerCameraController | null | undefined {
        return this.cameraController;
    }

    /**
     * Get all layers in the scene
     */
    public getLayers(): ServerLayer[] {
        return this.layers;
    }

    /**
     * Get the canvas for this scene (creates one if needed)
     */
    public getCanvas(): Canvas {
        const canvas = createCanvas(this.width, this.height);
        // Note: This is a simplified version, ideally we'd reuse a canvas
        return canvas;
    }

    /**
     * Add a layer to the scene programmatically
     */
    public addLayer(layer: ServerLayer): void {
        this.layers.push(layer);
    }
}


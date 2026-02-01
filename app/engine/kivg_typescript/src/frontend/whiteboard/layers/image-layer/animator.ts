import { ImageLayerConfig } from './types';
import { PixelPoint } from './utils';
import { ColorRegion } from './processing-cache';
import { Point } from '../../../../shared/types';
import { AdaptiveQualityManager } from './adaptive-quality';
import { HandOverlayManager } from '../../managers/hand-overlay-manager';
import { AnimationTimingController } from '../../../core/infra/timing-controller';
import { isDebugEnabled } from '../../../../shared/config/debug_config';

/**
 * Configuration options for the Animator
 */
interface AnimatorConfig {
    /** Radius for revealing strokes (default: 2, Python uses DEFAULT_STROKE_WIDTH = 3) */
    strokeRevealRadius: number;
    /** Maximum movements per region during fill (default: 1) */
    maxMovementsPerRegion: number;
    /** Maximum region size for flood fill (default: 1_000_000, matches Python) */
    maxRegionSize: number;
    /** Easing function for fill animation progress (cubic ease-in-out) */
    easingFunction: (t: number) => number;
}

export class Animator {
    private canvas: HTMLCanvasElement;
    private config: ImageLayerConfig;
    private animatorConfig: AnimatorConfig;
    private stopped: boolean = false;
    private abortController: AbortController | null = null;
    private handOverlayManager: HandOverlayManager | null = null;
    private handOverlayCanvas: HTMLCanvasElement | null = null;
    private paused: boolean = false;
    private currentTimingController: AnimationTimingController | null = null;

    private transformPoint: (p: PixelPoint) => Point;

    // FPS tracking for performance monitoring
    private frameTimestamps: number[] = [];
    private readonly FPS_SAMPLE_SIZE = 30; // Track last 30 frames

    // Circle offset cache for pixel drawing optimization
    private circleOffsets: Map<number, Array<[number, number]>> = new Map();

    // Adaptive quality management (Phase 3 optimization)
    private adaptiveQuality: AdaptiveQualityManager | null = null;
    private readonly ENABLE_ADAPTIVE_QUALITY = true; // Feature flag

    // Camera transform for virtual size hand overlay positioning
    private cameraTransform: { zoom: number; position: { x: number; y: number }; virtualSize: { width: number; height: number } } | null = null;


    constructor(
        canvas: HTMLCanvasElement,
        config: ImageLayerConfig,
        handOverlayManager?: HandOverlayManager | null,
        handOverlayCanvas?: HTMLCanvasElement | null,
        transformPoint?: (p: PixelPoint) => Point
    ) {
        this.canvas = canvas;
        if (!canvas.getContext('2d')) {
            throw new Error('Failed to get 2D context from canvas');
        }
        this.config = config;
        this.handOverlayManager = handOverlayManager || null;
        this.handOverlayCanvas = handOverlayCanvas || null;
        this.transformPoint = transformPoint || ((p: PixelPoint) => [p.x, p.y] as Point);
        this.abortController = new AbortController();

        const sweepSpeed = config.sweepSpeed ?? 1.0;
        const clampedSweepSpeed = Math.max(0.5, Math.min(10.0, sweepSpeed));

        this.animatorConfig = {
            strokeRevealRadius: 3,
            maxMovementsPerRegion: clampedSweepSpeed,
            maxRegionSize: 1_000_000,
            easingFunction: (t: number) => {
                // Cubic ease-in-out
                return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            }
        };

        if (this.ENABLE_ADAPTIVE_QUALITY) {
            this.adaptiveQuality = new AdaptiveQualityManager(60); // Target 60 FPS
            if (isDebugEnabled()) {
                console.log('[Animator] Adaptive quality management enabled');
            }
        }
    }

    async waitForHandOverlay(): Promise<void> {
        if (this.handOverlayManager && this.handOverlayManager.isEnabled()) {
            const startTime = Date.now();
            const timeout = 5000;

            while (!this.handOverlayManager.isLoaded() && (Date.now() - startTime < timeout)) {
                await new Promise(r => setTimeout(r, 100));
            }

            if (!this.handOverlayManager.isLoaded()) {
                console.warn('[Animator] Hand overlay failed to load within timeout, proceeding without it.');
            }
        }
    }

    stop(): void {
        this.stopped = true;
        if (this.abortController) {
            this.abortController.abort();
        }
    }

    pause(): void {
        this.paused = true;
        this.currentTimingController?.pause();
    }

    resume(): void {
        this.paused = false;
        this.currentTimingController?.resume();
    }

    setCameraTransform(zoom: number, position: { x: number; y: number }, virtualSize: { width: number; height: number }): void {
        this.cameraTransform = { zoom, position, virtualSize };
        if (this.handOverlayManager) {
            this.handOverlayManager.setCameraTransform(zoom, position, virtualSize);
        }
    }

    async waitUntilPrecise(targetTimeMs: number): Promise<void> {
        while (!this.stopped && performance.now() < targetTimeMs - 16) {
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
        while (!this.stopped && performance.now() < targetTimeMs) {
        }
    }

    private trackFrame(): void {
        const now = performance.now();
        this.frameTimestamps.push(now);
        if (this.frameTimestamps.length > this.FPS_SAMPLE_SIZE) {
            this.frameTimestamps.shift();
        }
    }

    private getCurrentFPS(): number {
        if (this.frameTimestamps.length < 2) return 60;
        const firstTimestamp = this.frameTimestamps[0];
        const lastTimestamp = this.frameTimestamps[this.frameTimestamps.length - 1];
        const timeDelta = lastTimestamp - firstTimestamp;
        if (timeDelta === 0) return 60;
        return ((this.frameTimestamps.length - 1) / timeDelta) * 1000;
    }

    private preCalculateCircleOffsets(radius: number): Array<[number, number]> {
        if (this.circleOffsets.has(radius)) {
            return this.circleOffsets.get(radius)!;
        }
        const offsets: Array<[number, number]> = [];
        const radiusSq = radius * radius;
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (dx * dx + dy * dy <= radiusSq) {
                    offsets.push([dx, dy]);
                }
            }
        }
        this.circleOffsets.set(radius, offsets);
        return offsets;
    }

    async animateStrokes(strokes: PixelPoint[][], grayBGR: ImageData, revealMask: Uint8Array, initialProgress: number = 0): Promise<boolean> {
        const totalPoints = strokes.reduce((sum, s) => sum + s.length, 0);
        const duration = (this.config.duration * 1000) * this.config.strokeRatio;

        const timingController = new AnimationTimingController({
            totalDuration: duration,
            totalWork: totalPoints,
            correctionFactor: 0.3,
            debug: isDebugEnabled(),
            initialProgress: initialProgress
        });
        this.currentTimingController = timingController;

        let currentStrokeIdx = 0;
        let currentPointIdx = 0;
        let prevPoint: PixelPoint | null = null;
        let pointsDrawn = 0;

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = this.canvas.width;
        maskCanvas.height = this.canvas.height;
        const maskCtx = maskCanvas.getContext('2d')!;
        maskCtx.fillStyle = 'black';
        maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
        maskCtx.strokeStyle = 'white';
        maskCtx.lineCap = 'round';
        maskCtx.lineJoin = 'round';

        while (!timingController.isComplete(pointsDrawn)) {
            if (this.stopped || this.abortController?.signal.aborted) {
                return false;
            }
            if (this.paused) {
                await new Promise(r => requestAnimationFrame(r));
                continue;
            }
            const pointsToDraw = timingController.getWorkToDo(pointsDrawn);
            let pointsDrawnThisFrame = 0;

            while (pointsDrawnThisFrame < pointsToDraw && currentStrokeIdx < strokes.length) {
                const stroke = strokes[currentStrokeIdx];
                if (currentPointIdx >= stroke.length) {
                    currentStrokeIdx++;
                    currentPointIdx = 0;
                    prevPoint = null;
                    continue;
                }

                const pt = stroke[currentPointIdx];
                if (prevPoint && currentPointIdx > 0) {
                    maskCtx.lineWidth = this.animatorConfig.strokeRevealRadius;
                    maskCtx.beginPath();
                    maskCtx.moveTo(prevPoint.x, prevPoint.y);
                    maskCtx.lineTo(pt.x, pt.y);
                    maskCtx.stroke();
                } else {
                    maskCtx.fillStyle = 'white';
                    maskCtx.beginPath();
                    maskCtx.arc(pt.x, pt.y, Math.floor(this.animatorConfig.strokeRevealRadius / 2), 0, Math.PI * 2);
                    maskCtx.fill();
                }

                prevPoint = pt;
                currentPointIdx++;
                pointsDrawn++;
                pointsDrawnThisFrame++;
            }

            const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
            for (let i = 0; i < revealMask.length; i++) {
                revealMask[i] = maskData[i * 4];
            }

            let currentPoint: PixelPoint | null = null;
            let nextPoint: PixelPoint | null = null;

            if (currentStrokeIdx < strokes.length) {
                const currentStroke = strokes[currentStrokeIdx];
                if (currentStroke && currentPointIdx < currentStroke.length) {
                    currentPoint = currentStroke[currentPointIdx];
                    if (currentPointIdx + 1 < currentStroke.length) {
                        nextPoint = currentStroke[currentPointIdx + 1];
                    } else if (currentStrokeIdx + 1 < strokes.length) {
                        const nextStroke = strokes[currentStrokeIdx + 1];
                        if (nextStroke && nextStroke.length > 0) {
                            nextPoint = nextStroke[0];
                        }
                    }
                } else if (prevPoint) {
                    currentPoint = prevPoint;
                    if (currentStrokeIdx + 1 < strokes.length) {
                        const nextStroke = strokes[currentStrokeIdx + 1];
                        if (nextStroke && nextStroke.length > 0) {
                            nextPoint = nextStroke[0];
                        }
                    }
                }
            }

            this.renderFrame(grayBGR, revealMask, currentPoint, nextPoint, pointsDrawn);
            this.trackFrame();
            await new Promise(r => requestAnimationFrame(r));
        }
        return true;
    }

    async animateFill(regions: ColorRegion[], srcMat: ImageData, revealMask: Uint8Array, initialProgress: number = 0): Promise<boolean> {
        const fillDuration = (this.config.duration * 1000) * (1 - this.config.strokeRatio);
        let totalPixels = 0;
        for (const region of regions) {
            totalPixels += region.pixels.length;
        }
        if (totalPixels === 0) return true;

        const timingController = new AnimationTimingController({
            totalDuration: fillDuration,
            totalWork: totalPixels,
            correctionFactor: 0.3,
            debug: isDebugEnabled(),
            initialProgress: initialProgress
        });
        this.currentTimingController = timingController;

        let pixelsDrawn = 0;
        let currentRegionIdx = 0;
        let currentPixelIdx = 0;
        const maskCols = this.canvas.width;
        const maskRows = this.canvas.height;

        while (!timingController.isComplete(pixelsDrawn)) {
            if (this.stopped || this.abortController?.signal.aborted) {
                return false;
            }
            const pixelsToDraw = timingController.getWorkToDo(pixelsDrawn);
            let lastDrawnPixel: PixelPoint | null = null;
            let nextPixel: PixelPoint | null = null;
            let pixelsDrawnThisFrame = 0;

            while (pixelsDrawnThisFrame < pixelsToDraw && currentRegionIdx < regions.length) {
                const region = regions[currentRegionIdx];
                const availableInRegion = region.pixels.length - currentPixelIdx;
                const takeFromRegion = Math.min(pixelsToDraw - pixelsDrawnThisFrame, availableInRegion);

                let pixelRadius: number;
                if (this.adaptiveQuality) {
                    pixelRadius = this.adaptiveQuality.getPixelRadius();
                } else {
                    pixelRadius = Math.min(3, Math.max(1, Math.ceil(2 / Math.sqrt(regions.length / 50))));
                }

                const offsets = pixelRadius === 1 ? null : this.preCalculateCircleOffsets(pixelRadius);

                for (let i = 0; i < takeFromRegion; i++) {
                    const p = region.pixels[currentPixelIdx + i];
                    if (pixelRadius === 1) {
                        revealMask[p.y * maskCols + p.x] = 255;
                    } else {
                        for (const [dx, dy] of offsets!) {
                            const py = p.y + dy;
                            const px = p.x + dx;
                            if (py >= 0 && py < maskRows && px >= 0 && px < maskCols) {
                                revealMask[py * maskCols + px] = 255;
                            }
                        }
                    }
                }
                currentPixelIdx += takeFromRegion;
                pixelsDrawn += takeFromRegion;
                pixelsDrawnThisFrame += takeFromRegion;
                if (takeFromRegion > 0) {
                    lastDrawnPixel = region.pixels[currentPixelIdx - 1];
                }
                if (currentPixelIdx >= region.pixels.length) {
                    currentRegionIdx++;
                    currentPixelIdx = 0;
                }
            }
            if (currentRegionIdx < regions.length) {
                nextPixel = regions[currentRegionIdx].pixels[currentPixelIdx];
            }
            this.renderFrame(srcMat, revealMask, lastDrawnPixel, nextPixel, pixelsDrawn);
            this.trackFrame();
            if (this.adaptiveQuality && this.frameTimestamps.length === this.FPS_SAMPLE_SIZE) {
                const currentFPS = this.getCurrentFPS();
                this.adaptiveQuality.adjustQuality(currentFPS);
            }
            await new Promise(r => requestAnimationFrame(r));
        }

        if (isDebugEnabled()) {
            const finalFPS = this.getCurrentFPS();
            const report = timingController.getFinalReport(pixelsDrawn);
            console.log('[Animator] Fill animation complete:', {
                fps: finalFPS.toFixed(1),
                target: `${report.targetDuration.toFixed(0)}ms`,
                actual: `${report.actualDuration.toFixed(0)}ms`,
                error: `${report.timingErrorPercent.toFixed(1)}%`,
            });
            if (this.adaptiveQuality) {
                const status = this.adaptiveQuality.getStatus();
                console.log(`[AdaptiveQuality] Final status: ${(status.samplingRate * 100).toFixed(1)}% sampling, radius=${status.pixelRadius}, avg FPS=${status.avgFPS?.toFixed(1) || 'N/A'}`);
            }
        }
        this.renderFrame(srcMat, revealMask, null, null);
        return true;
    }

    private tempCanvas: HTMLCanvasElement | null = null;

    renderFrame(contentImageData: ImageData, revealMask: Uint8Array, currentPos: PixelPoint | null = null, nextPos: PixelPoint | null = null, workDone: number = 0): void {
        const ctx = this.canvas.getContext('2d')!;
        const { width, height } = this.canvas;
        if (!this.tempCanvas) {
            this.tempCanvas = document.createElement('canvas');
            this.tempCanvas.width = width;
            this.tempCanvas.height = height;
        }
        ctx.clearRect(0, 0, width, height);
        const maskedData = new ImageData(new Uint8ClampedArray(contentImageData.data), width, height);
        for (let i = 0; i < revealMask.length; i++) {
            maskedData.data[i * 4 + 3] = revealMask[i];
        }
        ctx.putImageData(maskedData, 0, 0);

        if (this.handOverlayManager && this.handOverlayManager.isEnabled() && this.handOverlayCanvas) {
            if (currentPos) {
                const transformedPos = this.transformPoint(currentPos);
                const transformedNext = nextPos ? this.transformPoint(nextPos) : undefined;
                const progress = this.currentTimingController
                    ? this.currentTimingController.getStats(workDone).progress
                    : 0;
                this.handOverlayManager.updateHandPosition(
                    progress,
                    {
                        currentPoint: transformedPos,
                        nextPoint: transformedNext
                    },
                    this.handOverlayCanvas
                );
            } else {
                this.handOverlayManager.hideHand(this.handOverlayCanvas);
            }
        }
    }

    dispose(): void {
        this.stop();
        this.tempCanvas = null;
    }
}

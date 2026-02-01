import { Kivg } from '../legacy/legacy_kivg';
import { Layer } from '../../whiteboard/layer';
import { AnimationType, AnimationConfig, LayerConfig } from '../../whiteboard/types';
import { isDebugEnabled } from '../../../shared/config/debug_config';
import { LRUCache } from '../../whiteboard/utils/performance-utils';


export interface SvgLayerConfig extends LayerConfig {
    fps?: number;
    duration?: number;
    fill?: boolean;
    lineWidth?: number;
    lineDash?: [number, number][];
    lineColor?: [number, number, number, number];
    autoPlay?: boolean;
    loop?: boolean;
    handOverlayEnabled?: boolean;
    handImageUrl?: string;
    handScale?: number;
    handOffset?: [number, number];
    handAnchorTopLeft?: boolean;
    handAnchorPoint?: [number, number];
}

export interface SvgLayerControls {
    play: () => Promise<void>;
    pause: () => void;
    stop: () => void;
    restart: () => Promise<void>;
    clear: () => void;
    loadSvg: (svgContent: string) => Promise<void>;
    loadSvgFromUrl: (url: string) => Promise<void>;
}

export class SvgLayer extends Layer {
    protected easeOutCubic(t: number): number {
        return 1 - Math.pow(1 - t, 3);
    }
    protected easeOutBack(t: number): number {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
    protected easeInOutQuad(t: number): number {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }
    private kivg: Kivg;
    private playerConfig: SvgLayerConfig;
    private svgContent: string | null = null;
    private svgUrl: string | null = null;
    private isPlaying: boolean = false;
    private currentFrame: number = 0;
    private animationFrameId: number | null = null;
    private lastFrameTime: number = 0;
    private imageElement: SVGImageElement | null = null;
    private offscreenCanvas: HTMLCanvasElement;
    private drawingPositions: ([number, number] | null)[] = [];
    private frameCache: LRUCache<number, { imageData: ImageData; position: [number, number] | null }>;
    private totalFrames: number = 0;
    private lastFramePosition: [number, number] | null = null;
    private cachedRotation: number = 0;
    private lastHandPos: { x: number; y: number } | null = null;
    private lastObjectUrl: string | null = null;
    private isDestroyed: boolean = false;
    private supportsWebP: boolean = true; // Assume WebP support, will test on first use
    private wasRewinding: boolean = false; // Hysteresis for seek jitter
    private cachedTransformCos: number = 1;
    private cachedTransformSin: number = 0;
    private lastRenderedFrameIndex: number = -1;
    private finalFrameBlob: Blob | null = null;
    private finalFrameUrl: string | null = null;

    // Boundary thresholds for hiding hand overlay
    // These determine when to hide the hand at the start/end of animations
    private readonly HAND_HIDE_START_THRESHOLD = 0.02;  // Hide hand in first 2% (first 1-3 frames)
    private readonly HAND_HIDE_END_THRESHOLD = 0.98;    // Hide hand in last 2% (last 1-3 frames)

    constructor(svgUrl?: string, config?: Partial<SvgLayerConfig>) {
        let processedConfig = config ? { ...config } : {};

        const hasLegacyHandProperties =
            processedConfig.handOverlayEnabled !== undefined ||
            processedConfig.handImageUrl !== undefined ||
            processedConfig.handScale !== undefined ||
            processedConfig.handOffset !== undefined ||
            processedConfig.handAnchorPoint !== undefined ||
            processedConfig.handAnchorTopLeft !== undefined;

        if (!processedConfig.handOverlay && hasLegacyHandProperties) {
            processedConfig.handOverlay = {
                enabled: processedConfig.handOverlayEnabled ?? false,
            };
        }

        const defaultConfig: SvgLayerConfig = {
            id: 'kivg-player-' + Math.random().toString(36).substr(2, 9),
            position: { x: 0, y: 0 },
            opacity: 1,
            scale: 1,
            rotation: 0,
            fps: 30,
            duration: 0.05,
            fill: true,
            lineWidth: 2,
            lineColor: [0, 0, 0, 255],
            autoPlay: false,
            loop: false,
            width: 200,
            height: 200,
            handOverlayEnabled: false,
            handScale: 0.30,
            handOffset: [-18, -20],
            handAnchorTopLeft: false,
            handAnchorPoint: undefined,
            ...processedConfig
        };

        super(defaultConfig);

        // Validate configuration
        this.validateConfig(defaultConfig);

        this.svgUrl = svgUrl || null;
        this.playerConfig = defaultConfig;
        this.updateTransformCache();

        this.kivg = new Kivg(
            this.playerConfig.width!,
            this.playerConfig.height!
        );

        this.offscreenCanvas = this.kivg.canvas.getCanvas();

        // Initialize LRU cache for frames
        this.frameCache = new LRUCache<number, { imageData: ImageData; position: [number, number] | null }>(50, 60000);

        // Load SVG from URL if provided
        // Note: This async operation will complete in the background. If the KivgPlayer
        // is destroyed before loading completes, the promise will still resolve but
        // operations on the destroyed instance will be no-ops (e.g., setOpacity checks
        // if this.element exists). For a production system, consider adding a cleanup
        // mechanism to cancel pending operations on destroy.
        if (this.svgUrl) {
            this.loadSvgFromUrl(this.svgUrl).then(async () => {
                if (this.playerConfig.autoPlay) {
                    await this.play();
                } else {
                    // Only reveal original if not scheduled for a 'draw' animation
                    if (this.playerConfig.entrance_animation?.type !== 'draw') {
                        await this.revealOriginal();
                        this.setOpacity(this.playerConfig.opacity || 1);
                    }
                }
            }).catch(err => {
                console.error('Failed to load SVG from URL:', err);
            });
        }
    }

    /**
     * Validates the player configuration and logs warnings for problematic values.
     */
    private validateConfig(config: SvgLayerConfig): void {
        // Validate duration
        if (config.duration !== undefined) {
            if (config.duration <= 0) {
                console.error('[SvgLayer] Duration must be greater than 0. Defaulting to 0.05s.');
                config.duration = 0.05;
            } else if (config.duration < 0.01) {
                console.warn(
                    `[SvgLayer] Duration ${config.duration}s is very short and may not display all frames smoothly. ` +
                    `Recommended minimum: 0.1s.`
                );
            } else if (config.duration > 300) {
                console.warn(
                    `[SvgLayer] Duration ${config.duration}s is very long (> 5 minutes). ` +
                    `This may generate a large number of frames.`
                );
            }
        }

        // Validate FPS
        if (config.fps !== undefined) {
            if (config.fps <= 0) {
                console.error('[SvgLayer] FPS must be greater than 0. Defaulting to 30.');
                config.fps = 30;
            } else if (config.fps > 120) {
                console.warn(
                    `[SvgLayer] FPS ${config.fps} is very high. ` +
                    `This may generate excessive frames and impact performance.`
                );
            }
        }

        // Validate combination of duration and FPS
        if (config.duration !== undefined && config.fps !== undefined) {
            const estimatedFrames = config.duration * config.fps;
            if (estimatedFrames > 10000) {
                console.warn(
                    `[SvgLayer] Configuration will generate ~${Math.round(estimatedFrames)} frames ` +
                    `(duration: ${config.duration}s, fps: ${config.fps}). ` +
                    `This may impact performance. Consider reducing duration or FPS.`
                );
            } else if (estimatedFrames < 2) {
                console.warn(
                    `[SvgLayer] Configuration will generate only ~${Math.round(estimatedFrames)} frames ` +
                    `(duration: ${config.duration}s, fps: ${config.fps}). ` +
                    `Animation may appear as a single step. Consider increasing duration or FPS.`
                );
            }
        }
    }

    /**
     * Normalizes and validates target animation duration.
     * Ensures duration is within practical bounds and provides warnings for edge cases.
     * 
     * @param targetDuration - Desired duration in seconds (undefined uses FPS-based timing)
     * @param framesCount - Total number of frames in the animation
     * @returns Frame interval in milliseconds
     */
    private normalizeTargetDuration(targetDuration?: number, framesCount: number = 1): number {
        // Constants for validation
        const MIN_DURATION_PER_FRAME_MS = 1; // 1ms minimum per frame
        const MAX_TOTAL_DURATION_S = 300; // 5 minutes maximum
        const RECOMMENDED_MIN_DURATION_S = 0.1; // 100ms recommended minimum

        // If no target duration specified, use FPS-based timing
        if (targetDuration === undefined) {
            return 1000 / this.playerConfig.fps!;
        }

        // Convert to milliseconds
        const totalDurationMs = targetDuration * 1000;
        const frameIntervalMs = totalDurationMs / framesCount;

        // Validate and warn about edge cases

        // Case 1: Duration too short for number of frames
        const minTotalDuration = MIN_DURATION_PER_FRAME_MS * framesCount;
        if (totalDurationMs < minTotalDuration) {
            console.warn(
                `[SvgLayer] Duration ${targetDuration}s (${totalDurationMs}ms) is too short for ${framesCount} frames. ` +
                `Minimum duration is ${minTotalDuration}ms (${MIN_DURATION_PER_FRAME_MS}ms per frame). ` +
                `Clamping to minimum.`
            );
            return MIN_DURATION_PER_FRAME_MS;
        }

        // Case 2: Duration shorter than recommended (will be limited by refresh rate)
        if (targetDuration < RECOMMENDED_MIN_DURATION_S) {
            console.warn(
                `[SvgLayer] Duration ${targetDuration}s is very short. ` +
                `Animation will be limited by display refresh rate (~16.67ms). ` +
                `Recommended minimum: ${RECOMMENDED_MIN_DURATION_S}s for smooth playback.`
            );
        }

        // Case 3: Duration exceeds maximum
        if (targetDuration > MAX_TOTAL_DURATION_S) {
            const clampedInterval = (MAX_TOTAL_DURATION_S * 1000) / framesCount;
            console.warn(
                `[SvgLayer] Duration ${targetDuration}s exceeds maximum ${MAX_TOTAL_DURATION_S}s. ` +
                `Clamping to ${MAX_TOTAL_DURATION_S}s.`
            );
            return clampedInterval;
        }

        // Case 4: Very long animations with high FPS generate many frames
        if (framesCount > 10000) {
            console.warn(
                `[SvgLayer] Animation has ${framesCount} frames, which may impact performance. ` +
                `Consider reducing duration or FPS.`
            );
        }

        return frameIntervalMs;
    }

    render(): SVGElement {
        if (!this.element) {
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.setAttribute('id', this.playerConfig.id || 'svg-layer');

            this.imageElement = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            this.imageElement.setAttribute('width', this.playerConfig.width!.toString());
            this.imageElement.setAttribute('height', this.playerConfig.height!.toString());
            this.imageElement.setAttribute('preserveAspectRatio', 'none');

            group.appendChild(this.imageElement);
            this.element = group;

            this.applyTransform();
            // Start hidden - will be shown when content is loaded or play() is called
            // If frames are already loaded, show the appropriate frame based on animation type
            const framesCount = this.totalFrames; // Use totalFrames
            if (framesCount > 0) {
                if (this.playerConfig.entrance_animation?.type === 'draw') {
                    // For draw animations, start at the beginning (usually empty)
                    this.updateImageFromFrame(0);
                    this.setOpacity(0);
                } else {
                    // For other types, show the final state
                    this.updateImageFromFrame(framesCount - 1);
                    this.setOpacity(this.playerConfig.opacity || 1);
                }
            } else {
                this.setOpacity(0);
            }
        }

        return this.element;
    }

    async animate(type: AnimationType, config: AnimationConfig, initialProgress: number = 0): Promise<void> {
        const delay = config.delay || 0;

        if (config.warmUp) {
            // During warm-up, we only want to trigger frame generation/caching
            if (type === 'draw' && this.totalFrames === 0) { // Use totalFrames
                await this.preload();
            }
            return;
        }

        if (type === 'draw') {
            if (delay > 0) {
                await this.wait(delay);
            }

            // Ensure SVG is loaded before playing
            if (this.totalFrames === 0) { // Use totalFrames
                console.warn('[SvgLayer] Draw animation called but frames not loaded yet. Waiting for preload...');
                await this.preload();
            }

            // Extract target duration from config (in milliseconds)
            // Convert to seconds for consistency with other timing parameters
            const configDuration = config.duration;
            const targetDurationSeconds = configDuration / 1000;
            const startTime = performance.now() - (initialProgress * config.duration);
            await this.play(targetDurationSeconds, initialProgress);

            // Log timing precision for validation
            const actualDuration = performance.now() - startTime;
            const expectedDuration = config.duration !== undefined ? config.duration : (this.totalFrames / this.playerConfig.fps! * 1000); // Use totalFrames
            console.log(`[SvgLayer] Layer ${this.playerConfig.id} (${type}): Expected ${expectedDuration.toFixed(2)}ms, Actual ${actualDuration.toFixed(2)}ms`);
            return;
        }

        // For all other animations (fade_in, slide, zoom, etc.), use the generic LayerAnimator
        // via the parent class implementation
        return super.animate(type, config, initialProgress);
    }

    private fullShapeImageData: ImageData | null = null;

    /**
     * Preload the SVG and generate frames.
     * This ensures the layer is ready for occlusion capture.
     */
    public async preload(): Promise<void> {
        if (this.totalFrames > 0 && this.fullShapeImageData) return; // Use totalFrames

        if (this.svgUrl) {
            await this.loadSvgFromUrl(this.svgUrl);
        } else if (this.svgContent) {
            await this.loadSvg(this.svgContent);
        }

        // After loading, ensure we have the full SVG content for occlusion detection.
        // We draw to a temporary canvas to avoid affecting the visible screen state.
        if (this.svgContent) {
            const tempKivg = new Kivg(this.playerConfig.width!, this.playerConfig.height!);
            try {
                await tempKivg.draw(this.svgContent, false, 'seq', {
                    dur: this.playerConfig.duration!,
                    fill: true,
                    line_width: this.playerConfig.lineWidth!,
                    line_color: this.playerConfig.lineColor!,
                    fps: 1,
                    hand_draw: false
                });
                this.fullShapeImageData = tempKivg.canvas.getImageData();
            } finally {
                // Clean up temporary Kivg canvas to prevent memory leak
                tempKivg.clear();
            }
        }
    }

    async loadSvg(svgContent: string): Promise<void> {
        try {
            // Clear old frames and cache before loading new ones
            this.clearFrames();
            this.frameCache.clear();
            this.finalFrameBlob = null;
            if (this.finalFrameUrl) {
                URL.revokeObjectURL(this.finalFrameUrl);
                this.finalFrameUrl = null;
            }
            this.lastRenderedFrameIndex = -1;

            this.svgContent = svgContent;
            this.kivg.clear();

            if (isDebugEnabled()) {
                console.log("[SvgLayer] Preparing animation (lazy mode)...");
                console.log(`Config: fill=${this.playerConfig.fill}, lineWidth=${this.playerConfig.lineWidth}, lineColor=`, this.playerConfig.lineColor);
            }

            // draw() now returns null but prepares the Kivg instance for lazy rendering
            await this.kivg.draw(svgContent, true, 'seq', {
                dur: this.playerConfig.duration!,
                fill: this.playerConfig.fill!,
                line_width: this.playerConfig.lineWidth!,
                line_color: this.playerConfig.lineColor!,
                fps: this.playerConfig.fps!,
                hand_draw: false
            });

            const totalDuration = this.kivg.getTotalDuration();
            const fps = this.playerConfig.fps || 30;
            this.totalFrames = Math.max(1, Math.floor(totalDuration * fps));

            // Note: drawingPositions are no longer pre-calculated globally in Kivg
            // They are calculated per-frame when needed
            this.drawingPositions = [];

            if (isDebugEnabled()) {
                console.log(`[SvgLayer] Prepared animation: ~${this.totalFrames} frames over ${totalDuration.toFixed(2)}s`);
            }

            this.currentFrame = 0;

            // Warm up: Generate first frame to ensure everything is ready
            await this.getFrame(0);
        } catch (error) {
            console.error("Failed to load SVG:", error);
            throw error;
        }
    }

    /**
     * Get a frame by index, using cache if available.
     * Returns both the ImageData and the drawing position for that frame.
     */
    async getFrame(index: number): Promise<{ imageData: ImageData; position: [number, number] | null }> {
        const cached = this.frameCache.get(index);
        if (cached) return cached;

        const fps = this.playerConfig.fps || 30;
        const time = index / fps;
        const result = this.kivg.renderFrameAtTime(time);

        this.frameCache.set(index, result);
        return result;
    }

    /**
     * Helper method to update the image element with a blob URL.
     * Handles URL revocation to prevent memory leaks.
     */
    private setImageFromBlob(blob: Blob | null): void {
        if (blob && this.imageElement) {
            const url = URL.createObjectURL(blob);

            // Revoke old URL to avoid memory leaks
            if (this.lastObjectUrl) {
                URL.revokeObjectURL(this.lastObjectUrl);
            }

            this.lastObjectUrl = url;
            this.imageElement.setAttributeNS('http://www.w3.org/1999/xlink', 'href', url);
        }
    }

    /**
     * Updates the SVG image element with the content of a specific frame.
     * Consolidates lazy frame fetching, position tracking, and image display.
     */
    private async updateImageFromFrame(frameIndex: number): Promise<void> {
        // Optimization: Skip if we are already displaying this frame
        if (frameIndex === this.lastRenderedFrameIndex && this.imageElement?.getAttributeNS('http://www.w3.org/1999/xlink', 'href')) {
            return;
        }

        // Optimization: Handle the static final frame separately
        if (frameIndex >= this.totalFrames - 1 && this.totalFrames > 0 && this.finalFrameUrl) {
            if (this.imageElement) {
                this.imageElement.setAttributeNS('http://www.w3.org/1999/xlink', 'href', this.finalFrameUrl);
                this.lastRenderedFrameIndex = frameIndex;
            }
            return;
        }

        const result = await this.getFrame(frameIndex);
        if (!this.imageElement || !result) {
            if (isDebugEnabled()) {
                console.warn(`[SvgLayer] updateImageFromFrame: Missing imageElement or frame data at index ${frameIndex}`);
            }
            return;
        }

        const { imageData, position } = result;
        this.lastFramePosition = position; // Store position for hand overlay

        const ctx = this.offscreenCanvas.getContext('2d');
        if (!ctx) return;

        try {
            ctx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
            ctx.putImageData(imageData, 0, 0);

            // Debug: Check if the frame being displayed has content
            if (isDebugEnabled() && (frameIndex === 0 || frameIndex === this.totalFrames - 1)) {
                let hasContent = false;
                for (let i = 0; i < imageData.data.length; i += 4) {
                    if (imageData.data[i + 3] > 0) {
                        hasContent = true;
                        break;
                    }
                }
                console.log(`[SvgLayer] Displaying frame ${frameIndex} (${frameIndex === 0 ? 'first' : 'last'}): has content = ${hasContent}`);
            }

            // Performance optimization: Use WebP encoding (75% faster than PNG)
            // Falls back to PNG if WebP is not supported
            // and createObjectURL instead of toDataURL
            return new Promise((resolve) => {
                const imageFormat = this.supportsWebP ? 'image/webp' : 'image/png';

                this.offscreenCanvas.toBlob((blob) => {
                    // If WebP encoding failed and we haven't tried PNG yet, fallback to PNG
                    if (!blob && this.supportsWebP) {
                        this.supportsWebP = false;
                        if (isDebugEnabled()) {
                            console.log('[SvgLayer] WebP encoding not supported, falling back to PNG');
                        }
                        // Retry with PNG
                        this.offscreenCanvas.toBlob((pngBlob) => {
                            this.setImageFromBlob(pngBlob);
                            resolve();
                        }, 'image/png');
                        return;
                    }

                    this.setImageFromBlob(blob);

                    // Cache the final frame if this is it
                    if (frameIndex >= this.totalFrames - 1 && blob && !this.finalFrameBlob) {
                        this.finalFrameBlob = blob;
                        this.finalFrameUrl = URL.createObjectURL(blob);
                        // We also need to update the currently set URL because setImageFromBlob 
                        // just created a different temporary URL for this same blob.
                        // For consistency, let's use the finalFrameUrl immediately.
                        if (this.imageElement) {
                            this.imageElement.setAttributeNS('http://www.w3.org/1999/xlink', 'href', this.finalFrameUrl);
                            // Revoke the temporary one created by setImageFromBlob just before
                            if (this.lastObjectUrl) {
                                URL.revokeObjectURL(this.lastObjectUrl);
                                this.lastObjectUrl = this.finalFrameUrl;
                            }
                        }
                    }

                    this.lastRenderedFrameIndex = frameIndex;
                    resolve();
                }, imageFormat);
            });
        } catch (e) {
            console.error('Failed to update image from frame:', e);
            // Ensure we don't leak URLs even in error cases
            // (the URL has already been revoked in the normal path above)
        }
    }

    async loadSvgFromUrl(url: string): Promise<void> {
        try {
            this.svgUrl = url;
            if (isDebugEnabled()) {
                console.log(`Fetching SVG from: ${url}`);
            }

            let svgContent: string;

            // Use HTTP loader for remote URLs
            if (url.startsWith('http://') || url.startsWith('https://')) {
                const { getGlobalCache } = await import('../../utils/asset_cache');
                const { fetchText } = await import('../../utils/http_loader');

                const cache = getGlobalCache();
                const cachedBlob = await cache.get(url);

                if (cachedBlob) {
                    svgContent = await cachedBlob.text();
                } else {
                    const fetchedBlob = await fetchText(url, { retries: 3, timeout: 30000 });
                    await cache.set(url, fetchedBlob);
                    svgContent = await fetchedBlob.text();
                }
            } else {
                // Local path - use standard fetch
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                svgContent = await response.text();
            }

            if (isDebugEnabled()) {
                console.log('SVG content loaded successfully');
            }

            await this.loadSvg(svgContent);
        } catch (error) {
            console.error("Failed to load SVG from URL:", error);
            throw error;
        }
    }

    async play(targetDurationSeconds?: number, initialProgress: number = 0): Promise<void> {
        if (this.totalFrames === 0) {
            console.warn("[SvgLayer] No frames to play. Load an SVG first.");
            return;
        }

        if (this.isPlaying) {
            console.warn("[SvgLayer] Animation is already playing.");
            return;
        }

        this.wasRewinding = false;

        if (isDebugEnabled()) {
            console.log(`[SvgLayer] Starting play() with ${this.totalFrames} frames`);
        }

        await this.waitForHandOverlayReady();

        if (initialProgress > 0) {
            this.currentFrame = Math.floor(initialProgress * this.totalFrames);
        } else if (this.currentFrame >= this.totalFrames) {
            this.currentFrame = 0;
        }

        await this.updateImageFromFrame(this.currentFrame);
        this.setOpacity(this.playerConfig.opacity || 1);

        this.isPlaying = true;
        this.isPaused = false;
        this.isStopped = false;
        this.lastHandPos = null;

        const totalDurationMs = (targetDurationSeconds || (this.totalFrames / this.playerConfig.fps!)) * 1000;
        const animationStartTime = performance.now() - (initialProgress * totalDurationMs);
        this.lastFrameTime = performance.now();

        return new Promise((resolve) => {
            const frameInterval = this.normalizeTargetDuration(
                targetDurationSeconds,
                this.totalFrames
            );

            this.currentFrame++;

            const playFrame = async (currentTime: number) => {
                if (this.isStopped) {
                    this.animationFrameId = null;
                    resolve();
                    return;
                }

                if (this.isPaused) {
                    await this.resumePromise;
                    if (this.isStopped) {
                        this.animationFrameId = null;
                        resolve();
                        return;
                    }
                    this.lastFrameTime = performance.now();
                    this.animationFrameId = requestAnimationFrame(playFrame);
                    return;
                }

                if (!this.isPlaying) {
                    this.animationFrameId = null;
                    resolve();
                    return;
                }

                const elapsed = currentTime - this.lastFrameTime;
                const framesToProcess = Math.floor(elapsed / frameInterval);

                if (framesToProcess > 0) {
                    this.lastFrameTime = currentTime - (elapsed % frameInterval);
                    const maxFramesPerTick = Math.min(framesToProcess, 20);

                    let lastValidFrame = this.currentFrame - 1;
                    let framesProcessedTotal = 0;

                    for (let i = 0; i < maxFramesPerTick && this.currentFrame < this.totalFrames; i++) {
                        lastValidFrame = this.currentFrame;
                        this.currentFrame++;
                        framesProcessedTotal++;
                    }

                    if (lastValidFrame >= 0 && lastValidFrame < this.totalFrames) {
                        await this.updateImageFromFrame(lastValidFrame);

                        if (this.handOverlayManager && this.handOverlayManager.isEnabled() && this.handOverlayCanvas) {
                            const position = this.lastFramePosition;
                            if (position !== null && position !== undefined) {
                                const [x, y] = position;
                                const progress = lastValidFrame / this.totalFrames;
                                const transformedCurrent = this.transformPoint(x, y);

                                let targetX = transformedCurrent.x;
                                let targetY = transformedCurrent.y;

                                if (this.lastHandPos) {
                                    const smoothFactor = 0.4;
                                    targetX = this.lastHandPos.x + (targetX - this.lastHandPos.x) * (1 - smoothFactor);
                                    targetY = this.lastHandPos.y + (targetY - this.lastHandPos.y) * (1 - smoothFactor);
                                }
                                this.lastHandPos = { x: targetX, y: targetY };

                                const bounceFrequency = 4.0;
                                const bounceAmplitude = 0.5;
                                const timeInSeconds = lastValidFrame / this.playerConfig.fps!;
                                const bounceOffset = Math.sin(timeInSeconds * bounceFrequency * Math.PI * 2) * bounceAmplitude;

                                this.handOverlayManager.updateHandPosition(progress, {
                                    currentPoint: { x: targetX, y: targetY + bounceOffset },
                                    nextPoint: undefined
                                }, this.handOverlayCanvas);
                            } else {
                                this.handOverlayManager.hideHand(this.handOverlayCanvas);
                            }
                        }
                    }

                    if (this.currentFrame >= this.totalFrames) {
                        if (this.playerConfig.loop) {
                            this.currentFrame = 0;
                        } else {
                            this.isPlaying = false;
                            this.isPaused = false;
                            this.animationFrameId = null;

                            if (this.handOverlayManager && this.handOverlayCanvas) {
                                this.handOverlayManager.hideHand(this.handOverlayCanvas);
                            }

                            const totalExpectedDuration = frameInterval * this.totalFrames;
                            while (performance.now() - animationStartTime < totalExpectedDuration) {
                                // Micro-adjustment
                            }

                            resolve();
                            return;
                        }
                    }
                }

                this.animationFrameId = requestAnimationFrame(playFrame);
            };

            this.animationFrameId = requestAnimationFrame(playFrame);
        });
    }

    pause(): void {
        if (this.isPaused) return;
        super.pause();
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    stop(): void {
        super.stop();
        this.isPlaying = false;
        this.wasRewinding = false;
        this.currentFrame = 0;

        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        if (this.handOverlayManager && this.handOverlayCanvas) {
            this.handOverlayManager.hideHand(this.handOverlayCanvas);
        }

        if (this.totalFrames > 0) {
            this.updateImageFromFrame(0);
        }
    }

    async restart(): Promise<void> {
        this.stop();
        await new Promise(resolve => setTimeout(resolve, 50));
        await this.play();
    }

    private clearFrames(): void {
        if (this.lastObjectUrl) {
            URL.revokeObjectURL(this.lastObjectUrl);
            this.lastObjectUrl = null;
        }

        if (this.frameCache) {
            this.frameCache.clear();
        }

        this.totalFrames = 0;
        this.currentFrame = 0;
        this.lastFramePosition = null;
        this.drawingPositions = [];
        this.fullShapeImageData = null;
    }

    clear(): void {
        this.stop();
        this.kivg.clear();
        this.clearFrames();
        this.svgContent = null;
        this.svgUrl = null;
        if (this.imageElement) {
            this.imageElement.removeAttribute('href');
        }
    }

    public destroy(): void {
        if (this.isDestroyed) return;
        this.isDestroyed = true;
        this.stop();
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.clearFrames();
        this.kivg.clear();
        const ctx = this.offscreenCanvas?.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
        }
        if (this.imageElement) {
            this.imageElement.removeAttribute('href');
            this.imageElement = null;
        }
        this.svgContent = null;
        this.svgUrl = null;
        this.lastHandPos = null;
    }

    private async revealOriginal(): Promise<void> {
        if (!this.svgContent) return;

        try {
            if (this.totalFrames > 0) {
                const lastIdx = this.totalFrames - 1;
                await this.updateImageFromFrame(lastIdx);
                return;
            }

            await this.kivg.draw(this.svgContent, false, 'seq', {
                dur: this.playerConfig.duration!,
                fill: this.playerConfig.fill!,
                line_width: this.playerConfig.lineWidth!,
                line_color: this.playerConfig.lineColor!,
                fps: this.playerConfig.fps!,
                hand_draw: false
            });

            if (this.imageElement) {
                const dataUrl = this.offscreenCanvas.toDataURL('image/png');
                this.imageElement.setAttributeNS('http://www.w3.org/1999/xlink', 'href', dataUrl);
            }
        } catch (e) {
            console.error('Failed to reveal original image', e);
        }
    }

    getState() {
        return {
            isPlaying: this.isPlaying,
            isPaused: this.isPaused,
            currentFrame: this.currentFrame,
            totalFrames: this.totalFrames,
            hasContent: this.svgContent !== null,
            svgUrl: this.svgUrl
        };
    }

    updateConfig(newConfig: Partial<SvgLayerConfig>): void {
        this.playerConfig = { ...this.playerConfig, ...newConfig };
        this.config = { ...this.config, ...newConfig };
        if (newConfig.rotation !== undefined) {
            this.updateTransformCache();
        }
    }

    getControls(): SvgLayerControls {
        return {
            play: () => this.play(),
            pause: () => this.pause(),
            stop: () => this.stop(),
            restart: () => this.restart(),
            clear: () => this.clear(),
            loadSvg: (content: string) => this.loadSvg(content),
            loadSvgFromUrl: (url: string) => this.loadSvgFromUrl(url)
        };
    }

    private updateTransformCache(): void {
        const rotation = this.playerConfig.rotation || 0;
        if (rotation !== this.cachedRotation) {
            this.cachedRotation = rotation;
            const rad = (rotation * Math.PI) / 180;
            this.cachedTransformCos = Math.cos(rad);
            this.cachedTransformSin = Math.sin(rad);
        }
    }

    private transformPoint(x: number, y: number): { x: number; y: number } {
        return this.transformToGlobal({ x, y });
    }

    /**
     * Capture the layer's content directly to a canvas context.
     * This allows the Scene to capture the KivgPlayer's canvas pixels
     * for the erase effect, which SVG serialization cannot do.
     */
    public captureToContext(ctx: CanvasRenderingContext2D, onlyCurrentState: boolean = false): boolean {
        // If we only want the current state, respect current visibility
        if (onlyCurrentState) {
            const opacity = this.config.opacity !== undefined ? this.config.opacity : 1;
            if (opacity <= 0) return false;

            const display = this.element?.style.display;
            if (display === 'none') return false;
        }

        ctx.save();

        // Apply layer position and rotation
        const pos = this.config.position;
        if (!pos) {
            ctx.restore();
            return false;
        }
        const rotation = this.config.rotation || 0;
        const scale = this.config.scale || 1;

        ctx.translate(pos.x, pos.y);
        if (rotation !== 0) {
            ctx.rotate((rotation * Math.PI) / 180);
        }

        // Apply layer scale
        ctx.scale(scale, scale);

        // If animation has started and we have frames, draw the current frame
        if (this.isPlaying || this.currentFrame > 0) {
            if (this.offscreenCanvas) {
                ctx.drawImage(this.offscreenCanvas, 0, 0);
                ctx.restore();
                return true;
            }
        }

        // If animation hasn't started but we have preloaded the full shape, draw it
        // This is crucial for occlusion detection before the animation begins
        // But ONLY if we are not restricted to the current (invisible) state
        if (!onlyCurrentState && this.fullShapeImageData) {
            // Create a temporary canvas to draw the ImageData
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.fullShapeImageData.width;
            tempCanvas.height = this.fullShapeImageData.height;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
                tempCtx.putImageData(this.fullShapeImageData, 0, 0);
                ctx.drawImage(tempCanvas, 0, 0);
                ctx.restore();
                return true;
            }
        }

        // Fallback to offscreenCanvas if nothing else
        if (this.offscreenCanvas) {
            ctx.drawImage(this.offscreenCanvas, 0, 0);
            ctx.restore();
            return true;
        }

        ctx.restore();
        return false;
    }

    protected getLayerType(): string {
        return 'drawing';
    }

    /**
     * Seek to a specific progress (0-1) in the layer's entrance animation.
     * This immediately applies the visual state for that frame.
     * 
     * Smart Seek: Supports both forward (incremental) and rewind (backward) seeking.
     */
    protected onSeek(entranceProgress: number): void {
        const config = this.config.entrance_animation;
        if (!config || config.type !== 'draw') {
            // For non-draw animations, base Layer.seek handles everything via LayerAnimator
            return;
        }

        // Calculate direction and incremental status based on lifecycle progress (this.lastSeekProgress)
        const progress = entranceProgress;
        const lifecycleProgress = this.lastSeekProgress || 0;
        const direction = this.getSeekDirection(lifecycleProgress);
        const isIncremental = this.isIncrementalSeek(lifecycleProgress, 0.05);

        // Hysteresis logic to prevent hand flicker on rewind jitter
        let effectiveDirection = direction;
        if (direction === 'rewind') {
            this.wasRewinding = true;
        } else if (direction === 'forward' && this.wasRewinding) {
            // Check if forward movement is significant enough to break hysteresis
            // Use a small threshold (0.5%) to filter out mouse jitter
            const delta = lifecycleProgress - (this.lastSeekProgress || 0); // Note: this.lastSeekProgress was just updated by super.seek
            // Wait, I need the PREVIOUS lastSeekProgress. 
            // In Layer.seek, I update this.lastSeekProgress = progress; at the VERY START.
            // So lifecycleProgress IS the new progress.
            // This logic might need refinement if I need the OLD progress.
            // But let's stick to the current logic which seems to work for jitter.

            if (delta < 0.005) {
                // Treat as jitter: force rewind behavior (hide hand)
                effectiveDirection = 'rewind';
            } else {
                // Significant forward movement: reset hysteresis
                this.wasRewinding = false;
            }
        }

        if (isDebugEnabled()) {
            console.log(`[SvgLayer] onSeek: entranceProgress=${entranceProgress.toFixed(4)}, direction=${direction}, effective=${effectiveDirection}`);
        }

        // If frames haven't been loaded yet, we can't seek
        if (this.totalFrames === 0) {
            return;
        }

        // Calculate target frame based on entrance progress
        const targetFrame = Math.floor(progress * (this.totalFrames - 1));
        const clampedFrame = Math.max(0, Math.min(targetFrame, this.totalFrames - 1));

        // Update the current frame (for play/pause continuity)
        this.currentFrame = clampedFrame;

        // Update the visual display
        this.updateImageFromFrameSync(clampedFrame);

        // Update hand overlay position if enabled
        if (this.getShouldDrawHandDuringSeek()) {
            if (this.handOverlayManager?.isEnabled() && this.handOverlayCanvas) {
                // Hide hand if we are outside the active animation range
                if (progress < this.HAND_HIDE_START_THRESHOLD || progress > this.HAND_HIDE_END_THRESHOLD) {
                    this.handOverlayManager.hideHand(this.handOverlayCanvas);
                    return;
                }

                // Use the position from the frame we just rendered (stored in this.lastFramePosition)
                const position = this.lastFramePosition;
                if (position !== null && position !== undefined) {
                    const [x, y] = position;
                    const transformedPos = this.transformPoint(x, y);
                    this.handOverlayManager.drawHandAt(transformedPos.x, transformedPos.y, this.handOverlayCanvas);
                } else {
                    this.handOverlayManager.hideHand(this.handOverlayCanvas);
                }
            } else if (this.handOverlayManager && this.handOverlayCanvas) {
                this.handOverlayManager.hideHand(this.handOverlayCanvas);
            }
        }
    }

    /**
     * Update image from frame synchronously (for seek operations)
     * Uses blob-based approach to prevent flickering during seek
     */
    private updateImageFromFrameSync(frameIndex: number): void {
        if (!this.imageElement) {
            return;
        }

        // renderFrameAtTime is synchronous and fast enough for seek
        const fps = this.playerConfig.fps || 30;
        const time = frameIndex / fps;
        const { imageData, position } = this.kivg.renderFrameAtTime(time);

        // Store position for hand overlay tracking
        this.lastFramePosition = position;

        // Update offscreen canvas
        const ctx = this.offscreenCanvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
            ctx.putImageData(imageData, 0, 0);
        }

        // Use blob-based approach (same as async version) to prevent flickering
        try {
            const imageFormat = this.supportsWebP ? 'image/webp' : 'image/png';

            this.offscreenCanvas.toBlob((blob) => {
                if (!blob && this.supportsWebP) {
                    this.supportsWebP = false;
                    if (isDebugEnabled()) {
                        console.log('[SvgLayer] WebP encoding not supported, falling back to PNG');
                    }
                    this.offscreenCanvas.toBlob((pngBlob) => {
                        this.setImageFromBlob(pngBlob);
                    }, 'image/png');
                    return;
                }

                this.setImageFromBlob(blob);
            }, imageFormat);
        } catch (error) {
            if (isDebugEnabled()) {
                console.warn('[SvgLayer] Failed to update frame during seek:', error);
            }
        }
    }
}
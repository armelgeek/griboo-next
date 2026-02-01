/**
 * Camera Module for Kivg Core
 * 
 * Provides camera effects, transformations, and parallax effects for animations.
 * 
 * Features:
 * - Camera zoom and pan effects
 * - Parallax depth calculations
 * - Camera sequence generation with transitions
 * - Easing-based camera movements
 * - Post-animation effects (zoom in/out, etc.)
 * 
 * Usage:
 *     import { CameraController, applyCameraTransform, generateZoomFrames } from './core/camera';
 *     
 *     const camera = new CameraController(1920, 1080);
 *     camera.addKeyframe({ zoom: 1.2, position: [0.3, 0.5], pauseTime: 2.0 });
 *     const frames = camera.generateFrames(baseFrame, 30);
 */

import { AnimationTransition } from './easing';
import { CameraConfig, CameraPosition, CameraSize, CameraKeyframe } from '../../../shared/types';
export type { CameraConfig, CameraPosition, CameraSize, CameraKeyframe };
import { interpolateCamera, easingFunction, calculateCameraForBounds } from '../../../shared/utils/camera_utils';
export { interpolateCamera, easingFunction, calculateCameraForBounds };

/**
 * Calculate position offset based on parallax depth.
 */
export function calculateParallaxOffset(
    cameraPosition: CameraPosition,
    parallaxDepth: number,
    canvasWidth: number,
    canvasHeight: number
): [number, number] {
    const camX = cameraPosition.x ?? 0.5;
    const camY = cameraPosition.y ?? 0.5;

    // Deviation from center
    const deviationX = camX - 0.5;
    const deviationY = camY - 0.5;

    // Parallax multiplier: lower depth = less movement
    const parallaxFactor = 1.0 - parallaxDepth;

    // Calculate offset in pixels
    const offsetX = -deviationX * canvasWidth * parallaxFactor;
    const offsetY = -deviationY * canvasHeight * parallaxFactor;

    return [Math.round(offsetX), Math.round(offsetY)];
}

/**
 * Apply camera zoom and position transformations to a frame.
 */
export function applyCameraTransform(
    frame: ImageData,
    cameraConfig: CameraConfig | null,
    frameWidth: number,
    frameHeight: number,
    cameraSize?: CameraSize | null,
    parallaxDepth: number = 1.0,
    backgroundColor: string = 'white'
): ImageData {
    if (!cameraConfig) {
        return frame;
    }

    const zoom = cameraConfig.zoom ?? 1.0;
    const position = cameraConfig.position ?? { x: 0.5, y: 0.5 };

    // Apply parallax depth to zoom
    const effectiveZoom = 1.0 + (zoom - 1.0) * parallaxDepth;

    const h = frame.height;
    const w = frame.width;

    // Calculate center position with parallax adjustment
    const parallaxPosX = 0.5 + (position.x - 0.5) * parallaxDepth;
    const parallaxPosY = 0.5 + (position.y - 0.5) * parallaxDepth;

    const centerX = w * parallaxPosX;
    const centerY = h * parallaxPosY;

    // Create canvas for transformation
    const canvas = document.createElement('canvas');
    canvas.width = frameWidth;
    canvas.height = frameHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        return frame;
    }

    // 1. Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, frameWidth, frameHeight);

    // 2. Create source canvas to draw the ImageData
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = w;
    srcCanvas.height = h;
    const srcCtx = srcCanvas.getContext('2d');
    if (!srcCtx) {
        return frame;
    }

    srcCtx.putImageData(frame, 0, 0);

    // 3. Apply transformation using robust drawImage scaling
    ctx.save();
    const x_offset = frameWidth / 2 - centerX * effectiveZoom;
    const y_offset = frameHeight / 2 - centerY * effectiveZoom;

    ctx.drawImage(
        srcCanvas,
        0, 0, w, h,                   // Source: entire virtual canvas
        x_offset, y_offset,            // Destination: centered position
        w * effectiveZoom, h * effectiveZoom // Destination: scaled size
    );
    ctx.restore();

    return ctx.getImageData(0, 0, frameWidth, frameHeight);
}

/**
 * Normalize camera position to object format.
 */
export function normalizeCameraPosition(
    positionRaw: CameraPosition | [number, number] | null | undefined
): CameraPosition {
    if (!positionRaw) {
        return { x: 0.5, y: 0.5 };
    }

    if (Array.isArray(positionRaw)) {
        return {
            x: positionRaw[0] ?? 0.5,
            y: positionRaw[1] ?? 0.5
        };
    }

    return positionRaw;
}

/**
 * Generate frames for a sequence of camera movements.
 */
export function generateCameraSequenceFrames(
    baseFrame: ImageData,
    cameras: CameraKeyframe[],
    frameRate: number,
    targetWidth: number,
    targetHeight: number,
    verbose: boolean = false
): ImageData[] {
    if (!cameras.length) {
        return [baseFrame];
    }

    const allFrames: ImageData[] = [];
    let prevCamera: CameraConfig | null = null;

    for (let cameraIdx = 0; cameraIdx < cameras.length; cameraIdx++) {
        const camera = cameras[cameraIdx];
        const cameraZoom = camera.zoom ?? 1.0;
        const cameraPosRaw = camera.position ?? { x: 0.5, y: 0.5 };
        const cameraPos = normalizeCameraPosition(cameraPosRaw);
        const cameraSize = camera.size ?? null;
        const duration = camera.pauseTime ?? 2.0;
        const transitionDuration = camera.transitionDuration ?? 0;
        const easing = camera.easing ?? 'ease_out';

        const holdFrames = Math.floor(frameRate * duration);
        const transitionFrames = prevCamera && transitionDuration > 0
            ? Math.floor(frameRate * transitionDuration)
            : 0;

        if (verbose) {
            console.log(`    📷 Camera ${cameraIdx + 1}: zoom=${cameraZoom.toFixed(2)}, pos=(${cameraPos.x.toFixed(2)}, ${cameraPos.y.toFixed(2)}), duration=${duration}s`);
            if (transitionFrames > 0) {
                console.log(`       Transition: ${transitionDuration}s with ${easing} easing`);
            }
        }

        // Generate transition frames
        if (prevCamera && transitionFrames > 0) {
            for (let i = 0; i < transitionFrames; i++) {
                const progress = transitionFrames > 1 ? i / (transitionFrames - 1) : 1.0;
                const currentCamera = interpolateCamera(prevCamera, camera, progress, easing);

                const frame = applyCameraTransform(
                    baseFrame,
                    currentCamera,
                    targetWidth,
                    targetHeight,
                    currentCamera.size
                );
                allFrames.push(frame);
            }
        }

        // Generate hold frames
        const cameraConfig: CameraConfig = {
            zoom: cameraZoom,
            position: cameraPos,
            size: cameraSize
        };

        for (let i = 0; i < holdFrames; i++) {
            const frame = applyCameraTransform(
                baseFrame,
                cameraConfig,
                targetWidth,
                targetHeight,
                cameraSize
            );
            allFrames.push(frame);
        }

        prevCamera = cameraConfig;
    }

    return allFrames;
}

/**
 * Apply zoom effect to a frame.
 */
export function applyZoomEffect(
    frame: ImageData,
    zoomStart: number,
    zoomEnd: number,
    progress: number,
    center: [number, number] = [0.5, 0.5],
    easing: string = 'ease_out'
): ImageData {
    const easedProgress = easingFunction(progress, easing);
    const currentZoom = zoomStart + (zoomEnd - zoomStart) * easedProgress;

    const cameraConfig: CameraConfig = {
        zoom: currentZoom,
        position: { x: center[0], y: center[1] }
    };

    return applyCameraTransform(frame, cameraConfig, frame.width, frame.height);
}

/**
 * Generate frames for a zoom animation.
 */
export function generateZoomFrames(
    frame: ImageData,
    numFrames: number,
    zoomStart: number = 1.0,
    zoomEnd: number = 1.2,
    center: [number, number] = [0.5, 0.5],
    easing: string = 'ease_out'
): ImageData[] {
    const frames: ImageData[] = [];

    for (let i = 0; i < numFrames; i++) {
        const progress = numFrames > 1 ? i / (numFrames - 1) : 0;
        const zoomed = applyZoomEffect(frame, zoomStart, zoomEnd, progress, center, easing);
        frames.push(zoomed);
    }

    return frames;
}

/**
 * Generate frames for a pan animation.
 */
export function generatePanFrames(
    frame: ImageData,
    numFrames: number,
    startPos: [number, number] = [0.3, 0.5],
    endPos: [number, number] = [0.7, 0.5],
    zoom: number = 1.5,
    easing: string = 'ease_in_out'
): ImageData[] {
    const frames: ImageData[] = [];

    for (let i = 0; i < numFrames; i++) {
        const progress = numFrames > 1 ? i / (numFrames - 1) : 0;
        const easedProgress = easingFunction(progress, easing);

        const currentX = startPos[0] + (endPos[0] - startPos[0]) * easedProgress;
        const currentY = startPos[1] + (endPos[1] - startPos[1]) * easedProgress;

        const cameraConfig: CameraConfig = {
            zoom,
            position: { x: currentX, y: currentY }
        };

        const panned = applyCameraTransform(frame, cameraConfig, frame.width, frame.height);
        frames.push(panned);
    }

    return frames;
}

/**
 * Camera controller for managing camera movements and effects.
 */
/**
 * Camera controller for managing camera movements and effects.
 * Ported from ServerCameraController to ensure identical behavior.
 */
export class CameraController {
    private width: number;
    private height: number;
    private virtualSize: CameraSize;
    private followMode: 'manual' | 'active_layer' | 'hand';
    private currentConfig: CameraConfig;
    private keyframes: CameraKeyframe[] = [];
    private resolvedKeyframes: Map<number, CameraConfig> = new Map();

    constructor(
        width: number,
        height: number,
        initialConfig?: CameraConfig,
        virtualSize?: CameraSize,
        followMode: 'manual' | 'active_layer' | 'hand' = 'manual'
    ) {
        this.width = width;
        this.height = height;
        this.virtualSize = virtualSize || { width, height };
        this.followMode = followMode || 'manual'; // Changed this line

        // Deep copy and normalize initial config
        this.currentConfig = initialConfig ? JSON.parse(JSON.stringify(initialConfig)) : {
            size: { width: 800, height: 450 },
            position: { x: 0.5, y: 0.5 }
        };

        if (this.currentConfig.position) {
            if (this.currentConfig.position.x > 1.0) this.currentConfig.position.x /= this.virtualSize.width;
            if (this.currentConfig.position.y > 1.0) this.currentConfig.position.y /= this.virtualSize.height;
        }
    }

    /**
     * Update the initial camera configuration.
     * Useful for snapping the camera to the first keyframe during preparation.
     */
    public setInitialConfig(config: CameraConfig): void {
        this.currentConfig = { ...config };
    }

    /**
     * Update the frame dimensions.
     */
    public setDimensions(width: number, height: number): void {
        this.width = width;
        this.height = height;
    }

    /**
     * Get all keyframes (read-only copy)
     */
    getKeyframes(): CameraKeyframe[] {
        return [...this.keyframes];
    }

    /**
     * Check if camera has keyframes
     */
    hasKeyframes(): boolean {
        return this.keyframes.length > 0;
    }

    /**
     * Clear all keyframes
     */
    clearKeyframes(): void {
        this.keyframes = [];
        this.resolvedKeyframes.clear();
    }

    /**
     * Get the total duration of all camera keyframes
     */
    getKeyframesDuration(): number {
        if (this.keyframes.length === 0) return 0;
        const lastKf = this.keyframes[this.keyframes.length - 1];
        return (lastKf.startTime || 0) + (lastKf.pauseTime || 0);
    }

    /**
     * Add a camera keyframe
     */
    addKeyframe(keyframe: CameraKeyframe): void {
        this.keyframes.push(keyframe);
        // Sort keyframes by startTime
        this.keyframes.sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
        this.resolvedKeyframes.clear(); // Invalidate cache
    }

    /**
     * Pre-resolve all keyframes to avoid repeated lookups during rendering.
     */
    public warmup(layers: any[]): void {
        this.resolvedKeyframes.clear();
        for (let i = 0; i < this.keyframes.length; i++) {
            const kf = this.keyframes[i];
            const startTime = kf.startTime || 0;
            const resolved = this.resolveConfig(kf, startTime, layers);
            this.resolvedKeyframes.set(i, resolved);
        }
    }

    /**
     * Get camera configuration at a specific time
     */
    getConfigAtTime(time: number, layers: any[] = []): CameraConfig {
        // 1. Handle Keyframes and Manual Mode (Priority)
        if (this.keyframes.length > 0) {
            // Find the keyframe that applies at this time
            let prevKeyframe: CameraKeyframe | null = null;
            let nextKeyframe: CameraKeyframe | null = null;

            for (let i = 0; i < this.keyframes.length; i++) {
                const kf = this.keyframes[i];
                const startTime = kf.startTime || 0;

                if (startTime <= time) {
                    prevKeyframe = kf;
                } else {
                    nextKeyframe = kf;
                    break;
                }
            }

            if (!prevKeyframe) {
                const firstKf = this.keyframes[0];
                const firstStartTime = firstKf.startTime || 0;
                const transitionDuration = firstKf.transitionDuration || 0;

                if (time < firstStartTime && transitionDuration > 0) {
                    const transitionStart = firstStartTime - transitionDuration;
                    if (time >= transitionStart) {
                        const progress = (time - transitionStart) / transitionDuration;
                        const resolvedInitial = this.resolveConfig(this.currentConfig, time, layers);
                        const resolvedFirst = this.resolvedKeyframes.get(0) || this.resolveConfig(firstKf, time, layers);
                        return interpolateCamera(resolvedInitial, resolvedFirst, progress, firstKf.easing);
                    }
                }

                // Return initial config if we are before the first keyframe's transition
                return this.resolveConfig(this.currentConfig, time, layers);
            }

            const prevIndex = this.keyframes.indexOf(prevKeyframe);
            const nextIndex = nextKeyframe ? this.keyframes.indexOf(nextKeyframe) : -1;

            if (!nextKeyframe) {
                return this.resolvedKeyframes.get(prevIndex) || this.resolveConfig(prevKeyframe, time, layers);
            }

            // Between two keyframes
            const nextStartTime = nextKeyframe.startTime || 0;
            const transitionDuration = nextKeyframe.transitionDuration || 0;
            const prevDuration = prevKeyframe.pauseTime || 0;
            const prevStartTime = prevKeyframe.startTime || 0;
            const totalHoldTime = prevDuration;

            // Check if we are still in the pause period after reaching the previous keyframe
            if (time < prevStartTime + totalHoldTime) {
                return this.resolvedKeyframes.get(prevIndex) || this.resolveConfig(prevKeyframe, time, layers);
            }

            if (time >= nextStartTime - transitionDuration) {
                const progress = transitionDuration > 0
                    ? (time - (nextStartTime - transitionDuration)) / transitionDuration
                    : 1.0;
                const resolvedPrev = this.resolvedKeyframes.get(prevIndex) || this.resolveConfig(prevKeyframe, time, layers);
                const resolvedNext = this.resolvedKeyframes.get(nextIndex) || this.resolveConfig(nextKeyframe, time, layers);
                return interpolateCamera(resolvedPrev, resolvedNext, progress, nextKeyframe.easing);
            }

            return this.resolvedKeyframes.get(prevIndex) || this.resolveConfig(prevKeyframe, time, layers);
        }

        // 2. Handle Automatic Follow Modes (Fallback)
        if (this.followMode === 'hand' || this.followMode === 'active_layer') {
            // Find the layer currently being animated
            const activeLayer = layers.find(l => {
                const timing = l.absoluteTiming || l.timing;
                if (!timing) return false;
                const start = timing.entranceDelay || 0;
                const end = start + (timing.animationDuration || 0);
                return time >= start && time < end;
            });

            if (activeLayer) {
                if (this.followMode === 'hand') {
                    const handPos = activeLayer.getHandPosition?.(time);
                    if (handPos) {
                        return {
                            zoom: 2.0, // Default zoom for hand following
                            position: {
                                x: handPos.x / this.virtualSize.width,
                                y: handPos.y / this.virtualSize.height
                            }
                        };
                    }
                } else {
                    // active_layer mode: focus on the layer's bounds
                    const proxy = activeLayer.getOcclusionProxy?.(time);
                    if (proxy) {
                        const bounds = {
                            left: proxy.x - (proxy.type === 'rect' ? 0 : proxy.width / 2),
                            top: proxy.y - (proxy.type === 'rect' ? 0 : proxy.height / 2),
                            right: proxy.x + (proxy.type === 'rect' ? proxy.width : proxy.width / 2),
                            bottom: proxy.y + (proxy.type === 'rect' ? proxy.height : proxy.height / 2)
                        };
                        return calculateCameraForBounds(bounds, { width: this.width, height: this.height }, this.virtualSize, 50);
                    }
                }
            }
        }

        return this.resolveConfig(this.currentConfig, time, layers);
    }

    /**
     * Resolve a CameraConfig (e.g., handle targetLayerId)
     */
    private resolveConfig(config: CameraConfig, time: number, layers: any[]): CameraConfig {
        let resolved: CameraConfig;

        if (config.targetLayerId) {
            const layer = layers.find(l => (l.config?.id || l.id) === config.targetLayerId);
            if (layer) {
                const proxy = layer.getOcclusionProxy?.(time);
                if (proxy) {
                    const isCenterBased = proxy.type === 'circle' || proxy.type === 'ellipse';
                    const bounds = {
                        left: proxy.left !== undefined ? proxy.left : (isCenterBased ? proxy.x - proxy.width / 2 : proxy.x),
                        top: proxy.top !== undefined ? proxy.top : (isCenterBased ? proxy.y - proxy.height / 2 : proxy.y),
                        right: proxy.right !== undefined ? proxy.right : (isCenterBased ? proxy.x + proxy.width / 2 : proxy.x + proxy.width),
                        bottom: proxy.bottom !== undefined ? proxy.bottom : (isCenterBased ? proxy.y + proxy.height / 2 : proxy.y + proxy.height)
                    };
                    const padding = config.padding ?? 50;
                    resolved = calculateCameraForBounds(bounds, { width: this.width, height: this.height }, this.virtualSize, padding);

                    // If an explicit zoom is provided, override the calculated one
                    if (config.zoom !== undefined) {
                        resolved.zoom = config.zoom;
                    }
                } else {
                    resolved = JSON.parse(JSON.stringify(config));
                }
            } else {
                resolved = JSON.parse(JSON.stringify(config));
            }
        } else {
            resolved = JSON.parse(JSON.stringify(config));
        }

        // Normalize position if it's provided in absolute pixels (> 1.0)
        if (resolved.position) {
            if (resolved.position.x > 1.0) resolved.position.x /= this.virtualSize.width;
            if (resolved.position.y > 1.0) resolved.position.y /= this.virtualSize.height;
        }

        // If size is provided but zoom is not, calculate zoom to fit the size
        if (resolved.size && resolved.zoom === undefined) {
            const zoomX = this.width / resolved.size.width;
            const zoomY = this.height / resolved.size.height;
            resolved.zoom = Math.min(zoomX, zoomY);
        }

        // Ensure zoom and position always have default values
        if (resolved.zoom === undefined) {
            resolved.zoom = 1.0;
        }
        if (resolved.position === undefined) {
            resolved.position = { x: 0.5, y: 0.5 };
        }

        return resolved;
    }

    /**
     * Transform a point from virtual canvas coordinates to screen coordinates
     */
    public transformPoint(point: { x: number, y: number }, time: number, layers: any[] = []): { x: number, y: number } {
        const config = this.getConfigAtTime(time, layers);
        const zoom = config.zoom ?? 1.0;
        const position = config.position ?? { x: 0.5, y: 0.5 };

        const w = this.virtualSize.width;
        const h = this.virtualSize.height;
        const centerX = w * position.x;
        const centerY = h * position.y;

        const x_offset = this.width / 2 - centerX * zoom;
        const y_offset = this.height / 2 - centerY * zoom;

        return {
            x: point.x * zoom + x_offset,
            y: point.y * zoom + y_offset
        };
    }

    /**
     * Apply current camera settings to a frame.
     */
    apply(frame: ImageData, time?: number, layers: any[] = []): ImageData {
        const cameraConfig = time !== undefined ? this.getConfigAtTime(time, layers) : this.currentConfig;

        return applyCameraTransform(
            frame,
            cameraConfig,
            this.width,
            this.height,
            cameraConfig.size
        );
    }

    /**
     * Generate all camera animation frames.
     * Note: This uses the standalone generateCameraSequenceFrames for now,
     * which might differ slightly from getConfigAtTime logic if not updated.
     * For strict consistency, we should probably iterate time and use getConfigAtTime.
     */
    generateFrames(baseFrame: ImageData, frameRate: number = 30): ImageData[] {
        if (!this.keyframes.length) {
            return [baseFrame];
        }

        // Use the shared utility for now as it's efficient for sequences
        return generateCameraSequenceFrames(
            baseFrame,
            this.keyframes,
            frameRate,
            this.width,
            this.height
        );
    }

    /**
     * Set current zoom level (Manual override)
     */
    setZoom(zoom: number): void {
        this.currentConfig.zoom = zoom;
    }

    /**
     * Set current position (Manual override)
     */
    setPosition(x: number, y: number): void {
        this.currentConfig.position = { x, y };
    }

    /**
     * Check if camera is settled (not transitioning between keyframes) at a given time.
     * Returns true if camera is at rest, false if currently animating.
     */
    public isCameraSettled(time: number): boolean {
        if (this.keyframes.length === 0) {
            return true; // No keyframes = always settled
        }

        // Check if we're in a transition to first keyframe
        const firstKf = this.keyframes[0];
        const firstStartTime = firstKf.startTime || 0;
        const firstTransitionDuration = firstKf.transitionDuration || 0;
        if (firstTransitionDuration > 0 && time < firstStartTime) {
            const transitionStart = firstStartTime - firstTransitionDuration;
            if (time >= transitionStart && time < firstStartTime) {
                return false; // In transition to first keyframe
            }
        }

        // Find current and next keyframe
        for (let i = 0; i < this.keyframes.length; i++) {
            const kf = this.keyframes[i];
            const startTime = kf.startTime || 0;
            const pauseTime = kf.pauseTime || 0;
            const nextKf = this.keyframes[i + 1];

            if (nextKf) {
                const nextStartTime = nextKf.startTime || 0;
                const nextTransitionDuration = nextKf.transitionDuration || 0;

                // Check if we're past the pause period and in transition
                if (time >= startTime + pauseTime && nextTransitionDuration > 0) {
                    const transitionStart = nextStartTime - nextTransitionDuration;
                    if (time >= transitionStart && time < nextStartTime) {
                        return false; // In transition
                    }
                }
            }
        }

        return true; // Settled
    }

    /**
     * Get the time when the camera will be settled (end of current transition).
     * Returns the current time if already settled.
     */
    public getCameraSettleTime(time: number): number {
        const totalDuration = this.getKeyframesDuration();
        if (totalDuration <= 0) return time;

        // Return the total duration of the camera sequence to ensure 
        // subsequent transitions wait for all camera movements to finish.
        return Math.max(time, totalDuration);
    }
}

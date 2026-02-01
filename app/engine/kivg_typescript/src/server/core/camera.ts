import { Canvas, createCanvas } from 'canvas';
import { CameraConfig, CameraKeyframe, CameraSize, CameraPosition } from '../../shared/types';
import { interpolateCamera, calculateCameraForBounds } from '../../shared/utils/camera_utils';
import { ServerLayer } from './layer';

/**
 * Server-side Camera Controller
 * Handles camera transformations (zoom, pan) for server-side rendering.
 */
export class ServerCameraController {
    private width: number;
    private height: number;
    private virtualSize: CameraSize;
    private followMode: 'manual' | 'active_layer' | 'hand';
    private currentConfig: CameraConfig;
    private keyframes: CameraKeyframe[] = [];
    private initialConfigProvided: boolean = false;

    constructor(width: number, height: number, initialConfig?: CameraConfig, virtualSize?: CameraSize, followMode: 'manual' | 'active_layer' | 'hand' = 'manual') {
        this.width = width;
        this.height = height;
        this.virtualSize = virtualSize || { width, height };
        this.followMode = followMode;
        this.initialConfigProvided = !!initialConfig;

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
     * Clear all keyframes
     */
    clearKeyframes(): void {
        this.keyframes = [];
    }

    /**
     * Add a camera keyframe
     */
    addKeyframe(keyframe: CameraKeyframe): void {
        this.keyframes.push(keyframe);
        // Sort keyframes by startTime
        this.keyframes.sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
    }

    /**
     * Check if camera has any keyframes
     */
    hasKeyframes(): boolean {
        return this.keyframes.length > 0;
    }

    /**
     * Check if camera has follow mode or keyframes or initial config
     */
    isActive(): boolean {
        return this.keyframes.length > 0 || this.followMode !== 'manual' || this.initialConfigProvided;
    }

    /**
     * Get camera configuration at a specific time
     */
    getConfigAtTime(time: number, layers: ServerLayer[] = []): CameraConfig {
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
                        const resolvedFirst = this.resolveConfig(firstKf, time, layers);
                        return interpolateCamera(resolvedInitial, resolvedFirst, progress, firstKf.easing);
                    }
                }

                // Return initial config if we are before the first keyframe's transition
                return this.resolveConfig(this.currentConfig, time, layers);
            }

            const prevIndex = this.keyframes.indexOf(prevKeyframe);
            const nextIndex = nextKeyframe ? this.keyframes.indexOf(nextKeyframe) : -1;

            if (!nextKeyframe) {
                return this.resolveConfig(prevKeyframe, time, layers);
            }

            // Between two keyframes
            const nextStartTime = nextKeyframe.startTime || 0;
            const transitionDuration = nextKeyframe.transitionDuration || 0;
            const prevDuration = prevKeyframe.pauseTime || 0;
            const prevStartTime = prevKeyframe.startTime || 0;
            const totalHoldTime = prevDuration;

            if (time < prevStartTime + totalHoldTime) {
                return this.resolveConfig(prevKeyframe, time, layers);
            }

            if (time >= nextStartTime - transitionDuration) {
                const progress = transitionDuration > 0
                    ? (time - (nextStartTime - transitionDuration)) / transitionDuration
                    : 1.0;
                const resolvedPrev = this.resolveConfig(prevKeyframe, time, layers);
                const resolvedNext = this.resolveConfig(nextKeyframe, time, layers);
                return interpolateCamera(resolvedPrev, resolvedNext, progress, nextKeyframe.easing);
            }

            return this.resolveConfig(prevKeyframe, time, layers);
        }

        // 2. Handle Automatic Follow Modes (Fallback)
        if (this.followMode === 'hand' || this.followMode === 'active_layer') {
            // Find the layer currently being animated
            const activeLayer = layers.find(l => {
                const timing = l.getAbsoluteTiming();
                return timing && time >= timing.entranceDelay && time < timing.entranceDelay + timing.animationDuration;
            });

            if (activeLayer) {
                if (this.followMode === 'hand') {
                    const handPos = activeLayer.getHandPosition(time);
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
                    const proxy = activeLayer.getOcclusionProxy(time);
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

        return this.resolveConfig(this.currentConfig, time, layers);
    }

    /**
     * Resolve a CameraConfig (e.g., handle targetLayerId)
     */
    private resolveConfig(config: CameraConfig, time: number, layers: ServerLayer[]): CameraConfig {
        let resolved: CameraConfig;

        if (config.targetLayerId) {
            const layer = layers.find(l => l.getConfig().id === config.targetLayerId);
            if (layer) {
                const proxy = layer.getOcclusionProxy(time);
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

        if (resolved.size) {
            const zoomX = this.virtualSize.width / resolved.size.width;
            const zoomY = this.virtualSize.height / resolved.size.height;
            // Use Math.max to ensure the camera fits the most constrained dimension 
            // of the virtual space relative to the output aspect ratio.
            resolved.zoom = Math.max(zoomX, zoomY);
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
    public transformPoint(point: { x: number, y: number }, time: number, layers: ServerLayer[] = [], targetWidth?: number, targetHeight?: number): { x: number, y: number } {
        const config = this.getConfigAtTime(time, layers);
        const zoom = config.zoom || 1.0;
        const position = config.position || { x: 0.5, y: 0.5 };

        const drawWidth = targetWidth || this.width;
        const drawHeight = targetHeight || this.height;

        const w = this.virtualSize.width;
        const h = this.virtualSize.height;

        // Base viewport scale factor
        const viewportScale = Math.min(drawWidth / w, drawHeight / h);
        const finalZoom = zoom * viewportScale;

        const centerX = w * position.x;
        const centerY = h * position.y;

        const x_offset = drawWidth / 2 - centerX * finalZoom;
        const y_offset = drawHeight / 2 - centerY * finalZoom;

        return {
            x: point.x * finalZoom + x_offset,
            y: point.y * finalZoom + y_offset
        };
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
        if (this.keyframes.length === 0 || this.isCameraSettled(time)) {
            return time;
        }

        // Check transition to first keyframe
        const firstKf = this.keyframes[0];
        const firstStartTime = firstKf.startTime || 0;
        const firstTransitionDuration = firstKf.transitionDuration || 0;
        if (firstTransitionDuration > 0 && time < firstStartTime) {
            const transitionStart = firstStartTime - firstTransitionDuration;
            if (time >= transitionStart) {
                return firstStartTime;
            }
        }

        // Find the current transition
        for (let i = 0; i < this.keyframes.length; i++) {
            const kf = this.keyframes[i];
            const startTime = kf.startTime || 0;
            const pauseTime = kf.pauseTime || 0;
            const nextKf = this.keyframes[i + 1];

            if (nextKf) {
                const nextStartTime = nextKf.startTime || 0;
                const nextTransitionDuration = nextKf.transitionDuration || 0;

                if (time >= startTime + pauseTime && nextTransitionDuration > 0) {
                    const transitionStart = nextStartTime - nextTransitionDuration;
                    if (time >= transitionStart && time < nextStartTime) {
                        return nextStartTime;
                    }
                }
            }
        }

        return time;
    }
}

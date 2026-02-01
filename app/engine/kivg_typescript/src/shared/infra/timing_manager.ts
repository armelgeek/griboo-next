/**
 * TimingManager - Centralized class for managing all timing and duration calculations
 * 
 * This class handles:
 * - Layer timing configuration
 * - Scene duration calculations
 * - Animation timing management
 */

import { LayerConfig, LayerBoundingBox, SceneConfig } from '../types';
import { SpatialLayerIndex, BBoxCache, proxiesIntersect } from '../utils/performance_utils';

export interface LayerTimingBreakdown {
    entranceDelay: number;
    animationDuration: number;
    emphasisDuration: number;
    pauseDuration: number;
    occlusionDuration: number;
    exitDuration: number;
    totalDuration: number;
}

export interface SceneTimingBreakdown {
    transitionDuration: number;
    layersAnimationDuration: number;
    partialEraseDuration: number;
    eraserDelay: number;
    eraserDuration: number;
    hideTransitionDuration: number;
    totalDuration: number;
}

export class TimingManager {
    private static DEFAULT_ENTRANCE_DURATION = 1.5; // seconds
    private static DEFAULT_TRANSITION_DURATION = 0.5; // seconds

    // Global bbox cache for performance optimization
    private static bboxCache = new BBoxCache();

    /**
     * Internal helper to get config from either a Layer instance or a plain config object.
     */
    private static getLayerConfig(layer: any): any {
        if (!layer) return {};
        if (typeof layer.getConfig === 'function') {
            return layer.getConfig();
        }
        return layer;
    }

    /**
     * Helper to get the configuration from a scene or a scene instance.
     */
    private static getSceneConfig(scene: any): any {
        if (!scene) return {};

        // If it's a Scene instance (has config and layers Map or array)
        if (scene.config && (scene.layers instanceof Map || Array.isArray(scene.layers))) {
            const config = { ...scene.config };
            if (!config.layers) {
                if (scene.layers instanceof Map) {
                    if (scene.layerOrder) {
                        config.layers = scene.layerOrder.map((id: string) => scene.layers.get(id));
                    } else {
                        config.layers = Array.from(scene.layers.values());
                    }
                } else {
                    config.layers = scene.layers;
                }
            }
            return config;
        }

        if (scene.config) return scene.config;
        return scene;
    }

    /**
     * Get the explicit duration for a layer's entrance animation.
     * Returns duration in seconds.
     */
    static getLayerEntranceDuration(layer: LayerConfig | any, speed: number = 1.0): number {
        const config = this.getLayerConfig(layer);
        let duration = this.DEFAULT_ENTRANCE_DURATION;
        if (config.entrance_animation?.duration !== undefined) {
            duration = config.entrance_animation.duration;
        } else if (config.animation?.duration !== undefined) {
            duration = config.animation.duration;
        } else {
            const type = config.entrance_animation?.type || config.animation?.type;
            duration = this.getDefaultDurationForType(type);
        }

        return duration / speed;
    }

    /**
     * Get the default duration for an animation type in milliseconds.
     */
    private static getDefaultDurationForType(type: string | undefined): number {
        if (type === 'none') return 0;
        if (type === 'draw' || type === 'typewriter' || type === 'char_fade' || type === 'writetyping' || type === 'push' || type === 'erase') return 1.5;
        return 0.5;
    }

    /**
     * Get the entrance delay for a layer.
     */
    static getLayerEntranceDelay(layer: LayerConfig | any, speed: number = 1.0): number {
        const config = this.getLayerConfig(layer);
        const delay = config.entrance_animation?.delay ?? config.animation?.delay ?? 0;
        return delay / speed;
    }

    /**
     * Get the pause time after a layer animation.
     */
    static getLayerPauseDuration(layer: LayerConfig | any, speed: number = 1.0): number {
        const config = this.getLayerConfig(layer);
        const pauseTime = config.timingConfig?.pauseTime ?? 0; // Default: no pause (matches frontend)
        return pauseTime / speed;
    }

    /**
     * Get the explicit duration for a layer's exit animation.
     * Returns duration in seconds.
     */
    static getLayerExitDuration(layer: LayerConfig | any, speed: number = 1.0): number {
        const config = this.getLayerConfig(layer);
        let duration = 0;
        if (config.exit_animation?.duration !== undefined) {
            duration = config.exit_animation.duration;
        } else if (config.exit_animation?.type && config.exit_animation.type !== 'none') {
            duration = 0.5; // Default exit duration in seconds
        }

        return duration / speed;
    }

    /**
     * Get the exit delay for a layer.
     */
    static getLayerExitDelay(layer: LayerConfig | any, speed: number = 1.0): number {
        const config = this.getLayerConfig(layer);
        const delay = config.exit_animation?.delay ?? 0;
        return delay / speed;
    }

    /**
     * Get the scaled occlusion duration for a scene.
     */
    static getOcclusionDuration(sceneOrInstance: any): number {
        const scene = this.getSceneConfig(sceneOrInstance);
        const duration = scene.occlusionCullingConfig?.duration ?? 1.5;
        const drawSpeed = scene.timingConfig?.drawSpeed ?? 1.0;
        return duration / drawSpeed;
    }

    /**
     * Get the duration of the emphasis animation.
     */
    static getLayerEmphasisDuration(layer: LayerConfig | any, speed: number = 1.0): number {
        const config = this.getLayerConfig(layer);
        if (!config.emphasis_animation || config.emphasis_animation.type === 'none') return 0;

        const duration = config.emphasis_animation.duration || 1;
        const delay = config.emphasis_animation.delay || 0;
        const iterations = config.emphasis_animation.iterations ?? 1;

        // If infinite, we treat it as 0 for total duration calculation unless manually handled
        // or we could enforce a minimum duration. For now, let's treat infinite as 0 explicit duration
        // and rely on the scene duration or exit animation to cut it off.
        // However, if we want to ensure at least one loop plays:
        const effectiveIterations = iterations === Infinity ? 1 : iterations;

        return (delay + (duration * effectiveIterations)) / speed;
    }

    /**
     * Calculate the complete timing breakdown for a single layer.
     */
    static calculateLayerTiming(layer: LayerConfig | any, speedOverride?: number, occlusionDurationOverride?: number): LayerTimingBreakdown {
        if (!layer) {
            return {
                entranceDelay: 0,
                animationDuration: 0,
                emphasisDuration: 0,
                pauseDuration: 0,
                occlusionDuration: 0,
                exitDuration: 0,
                totalDuration: 0
            };
        }
        const config = this.getLayerConfig(layer);

        // Use override if provided, otherwise check config, otherwise default to 1.0
        const speed = speedOverride ?? config.timingConfig?.drawSpeed ?? 1.0;

        const entranceDelay = this.getLayerEntranceDelay(config, speed);
        const animationDuration = this.getLayerEntranceDuration(config, speed);
        const emphasisDuration = this.getLayerEmphasisDuration(config, speed);
        const pauseDuration = this.getLayerPauseDuration(config, speed);

        // Duration for occlusion culling
        const occlusionDuration = occlusionDurationOverride ?? 0;

        const exitDelay = this.getLayerExitDelay(config, speed);
        const exitAnimDuration = this.getLayerExitDuration(config, speed);
        const exitDuration = exitDelay + exitAnimDuration;

        // Timelime:
        // [Occlusion] [Entrance Delay] [Entrance Animation] [Emphasis] [Pause] [Exit Animation]
        // Note: Occlusion usually happens in parallel or before, but here we sum it?
        // Actually, existing code summed occlusionDuration. Let's keep it consistent.

        const totalDuration = occlusionDuration +
            entranceDelay +
            animationDuration +
            emphasisDuration +
            pauseDuration +
            exitDuration;

        return {
            entranceDelay,
            animationDuration,
            emphasisDuration,
            pauseDuration,
            occlusionDuration,
            exitDuration,
            totalDuration
        };
    }

    /**
     * Calculate timing breakdown for an entire scene.
     */
    static calculateSceneTiming(sceneOrInstance: any): SceneTimingBreakdown {
        const scene = this.getSceneConfig(sceneOrInstance);
        if (!scene || Object.keys(scene).length === 0) {
            return {
                transitionDuration: 0,
                layersAnimationDuration: 0,
                partialEraseDuration: 0,
                eraserDelay: 0,
                eraserDuration: 0,
                hideTransitionDuration: 0,
                totalDuration: 0,
            };
        }

        const drawSpeed = scene.timingConfig?.drawSpeed ?? 1.0;
        const transitionDuration = 0;
        let layersAnimationDuration = 0;
        let partialEraseDuration = 0;

        if (scene.layers && scene.layers.length > 0) {
            const layerData = (scene.layers as any[])
                .filter(l => !!l)
                .map(l => {
                    const config = this.getLayerConfig(l);
                    return {
                        instance: l,
                        config,
                        bbox: this.getLayerBoundingBox(l),
                        zIndex: config.zIndex || config.z_index || 0
                    };
                })
                .sort((a, b) => a.zIndex - b.zIndex);

            const sceneOcclusionDuration = scene.occlusionCulling ? this.getOcclusionDuration(scene) : 0;

            let spatialIndex: SpatialLayerIndex | null = null;
            if (scene.occlusionCulling && layerData.length > 10) {
                spatialIndex = new SpatialLayerIndex();
                spatialIndex.buildIndex(
                    layerData.map(d => d.instance),
                    (layer) => this.getLayerBoundingBox(layer)
                );
            }

            for (let i = 0; i < layerData.length; i++) {
                const current = layerData[i];
                let occlusionDuration = 0;

                if (scene.occlusionCulling && i > 0) {
                    let overlappingLayers: any[] = [];

                    if (spatialIndex) {
                        overlappingLayers = spatialIndex.findOverlappingLayers(
                            current.instance,
                            i,
                            (layer) => this.getLayerBoundingBox(layer)
                        );
                    } else {
                        for (let j = 0; j < i; j++) {
                            const prev = layerData[j];
                            if (this.doLayersOverlap(current.instance, prev.instance)) {
                                overlappingLayers.push(prev.instance);
                            }
                        }
                    }

                    for (const prevLayer of overlappingLayers) {
                        const prevData = layerData.find(d => d.instance === prevLayer);
                        if (prevData?.config.occlusionCulling !== false) {
                            occlusionDuration = sceneOcclusionDuration;
                            partialEraseDuration += occlusionDuration;
                            break;
                        }
                    }
                }

                const timing = this.calculateLayerTiming(current.instance, drawSpeed, occlusionDuration);
                layersAnimationDuration += timing.totalDuration;
            }
        }

        let exitDuration = 0;
        const isEraser = scene.transition?.type === 'eraser' || scene.eraser_config?.enabled || scene.eraser?.enabled;

        if (isEraser) {
            const eraserConfig = (scene.eraser_config || scene.eraser || {}) as any;
            const delay = (eraserConfig.delayAfterAnimations ?? 0) / drawSpeed;
            const duration = (eraserConfig.duration ?? scene.transition?.duration ?? this.DEFAULT_ENTRANCE_DURATION) / drawSpeed;
            exitDuration = delay + duration;
        } else {
            const duration = (scene.transition?.type === 'none')
                ? 0
                : (scene.transition?.duration ?? this.DEFAULT_TRANSITION_DURATION);
            exitDuration = duration / drawSpeed;
        }

        let totalDuration = transitionDuration + layersAnimationDuration + exitDuration;

        // Account for camera keyframes if they extend beyond layer animations
        if (scene.camera?.keyframes && scene.camera.keyframes.length > 0) {
            const lastKf = scene.camera.keyframes[scene.camera.keyframes.length - 1];
            const cameraDuration = (lastKf.startTime || 0) + (lastKf.pauseTime || 0);
            if (cameraDuration > totalDuration - exitDuration) {
                // We keep the scene alive until camera finishes its content
                layersAnimationDuration = cameraDuration;
                totalDuration = transitionDuration + layersAnimationDuration + exitDuration;
            }
        }

        return {
            transitionDuration,
            layersAnimationDuration,
            partialEraseDuration,
            eraserDelay: 0,
            eraserDuration: 0,
            hideTransitionDuration: exitDuration,
            totalDuration,
        };
    }

    public static doLayersOverlap(layer1: any, layer2: any): boolean {
        if (typeof layer1.getOcclusionProxy === 'function' && typeof layer2.getOcclusionProxy === 'function') {
            const proxy1 = layer1.getOcclusionProxy();
            const proxy2 = layer2.getOcclusionProxy();
            return proxiesIntersect(proxy1, proxy2);
        }

        const box1 = this.getLayerBoundingBox(layer1);
        const box2 = this.getLayerBoundingBox(layer2);
        return this.doBoxesIntersect(box1, box2);
    }

    /**
     * Get the bounding box of a layer.
     */
    public static getLayerBoundingBox(layer: any): LayerBoundingBox {
        const cached = this.bboxCache.getBBox(layer, (l) => this.calculateLayerBoundingBox(l));
        if (cached) {
            return cached;
        }
        return this.calculateLayerBoundingBox(layer);
    }

    private static calculateLayerBoundingBox(layer: any): LayerBoundingBox {
        if (typeof layer.getGlobalBBox === 'function') {
            const bbox = layer.getGlobalBBox();
            const config = layer.config || {};
            const scaleX = config.scaleX ?? config.scale ?? 1;
            const scaleY = config.scaleY ?? config.scale ?? 1;

            if (bbox) {
                return {
                    left: bbox.x,
                    right: bbox.x + bbox.width,
                    top: bbox.y,
                    bottom: bbox.y + bbox.height,
                    logicalWidth: (config.width || bbox.width / scaleX) * scaleX,
                    logicalHeight: (config.height || bbox.height / scaleY) * scaleY
                };
            }
        }

        const config = this.getLayerConfig(layer);
        const pos = config.position || config.camera_position || { x: 0, y: 0 };

        const isText = config.type === 'text' || config.text_config || config.text;
        const shapeConfig = config.shape_config || {};
        const shapeType = shapeConfig.shape || config.shape;

        let width = config.width || (isText ? 400 : 200);
        let height = config.height || (isText ? 100 : 200);

        const isCentered = !!(
            isText ||
            ['circle', 'ellipse', 'star', 'triangle', 'polygon', 'hexagon'].includes(shapeType)
        );

        const rotation = config.rotation || 0;
        const scaleX = config.scaleX ?? config.scale ?? 1;
        const scaleY = config.scaleY ?? config.scale ?? 1;

        const left = isCentered ? -width / 2 : 0;
        const top = isCentered ? -height / 2 : 0;
        const right = left + width;
        const bottom = top + height;

        const corners = [
            { x: left * scaleX, y: top * scaleY },
            { x: right * scaleX, y: top * scaleY },
            { x: left * scaleX, y: bottom * scaleY },
            { x: right * scaleX, y: bottom * scaleY }
        ];

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        if (rotation !== 0) {
            const rad = (rotation * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);

            corners.forEach(p => {
                const rx = p.x * cos - p.y * sin;
                const ry = p.x * sin + p.y * cos;
                const gx = rx + pos.x;
                const gy = ry + pos.y;
                minX = Math.min(minX, gx);
                maxX = Math.max(maxX, gx);
                minY = Math.min(minY, gy);
                maxY = Math.max(maxY, gy);
            });
        } else {
            corners.forEach(p => {
                const gx = p.x + pos.x;
                const gy = p.y + pos.y;
                minX = Math.min(minX, gx);
                maxX = Math.max(maxX, gx);
                minY = Math.min(minY, gy);
                maxY = Math.max(maxY, gy);
            });
        }

        return {
            left: minX,
            right: maxX,
            top: minY,
            bottom: maxY,
            logicalWidth: width * scaleX,
            logicalHeight: height * scaleY
        };
    }

    private static doBoxesIntersect(a: LayerBoundingBox, b: LayerBoundingBox): boolean {
        const aWidth = a.logicalWidth || (a.right - a.left);
        const aHeight = a.logicalHeight || (a.bottom - a.top);
        const bWidth = b.logicalWidth || (b.right - b.left);
        const bHeight = b.logicalHeight || (b.bottom - b.top);

        const marginAX = aWidth * 0.5;
        const marginAY = aHeight * 0.5;
        const marginBX = bWidth * 0.5;
        const marginBY = bHeight * 0.5;

        const aLeft = a.left - marginAX;
        const aRight = a.right + marginAX;
        const aTop = a.top - marginAY;
        const aBottom = a.bottom + marginAY;

        const bLeft = b.left - marginBX;
        const bRight = b.right + marginBX;
        const bTop = b.top - marginBY;
        const bBottom = b.bottom + marginBY;

        return !(
            aRight <= bLeft ||
            aLeft >= bRight ||
            aBottom <= bTop ||
            aTop >= bBottom
        );
    }
}

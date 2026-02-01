import { SceneConfig, OcclusionProxy, Point } from "../../../shared/types";
import { Layer } from "../layer";
import { HandOverlayManager } from "./hand-overlay-manager";
import { getHandOverlayConfigFromPreset } from "../utils/hand-config";
import { isDebugEnabled } from '../../../shared/config/debug_config';
import { TimingManager } from "../../../shared/infra/timing_manager";
import {
    completeTimingPrecision,
    logTimingResult
} from "../utils/timing-precision";
import { proxiesIntersect } from "../../../shared/utils/performance_utils";
import { OcclusionLogic } from "../../../shared/core/occlusion_logic";
import { EraserLayerData, EraserHandStrategy } from "../../../shared/core/hand_overlay_manager";
import { PersistentCacheManager } from "../utils/persistent-cache";
import { layerPreparationCache } from "../../../shared/infra/layer-preparation-cache";


/**
 * Default frame rate for erase animations (frames per second)
 */
export const DEFAULT_ERASE_FRAME_RATE = 30;

/**
 * Helper function to get the type of a layer safely.
 */
export function getLayerType(layer: Layer): string {
    return (layer as any).getLayerType ? (layer as any).getLayerType() : 'default';
}

/**
 * Check if a layer is an eraser or rubber layer that should be excluded from occlusion culling.
 */
export function isEraserOrRubberLayer(layer: Layer): boolean {
    const layerType = getLayerType(layer);
    return layerType === 'eraser' || layerType === 'rubber';
}

export interface GeometricEraseData {
    layerIds: string[];
    path: Point[];
    radius: number;
    showEraser: boolean;
}

/**
 * Interface for the scene context needed by the occlusion logic
 */
export interface OcclusionSceneContext {
    id: string;
    config: SceneConfig;
    layers: Map<string, Layer>;
    layerOrder: string[];
    parentSvg: SVGSVGElement | null;
    handOverlayCanvas: HTMLCanvasElement | null;
    sceneHandOverlayManager: HandOverlayManager | null;
    partialEraseCache: {
        get(key: string): GeometricEraseData[] | undefined;
        set(key: string, value: GeometricEraseData[]): void;
        clear(): void;
    };
    partialEraseEnabled: boolean;
    parseBackgroundColor(color: any): [number, number, number];
    setHandOverlayManager(manager: HandOverlayManager): void;
    getSceneDimensions(): { width: number; height: number };
}

export class OcclusionCullingManager {
    private performedAutoErase: Set<string> = new Set();

    // OPTIMIZATION: Cache for content masks to avoid recomputation
    // Maps layerId to its computed bounding proxy (lightweight)
    private contentMaskCache: Map<string, { proxy: any, timestamp: number }> = new Map();

    // Smart Seek: Track last state for incremental updates
    // Maps layerId to its last seek state
    private lastSeekState: Map<string, {
        progress: number;
        pathIndex: number;
        pathD: string;
    }> = new Map();

    // OPTIMIZATION: Spatial index for fast overlap detection
    private spatialIndex: any = null;
    private spatialIndexBuiltFor: number = -1;

    // WORKER: Offload occlusion calculations
    private worker: Worker | null = null;
    private workerPendingJobs: Map<string, (result: any) => void> = new Map();
    private isWorkerSupported: boolean = typeof Worker !== 'undefined';
    private workerBuiltFor: number = -1;



    constructor(private context: OcclusionSceneContext) {
    }

    public destroy() {
        this.clearCaches();
    }

    /**
     * Reset the occlusion state.
     */
    public reset(): void {
        this.performedAutoErase.clear();
        this.lastSeekState.clear();
        this.spatialIndex = null;
        this.spatialIndexBuiltFor = -1;
        this.clearCaches();
    }

    /**
     * Manually mark a layer as having performed its auto-erase.
     * Used during seek operations to restore state.
     */
    public markAsAutoErased(layerId: string): void {
        this.performedAutoErase.add(layerId);
    }

    // OPTIMIZATION: Ensure spatial index is built for the current layers
    private async initWorker(): Promise<void> {
        if (!this.isWorkerSupported || this.worker) return;

        try {
            // @ts-ignore - URL in Worker constructor is standard ESM
            this.worker = new Worker(new URL('../../workers/occlusion.worker.ts', import.meta.url), { type: 'module' });

            this.worker.onmessage = (e) => {
                const { type, payload } = e.data;
                const { jobId, ...data } = payload || {};

                if (jobId && this.workerPendingJobs.has(jobId)) {
                    const resolve = this.workerPendingJobs.get(jobId)!;
                    this.workerPendingJobs.delete(jobId);
                    resolve(data);
                }
            };

            this.worker.onerror = (err) => {
                console.warn('[OcclusionCullingManager] Worker error, falling back to main thread:', err);
                this.isWorkerSupported = false;
                this.worker = null;
            };

            if (isDebugEnabled()) {
                console.log('[OcclusionCullingManager] Occlusion worker initialized');
            }
        } catch (err) {
            console.warn('[OcclusionCullingManager] Failed to start worker:', err);
            this.isWorkerSupported = false;
        }
    }

    private async callWorker(type: string, payload: any = {}): Promise<any> {
        await this.initWorker();
        if (!this.worker) return null;

        const jobId = Math.random().toString(36).substring(2, 11);
        return new Promise((resolve) => {
            this.workerPendingJobs.set(jobId, resolve);
            this.worker!.postMessage({ type, payload: { ...payload, jobId } });

            // Timeout safety
            setTimeout(() => {
                if (this.workerPendingJobs.has(jobId)) {
                    this.workerPendingJobs.delete(jobId);
                    resolve(null);
                }
            }, 5000);
        });
    }

    private async ensureSpatialIndex(): Promise<void> {
        const orderLength = this.context.layerOrder.length;

        // Try worker first for large scenes
        if (this.isWorkerSupported && orderLength > 100) {
            if (this.workerBuiltFor === orderLength) return;

            const layersData = this.context.layerOrder.map((id, index) => {
                const layer = this.context.layers.get(id);
                return {
                    id,
                    index,
                    bbox: layer ? TimingManager.getLayerBoundingBox(layer) : { left: 0, top: 0, right: 0, bottom: 0 }
                };
            });

            const result = await this.callWorker('BUILD_INDEX', {
                layers: layersData,
                layerOrder: this.context.layerOrder
            });

            if (result) {
                this.workerBuiltFor = orderLength;
                if (isDebugEnabled()) {
                    console.log(`[Occlusion] Spatial index built in WORKER for ${orderLength} layers`);
                }
                return;
            }
        }

        // Fallback to local index
        if (this.spatialIndex && this.spatialIndexBuiltFor === orderLength) return;

        if (orderLength > 20) {
            try {
                // @ts-ignore - Dynamic import
                const { SpatialLayerIndex } = await import("../utils/performance-utils");

                this.spatialIndex = new SpatialLayerIndex();
                const layers = this.context.layerOrder
                    .map(id => this.context.layers.get(id))
                    .filter((l): l is Layer => !!l);

                this.spatialIndex.buildIndex(layers, (l: any) => TimingManager.getLayerBoundingBox(l));
                this.spatialIndexBuiltFor = orderLength;

                if (isDebugEnabled()) {
                    console.log(`[Occlusion] Spatial index built on MAIN THREAD for ${orderLength} layers`);
                }
            } catch (err) {
                console.warn('[Occlusion] Failed to build spatial index:', err);
                this.spatialIndex = null;
            }
        }
    }

    /**
     * Clear all caches.
     * OPTIMIZATION: Centralized cache cleanup.
     */
    private clearCaches(): void {
        this.contentMaskCache.clear();
        this.spatialIndex = null;
        this.spatialIndexBuiltFor = -1;
        // ... rest of the method
        // CRITICAL: Also clear the partialEraseCache to prevent stale occlusion data
        // from being reused during seek operations or replay in the same mode
        this.context.partialEraseCache.clear();

        // CRITICAL: Clean up SVG mask elements to prevent stale masks from affecting rendering
        // This ensures masks are regenerated fresh on next playback
        if (this.context.parentSvg) {
            const defs = this.context.parentSvg.querySelector('defs');
            if (defs) {
                // Remove all occlusion masks for this scene
                const masks = defs.querySelectorAll(`mask[id^="mask-occlusion-${this.context.id}-"]`);
                masks.forEach(mask => {
                    if (mask.parentNode) {
                        mask.parentNode.removeChild(mask);
                    }
                });
            }
        }

        // CRITICAL: Remove mask attributes from layer elements and wrappers
        // to ensure layers are fully visible after reset
        this.context.layerOrder.forEach(layerId => {
            const layer = this.context.layers.get(layerId);
            if (!layer) return;

            const layerElement = layer.getElement();
            if (layerElement) {
                // Remove mask from layer element
                layerElement.removeAttribute('mask');

                // Remove mask from wrapper if it exists
                const wrapper = layerElement.parentElement as any;
                if (wrapper && wrapper.classList.contains('layer-occlusion-wrapper')) {
                    wrapper.removeAttribute('mask');
                }
            }
        });
    }

    /**
     * Get the intersection rectangle of two proxies.
     * 
     * This method now applies a margin BEFORE checking intersection to handle
     * small overlaps and near-misses more tolerantly. This ensures that objects
     * that are visually close enough to require occlusion handling will generate
     * a reasonable erase zone.
     * 
     * @param a - First occlusion proxy
     * @param b - Second occlusion proxy
     * @param marginRatio - Ratio of object size to use as margin (default: 0.1 = 10%)
     *                      This default value matches the interface definition in types.ts
     * @returns Intersection rectangle or null if no overlap
     */
    private getIntersectionRect(
        a: OcclusionProxy,
        b: OcclusionProxy,
        marginRatio: number = 0.1
    ): { left: number, top: number, right: number, bottom: number } | null {
        const rect = OcclusionLogic.getIntersectionRect(a, b, marginRatio);

        if (!rect) {
            if (this.context.config.debug && isDebugEnabled()) {
                console.log('[Occlusion] No intersection found after margin expansion');
            }
            return null;
        }

        if (this.context.config.debug && isDebugEnabled()) {
            console.log('[Occlusion] Intersection rectangle calculated', {
                marginRatio,
                intersection: rect,
                size: {
                    width: rect.right - rect.left,
                    height: rect.bottom - rect.top
                }
            });
        }

        return rect;
    }

    /**
     * Ensure the erase zone has a minimum size relative to the eraser radius.
     * Small intersections (e.g., 1-2px) are expanded to be at least 2x the radius
     * to ensure effective visual erasing.
     * 
     * @param rect - The intersection rectangle
     * @param radius - The eraser radius in pixels
     * @returns Expanded rectangle with minimum dimensions
     */
    private ensureMinimumEraseZone(
        rect: { left: number, top: number, right: number, bottom: number },
        radius: number
    ): { left: number, top: number, right: number, bottom: number } {
        const newRect = OcclusionLogic.ensureMinimumEraseZone(rect, radius);

        if (this.context.config.debug && isDebugEnabled()) {
            const width = rect.right - rect.left;
            const height = rect.bottom - rect.top;
            const minSize = radius * 2;
            if (width < minSize || height < minSize) {
                console.log(`[Occlusion] Expanding narrow erase zone (radius: ${radius}px)`);
            }
        }

        return newRect;
    }

    /**
     * Generate a zigzag path covering a rectangle.
     */
    private generateZigzagPath(left: number, top: number, right: number, bottom: number, radius: number): Point[] {
        const path = OcclusionLogic.generateZigzagPath(left, top, right, bottom, radius);
        return path as Point[];
    }

    /**
     * Apply automatic partial erase for a layer that is about to be animated.
     */
    public async applyAutomaticPartialErase(layerId: string, _speed: number = 1.0, durationOverride?: number): Promise<void> {
        // Skip if occlusion culling is not enabled for the scene
        if (!this.context.config.occlusionCulling) {
            return;
        }

        // Skip if partial erase is disabled for performance
        if (!this.context.partialEraseEnabled) {
            return;
        }

        const layer = this.context.layers.get(layerId);
        if (!layer) return;

        const layerConfig = layer.getConfig();
        if (!this.context.parentSvg) return;

        // Get current layer's z-index and position in render order
        const currentIndex = this.context.layerOrder.indexOf(layerId);
        const currentZIndex = layerConfig.zIndex || 0;
        const targetProxy = layer.getOcclusionProxy();

        // Find all layers BELOW this one that should be partially erased
        const lowerLayers: Array<{ id: string; layer: Layer; proxy: OcclusionProxy }> = [];

        await this.ensureSpatialIndex();

        if (this.spatialIndex) {
            // OPTIMIZED: Use spatial index to find candidate overlapping layers
            // @ts-ignore
            const { TimingManager } = await import("./timing-manager");
            const candidates = this.spatialIndex.findOverlappingLayers(layer, currentIndex, (l: any) => TimingManager.getLayerBoundingBox(l));

            for (const lowerLayer of candidates) {
                const lowerConfig = lowerLayer.getConfig();
                const id = lowerConfig.id;
                const lowerZIndex = lowerConfig.zIndex || 0;
                const hasOcclusionEnabled = lowerConfig.occlusionCulling !== false;

                if (lowerZIndex <= currentZIndex && !isEraserOrRubberLayer(lowerLayer) && hasOcclusionEnabled) {
                    const lowerProxy = lowerLayer.getOcclusionProxy();
                    // We already know they intersect via spatial index, but double check with precise proxy if needed
                    // (spatial index uses BBox which is usually same as proxy for simple layers)
                    lowerLayers.push({ id, layer: lowerLayer, proxy: lowerProxy });
                }
            }
        } else {
            // Fallback for few layers
            for (let i = 0; i < currentIndex; i++) {
                const id = this.context.layerOrder[i];
                const lowerLayer = this.context.layers.get(id);
                if (!lowerLayer) continue;

                const lowerConfig = lowerLayer.getConfig();
                const lowerZIndex = lowerConfig.zIndex || 0;
                const hasOcclusionEnabled = lowerConfig.occlusionCulling !== false;

                if (lowerZIndex <= currentZIndex && !isEraserOrRubberLayer(lowerLayer) && hasOcclusionEnabled) {
                    const lowerProxy = lowerLayer.getOcclusionProxy();

                    // Use 0.5 margin ratio (50% of size) to make detection very sensitive
                    if (proxiesIntersect(targetProxy, lowerProxy, 0.5)) {
                        lowerLayers.push({ id, layer: lowerLayer, proxy: lowerProxy });
                    }
                }
            }
        }

        if (lowerLayers.length === 0) {
            return;
        }

        // Check cache for this layer
        const cacheKey = `${this.context.id}:${layerId}`;
        const cachedResults = this.context.partialEraseCache.get(cacheKey);

        if (cachedResults && Array.isArray(cachedResults)) {
            const cachedItems = cachedResults as GeometricEraseData[];
            if (cachedItems.length > 0) {
                // Play all cached animations
                for (const item of cachedItems) {
                    const { layerIds: lowerIds, path, radius, showEraser } = item;
                    const lowerLayers = lowerIds
                        .map(id => this.context.layers.get(id))
                        .filter((l): l is Layer => !!l);

                    if (lowerLayers.length > 0 && path) {
                        await this.playGeometricPartialEraseAnimation(
                            lowerLayers,
                            path,
                            radius,
                            showEraser,
                            layerId,
                            durationOverride
                        );
                    }
                }

                this.performedAutoErase.add(layerId);
                for (const item of cachedItems) {
                    for (const lowerId of item.layerIds) {
                        await this.applyStaticOcclusion(lowerId);
                    }
                }
                layer.setOpacity(layerConfig.opacity !== undefined ? layerConfig.opacity : 1);
                return;
            }
        }

        // Use scene-level configuration
        const occlusionConfig = this.context.config.occlusionCullingConfig || {};
        const radius = occlusionConfig.radius ?? 30;
        const showEraser = occlusionConfig.showEraser !== false;

        // Ensure upper layer is hidden during the erase animation
        const originalOpacity = layerConfig.opacity !== undefined ? layerConfig.opacity : 1;
        layer.setOpacity(0);

        try {
            // 1. Calculate a single "global" eraser path that covers all overlapping areas
            // We use the targetProxy (upper layer) as the base for the path
            // but we only need to erase where it actually intersects with lower layers.

            // For now, to keep it simple and correct, we'll generate a path that covers
            // the union of all intersection rectangles.
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            let hasOverlap = false;

            for (const { proxy: lowerProxy } of lowerLayers) {
                // Use configured margin ratio or default to 0.1 (10%)
                const marginRatio = occlusionConfig.intersectionMarginRatio ?? 0.1;
                const intersection = this.getIntersectionRect(targetProxy, lowerProxy, marginRatio);
                if (intersection) {
                    minX = Math.min(minX, intersection.left);
                    minY = Math.min(minY, intersection.top);
                    maxX = Math.max(maxX, intersection.right);
                    maxY = Math.max(maxY, intersection.bottom);
                    hasOverlap = true;
                }
            }

            if (hasOverlap) {
                // Check if the upper layer is "hollow" (no fill)
                // If so, we can use its actual path for erasing instead of a zigzag wipe
                const isHollow = (layer as any).isHollow && (layer as any).isHollow();
                const erasePath = isHollow && (layer as any).getErasePath ? (layer as any).getErasePath() : null;

                let finalPath: Point[];
                let finalRadius = radius;

                if (erasePath && erasePath.length > 0) {
                    if (this.context.config.debug && isDebugEnabled()) {
                        console.log(`[Occlusion] Using path-based erasing for hollow layer ${layerId}`);
                    }
                    finalPath = erasePath as Point[];
                    // For path-based erasing, we use a smaller radius (matching stroke width + dilation)
                    const strokeWidth = (layerConfig as any).strokeWidth || 2;
                    finalRadius = (strokeWidth / 2) + 4; // 4px dilation
                } else {
                    // Ensure the erase zone has a minimum size relative to the eraser radius
                    const eraseZone = this.ensureMinimumEraseZone(
                        { left: minX, top: minY, right: maxX, bottom: maxY },
                        radius
                    );

                    finalPath = this.generateZigzagPath(
                        eraseZone.left,
                        eraseZone.top,
                        eraseZone.right,
                        eraseZone.bottom,
                        radius
                    );
                }

                const lowerLayersToErase = lowerLayers.map(l => l.layer);
                const lowerLayerIds = lowerLayers.map(l => l.id);

                // 2. Play a single animation for all layers
                await this.playGeometricPartialEraseAnimation(
                    lowerLayersToErase,
                    finalPath,
                    finalRadius,
                    showEraser,
                    layerId,
                    durationOverride
                );

                // 3. Cache the result
                const cacheKey = `${this.context.id}:${layerId}`;
                this.context.partialEraseCache.set(cacheKey, [{
                    layerIds: lowerLayerIds,
                    path: finalPath,
                    radius: finalRadius,
                    showEraser
                }]);
            }
        } catch (e) {
            if (isDebugEnabled()) {
                console.error('[Partial Erase] Exception during geometric animation:', e);
            }
        }

        this.performedAutoErase.add(layerId);
        for (const { id: lowerId } of lowerLayers) {
            await this.applyStaticOcclusion(lowerId);
        }

        // CRITICAL: Only restore opacity if the layer is NOT about to play an entrance animation
        // that starts from 0 (like fade_in, draw, reveal, etc.).
        // If it is, we keep it at 0 so the entrance animation can handle the transition.
        const entranceAnim = layerConfig.entrance_animation;
        const startsInvisible = entranceAnim && [
            'fade_in', 'fade_in_down', 'fade_in_left', 'fade_in_right', 'fade_in_up',
            'fade_in_top_left', 'fade_in_top_right', 'fade_in_bottom_left', 'fade_in_bottom_right',
            'zoom_in', 'zoom_in_down', 'zoom_in_left', 'zoom_in_right', 'zoom_in_up',
            'bounce', 'bounce_in', 'bounce_in_down', 'bounce_in_left', 'bounce_in_right', 'bounce_in_up',
            'rotate_in', 'spin_in', 'rotate_in_down_left', 'rotate_in_down_right', 'rotate_in_up_left', 'rotate_in_up_right',
            'flip_in', 'flip_in_x', 'flip_in_y',
            'back_in_down', 'back_in_left', 'back_in_right', 'back_in_up',
            'lightspeed_in', 'roll_in', 'jack_in_the_box',
            'slide_in', 'slide_in_left', 'slide_in_right', 'slide_in_top', 'slide_in_bottom',
            'draw', 'typewriter', 'char_fade',
            'reveal_horizontal', 'reveal_vertical', 'reveal_diagonal'
        ].includes(entranceAnim.type);

        if (!startsInvisible) {
            layer.setOpacity(originalOpacity);
        }
    }


    /**
     * Pre-calculate partial erase frames for a specific layer.
     * OPTIMIZATION: This method pre-computes and caches geometric paths for occlusion.
     * Unlike the old implementation which generated heavy ImageData frames,
     * this only calculates lightweight geometric paths that are stored in the cache.
     */
    public async generatePartialEraseFramesForLayer(layerId: string): Promise<void> {
        if (!this.context.config.occlusionCulling) {
            return;
        }

        // OPTIMIZATION: Check if occlusion data is already cached
        const config = this.context.layers.get(layerId)?.getConfig() || {};
        const configHash = layerPreparationCache.generateConfigHash(config);
        const cacheKey = `occ:${this.context.id}:${layerId}:${configHash}`;

        // 1. Check in-memory LRU cache
        const cachedResults = this.context.partialEraseCache.get(cacheKey);
        if (cachedResults && cachedResults.length > 0) {
            if (isDebugEnabled()) {
                console.debug(`[OcclusionCulling] Using IN-MEMORY cached occlusion data for layer ${layerId}`);
            }
            return;
        }

        // 2. Check persistent IndexedDB cache
        const persistentCache = PersistentCacheManager.getInstance();
        const persistedData = await persistentCache.get<GeometricEraseData[]>(cacheKey);
        if (persistedData && persistedData.length > 0) {
            this.context.partialEraseCache.set(cacheKey, persistedData);
            if (isDebugEnabled()) {
                console.debug(`[OcclusionCulling] Using PERSISTENT cached occlusion data for layer ${layerId}`);
            }
            return;
        }

        const layer = this.context.layers.get(layerId);
        if (!layer) return;

        const currentIndex = this.context.layerOrder.indexOf(layerId);
        const currentZIndex = layer.getConfig().zIndex || 0;

        const lowerLayers: Array<{ id: string; layer: Layer; zIndex: number }> = [];

        await this.ensureSpatialIndex();

        if (this.spatialIndex) {
            // @ts-ignore
            const { TimingManager } = await import("./timing-manager");
            const candidates = this.spatialIndex.findOverlappingLayers(layer, currentIndex, (l: any) => TimingManager.getLayerBoundingBox(l));

            for (const lowerLayer of candidates) {
                const lowerConfig = lowerLayer.getConfig();
                const id = lowerConfig.id;
                const lowerZIndex = lowerConfig.zIndex || 0;
                const hasOcclusionEnabled = lowerConfig.occlusionCulling !== false;

                if (lowerZIndex <= currentZIndex && !isEraserOrRubberLayer(lowerLayer) && hasOcclusionEnabled) {
                    lowerLayers.push({ id, layer: lowerLayer, zIndex: lowerZIndex });
                }
            }
        } else {
            for (let i = 0; i < currentIndex; i++) {
                const id = this.context.layerOrder[i];
                const lowerLayer = this.context.layers.get(id);
                if (!lowerLayer) continue;

                const lowerConfig = lowerLayer.getConfig();
                const lowerZIndex = lowerConfig.zIndex || 0;
                const hasOcclusionEnabled = lowerConfig.occlusionCulling !== false;

                if (lowerZIndex <= currentZIndex && !isEraserOrRubberLayer(lowerLayer) && hasOcclusionEnabled) {
                    lowerLayers.push({ id, layer: lowerLayer, zIndex: lowerZIndex });
                }
            }
        }

        const parentSvg = this.context.parentSvg;
        if (lowerLayers.length === 0 || !parentSvg) return;

        // Use scene-level configuration
        const occlusionConfig = this.context.config.occlusionCullingConfig || {};
        const radius = occlusionConfig.radius ?? 30;
        const showEraser = occlusionConfig.showEraser !== false;

        // Process all lower layers to find the global intersection area
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let hasOverlap = false;
        const overlappingIds: string[] = [];
        const targetProxy = layer.getOcclusionProxy();

        for (const { id, layer: lowerLayer } of lowerLayers) {
            // Use configured margin ratio or default to 0.1 (10%)
            const marginRatio = occlusionConfig.intersectionMarginRatio ?? 0.1;
            const intersection = this.getIntersectionRect(targetProxy, lowerLayer.getOcclusionProxy(), marginRatio);
            if (intersection) {
                minX = Math.min(minX, intersection.left);
                minY = Math.min(minY, intersection.top);
                maxX = Math.max(maxX, intersection.right);
                maxY = Math.max(maxY, intersection.bottom);
                overlappingIds.push(id);
                hasOverlap = true;
            }
        }

        if (hasOverlap) {
            // Check if the upper layer is "hollow" (no fill)
            const isHollow = (layer as any).isHollow && (layer as any).isHollow();
            const erasePath = isHollow && (layer as any).getErasePath ? (layer as any).getErasePath() : null;

            let finalPath: Point[];
            let finalRadius = radius;

            if (erasePath && erasePath.length > 0) {
                finalPath = erasePath as Point[];
                const strokeWidth = (layer.getConfig() as any).strokeWidth || 2;
                finalRadius = (strokeWidth / 2) + 4;
            } else {
                // Ensure the erase zone has a minimum size relative to the eraser radius
                const eraseZone = this.ensureMinimumEraseZone(
                    { left: minX, top: minY, right: maxX, bottom: maxY },
                    radius
                );

                finalPath = this.generateZigzagPath(
                    eraseZone.left,
                    eraseZone.top,
                    eraseZone.right,
                    eraseZone.bottom,
                    radius
                );
            }

            const cacheKey = `${this.context.id}:${layerId}`;
            this.context.partialEraseCache.set(cacheKey, [{
                layerIds: overlappingIds,
                path: finalPath,
                radius: finalRadius,
                showEraser
            }]);
        }
    }



    /**
     * Play a purely geometric partial erase animation using SVG masks.
     * This is much lighter than the ImageData-based version.
     */
    /**
     * Setup the occlusion mask for a layer.
     * @returns The strokes path element within the mask.
     */
    private setupOcclusionMask(layer: Layer, radius: number, uniquePathId: string): SVGPathElement | null {
        if (!this.context.parentSvg) return null;

        const layerElement = layer.getElement();
        if (!layerElement) return null;

        const layerId = layer.getConfig().id;
        const maskId = `mask-occlusion-${this.context.id}-${layerId}`;

        // 1. Setup Mask
        let defs = this.context.parentSvg.querySelector('defs');
        if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            this.context.parentSvg.insertBefore(defs, this.context.parentSvg.firstChild);
        }

        let mask = this.context.parentSvg.querySelector(`#${maskId}`) as SVGMaskElement;
        if (!mask) {
            mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
            mask.setAttribute('id', maskId);
            mask.setAttribute('maskUnits', 'userSpaceOnUse');
            defs.appendChild(mask);
        }

        // 1.1 Ensure filter exists
        if (!defs.querySelector('#filter-occlusion-feathered')) {
            const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
            filter.setAttribute('id', 'filter-occlusion-feathered');

            const colorMatrix = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
            colorMatrix.setAttribute('type', 'matrix');
            colorMatrix.setAttribute('values', '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0');
            filter.appendChild(colorMatrix);

            const morphology = document.createElementNS('http://www.w3.org/2000/svg', 'feMorphology');
            morphology.setAttribute('operator', 'dilate');
            morphology.setAttribute('radius', '2');
            filter.appendChild(morphology);

            const blur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
            blur.setAttribute('stdDeviation', '1');
            filter.appendChild(blur);

            defs.appendChild(filter);
        }

        // Add white background (visible) ONLY if mask is new/empty
        if (!mask.querySelector('rect[fill="white"]')) {
            const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bg.setAttribute('width', '100%');
            bg.setAttribute('height', '100%');
            bg.setAttribute('fill', 'white');
            mask.appendChild(bg);
        }

        // Path for eraser strokes (black = hidden)
        // CRITICAL FIX: Use unique ID to allow multiple erasers on same mask
        const pathElementId = `${maskId}-path-${uniquePathId}`;
        let strokesPath = mask.querySelector(`#${pathElementId}`) as SVGPathElement;

        if (!strokesPath) {
            strokesPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            strokesPath.setAttribute('id', pathElementId);
            strokesPath.setAttribute('fill', 'none');
            strokesPath.setAttribute('stroke', 'black');
            strokesPath.setAttribute('stroke-linecap', 'round');
            strokesPath.setAttribute('stroke-linejoin', 'round');
            strokesPath.setAttribute('filter', 'url(#filter-occlusion-feathered)');
            mask.appendChild(strokesPath);

            // Only clear d on creation or explicit reset logic (not here)
            // But we must initialize it to empty
            strokesPath.setAttribute('d', '');
        }

        strokesPath.setAttribute('stroke-width', (radius * 2).toString());

        // Apply mask to layer wrapper
        const wrapper = this.getOrCreateOcclusionWrapper(layerElement);
        wrapper.setAttribute('mask', `url(#${maskId})`);
        layerElement.removeAttribute('mask');

        return strokesPath;
    }

    /**
     * Play a purely geometric partial erase animation using SVG masks.
     * This version supports multiple layers to perform a single sweep for all overlaps.
     */
    public async playGeometricPartialEraseAnimation(
        layers: Layer[],
        path: Point[],
        radius: number,
        showEraser: boolean,
        eraserId: string,
        durationOverride?: number
    ): Promise<void> {
        if (!this.context.parentSvg || path.length === 0 || layers.length === 0) return;

        // 1. Setup all masks
        const strokesPaths: SVGPathElement[] = [];
        for (const layer of layers) {
            const strokesPath = this.setupOcclusionMask(layer, radius, eraserId);
            if (strokesPath) {
                strokesPaths.push(strokesPath);
            }
        }

        if (strokesPaths.length === 0) return;

        // 2. Animation
        const duration = durationOverride !== undefined
            ? durationOverride
            : TimingManager.getOcclusionDuration(this.context.config || this.context);

        const compensatedDuration = Math.max(0.1, duration);
        const totalDurationMs = (compensatedDuration * 1000);
        const startTime = performance.now();

        // Initialize hand if needed
        let useHandOverlay = showEraser && !!this.context.handOverlayCanvas;
        if (isDebugEnabled()) {
            console.log(`[Occlusion Debug] playGeometricPartialEraseAnimation: showEraser=${showEraser}, hasCanvas=${!!this.context.handOverlayCanvas}, useHandOverlay=${useHandOverlay}`);
        }
        if (useHandOverlay) {
            const manager = this.context.sceneHandOverlayManager;
            if (manager) {
                // Ensure camera transform is synced for virtual size support
                // This is critical for the hand to appear at the correct position on screen
                // when using virtual size (e.g. 4000x3000) with camera zoom/pan
                if ((this.context as any).cameraController) {
                    const scene = this.context as any;
                    const cameraConfig = scene.cameraController.getConfigAtTime(0, []); // Use current time 0 relative to animation? Or actual time?
                    // Actually we should use the current scene time if possible, but for now use current config
                    // The scene.applyCameraTransformToSvg updates this regularly during playback

                    const { width, height } = this.context.getSceneDimensions();
                    const virtualWidth = scene.config.camera?.virtualSize?.width || width;
                    const virtualHeight = scene.config.camera?.virtualSize?.height || height;
                    const virtualSize = { width: virtualWidth, height: virtualHeight };

                    // Force update immediately before animation starts
                    manager.setCameraTransform(
                        cameraConfig.zoom || 1,
                        cameraConfig.position || { x: 0.5, y: 0.5 },
                        virtualSize
                    );
                }

                const eraserHandConfig = getHandOverlayConfigFromPreset('eraser');
                if (eraserHandConfig) {
                    if (isDebugEnabled()) console.log('[Occlusion Debug] Initializing eraser hand manager...');
                    await manager.initialize(eraserHandConfig);
                    manager.setStrategy(new EraserHandStrategy());
                    if (isDebugEnabled()) console.log('[Occlusion Debug] Eraser hand manager initialized.');
                } else {
                    if (isDebugEnabled()) console.warn('Eraser hand config not found.');
                    useHandOverlay = false;
                }
            } else {
                if (isDebugEnabled()) console.warn('sceneHandOverlayManager not found.');
                useHandOverlay = false;
            }
        }

        return new Promise((resolve) => {
            let lastPathIdx = -1;
            let totalPausedTime = 0;

            const animate = async (currentTime: number) => {
                try {
                    const wasPaused = layers[0].isPaused;
                    const pauseStart = wasPaused ? performance.now() : 0;
                    await layers[0].checkPlaybackState();
                    if (wasPaused) {
                        const pauseDuration = performance.now() - pauseStart;
                        totalPausedTime += pauseDuration;
                    }

                    const elapsed = currentTime - startTime - totalPausedTime;
                    const progress = Math.min(elapsed / totalDurationMs, 1);
                    const currentPathIdx = Math.floor(progress * (path.length - 1));

                    // Update ALL masks with path
                    if (currentPathIdx > lastPathIdx) {
                        for (const strokesPath of strokesPaths) {
                            let d = strokesPath.getAttribute('d') || '';
                            for (let i = lastPathIdx + 1; i <= currentPathIdx; i++) {
                                const [x, y] = path[i];
                                if (d === '') {
                                    d = `M ${x} ${y}`;
                                } else {
                                    d += ` L ${x} ${y}`;
                                }
                            }
                            strokesPath.setAttribute('d', d);
                        }
                        lastPathIdx = currentPathIdx;
                    }

                    // Update hand
                    if (useHandOverlay && this.context.sceneHandOverlayManager) {
                        const [x, y] = path[currentPathIdx] || path[0];
                        const nextPos = path[currentPathIdx + 1];

                        const eraserLayerData: EraserLayerData = {
                            currentErasePosition: { x, y },
                            nextErasePosition: nextPos ? { x: nextPos[0], y: nextPos[1] } : undefined
                        };

                        if (isDebugEnabled() && Math.random() < 0.01) {
                            // console.log('Updating hand position:', { progress, x, y });
                        }
                        this.context.sceneHandOverlayManager.updateHandPosition(progress, eraserLayerData, this.context.handOverlayCanvas!);
                    }

                    if (progress < 1) {
                        requestAnimationFrame(animate);
                    } else {
                        // Final state: ensure hand is hidden
                        if (useHandOverlay && this.context.sceneHandOverlayManager) {
                            this.context.sceneHandOverlayManager.hideHand(this.context.handOverlayCanvas!);
                        }

                        // Apply precise timing correction
                        await completeTimingPrecision(
                            startTime + totalPausedTime,
                            totalDurationMs,
                            (seconds) => this.wait(seconds)
                        );

                        const actualDuration = performance.now() - startTime;
                        logTimingResult('OcclusionCullingManager', layers[0].getConfig().id, 'erase-multi', actualDuration, totalDurationMs);
                        resolve();
                    }
                } catch (error: any) {
                    if (error.name === 'PlaybackStoppedError') {
                        if (isDebugEnabled()) console.log('[OcclusionCullingManager] Animation stopped during erase animation');
                        resolve(); // Resolve anyway to allow cleanup
                    } else {
                        if (isDebugEnabled()) {
                            console.error('[OcclusionCullingManager] Error in erase animation loop:', error);
                        }
                        resolve(); // Resolve to avoid blocking the whole scene
                    }
                }
            };

            requestAnimationFrame(animate);
        });
    }
    /**
     * Seek to a specific progress in the geometric partial erase.
     * Supports Smart Seek: bidirectional (forward/rewind) with incremental optimization.
     */
    public async seek(layerOrId: Layer | string, progress: number): Promise<void> {
        if (!this.context.parentSvg) return;

        let layer: Layer | undefined;
        if (typeof layerOrId === 'string') {
            layer = this.context.layers.get(layerOrId);
        } else {
            layer = layerOrId;
        }

        if (!layer) return;

        // Find overlapping lower layers that need occlusion
        const layerId = layer.getConfig().id;
        const cacheKey = `${this.context.id}:${layerId}`;
        const cachedResults = this.context.partialEraseCache.get(cacheKey);

        if (!cachedResults || !Array.isArray(cachedResults)) return;

        for (let itemIdx = 0; itemIdx < cachedResults.length; itemIdx++) {
            const item = cachedResults[itemIdx];
            const { layerIds: lowerIds, path, radius } = item;

            // Use composite key to prevent collisions between items for the same layer
            const itemCacheKey = `${layerId}:${itemIdx}`;
            const lastState = this.lastSeekState.get(itemCacheKey);
            const lastProgress = lastState?.progress ?? -1;

            // Determine seek direction and if incremental
            const isRewind = lastProgress >= 0 && progress < lastProgress;
            const isIncremental = lastProgress >= 0 && Math.abs(progress - lastProgress) < 0.05; // 5% threshold
            const lowerLayers = lowerIds
                .map(id => this.context.layers.get(id))
                .filter((l): l is Layer => !!l);

            if (lowerLayers.length === 0 || !path || path.length === 0) continue;

            const strokesPaths: SVGPathElement[] = [];
            for (const lowerLayer of lowerLayers) {
                // Pass itemCacheKey as unique eraserId
                const strokesPath = this.setupOcclusionMask(lowerLayer, radius, itemCacheKey);
                if (strokesPath) {
                    strokesPaths.push(strokesPath);
                }
            }

            if (strokesPaths.length === 0) continue;

            const currentPathIdx = Math.floor(progress * (path.length - 1));

            // Smart Seek: Only rebuild path string if index changed significantly or not incremental
            let d = '';
            const lastPathIndex = lastState?.pathIndex ?? -1;
            const needsRebuild = !isIncremental || Math.abs(currentPathIdx - lastPathIndex) > 1;

            if (needsRebuild || !lastState?.pathD) {
                // Full path rebuild
                for (let i = 0; i <= currentPathIdx; i++) {
                    const [x, y] = path[i];
                    if (d === '') {
                        d = `M ${x} ${y}`;
                    } else {
                        d += ` L ${x} ${y}`;
                    }
                }
            } else if (isRewind && currentPathIdx < lastPathIndex) {
                // Rewind: rebuild from start to current
                for (let i = 0; i <= currentPathIdx; i++) {
                    const [x, y] = path[i];
                    if (d === '') {
                        d = `M ${x} ${y}`;
                    } else {
                        d += ` L ${x} ${y}`;
                    }
                }
            } else if (!isRewind && currentPathIdx > lastPathIndex) {
                // Forward incremental: append to existing path
                d = lastState.pathD;
                for (let i = lastPathIndex + 1; i <= currentPathIdx; i++) {
                    const [x, y] = path[i];
                    d += ` L ${x} ${y}`;
                }
            } else {
                // No change needed
                d = lastState.pathD;
            }

            // Only update DOM if path actually changed
            if (d !== lastState?.pathD) {
                for (const strokesPath of strokesPaths) {
                    strokesPath.setAttribute('d', d);
                }
            }

            // Update hand if needed (optional for seek, but good for scrubbing)
            const occlusionConfig = this.context.config.occlusionCullingConfig || {};
            const showEraser = occlusionConfig.showEraser !== false;
            if (showEraser && this.context.sceneHandOverlayManager && this.context.handOverlayCanvas) {
                const [x, y] = path[currentPathIdx] || path[0];
                const nextPos = path[currentPathIdx + 1];

                const eraserLayerData = {
                    currentErasePosition: { x, y },
                    nextErasePosition: nextPos ? { x: nextPos[0], y: nextPos[1] } : undefined,
                    hasContent: true
                };

                this.context.sceneHandOverlayManager.updateHandPosition(progress, eraserLayerData, this.context.handOverlayCanvas!);

                if (progress >= 1) {
                    // Show hand at the end position
                    const lastPos = path[path.length - 1];
                    if (lastPos) {
                        this.context.sceneHandOverlayManager.drawHandAt(lastPos[0], lastPos[1], this.context.handOverlayCanvas!);
                    }
                    // Note: If no lastPos, don't hide - other layers might be showing hands
                }
            }

            // Cache the current state for next seek using composite key
            this.lastSeekState.set(itemCacheKey, {
                progress: progress,
                pathIndex: currentPathIdx,
                pathD: d
            });
        }
    }

    /**
     * Helper wait method for high-precision timing.
     */
    private async wait(seconds: number): Promise<void> {
        const { preciseWait } = await import('../utils/timing-precision');
        return preciseWait(seconds);
    }



    /**
     * Get all layers that overlap with a specific layer.
     * 
     * This method uses a two-stage detection:
     * @returns Array of overlapping layer IDs
     */
    public async getOverlappingLayers(layerId: string, onlyUpper: boolean = false): Promise<string[]> {
        const layer = this.context.layers.get(layerId);
        if (!layer) return [];

        const layerIndex = this.context.layerOrder.indexOf(layerId);
        const targetProxy = layer.getOcclusionProxy();

        const overlappingIds: string[] = [];

        // OPTIMIZATION: Use spatial index (Worker or Local)
        await this.ensureSpatialIndex();

        if (this.worker && this.workerBuiltFor === this.context.layerOrder.length) {
            const bbox = TimingManager.getLayerBoundingBox(layer);
            const result = await this.callWorker('FIND_OVERLAPS', {
                bbox,
                maxIndex: layerIndex,
                onlyUpper,
                layerId
            });

            if (result && result.overlappingIds) {
                for (const otherId of result.overlappingIds) {
                    const otherLayer = this.context.layers.get(otherId);
                    if (!otherLayer || isEraserOrRubberLayer(otherLayer)) continue;
                    overlappingIds.push(otherId);
                }
                return overlappingIds;
            }
        }

        // Fallback to local spatial index
        if (this.spatialIndex) {
            const overlappingLayers = this.spatialIndex.findOverlappingLayers(
                layer,
                onlyUpper ? this.context.layerOrder.length : -1,
                (l: any) => TimingManager.getLayerBoundingBox(l)
            );

            for (const otherLayer of overlappingLayers) {
                if (onlyUpper) {
                    const otherIndex = this.context.layerOrder.indexOf(otherLayer.id);
                    if (otherIndex <= layerIndex) continue;
                }
                if (isEraserOrRubberLayer(otherLayer)) continue;
                overlappingIds.push(otherLayer.id);
            }
        } else {
            // Brute force fallback
            const layersToCheck: string[] = onlyUpper
                ? this.context.layerOrder.slice(layerIndex + 1)
                : this.context.layerOrder.filter(id => id !== layerId);

            for (const otherId of layersToCheck) {
                const otherLayer = this.context.layers.get(otherId);
                if (!otherLayer || isEraserOrRubberLayer(otherLayer)) continue;

                if (proxiesIntersect(targetProxy, otherLayer.getOcclusionProxy())) {
                    overlappingIds.push(otherId);
                }
            }
        }

        return overlappingIds;
    }

    /**
     * Apply static occlusion to a layer by creating an SVG mask that hides
     * portions covered by higher z-index layers.
     * 
     * This ensures that the layer is properly clipped even before it starts animating,
     * preventing overlap artifacts during drawing.
     * 
     * @param layerId - ID of the layer to apply masking to
     */
    public async applyStaticOcclusion(layerId: string, force: boolean = false): Promise<void> {
        const layer = this.context.layers.get(layerId);
        if (!layer) return;

        const layerElement = layer.getElement();
        if (!layerElement || !this.context.parentSvg) return;

        // Find all layers ABOVE this one that overlap
        const overlappingUpperIds = await this.getOverlappingLayers(layerId, true);

        // Filter overlapping layers: only include layers that have already performed their auto-erase
        // UNLESS force is true (for initial scene-wide occlusion)
        const staticUpperIds = overlappingUpperIds.filter((id: string) => {
            return force || this.performedAutoErase.has(id);
        });

        if (staticUpperIds.length === 0) {
            // If no static occlusion is needed, ensure we don't have a leftover mask
            layerElement.removeAttribute('mask');
            const wrapper = layerElement.parentElement as any;
            if (wrapper && wrapper.classList.contains('layer-occlusion-wrapper')) {
                // We keep the wrapper but remove the mask
                wrapper.removeAttribute('mask');
            }
            return;
        }

        if (isDebugEnabled()) {
            console.log(`[Static Occlusion] Applying geometric mask to layer ${layerId} due to ${staticUpperIds.length} overlapping upper layers`);
        }

        // WRAP THE LAYER TO AVOID TRANSFORM ISSUES IN MASKING
        const wrapper = this.getOrCreateOcclusionWrapper(layerElement);

        // Create mask ID
        const maskId = `mask-occlusion-${this.context.id}-${layerId}`;

        // Check if mask already exists
        let mask = this.context.parentSvg.querySelector(`#${maskId}`) as SVGMaskElement;
        let defs = this.context.parentSvg.querySelector('defs');

        if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            this.context.parentSvg.insertBefore(defs, this.context.parentSvg.firstChild);
        }

        if (!mask) {
            mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
            mask.setAttribute('id', maskId);
            mask.setAttribute('maskUnits', 'userSpaceOnUse');
            defs.appendChild(mask);
        }

        // Clear mask content BUT preserve the zigzag path if it exists
        // This ensures we don't lose the "erased" state from the partial erase animation
        const children = Array.from(mask.children);
        for (const child of children) {
            // Keep the background rect
            if (child.nodeName === 'rect' && child.getAttribute('fill') === 'white') continue;

            // Keep the zigzag path (it has a filter)
            if (child.nodeName === 'path' && child.getAttribute('filter')?.includes('occlusion')) continue;

            // Remove everything else (old static proxies)
            mask.removeChild(child);
        }

        // Ensure white background exists
        if (!mask.querySelector('rect[fill="white"]')) {
            const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bg.setAttribute('x', '0');
            bg.setAttribute('y', '0');
            bg.setAttribute('width', '100%');
            bg.setAttribute('height', '100%');
            bg.setAttribute('fill', 'white');
            mask.insertBefore(bg, mask.firstChild);
        }

        // Group for occlusion shapes (black = hidden)
        // We reuse the existing group if possible, or create a new one
        let shapesGroup = mask.querySelector('g[fill="black"]') as SVGGElement;
        if (!shapesGroup) {
            shapesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            shapesGroup.setAttribute('fill', 'black');
            shapesGroup.setAttribute('filter', 'url(#filter-occlusion-feathered)');
            mask.appendChild(shapesGroup);
        }

        // Add overlapping layers to mask
        for (const upperId of staticUpperIds) {
            const upperLayer = this.context.layers.get(upperId);
            if (!upperLayer) continue;

            const upperElement = upperLayer.getElement();
            if (upperElement && upperElement.id) {
                // Use <use> element to reference the upper layer
                // This allows the mask to animate with the layer (progressive occlusion)
                const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
                use.setAttribute('href', `#${upperElement.id}`);

                // CRITICAL: We need to force the <use> content to be black for the mask
                // The #filter-occlusion-feathered filter already does this (turns all colors to black)
                // so we just need to ensure it's applied.
                // Since shapesGroup has the filter, anything inside it will be filtered.
                // However, <use> might reference elements that have their own filters or colors.
                // The color matrix in the filter should handle it.

                shapesGroup.appendChild(use);
            } else {
                // Fallback to geometric proxy if no element ID (shouldn't happen for layers)
                const proxy = upperLayer.getOcclusionProxy();
                if (proxy.type === 'rect') {
                    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    rect.setAttribute('x', proxy.x.toString());
                    rect.setAttribute('y', proxy.y.toString());
                    rect.setAttribute('width', proxy.width.toString());
                    rect.setAttribute('height', proxy.height.toString());
                    if (proxy.transform) rect.setAttribute('transform', proxy.transform);
                    shapesGroup.appendChild(rect);
                } else if (proxy.type === 'circle') {
                    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    circle.setAttribute('cx', proxy.x.toString());
                    circle.setAttribute('cy', proxy.y.toString());
                    circle.setAttribute('r', (proxy.radius || proxy.width / 2).toString());
                    if (proxy.transform) circle.setAttribute('transform', proxy.transform);
                    shapesGroup.appendChild(circle);
                } else if (proxy.type === 'ellipse') {
                    const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
                    ellipse.setAttribute('cx', proxy.x.toString());
                    ellipse.setAttribute('cy', proxy.y.toString());
                    ellipse.setAttribute('rx', (proxy.radiusX || proxy.width / 2).toString());
                    ellipse.setAttribute('ry', (proxy.radiusY || proxy.height / 2).toString());
                    if (proxy.transform) ellipse.setAttribute('transform', proxy.transform);
                    shapesGroup.appendChild(ellipse);
                }
            }
        }

        // Apply mask to the wrapper
        wrapper.setAttribute('mask', `url(#${maskId})`);
        layerElement.removeAttribute('mask');
    }


    /**
     * Get or create an occlusion wrapper for an element.
     * The wrapper is a neutral <g> element that sits between the element and its parent.
     * This allows applying masks in global/scene coordinates without interference from
     * the element's own transforms.
     */
    private getOrCreateOcclusionWrapper(element: SVGElement): SVGGElement {
        let wrapper = element.parentElement as any;
        if (wrapper && wrapper.classList.contains('layer-occlusion-wrapper')) {
            return wrapper;
        }

        wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        wrapper.classList.add('layer-occlusion-wrapper');
        element.parentElement?.insertBefore(wrapper, element);
        wrapper.appendChild(element);
        return wrapper;
    }
}

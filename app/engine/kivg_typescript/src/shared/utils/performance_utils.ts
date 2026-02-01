import RBush from 'rbush';
import { LayerBoundingBox, OcclusionProxy } from '../types';

/**
 * Bounding box interface for spatial indexing
 */
export interface LayerBBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    layerIndex: number;
    layer: any;
}

/**
 * R-Tree spatial index for efficient overlap detection
 * Reduces complexity from O(n²) to O(n log n)
 */
export class SpatialLayerIndex {
    private tree: RBush<LayerBBox>;

    constructor() {
        // maxEntries=9 is optimal for most use cases according to rbush docs
        this.tree = new RBush<LayerBBox>(9);
    }

    /**
     * Build index with bulk loading - O(n log n)
     */
    buildIndex(
        layers: any[],
        getBBoxFn: (layer: any) => LayerBoundingBox
    ): void {
        const items: LayerBBox[] = layers.map((layer, idx) => {
            const bbox = getBBoxFn(layer);
            return {
                minX: bbox.left,
                minY: bbox.top,
                maxX: bbox.right,
                maxY: bbox.bottom,
                layerIndex: idx,
                layer
            };
        });

        // Bulk load is much faster than individual inserts
        this.tree.load(items);
    }

    /**
     * Find overlapping layers - O(log n + k)
     */
    findOverlappingLayers(
        layer: any,
        maxIndex: number,
        getBBoxFn: (layer: any) => LayerBoundingBox
    ): any[] {
        const bbox = getBBoxFn(layer);

        const candidates = this.tree.search({
            minX: bbox.left,
            minY: bbox.top,
            maxX: bbox.right,
            maxY: bbox.bottom
        });

        return candidates
            .filter((c: any) => c.layerIndex < maxIndex)
            .map((c: any) => c.layer);
    }

    /**
     * Clear the index
     */
    clear(): void {
        this.tree.clear();
    }
}

/**
 * Simple performance.now() polyfill for Node.js/Browser
 */
const now = () => {
    if (typeof performance !== 'undefined' && performance.now) {
        return performance.now();
    }
    // Node.js fallback
    if (typeof process !== 'undefined' && process.hrtime) {
        const hr = process.hrtime();
        return (hr[0] * 1000000 + hr[1] / 1000) / 1000;
    }
    return Date.now();
};

/**
 * LRU cache for bounding boxes with automatic invalidation
 * Uses WeakMap to avoid memory leaks in browser/server environments
 */
export class BBoxCache {
    private cache = new WeakMap<any, {
        bbox: LayerBoundingBox | null;
        timestamp: number;
        transformHash: string;
    }>();

    private static readonly CACHE_TTL = 5000; // 5 seconds

    /**
     * Generate hash of transform properties
     */
    private getTransformHash(layer: any): string {
        const config = typeof layer.getConfig === 'function' ? layer.getConfig() : layer;
        const pos = config.position || config.camera_position || { x: 0, y: 0 };
        return `${pos.x},${pos.y},${config.scale || 1},${config.rotation || 0},${config.width || 0},${config.height || 0}`;
    }

    /**
     * Get cached bbox or calculate and cache
     */
    getBBox(
        layer: any,
        calculateFn: (layer: any) => LayerBoundingBox | null
    ): LayerBoundingBox | null {
        const cached = this.cache.get(layer);
        const currentHash = this.getTransformHash(layer);
        const currentTime = now();

        if (cached &&
            (currentTime - cached.timestamp) < BBoxCache.CACHE_TTL &&
            cached.transformHash === currentHash) {
            return cached.bbox;
        }

        const bbox = calculateFn(layer);

        this.cache.set(layer, {
            bbox,
            timestamp: currentTime,
            transformHash: currentHash
        });

        return bbox;
    }

    /**
     * Manually invalidate cache for a layer
     */
    invalidate(layer: any): void {
        this.cache.delete(layer);
    }

    /**
     * Clear entire cache
     */
    clear(): void {
        this.cache = new WeakMap();
    }
}

/**
 * Check if two geometric proxies intersect.
 * @param marginRatio - Ratio of the lower element's size to use as a margin.
 *                      Positive values increase sensitivity (looser detection).
 *                      Default is 0.5 (50% margin) for general overlap detection.
 */
export function proxiesIntersect(a: OcclusionProxy, b: OcclusionProxy, marginRatio: number = 0.5): boolean {
    // Use logical dimensions for margin if available, otherwise fallback to physical dimensions
    const aWidth = a.logicalWidth || a.width;
    const aHeight = a.logicalHeight || a.height;
    const bWidth = b.logicalWidth || b.width;
    const bHeight = b.logicalHeight || b.height;

    const marginAX = aWidth * marginRatio;
    const marginAY = aHeight * marginRatio;
    const marginBX = bWidth * marginRatio;
    const marginBY = bHeight * marginRatio;

    // Get base edges for each object
    // For rect, x/y are top-left. For circle/ellipse, x/y are center.
    const aLeft = (a.type === 'rect' ? a.x : a.x - a.width / 2) - marginAX;
    const aRight = (a.type === 'rect' ? a.x + a.width : a.x + a.width / 2) + marginAX;
    const aTop = (a.type === 'rect' ? a.y : a.y - a.height / 2) - marginAY;
    const aBottom = (a.type === 'rect' ? a.y + a.height : a.y + a.height / 2) + marginAY;

    const bLeft = (b.type === 'rect' ? b.x : b.x - b.width / 2) - marginBX;
    const bRight = (b.type === 'rect' ? b.x + b.width : b.x + b.width / 2) + marginBX;
    const bTop = (b.type === 'rect' ? b.y : b.y - b.height / 2) - marginBY;
    const bBottom = (b.type === 'rect' ? b.y + b.height : b.y + b.height / 2) + marginBY;

    const hasBBoxOverlap = !(
        aRight <= bLeft ||
        bRight <= aLeft ||
        aBottom <= bTop ||
        bBottom <= aTop
    );

    if (!hasBBoxOverlap) return false;

    // Detailed geometric check
    if (a.type === 'rect' && b.type === 'rect') return true;

    if (a.type === 'circle' && b.type === 'circle') {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const marginA = (marginAX + marginAY) / 2;
        const marginB = (marginBX + marginBY) / 2;
        return distance <= (a.radius! + marginA + b.radius! + marginB);
    }

    if ((a.type === 'rect' && b.type === 'circle') || (a.type === 'circle' && b.type === 'rect')) {
        const rect = a.type === 'rect' ? a : b;
        const circle = a.type === 'circle' ? a : b;

        const rectMarginX = a.type === 'rect' ? marginAX : marginBX;
        const rectMarginY = a.type === 'rect' ? marginAY : marginBY;
        const circleMargin = a.type === 'circle' ? (marginAX + marginAY) / 2 : (marginBX + marginBY) / 2;

        const rectLeft = (rect.x) - rectMarginX;
        const rectRight = (rect.x + rect.width) + rectMarginX;
        const rectTop = (rect.y) - rectMarginY;
        const rectBottom = (rect.y + rect.height) + rectMarginY;

        const closestX = Math.max(rectLeft, Math.min(circle.x, rectRight));
        const closestY = Math.max(rectTop, Math.min(circle.y, rectBottom));

        const dx = circle.x - closestX;
        const dy = circle.y - closestY;

        return (dx * dx + dy * dy) <= ((circle.radius! + circleMargin) * (circle.radius! + circleMargin));
    }

    return true;
}

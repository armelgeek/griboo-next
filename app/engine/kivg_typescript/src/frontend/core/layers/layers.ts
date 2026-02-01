/**
 * Layers Module for Kivg Core
 * 
 * Provides comprehensive layer management functionality for whiteboard animations.
 * This is the centralized layers module for the Griboo engine.
 * 
 * Features:
 * - Layer occlusion management (Z-index based)
 * - Layer composition with alpha blending
 * - Boolean operations (difference, intersection)
 * - Layer morphing and transitions
 * - Multi-layer rendering pipeline
 * 
 * Usage:
 *     import {
 *         LayerManager,
 *         LayerInfo,
 *         applyOcclusionCulling,
 *         computeLayerDifference,
 *         compositeLayers
 *     } from './core/layers';
 *     
 *     const manager = new LayerManager([1920, 1080]);
 *     
 *     manager.addLayer('background', bgImageData, 0);
 *     manager.addLayer('content', contentImageData, 1);
 *     manager.addLayer('overlay', overlayImageData, 2);
 *     
 *     const culledLayers = manager.applyOcclusion();
 *     const compositedImage = manager.composite();
 */

// Constants for occlusion processing
export const DEFAULT_CONTENT_THRESHOLD = 10; // Default alpha threshold for content detection
export const MIN_OVERLAP_PIXELS = 1; // Minimum overlap size to trigger clipping
export const FEATHER_RADIUS = 2; // Pixels to feather edges for smooth transitions
export const FEATHER_KERNEL_MULTIPLIER = 4; // Kernel size multiplier for Gaussian blur
export const MAX_REFLECTION_ITERATIONS = 100; // Maximum iterations for border reflection

/**
 * Blend mode for layer compositing.
 */
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay';

/**
 * Occlusion mode for layer processing.
 */
export type OcclusionMode = 'auto' | 'static' | 'none';

/**
 * Information about a single layer for occlusion processing.
 */
export interface LayerInfo {
    id: string;
    image: ImageData;
    zIndex: number;
    contentMask: Uint8Array | null;
    bounds: [number, number, number, number] | null; // [x1, y1, x2, y2]
    occlusionMode: OcclusionMode;
    opacity: number;
    visible: boolean;
    blendMode: BlendMode;
    contentThreshold?: number;
}

/**
 * Create a LayerInfo object with computed content mask and bounds.
 * 
 * @param id - Unique layer identifier
 * @param image - Layer image as ImageData
 * @param zIndex - Depth index (higher = rendered on top)
 * @param options - Optional configuration
 * @returns LayerInfo object
 */
export function createLayerInfo(
    id: string,
    image: ImageData,
    zIndex: number,
    options: {
        occlusionMode?: OcclusionMode;
        opacity?: number;
        visible?: boolean;
        blendMode?: BlendMode;
        contentThreshold?: number;
    } = {}
): LayerInfo {
    const {
        occlusionMode = 'auto',
        opacity = 1.0,
        visible = true,
        blendMode = 'normal',
        contentThreshold = DEFAULT_CONTENT_THRESHOLD
    } = options;

    // Compute content mask
    const contentMask = computeContentMask(image, contentThreshold);

    // Compute bounds
    const bounds = computeBounds(contentMask, image.width, image.height);

    return {
        id,
        image,
        zIndex,
        contentMask,
        bounds,
        occlusionMode,
        opacity,
        visible,
        blendMode,
        contentThreshold
    };
}

/**
 * Compute binary mask of non-background content.
 * 
 * Detects any non-transparent pixel as content, regardless of color brightness.
 * This is crucial for occlusion culling to work properly with light-colored shapes,
 * images, and SVG layers.
 * 
 * @param image - Source ImageData
 * @param threshold - Alpha threshold for opacity detection (default: 10)
 * @returns Uint8Array where 1 indicates content, 0 indicates background
 */
export function computeContentMask(
    image: ImageData,
    threshold: number = DEFAULT_CONTENT_THRESHOLD
): Uint8Array {
    const mask = new Uint8Array(image.width * image.height);

    // Use threshold as alpha threshold (min opacity to be considered content)
    // Default 10 means pixels with alpha >= 10 are content
    const alphaThreshold = Math.min(threshold, 10);

    for (let y = 0; y < image.height; y++) {
        for (let x = 0; x < image.width; x++) {
            const idx = (y * image.width + x) * 4;
            const alpha = image.data[idx + 3];

            // Any pixel with sufficient opacity is considered content
            // This includes both dark AND light colored pixels
            if (alpha >= alphaThreshold) {
                mask[y * image.width + x] = 1;
            } else {
                mask[y * image.width + x] = 0;
            }
        }
    }

    return mask;
}

/**
 * Compute bounding box of content.
 * 
 * @param mask - Content mask (Uint8Array)
 * @param width - Image width
 * @param height - Image height
 * @returns Bounding box as [x1, y1, x2, y2] or null if no content
 */
export function computeBounds(
    mask: Uint8Array,
    width: number,
    height: number
): [number, number, number, number] | null {
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let hasContent = false;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (mask[y * width + x] === 1) {
                hasContent = true;
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
    }

    if (!hasContent) {
        return null;
    }

    return [minX, minY, maxX, maxY];
}

/**
 * Resize a mask to match target dimensions.
 * 
 * @param mask - Source mask
 * @param srcWidth - Source width
 * @param srcHeight - Source height
 * @param targetWidth - Target width
 * @param targetHeight - Target height
 * @returns Resized mask
 */
function resizeMaskToTarget(
    mask: Uint8Array,
    srcWidth: number,
    srcHeight: number,
    targetWidth: number,
    targetHeight: number
): Uint8Array {
    if (srcWidth === targetWidth && srcHeight === targetHeight) {
        return mask;
    }

    const resized = new Uint8Array(targetWidth * targetHeight);
    const copyH = Math.min(srcHeight, targetHeight);
    const copyW = Math.min(srcWidth, targetWidth);

    for (let y = 0; y < copyH; y++) {
        for (let x = 0; x < copyW; x++) {
            resized[y * targetWidth + x] = mask[y * srcWidth + x];
        }
    }

    return resized;
}

/**
 * Manages layer occlusion and composition operations.
 * 
 * This class handles:
 * 1. Z-index based layer ordering
 * 2. Overlap detection between layers
 * 3. Boolean difference operations to clip underlying layers
 * 4. Layer composition with blending
 */
export class LayerManager {
    canvasSize: [number, number] | null;
    backgroundColor: [number, number, number];
    layers: Map<string, LayerInfo>;
    private _sortedLayers: LayerInfo[];
    private _needsSort: boolean;

    /**
     * Initialize the layer manager.
     * 
     * @param canvasSize - [width, height] of the canvas. If null, inferred from layers.
     * @param backgroundColor - Background color as RGB tuple (0-255).
     */
    constructor(
        canvasSize?: [number, number],
        backgroundColor: [number, number, number] = [255, 255, 255]
    ) {
        this.canvasSize = canvasSize ?? null;
        this.backgroundColor = backgroundColor;
        this.layers = new Map();
        this._sortedLayers = [];
        this._needsSort = true;
        console.log('[LayerManager] Initialized with background:', this.backgroundColor);
    }

    /**
     * Add a layer to the manager.
     * 
     * @param layerId - Unique identifier for the layer
     * @param image - Layer image as ImageData
     * @param zIndex - Depth index (higher = rendered on top)
     * @param options - Optional configuration
     */
    addLayer(
        layerId: string,
        image: ImageData,
        zIndex: number,
        options: {
            occlusionMode?: OcclusionMode;
            opacity?: number;
            visible?: boolean;
            blendMode?: BlendMode;
            contentThreshold?: number;
        } = {}
    ): void {
        const layerInfo = createLayerInfo(layerId, image, zIndex, options);
        this.layers.set(layerId, layerInfo);
        this._needsSort = true;

        // Update canvas size if needed
        if (!this.canvasSize) {
            this.canvasSize = [image.width, image.height];
        }
    }

    /**
     * Remove a layer from the manager.
     * 
     * @param layerId - ID of the layer to remove
     * @returns True if layer was removed, false if not found
     */
    removeLayer(layerId: string): boolean {
        const removed = this.layers.delete(layerId);
        if (removed) {
            this._needsSort = true;
        }
        return removed;
    }

    /**
     * Get a layer by ID.
     */
    getLayer(layerId: string): LayerInfo | undefined {
        return this.layers.get(layerId);
    }

    /**
     * Set layer visibility.
     */
    setLayerVisibility(layerId: string, visible: boolean): boolean {
        const layer = this.layers.get(layerId);
        if (layer) {
            layer.visible = visible;
            return true;
        }
        return false;
    }

    /**
     * Set layer opacity.
     */
    setLayerOpacity(layerId: string, opacity: number): boolean {
        const layer = this.layers.get(layerId);
        if (layer) {
            layer.opacity = Math.max(0, Math.min(1, opacity));
            return true;
        }
        return false;
    }

    /**
     * Set layer z-index.
     */
    setLayerZIndex(layerId: string, zIndex: number): boolean {
        const layer = this.layers.get(layerId);
        if (layer) {
            layer.zIndex = zIndex;
            this._needsSort = true;
            return true;
        }
        return false;
    }

    /**
     * Get layers sorted by z-index (ascending order).
     * 
     * @returns Array of LayerInfo objects sorted by zIndex
     */
    getSortedLayers(): LayerInfo[] {
        if (this._needsSort) {
            this._sortedLayers = Array.from(this.layers.values())
                .sort((a, b) => a.zIndex - b.zIndex);
            this._needsSort = false;
        }
        return this._sortedLayers;
    }

    /**
     * Detect overlap between two layers.
     * 
     * @param layerAId - ID of first layer
     * @param layerBId - ID of second layer
     * @returns Uint8Array where 1 indicates overlap
     */
    detectOverlap(layerAId: string, layerBId: string): Uint8Array {
        const layerA = this.layers.get(layerAId);
        const layerB = this.layers.get(layerBId);

        if (!layerA || !layerB || !layerA.contentMask || !layerB.contentMask) {
            return new Uint8Array(1);
        }

        // Handle size mismatch
        const targetH = Math.max(layerA.image.height, layerB.image.height);
        const targetW = Math.max(layerA.image.width, layerB.image.width);

        let maskA = layerA.contentMask;
        let maskB = layerB.contentMask;

        if (layerA.image.width !== targetW || layerA.image.height !== targetH) {
            maskA = resizeMaskToTarget(
                layerA.contentMask,
                layerA.image.width,
                layerA.image.height,
                targetW,
                targetH
            );
        }

        if (layerB.image.width !== targetW || layerB.image.height !== targetH) {
            maskB = resizeMaskToTarget(
                layerB.contentMask,
                layerB.image.width,
                layerB.image.height,
                targetW,
                targetH
            );
        }

        // Compute intersection: A ∩ B
        const overlap = new Uint8Array(targetW * targetH);
        for (let i = 0; i < overlap.length; i++) {
            overlap[i] = (maskA[i] === 1 && maskB[i] === 1) ? 1 : 0;
        }

        return overlap;
    }

    /**
     * Compute the set difference: A - (A ∩ B).
     * 
     * This clips the base layer where it overlaps with the overlay layer.
     * 
     * @param baseLayerId - ID of the layer to clip (A)
     * @param overlayLayerId - ID of the overlapping layer (B)
     * @param feather - Whether to feather the edges
     * @returns Modified ImageData of base layer with overlapping regions removed
     */
    computeDifference(
        baseLayerId: string,
        overlayLayerId: string,
        feather: boolean = true
    ): ImageData | null {
        const baseLayer = this.layers.get(baseLayerId);
        if (!baseLayer) return null;

        const overlayLayer = this.layers.get(overlayLayerId);
        if (!overlayLayer) {
            // Return a copy of the original image
            const copy = new ImageData(baseLayer.image.width, baseLayer.image.height);
            copy.data.set(baseLayer.image.data);
            return copy;
        }

        // Get intersection mask
        const overlapMask = this.detectOverlap(baseLayerId, overlayLayerId);

        // Check if overlap is significant
        let overlapCount = 0;
        for (let i = 0; i < overlapMask.length; i++) {
            if (overlapMask[i] === 1) overlapCount++;
        }

        if (overlapCount < MIN_OVERLAP_PIXELS) {
            const copy = new ImageData(baseLayer.image.width, baseLayer.image.height);
            copy.data.set(baseLayer.image.data);
            return copy;
        }

        return this._applyDifferenceToImage(
            baseLayer.image,
            overlapMask,
            Math.max(baseLayer.image.width, overlayLayer.image.width),
            Math.max(baseLayer.image.height, overlayLayer.image.height),
            feather
        );
    }

    /**
     * Apply difference operation directly to an image.
     */
    private _applyDifferenceToImage(
        image: ImageData,
        overlapMask: Uint8Array,
        maskWidth: number,
        maskHeight: number,
        feather: boolean = true
    ): ImageData {
        const result = new ImageData(image.width, image.height);
        result.data.set(image.data);

        if (feather) {
            // Apply feathered mask
            const featheredMask = this._createFeatheredMask(
                overlapMask,
                maskWidth,
                maskHeight,
                FEATHER_RADIUS
            );

            for (let y = 0; y < image.height; y++) {
                for (let x = 0; x < image.width; x++) {
                    if (y < maskHeight && x < maskWidth) {
                        const maskIdx = y * maskWidth + x;
                        const alpha = featheredMask[maskIdx];

                        if (alpha > 0) {
                            const idx = (y * image.width + x) * 4;
                            // Blend with background color
                            result.data[idx] = Math.round(
                                this.backgroundColor[0] * alpha +
                                result.data[idx] * (1 - alpha)
                            );
                            result.data[idx + 1] = Math.round(
                                this.backgroundColor[1] * alpha +
                                result.data[idx + 1] * (1 - alpha)
                            );
                            result.data[idx + 2] = Math.round(
                                this.backgroundColor[2] * alpha +
                                result.data[idx + 2] * (1 - alpha)
                            );
                        }
                    }
                }
            }
        } else {
            // Hard mask
            for (let y = 0; y < image.height; y++) {
                for (let x = 0; x < image.width; x++) {
                    if (y < maskHeight && x < maskWidth) {
                        const maskIdx = y * maskWidth + x;
                        if (overlapMask[maskIdx] === 1) {
                            const idx = (y * image.width + x) * 4;
                            result.data[idx] = this.backgroundColor[0];
                            result.data[idx + 1] = this.backgroundColor[1];
                            result.data[idx + 2] = this.backgroundColor[2];
                        }
                    }
                }
            }
        }

        return result;
    }

    /**
     * Create a feathered mask using dilation and Gaussian blur for smooth transitions.
     * This matches the Python implementation for hand-drawn smooth erasing.
     */
    private _createFeatheredMask(
        mask: Uint8Array,
        width: number,
        height: number,
        radius: number
    ): Float32Array {
        // First dilate the mask
        const dilated = new Uint8Array(width * height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let maxVal = 0;
                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        // Use circular kernel instead of square for smooth edges
                        // This matches Python's cv2.circle() behavior
                        const distSq = dx * dx + dy * dy;
                        if (distSq > radius * radius) continue;

                        const ny = y + dy;
                        const nx = x + dx;
                        if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                            maxVal = Math.max(maxVal, mask[ny * width + nx]);
                        }
                    }
                }
                dilated[y * width + x] = maxVal;
            }
        }

        // Apply Gaussian blur for smooth, natural transitions (like hand-drawn)
        const kernelSize = radius * FEATHER_KERNEL_MULTIPLIER + 1;
        const feathered = this._gaussianBlur(dilated, width, height, kernelSize);

        return feathered;
    }

    /**
     * Apply Gaussian blur to a mask for smooth feathering.
     * This creates more natural, hand-drawn-like transitions compared to box blur.
     * 
     * @param data - Input mask data
     * @param width - Image width
     * @param height - Image height
     * @param kernelSize - Gaussian kernel size (should be odd)
     * @returns Blurred mask as Float32Array
     */
    private _gaussianBlur(
        data: Uint8Array,
        width: number,
        height: number,
        kernelSize: number
    ): Float32Array {
        const { kernel, halfKernel } = generateGaussianKernel(kernelSize);

        // Apply Gaussian blur with proper border handling (reflect border mode like OpenCV default)
        const result = new Float32Array(width * height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sum = 0;
                let weightSum = 0;
                let kernelIdx = 0;

                for (let dy = -halfKernel; dy <= halfKernel; dy++) {
                    for (let dx = -halfKernel; dx <= halfKernel; dx++) {
                        // Use reflection at borders (like OpenCV's BORDER_REFLECT_101)
                        const ny = reflectBorder(y + dy, height);
                        const nx = reflectBorder(x + dx, width);

                        const weight = kernel[kernelIdx];
                        sum += data[ny * width + nx] * weight;
                        weightSum += weight;

                        kernelIdx++;
                    }
                }

                // Normalize by actual weight sum (important for border pixels)
                result[y * width + x] = weightSum > 0 ? sum / weightSum : 0;
            }
        }

        return result;
    }

    /**
     * Apply occlusion culling to all layers.
     * 
     * For each layer, clips portions covered by ALL higher z-index layers.
     * Each layer is checked against all layers with higher z-index values,
     * and the overlapping regions are removed based on the actual shape of each occluding layer.
     * 
     * @param autoOnly - If true, only process layers with occlusionMode='auto'
     * @returns Map of layer_id to the culled ImageData
     */
    applyOcclusion(autoOnly: boolean = true): Map<string, ImageData> {
        const sortedLayers = this.getSortedLayers();
        const culledImages = new Map<string, ImageData>();

        for (let i = 0; i < sortedLayers.length; i++) {
            const layer = sortedLayers[i];

            if (!layer.visible) {
                continue;
            }

            // Layers with occlusionMode='none' are included unprocessed
            if (autoOnly && layer.occlusionMode === 'none') {
                const copy = new ImageData(layer.image.width, layer.image.height);
                copy.data.set(layer.image.data);
                culledImages.set(layer.id, copy);
                continue;
            }

            // Create a copy of the current layer image
            let currentImage = new ImageData(layer.image.width, layer.image.height);
            currentImage.data.set(layer.image.data);

            // Clip by ALL higher z-index layers (not just the immediate next one)
            // This ensures the layer is properly occluded by the shape of each higher layer
            for (let j = i + 1; j < sortedLayers.length; j++) {
                const overlayLayer = sortedLayers[j];

                if (overlayLayer.visible && overlayLayer.occlusionMode !== 'none') {
                    // Apply occlusion for:
                    // - 'auto' mode: always process
                    // - 'static' mode: only when autoOnly=false
                    if (layer.occlusionMode === 'auto' ||
                        (layer.occlusionMode === 'static' && !autoOnly)) {
                        const overlap = this.detectOverlap(layer.id, overlayLayer.id);

                        let overlapCount = 0;
                        for (let k = 0; k < overlap.length; k++) {
                            if (overlap[k] === 1) overlapCount++;
                        }

                        if (overlapCount >= MIN_OVERLAP_PIXELS) {
                            currentImage = this._applyDifferenceToImage(
                                currentImage,
                                overlap,
                                Math.max(layer.image.width, overlayLayer.image.width),
                                Math.max(layer.image.height, overlayLayer.image.height),
                                true
                            );
                        }
                    }
                }
            }

            // Add the layer (processed or unprocessed) to the result
            // Layers with 'static' mode when autoOnly=true are included unprocessed
            culledImages.set(layer.id, currentImage);
        }

        return culledImages;
    }

    /**
     * Composite all layers into a single image.
     * 
     * @param useCulled - If true, use occlusion-culled images
     * @returns Composited ImageData with all layers
     */
    composite(useCulled: boolean = true): ImageData {
        if (!this.canvasSize) {
            throw new Error('Canvas size not set. Add at least one layer first.');
        }

        const [width, height] = this.canvasSize;
        const result = new ImageData(width, height);

        // Fill with background color
        console.log('[LayerManager] Composite filling background:', this.backgroundColor);
        for (let i = 0; i < result.data.length; i += 4) {
            result.data[i] = this.backgroundColor[0];
            result.data[i + 1] = this.backgroundColor[1];
            result.data[i + 2] = this.backgroundColor[2];
            result.data[i + 3] = 255;
        }

        // Get images (culled or original)
        const images = useCulled
            ? this.applyOcclusion()
            : new Map(Array.from(this.layers.entries()).map(
                ([id, layer]) => [id, layer.image]
            ));

        // Composite in z-order
        for (const layer of this.getSortedLayers()) {
            if (!layer.visible) {
                continue;
            }

            const layerImg = images.get(layer.id);
            if (!layerImg) {
                continue;
            }

            // Composite layer onto result
            const contentMask = computeContentMask(layerImg, layer.contentThreshold);

            for (let y = 0; y < Math.min(height, layerImg.height); y++) {
                for (let x = 0; x < Math.min(width, layerImg.width); x++) {
                    const maskIdx = y * layerImg.width + x;

                    if (contentMask[maskIdx] === 1) {
                        const srcIdx = (y * layerImg.width + x) * 4;
                        const dstIdx = (y * width + x) * 4;

                        // Apply opacity
                        if (layer.opacity < 1.0) {
                            const alpha = layer.opacity;
                            result.data[dstIdx] = Math.round(
                                layerImg.data[srcIdx] * alpha +
                                result.data[dstIdx] * (1 - alpha)
                            );
                            result.data[dstIdx + 1] = Math.round(
                                layerImg.data[srcIdx + 1] * alpha +
                                result.data[dstIdx + 1] * (1 - alpha)
                            );
                            result.data[dstIdx + 2] = Math.round(
                                layerImg.data[srcIdx + 2] * alpha +
                                result.data[dstIdx + 2] * (1 - alpha)
                            );
                        } else {
                            result.data[dstIdx] = layerImg.data[srcIdx];
                            result.data[dstIdx + 1] = layerImg.data[srcIdx + 1];
                            result.data[dstIdx + 2] = layerImg.data[srcIdx + 2];
                        }
                        result.data[dstIdx + 3] = 255;
                    }
                }
            }
        }

        return result;
    }

    /**
     * Get diagnostic information about layer occlusions.
     */
    getOcclusionInfo(): {
        totalLayers: number;
        layerOrder: string[];
        overlaps: Array<{
            lowerLayer: string;
            upperLayer: string;
            overlapPixels: number;
        }>;
    } {
        const sortedLayers = this.getSortedLayers();
        const overlaps: Array<{
            lowerLayer: string;
            upperLayer: string;
            overlapPixels: number;
        }> = [];

        for (let i = 0; i < sortedLayers.length; i++) {
            const layerA = sortedLayers[i];
            for (let j = i + 1; j < sortedLayers.length; j++) {
                const layerB = sortedLayers[j];
                const overlap = this.detectOverlap(layerA.id, layerB.id);

                let overlapPixels = 0;
                for (let k = 0; k < overlap.length; k++) {
                    if (overlap[k] === 1) overlapPixels++;
                }

                if (overlapPixels > 0) {
                    overlaps.push({
                        lowerLayer: layerA.id,
                        upperLayer: layerB.id,
                        overlapPixels
                    });
                }
            }
        }

        return {
            totalLayers: sortedLayers.length,
            layerOrder: sortedLayers.map(l => l.id),
            overlaps
        };
    }
}

/**
 * Layer configuration for convenience functions.
 */
export interface LayerConfig {
    id?: string;
    image: ImageData;
    zIndex?: number;
    occlusionMode?: OcclusionMode;
}

/**
 * Convenience function to apply occlusion culling to a list of layer configurations.
 * 
 * @param layers - Array of layer configurations
 * @param canvasSize - [width, height] of the canvas
 * @param backgroundColor - Background color as RGB tuple (0-255)
 * @returns Array of layer configurations with clipped images
 */
export function applyOcclusionCulling(
    layers: LayerConfig[],
    canvasSize: [number, number],
    backgroundColor: [number, number, number] = [255, 255, 255]
): LayerConfig[] {
    const manager = new LayerManager(canvasSize, backgroundColor);
    console.log('applyOcclusionCulling');
    for (let idx = 0; idx < layers.length; idx++) {
        const layer = layers[idx];
        const layerId = layer.id ?? `layer_${idx}`;
        const zIndex = layer.zIndex ?? idx;
        const occlusionMode = layer.occlusionMode ?? 'auto';

        manager.addLayer(layerId, layer.image, zIndex, { occlusionMode });
    }

    const culledImages = manager.applyOcclusion();

    return layers.map((layer, idx) => {
        const layerId = layer.id ?? `layer_${idx}`;
        const culledImage = culledImages.get(layerId);

        return {
            ...layer,
            image: culledImage ?? layer.image
        };
    });
}

/**
 * Compute the set difference between two layer images: A - (A ∩ B).
 * 
 * @param baseImage - The base layer image (A) to be clipped
 * @param overlayImage - The overlay layer image (B) that defines clipping region
 * @param backgroundColor - Color to use for clipped regions (0-255)
 * @param feather - Whether to feather edges
 * @param contentThreshold - Threshold for detecting content pixels
 * @returns Modified ImageData with overlapping regions clipped
 */
export function computeLayerDifference(
    baseImage: ImageData,
    overlayImage: ImageData,
    backgroundColor: [number, number, number] = [255, 255, 255],
    feather: boolean = true,
    contentThreshold: number = DEFAULT_CONTENT_THRESHOLD
): ImageData {
    // Compute content masks
    const baseMask = computeContentMask(baseImage, contentThreshold);
    const overlayMask = computeContentMask(overlayImage, contentThreshold);

    // Handle size mismatch by using the larger dimensions
    const targetW = Math.max(baseImage.width, overlayImage.width);
    const targetH = Math.max(baseImage.height, overlayImage.height);

    let resizedBaseMask = baseMask;
    let resizedOverlayMask = overlayMask;

    if (baseImage.width !== targetW || baseImage.height !== targetH) {
        resizedBaseMask = resizeMaskToTarget(
            baseMask,
            baseImage.width,
            baseImage.height,
            targetW,
            targetH
        );
    }

    if (overlayImage.width !== targetW || overlayImage.height !== targetH) {
        resizedOverlayMask = resizeMaskToTarget(
            overlayMask,
            overlayImage.width,
            overlayImage.height,
            targetW,
            targetH
        );
    }

    // Compute intersection
    const overlapMask = new Uint8Array(targetW * targetH);
    for (let i = 0; i < overlapMask.length; i++) {
        overlapMask[i] = (resizedBaseMask[i] === 1 && resizedOverlayMask[i] === 1) ? 1 : 0;
    }

    // Check if overlap is significant
    let overlapCount = 0;
    for (let i = 0; i < overlapMask.length; i++) {
        if (overlapMask[i] === 1) overlapCount++;
    }

    if (overlapCount < MIN_OVERLAP_PIXELS) {
        const result = new ImageData(baseImage.width, baseImage.height);
        result.data.set(baseImage.data);
        return result;
    }

    // Create result image
    const result = new ImageData(baseImage.width, baseImage.height);
    result.data.set(baseImage.data);

    if (feather) {
        // Create feathered mask
        const featheredMask = createFeatheredMaskStandalone(
            overlapMask,
            targetW,
            targetH,
            FEATHER_RADIUS
        );

        for (let y = 0; y < baseImage.height; y++) {
            for (let x = 0; x < baseImage.width; x++) {
                if (y < targetH && x < targetW) {
                    const maskIdx = y * targetW + x;
                    const alpha = featheredMask[maskIdx];

                    if (alpha > 0) {
                        const idx = (y * baseImage.width + x) * 4;
                        result.data[idx] = Math.round(
                            backgroundColor[0] * alpha +
                            result.data[idx] * (1 - alpha)
                        );
                        result.data[idx + 1] = Math.round(
                            backgroundColor[1] * alpha +
                            result.data[idx + 1] * (1 - alpha)
                        );
                        result.data[idx + 2] = Math.round(
                            backgroundColor[2] * alpha +
                            result.data[idx + 2] * (1 - alpha)
                        );
                    }
                }
            }
        }
    } else {
        for (let y = 0; y < baseImage.height; y++) {
            for (let x = 0; x < baseImage.width; x++) {
                if (y < targetH && x < targetW) {
                    const maskIdx = y * targetW + x;
                    if (overlapMask[maskIdx] === 1) {
                        const idx = (y * baseImage.width + x) * 4;
                        result.data[idx] = backgroundColor[0];
                        result.data[idx + 1] = backgroundColor[1];
                        result.data[idx + 2] = backgroundColor[2];
                    }
                }
            }
        }
    }

    return result;
}

/**
 * Apply border reflection to get a valid pixel coordinate.
 * Uses BORDER_REFLECT_101 mode like OpenCV's default.
 * 
 * This mode reflects at borders while excluding the border pixel itself.
 * For a 5-pixel image [0,1,2,3,4]:
 * - coord -1 -> 0 (reflects: 0|01234)
 * - coord 5 -> 4 (reflects: 01234|4)
 * - coord -2 -> 1
 * - coord 6 -> 3
 * 
 * Pattern: ...43210|01234|43210...
 * 
 * @param coord - Coordinate to reflect (can be negative or out of bounds)
 * @param size - Maximum size (width or height)
 * @returns Reflected coordinate within valid range [0, size-1]
 * 
 * @example
 * reflectBorder(-1, 5) => 0     // Reflect at lower bound
 * reflectBorder(5, 5) => 4      // Reflect at upper bound
 * reflectBorder(2, 5) => 2      // No reflection needed
 */
export function reflectBorder(coord: number, size: number): number {
    // Quick path for common case: coordinate already in bounds
    if (coord >= 0 && coord < size) {
        return coord;
    }

    // Handle edge case
    if (size <= 0) return 0;

    // Apply reflection iteratively until coord is in bounds
    // This handles multiple reflections for coordinates far outside bounds
    // Maximum iterations needed is logarithmic in distance from bounds
    let maxIter = MAX_REFLECTION_ITERATIONS;
    while ((coord < 0 || coord >= size) && maxIter-- > 0) {
        if (coord < 0) {
            // Mirror at -0.5 position: reflect at boundary excluding border pixel
            coord = -1 - coord;
        } else if (coord >= size) {
            // Mirror at size-0.5 position: reflect at boundary excluding border pixel
            coord = 2 * size - 1 - coord;
        }
    }

    // Final clamp for safety (should not be needed if algorithm is correct)
    return Math.max(0, Math.min(size - 1, coord));
}

/**
 * Generate a normalized 2D Gaussian kernel.
 * 
 * @param kernelSize - Size of the kernel (will be made odd if even)
 * @returns Object containing the kernel array and half-kernel size
 * 
 * @remarks
 * For performance optimization in scenarios with many repeated operations,
 * consider caching kernels by size. However, for typical occlusion culling
 * operations (once per layer during scene setup), the overhead is negligible.
 */
function generateGaussianKernel(kernelSize: number): { kernel: number[], halfKernel: number } {
    // Ensure kernel size is odd
    if (kernelSize % 2 === 0) kernelSize += 1;

    const halfKernel = Math.floor(kernelSize / 2);
    const sigma = kernelSize / 6; // Standard deviation for Gaussian

    // Generate Gaussian kernel
    const kernel: number[] = [];
    let kernelSum = 0;

    for (let i = -halfKernel; i <= halfKernel; i++) {
        for (let j = -halfKernel; j <= halfKernel; j++) {
            const value = Math.exp(-(i * i + j * j) / (2 * sigma * sigma));
            kernel.push(value);
            kernelSum += value;
        }
    }

    // Normalize kernel
    for (let i = 0; i < kernel.length; i++) {
        kernel[i] /= kernelSum;
    }

    return { kernel, halfKernel };
}

/**
 * Apply Gaussian blur to a mask for smooth feathering (standalone version).
 * This creates more natural, hand-drawn-like transitions compared to box blur.
 * 
 * @param data - Input mask data
 * @param width - Image width
 * @param height - Image height
 * @param kernelSize - Gaussian kernel size (should be odd)
 * @returns Blurred mask as Float32Array
 */
export function gaussianBlurStandalone(
    data: Uint8Array,
    width: number,
    height: number,
    kernelSize: number
): Float32Array {
    const { kernel, halfKernel } = generateGaussianKernel(kernelSize);

    // Apply Gaussian blur with proper border handling (reflect border mode like OpenCV default)
    const result = new Float32Array(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0;
            let weightSum = 0;
            let kernelIdx = 0;

            for (let dy = -halfKernel; dy <= halfKernel; dy++) {
                for (let dx = -halfKernel; dx <= halfKernel; dx++) {
                    // Use reflection at borders (like OpenCV's BORDER_REFLECT_101)
                    const ny = reflectBorder(y + dy, height);
                    const nx = reflectBorder(x + dx, width);

                    const weight = kernel[kernelIdx];
                    sum += data[ny * width + nx] * weight;
                    weightSum += weight;

                    kernelIdx++;
                }
            }

            // Normalize by actual weight sum (important for border pixels)
            result[y * width + x] = weightSum > 0 ? sum / weightSum : 0;
        }
    }

    return result;
}

/**
 * Standalone function to create a feathered mask with Gaussian blur for smooth transitions.
 * This matches the Python implementation for hand-drawn smooth erasing.
 */
function createFeatheredMaskStandalone(
    mask: Uint8Array,
    width: number,
    height: number,
    radius: number
): Float32Array {
    // First dilate the mask
    const dilated = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let maxVal = 0;
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    // Use circular kernel instead of square for smooth edges
                    // This matches Python's cv2.circle() behavior
                    const distSq = dx * dx + dy * dy;
                    if (distSq > radius * radius) continue;

                    const ny = y + dy;
                    const nx = x + dx;
                    if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                        maxVal = Math.max(maxVal, mask[ny * width + nx]);
                    }
                }
            }
            dilated[y * width + x] = maxVal;
        }
    }

    // Apply Gaussian blur for smooth, natural transitions (like hand-drawn)
    const kernelSize = radius * FEATHER_KERNEL_MULTIPLIER + 1;
    const feathered = gaussianBlurStandalone(dilated, width, height, kernelSize);

    return feathered;
}

/**
 * Detect all intersections between a list of layers.
 * 
 * @param layers - Array of ImageData objects
 * @param contentThreshold - Threshold for detecting content
 * @returns Array of tuples [layerAIdx, layerBIdx, overlapPixelCount]
 */
export function detectLayerIntersections(
    layers: ImageData[],
    contentThreshold: number = DEFAULT_CONTENT_THRESHOLD
): Array<[number, number, number]> {
    const intersections: Array<[number, number, number]> = [];

    // Compute all content masks
    const masks = layers.map(layer => ({
        mask: computeContentMask(layer, contentThreshold),
        width: layer.width,
        height: layer.height
    }));

    // Find all pairs with overlap
    for (let i = 0; i < layers.length; i++) {
        for (let j = i + 1; j < layers.length; j++) {
            const targetW = Math.max(masks[i].width, masks[j].width);
            const targetH = Math.max(masks[i].height, masks[j].height);

            let maskI = masks[i].mask;
            let maskJ = masks[j].mask;

            if (masks[i].width !== targetW || masks[i].height !== targetH) {
                maskI = resizeMaskToTarget(
                    masks[i].mask,
                    masks[i].width,
                    masks[i].height,
                    targetW,
                    targetH
                );
            }

            if (masks[j].width !== targetW || masks[j].height !== targetH) {
                maskJ = resizeMaskToTarget(
                    masks[j].mask,
                    masks[j].width,
                    masks[j].height,
                    targetW,
                    targetH
                );
            }

            let overlapPixels = 0;
            for (let k = 0; k < targetW * targetH; k++) {
                if (maskI[k] === 1 && maskJ[k] === 1) {
                    overlapPixels++;
                }
            }

            if (overlapPixels > 0) {
                intersections.push([i, j, overlapPixels]);
            }
        }
    }

    return intersections;
}

/**
 * Composite multiple layers into a single image.
 * 
 * @param layers - Array of ImageData objects (in z-order, first = bottom)
 * @param canvasSize - [width, height] of the canvas
 * @param backgroundColor - Background color as RGB tuple (0-255)
 * @param opacities - Optional array of opacity values for each layer
 * @returns Composited ImageData
 */
export function compositeLayers(
    layers: ImageData[],
    canvasSize: [number, number],
    backgroundColor: [number, number, number] = [255, 255, 255],
    opacities?: number[]
): ImageData {
    const [width, height] = canvasSize;
    const result = new ImageData(width, height);

    // Fill with background color
    for (let i = 0; i < result.data.length; i += 4) {
        result.data[i] = backgroundColor[0];
        result.data[i + 1] = backgroundColor[1];
        result.data[i + 2] = backgroundColor[2];
        result.data[i + 3] = 255;
    }

    const layerOpacities = opacities ?? layers.map(() => 1.0);

    for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
        const layer = layers[layerIdx];
        if (!layer) continue;

        const contentMask = computeContentMask(layer);
        const opacity = layerOpacities[layerIdx] ?? 1.0;

        for (let y = 0; y < Math.min(height, layer.height); y++) {
            for (let x = 0; x < Math.min(width, layer.width); x++) {
                const maskIdx = y * layer.width + x;

                if (contentMask[maskIdx] === 1) {
                    const srcIdx = (y * layer.width + x) * 4;
                    const dstIdx = (y * width + x) * 4;

                    if (opacity < 1.0) {
                        result.data[dstIdx] = Math.round(
                            layer.data[srcIdx] * opacity +
                            result.data[dstIdx] * (1 - opacity)
                        );
                        result.data[dstIdx + 1] = Math.round(
                            layer.data[srcIdx + 1] * opacity +
                            result.data[dstIdx + 1] * (1 - opacity)
                        );
                        result.data[dstIdx + 2] = Math.round(
                            layer.data[srcIdx + 2] * opacity +
                            result.data[dstIdx + 2] * (1 - opacity)
                        );
                    } else {
                        result.data[dstIdx] = layer.data[srcIdx];
                        result.data[dstIdx + 1] = layer.data[srcIdx + 1];
                        result.data[dstIdx + 2] = layer.data[srcIdx + 2];
                    }
                    result.data[dstIdx + 3] = 255;
                }
            }
        }
    }

    return result;
}

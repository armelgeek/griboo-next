/**
 * Hand overlay functionality for whiteboard-style drawing animation.
 * Overlays a hand image that follows the stroke during animation.
 * Uses Canvas API for simple and efficient rendering.
 */

export type Point = [number, number];

// Import from centralized asset configuration
import { isDebugEnabled } from '../../shared/config/debug_config';
import { imageCache } from '../utils/image_cache';


/**
 * Handles loading and overlaying hand images for drawing animation.
 * Uses native Canvas API for rendering.
 */
export class HandOverlay {
    // Default URL removed - must be provided
    private handImageElement: HTMLImageElement | null = null;
    private _scale: number;
    private _offset: Point;
    private _anchorTopLeft: boolean = false;
    private _anchorPoint?: [number, number];
    private isImageLoaded: boolean = false;
    private loadPromise: Promise<void> | null = null;
    private currentImageUrl: string | null = null;
    // Cache for scaled dimensions to avoid recalculation on every frame
    private cachedWidth: number = 0;
    private cachedHeight: number = 0;

    /**
     * Initialize the hand overlay.
     * 
     * @param handImageUrl - URL to hand image (PNG with transparency). Defaults to internal hand image.
     * @param scale - Scale factor for the hand image (0.0-2.0)
     * @param offset - Offset [x, y] from the drawing point to position the hand tip
     */
    constructor(
        handImageUrl?: string,
        scale: number = 0.80,
        offset: Point = [-18, -20],
        anchorTopLeft: boolean = false,
        anchorPoint?: [number, number]
    ) {
        this._scale = scale;
        this._offset = offset;
        this._anchorTopLeft = anchorTopLeft;
        if (anchorPoint) this._anchorPoint = anchorPoint;

        if (handImageUrl) {
            this.loadPromise = this.loadImage(handImageUrl);
        } else {
            // If no image provided, we can't render passed hand.
            // We don't throw here to follow "fail fast" only on render or load wait?
            // Or maybe we should just not load anything.
            // Previously it fell back to default.
            if (isDebugEnabled()) {
                console.warn('[HandOverlay] No hand image URL provided.');
            }
        }
    }

    /**
     * Wait for the hand image to finish loading.
     */
    async waitForLoad(): Promise<void> {
        if (this.loadPromise) {
            await this.loadPromise;
        }
    }

    /**
     * Load the hand image from a URL using the shared ImageCache.
     */
    async loadImage(url: string): Promise<void> {
        this.currentImageUrl = url;

        try {
            this.handImageElement = await imageCache.getImage(url, async (imageUrl) => {
                // This loader is only called if NOT in cache
                if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
                    const { getGlobalCache } = await import('../utils/asset_cache');
                    const { fetchImage } = await import('../utils/http_loader');

                    const cache = getGlobalCache();
                    let blob = await cache.get(imageUrl);

                    if (!blob) {
                        blob = await fetchImage(imageUrl, { retries: 3, timeout: 30000 });
                        await cache.set(imageUrl, blob);
                    }

                    return new Promise((resolve, reject) => {
                        const img = new Image();
                        const objectUrl = URL.createObjectURL(blob);

                        img.onload = () => {
                            URL.revokeObjectURL(objectUrl);
                            resolve(img);
                        };

                        img.onerror = (error) => {
                            URL.revokeObjectURL(objectUrl);
                            reject(new Error(`Failed to decode image from blob: ${imageUrl}`));
                        };

                        img.src = objectUrl;
                    });
                }

                // Local path
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => resolve(img);
                    img.onerror = () => reject(new Error(`Failed to load local image: ${imageUrl}`));
                    img.src = imageUrl;
                });
            });

            this.isImageLoaded = true;
            this.updateCachedDimensions();
        } catch (error) {
            console.error(`[HandOverlay] Error loading hand image from ${url}:`, error);
            this.isImageLoaded = false;
        }
    }

    /**
     * Get the current scale factor.
     */
    get scale(): number {
        return this._scale;
    }

    /**
     * Set the scale factor.
     */
    set scale(value: number) {
        this._scale = Math.max(0.01, value);
        this.updateCachedDimensions();
    }

    /**
     * Update cached dimensions when scale or image changes
     * This avoids recalculating dimensions on every frame
     */
    private updateCachedDimensions(): void {
        if (this.handImageElement) {
            this.cachedWidth = this.handImageElement.width * this._scale;
            this.cachedHeight = this.handImageElement.height * this._scale;
        }
    }

    /**
     * Get the current offset.
     */
    get offset(): Point {
        return this._offset;
    }

    /**
     * Set the offset from drawing point.
     */
    set offset(value: Point) {
        this._offset = value;
    }

    /**
     * Check if hand image is loaded successfully.
     */
    get isLoaded(): boolean {
        return this.isImageLoaded && this.handImageElement !== null;
    }

    /**
     * Get the dimensions of the scaled hand image.
     */
    getDimensions(): { width: number; height: number } | null {
        if (this.handImageElement) {
            return {
                width: this.cachedWidth,
                height: this.cachedHeight
            };
        }
        return null;
    }

    /**
     * Draw the hand on a canvas context.
     * @param ctx - Canvas 2D context
     * @param x - Target X coordinate (pivot point)
     * @param y - Target Y coordinate (pivot point)
     * @param rotation - Final rotation of the hand in radians
     * @param renderScale - Additional scale multiplier (e.g. for viewport compensation)
     */
    public render(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        rotation: number = 0,
        renderScale: number = 1.0
    ): void {
        if (!this.isImageLoaded || !this.handImageElement) {
            return;
        }

        // Validate cached dimensions
        if (this.cachedWidth < 1 || this.cachedHeight < 1) {
            this.updateCachedDimensions();
            if (this.cachedWidth < 1 || this.cachedHeight < 1) return;
        }

        // Apply renderScale to dimensions (match server version)
        const drawWidth = this.cachedWidth * renderScale;
        const drawHeight = this.cachedHeight * renderScale;

        // Calculate hand position based on anchor settings and renderScale
        let handX: number;
        let handY: number;
        if (this._anchorPoint) {
            const ax = this._anchorPoint[0];
            const ay = this._anchorPoint[1];
            handX = Math.round(x - ax * drawWidth) + this._offset[0] * renderScale;
            handY = Math.round(y - ay * drawHeight) + this._offset[1] * renderScale;
        } else {
            handX = x + this._offset[0] * renderScale;
            handY = y + this._offset[1] * renderScale;
        }

        if (rotation !== 0) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);

            let drawX: number;
            let drawY: number;

            if (this._anchorPoint) {
                const ax = this._anchorPoint[0];
                const ay = this._anchorPoint[1];
                drawX = -ax * drawWidth + this._offset[0] * renderScale;
                drawY = -ay * drawHeight + this._offset[1] * renderScale;
            } else {
                drawX = this._offset[0] * renderScale;
                drawY = this._offset[1] * renderScale;
            }

            ctx.drawImage(
                this.handImageElement,
                drawX,
                drawY,
                drawWidth,
                drawHeight
            );
            ctx.restore();
        } else {
            ctx.drawImage(
                this.handImageElement,
                handX,
                handY,
                drawWidth,
                drawHeight
            );
        }
    }

    /**
     * Clean up resources and release references to shared images.
     */
    public dispose(): void {
        this.handImageElement = null;
        this.isImageLoaded = false;
        this.loadPromise = null;
        this.currentImageUrl = null;
    }

    /**
     * Get the rotation angle to point the hand toward a target point.
     * 
     * @param fromX - Starting X coordinate
     * @param fromY - Starting Y coordinate
     * @param toX - Target X coordinate
     * @param toY - Target Y coordinate
     * @returns Angle in radians
     */
    public static getAngleToPoint(
        fromX: number,
        fromY: number,
        toX: number,
        toY: number
    ): number {
        return Math.atan2(toY - fromY, toX - fromX);
    }
}
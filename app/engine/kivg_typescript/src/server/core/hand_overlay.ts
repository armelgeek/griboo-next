import { loadImage, Image, CanvasRenderingContext2D } from 'canvas';
import { BaseHandOverlay, HandOverlayOptions } from '../../shared/core/hand_overlay';
import { loadAssetFromPath, isHttpUrl } from '../utils/path_utils';

/**
 * Server-side implementation of HandOverlay using node-canvas.
 */
export class HandOverlay extends BaseHandOverlay {
    private handImageElement: Image | null = null;

    constructor(options: HandOverlayOptions = {}) {
        super(options);
        const imageUrl = options.imageUrl;
        // In server-side, we might need to handle local paths or URLs
        // For now, we assume the caller handles the path resolution if needed
    }

    /**
     * Load the hand image.
     * Uses caching for remote HTTP/HTTPS URLs to prevent crashes and improve performance.
     * @param source - Path or Buffer or URL
     */
    async load(source: string | Buffer): Promise<void> {
        try {
            // If source is a Buffer, load it directly
            if (Buffer.isBuffer(source)) {
                this.handImageElement = await loadImage(source);
                this.isImageLoaded = true;
                this.updateCachedDimensions();
                return;
            }

            // For HTTP/HTTPS URLs, use loadAssetFromPath which provides caching and retry logic
            if (isHttpUrl(source)) {
                const buffer = await loadAssetFromPath(source, 'image', { silentFailure: false });
                this.handImageElement = await loadImage(buffer);
                this.isImageLoaded = true;
                this.updateCachedDimensions();
                return;
            }

            // For local files, use loadImage directly
            this.handImageElement = await loadImage(source);
            this.isImageLoaded = true;
            this.updateCachedDimensions();
        } catch (error) {
            console.error(`[HandOverlay Server] Failed to load hand image:`, error);
            this.isImageLoaded = false;
        }
    }

    protected updateCachedDimensions(): void {
        if (this.handImageElement) {
            this.cachedWidth = this.handImageElement.width * this._scale;
            this.cachedHeight = this.handImageElement.height * this._scale;
        }
    }

    /**
     * Draw the hand on the canvas context.
     * @param renderScale - Optional additional scale multiplier (e.g. for viewport compensation or zoom)
     */
    render(ctx: CanvasRenderingContext2D, x: number, y: number, rotation: number = 0, renderScale: number = 1.0): void {
        if (!this.isLoaded || !this.handImageElement) {
            return;
        }

        if (this.cachedWidth < 1 || this.cachedHeight < 1) {
            this.updateCachedDimensions();
            if (this.cachedWidth < 1 || this.cachedHeight < 1) return;
        }

        const drawWidth = this.cachedWidth * renderScale;
        const drawHeight = this.cachedHeight * renderScale;


        if (rotation !== 0) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rotation);

            const { drawX, drawY } = this.calculateRelativeDrawPosition();

            ctx.drawImage(
                this.handImageElement as any, // Cast to any due to node-canvas/browser type mismatch
                drawX * renderScale,
                drawY * renderScale,
                drawWidth,
                drawHeight
            );
            ctx.restore();
        } else {
            const { handX, handY } = this.calculatePosition(x, y);

            // Since calculatePosition includes the offset (which is already scaled in the constructor logic usually),
            // and we want to draw at the final calculated position, but with the new dimensions.
            // Actually, calculatePosition uses this.cachedWidth/Height if anchorPoint is used.
            // Let's re-calculate it with renderScale to be safe.

            let finalHandX = handX;
            let finalHandY = handY;

            if (this._anchorPoint) {
                const ax = this._anchorPoint[0];
                const ay = this._anchorPoint[1];
                finalHandX = Math.round(x - ax * drawWidth) + this._offset[0] * renderScale;
                finalHandY = Math.round(y - ay * drawHeight) + this._offset[1] * renderScale;
            } else {
                finalHandX = x + this._offset[0] * renderScale;
                finalHandY = y + this._offset[1] * renderScale;
            }

            ctx.drawImage(
                this.handImageElement as any,
                finalHandX,
                finalHandY,
                drawWidth,
                drawHeight
            );
        }
    }
}

import { CanvasRenderingContext2D } from 'canvas';
import { ServerLayer } from '../core/layer';
import { EraserLayerConfig, WhiteboardConfig } from '../../shared/types';
import { EraserHandStrategy } from '../../shared/core/hand_overlay_manager';

/**
 * Server-side Eraser Layer
 * Clears content on the canvas using various patterns (horizontal, vertical, diagonal).
 */
export class ServerEraserLayer extends ServerLayer {
    private radius: number = 30;
    private pattern: 'diagonal' | 'horizontal' | 'vertical' = 'diagonal';

    constructor(config: EraserLayerConfig, handsConfig?: WhiteboardConfig['hands']) {
        super(config, handsConfig);
        this.radius = config.radius || 30;
        this.pattern = config.pattern || 'diagonal';

        if (this.handOverlayManager) {
            this.handOverlayManager.setStrategy(new EraserHandStrategy());
        }
    }

    async doRender(ctx: CanvasRenderingContext2D, time: number): Promise<void> {
        const progress = this.getAnimationProgress(time);

        ctx.save();
        // Use destination-out to erase content
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'black'; // Color doesn't matter for destination-out

        this.renderEraser(ctx, progress);
        ctx.restore();

        // Update hand position
        if (this.handOverlayManager && progress < 1.0) {
            const layerData = this.getLayerDataForHand(progress);
            this.currentHandPosition = this.handOverlayManager.calculateHandPosition(progress, layerData, (p) => this.transformToGlobalAnimated(p, time));
        } else if (this.handOverlayManager && progress >= 1.0) {
            this.currentHandPosition = null;
        }
    }

    /**
     * Render the eraser pattern based on progress
     */
    private renderEraser(ctx: CanvasRenderingContext2D, progress: number): void {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;

        if (this.pattern === 'horizontal') {
            const currentX = progress * w;
            ctx.beginPath();
            ctx.rect(0, 0, currentX, h);
            ctx.fill();
        } else if (this.pattern === 'vertical') {
            const currentY = progress * h;
            ctx.beginPath();
            ctx.rect(0, 0, w, currentY);
            ctx.fill();
        } else {
            // Diagonal pattern
            const total = w + h;
            const current = progress * total;

            ctx.beginPath();
            ctx.moveTo(0, 0);
            if (current <= w) {
                ctx.lineTo(current, 0);
                ctx.lineTo(0, current);
            } else if (current <= h) {
                ctx.lineTo(w, 0);
                ctx.lineTo(w, current - w);
                ctx.lineTo(0, current);
            } else {
                ctx.lineTo(w, 0);
                ctx.lineTo(w, h);
                ctx.lineTo(current - h, h);
                ctx.lineTo(0, current - w);
            }
            ctx.closePath();
            ctx.fill();
        }
    }

    protected getLayerDataForHand(progress: number): any {
        const w = this.config.width || 800; // Use config width or default
        const h = this.config.height || 600;

        let currentErasePosition = { x: 0, y: 0 };
        let nextErasePosition = null;

        if (this.pattern === 'horizontal') {
            currentErasePosition = { x: progress * w, y: h / 2 };
            nextErasePosition = { x: (progress + 0.01) * w, y: h / 2 };
        } else if (this.pattern === 'vertical') {
            currentErasePosition = { x: w / 2, y: progress * h };
            nextErasePosition = { x: w / 2, y: (progress + 0.01) * h };
        } else {
            const total = w + h;
            const current = progress * total;
            const next = (progress + 0.01) * total;
            currentErasePosition = { x: Math.min(w, current), y: Math.max(0, current - w) };
            nextErasePosition = { x: Math.min(w, next), y: Math.max(0, next - w) };
        }

        return {
            currentErasePosition,
            nextErasePosition
        };
    }
}

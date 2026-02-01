import { CanvasRenderingContext2D } from 'canvas';
import { ServerLayer } from '../core/layer';
import { PathLayerConfig, Coordinate, WhiteboardConfig } from '../../shared/types';
import { PathDrawingHandStrategy } from '../../shared/core/hand_overlay_manager';

/**
 * Server-side Path Layer
 * Renders freehand paths based on a list of points.
 */
export class ServerPathLayer extends ServerLayer {
    private points: Coordinate[] = [];
    private strokeColor: string = '#000000';
    private strokeWidth: number = 2;
    private lineCap: 'butt' | 'round' | 'square' = 'round';
    private lineJoin: 'miter' | 'round' | 'bevel' = 'round';

    constructor(config: PathLayerConfig, handsConfig?: WhiteboardConfig['hands']) {
        super(config, handsConfig);
        this.points = config.points || [];
        this.strokeColor = config.strokeColor || '#000000';
        this.strokeWidth = config.strokeWidth || 2;
        this.lineCap = config.lineCap || 'round';
        this.lineJoin = config.lineJoin || 'round';

        if (this.handOverlayManager) {
            this.handOverlayManager.setStrategy(new PathDrawingHandStrategy());
        }
    }

    async doRender(ctx: CanvasRenderingContext2D, time: number): Promise<void> {
        if (this.points.length < 2) return;

        const progress = this.getAnimationProgress(time);
        const animationType = this.config.entrance_animation?.type || 'draw';

        ctx.save();
        this.applyTransform(ctx, progress, time);

        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = this.strokeWidth;
        ctx.lineCap = this.lineCap;
        ctx.lineJoin = this.lineJoin;

        if (animationType === 'draw') {
            this.renderDraw(ctx, progress);

            // Update hand position
            if (this.handOverlayManager && progress < 1.0) {
                const pointCount = Math.max(0, Math.floor(progress * this.points.length));
                const currentPoint = this.points[Math.min(pointCount, this.points.length - 1)];
                const nextPoint = pointCount < this.points.length - 1 ? this.points[pointCount + 1] : null;

                this.currentHandPosition = this.handOverlayManager.calculateHandPosition(progress, {
                    currentPoint: { x: currentPoint[0], y: currentPoint[1] },
                    nextPoint: nextPoint ? { x: nextPoint[0], y: nextPoint[1] } : null
                }, (p) => this.transformToGlobalAnimated(p, time));
            } else if (this.handOverlayManager && progress >= 1.0) {
                this.currentHandPosition = null;
            }
        } else if (animationType === 'fade_in') {
            ctx.globalAlpha *= progress;
            this.drawPath(ctx, this.points.length);
        } else {
            this.drawPath(ctx, this.points.length);
        }

        ctx.restore();
    }

    /**
     * Draw the path up to a certain point index
     */
    private drawPath(ctx: CanvasRenderingContext2D, pointCount: number): void {
        if (pointCount < 2) return;

        ctx.beginPath();
        ctx.moveTo(this.points[0][0], this.points[0][1]);
        for (let i = 1; i < pointCount; i++) {
            ctx.lineTo(this.points[i][0], this.points[i][1]);
        }
        ctx.stroke();
    }

    /**
     * Render the path with a drawing animation
     */
    private renderDraw(ctx: CanvasRenderingContext2D, progress: number): void {
        const pointCount = Math.max(0, Math.floor(progress * this.points.length));
        if (pointCount < 2) return;

        this.drawPath(ctx, pointCount);
    }

    protected getLayerDataForHand(progress: number): any {
        const pointCount = Math.max(0, Math.floor(progress * this.points.length));
        if (this.points.length === 0) return null;

        const currentPoint = this.points[Math.min(pointCount, this.points.length - 1)];
        const nextPoint = pointCount < this.points.length - 1 ? this.points[pointCount + 1] : null;

        return {
            currentPoint,
            nextPoint
        };
    }

    /**
     * Render the path as a black mask for occlusion.
     * Renders the actual path with increased stroke width (dilation).
     */
    public async renderAsMask(ctx: CanvasRenderingContext2D, time: number, forceFull: boolean = false): Promise<void> {
        if (this.points.length < 2) {
            // Fallback to proxy if no points
            await super.renderAsMask(ctx, time, forceFull);
            return;
        }

        const progress = forceFull ? 1.0 : this.getAnimationProgress(time);
        const exitProgress = forceFull ? 0.0 : this.getExitProgress(time);

        // If the layer is not yet visible and we're not forcing full, nothing to mask
        if (!forceFull && !this.isVisible(time)) return;

        const animationType = this.config.entrance_animation?.type || 'draw';

        ctx.save();
        this.applyTransform(ctx, progress, time);

        // Apply reveal clipping if not forcing full
        const isReveal = !forceFull && animationType.startsWith('reveal_');
        if (isReveal) {
            const width = this.config.width || 0;
            const height = this.config.height || 0;
            ctx.beginPath();
            if (animationType === 'reveal_horizontal') {
                ctx.rect(0, 0, width * progress, height);
            } else if (animationType === 'reveal_vertical') {
                ctx.rect(0, 0, width, height * progress);
            } else if (animationType === 'reveal_diagonal') {
                const p = progress * 2;
                if (p <= 1) {
                    ctx.moveTo(0, 0);
                    ctx.lineTo(width * p, 0);
                    ctx.lineTo(0, height * p);
                } else {
                    const p2 = p - 1;
                    ctx.moveTo(0, 0);
                    ctx.lineTo(width, 0);
                    ctx.lineTo(width, height * p2);
                    ctx.lineTo(width * p2, height);
                    ctx.lineTo(0, height);
                }
            }
            ctx.closePath();
            ctx.clip();
        }

        // Dilation for soft edges (matching shape_layer and kivg_layer)
        const DILATION = 12;

        ctx.strokeStyle = 'black';
        ctx.lineWidth = this.strokeWidth + DILATION;
        ctx.lineCap = this.lineCap;
        ctx.lineJoin = this.lineJoin;

        if (!forceFull && animationType === 'draw' && progress < 1) {
            // Follow draw animation progress
            const pointCount = Math.max(2, Math.floor(progress * this.points.length));
            this.drawPathMask(ctx, pointCount);
        } else {
            // Full path
            this.drawPathMask(ctx, this.points.length);
        }

        ctx.restore();
    }

    /**
     * Draw the path as a mask up to a certain point index
     */
    private drawPathMask(ctx: CanvasRenderingContext2D, pointCount: number): void {
        if (pointCount < 2) return;

        ctx.beginPath();
        ctx.moveTo(this.points[0][0], this.points[0][1]);
        for (let i = 1; i < pointCount; i++) {
            ctx.lineTo(this.points[i][0], this.points[i][1]);
        }
        ctx.stroke();
    }
}

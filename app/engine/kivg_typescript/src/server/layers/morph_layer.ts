import { CanvasRenderingContext2D } from 'canvas';
import { ServerLayer } from '../core/layer';
import { MorphLayerConfig, WhiteboardConfig } from '../../shared/types';
import { PathDrawingHandStrategy } from '../../shared/core/hand_overlay_manager';
import { interpolatePath, Point } from '../../shared/graphics/path_utils';

/**
 * Server-side Morph Layer
 * Interpolates between two paths (fromPath to toPath) based on animation progress.
 */
export class ServerMorphLayer extends ServerLayer {
    private fromPath: { x: number; y: number }[];
    private toPath: { x: number; y: number }[];
    private strokeColor: string = '#000000';
    private fillColor: string = 'transparent';
    private strokeWidth: number = 2;

    constructor(config: MorphLayerConfig, handsConfig?: WhiteboardConfig['hands']) {
        super(config, handsConfig);
        this.fromPath = config.fromPath || [];
        this.toPath = config.toPath || [];
        this.strokeColor = config.strokeColor || '#000000';
        this.fillColor = config.fillColor || 'transparent';
        this.strokeWidth = config.strokeWidth || 2;

        if (this.handOverlayManager) {
            this.handOverlayManager.setStrategy(new PathDrawingHandStrategy());
        }
    }

    async doRender(ctx: CanvasRenderingContext2D, time: number): Promise<void> {
        if (this.fromPath.length === 0 || this.toPath.length === 0) return;

        const progress = this.getAnimationProgress(time);

        ctx.save();
        this.applyTransform(ctx, progress, time);

        ctx.strokeStyle = this.strokeColor;
        ctx.fillStyle = this.fillColor;
        ctx.lineWidth = this.strokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const currentPath = this.interpolatePaths(this.fromPath, this.toPath, progress);

        ctx.beginPath();
        if (currentPath.length > 0) {
            ctx.moveTo(currentPath[0].x, currentPath[0].y);
            for (let i = 1; i < currentPath.length; i++) {
                ctx.lineTo(currentPath[i].x, currentPath[i].y);
            }
        }

        if (this.fillColor !== 'transparent') {
            ctx.fill();
        }
        ctx.stroke();

        // Update hand position
        if (this.handOverlayManager && progress < 1) {
            const lastPoint = currentPath[currentPath.length - 1];

            // Calculate next point for rotation (using a small delta in progress)
            const nextProgress = Math.min(progress + 0.01, 1.0);
            const nextPath = this.interpolatePaths(this.fromPath, this.toPath, nextProgress);
            const nextPoint = nextPath[nextPath.length - 1];

            this.currentHandPosition = this.handOverlayManager.calculateHandPosition(progress, {
                currentPoint: { x: lastPoint.x, y: lastPoint.y },
                nextPoint: { x: nextPoint.x, y: nextPoint.y }
            }, (p) => this.transformToGlobalAnimated(p, time));
        } else if (this.handOverlayManager && progress >= 1.0) {
            this.currentHandPosition = null;
        }

        ctx.restore();
    }

    /**
     * Interpolate between two paths.
     * Normalizes both paths to the same number of points for smooth morphing.
     */
    private interpolatePaths(
        path1: { x: number; y: number }[],
        path2: { x: number; y: number }[],
        progress: number
    ): { x: number; y: number }[] {
        // Use a fixed number of points for normalization to ensure smoothness
        // or use the max length of the two paths.
        const numPoints = Math.max(path1.length, path2.length, 50);

        const pts1: Point[] = path1.map(p => [p.x, p.y]);
        const pts2: Point[] = path2.map(p => [p.x, p.y]);

        const norm1 = interpolatePath(pts1, numPoints);
        const norm2 = interpolatePath(pts2, numPoints);

        const result: { x: number; y: number }[] = [];

        for (let i = 0; i < numPoints; i++) {
            const p1 = norm1[i];
            const p2 = norm2[i];

            result.push({
                x: p1[0] * (1 - progress) + p2[0] * progress,
                y: p1[1] * (1 - progress) + p2[1] * progress
            });
        }

        return result;
    }

    /**
     * Render the morph layer as a black mask for occlusion.
     * Renders the interpolated path with increased stroke width (dilation).
     */
    public async renderAsMask(ctx: CanvasRenderingContext2D, time: number, forceFull: boolean = false): Promise<void> {
        if (this.fromPath.length === 0 || this.toPath.length === 0) {
            // Fallback to proxy if no paths
            await super.renderAsMask(ctx, time, forceFull);
            return;
        }

        const progress = forceFull ? 1 : this.getAnimationProgress(time);

        ctx.save();
        this.applyTransform(ctx, progress, time);

        // Dilation for soft edges
        const DILATION = 8;

        const currentPath = this.interpolatePaths(this.fromPath, this.toPath, progress);

        ctx.strokeStyle = 'black';
        ctx.fillStyle = 'black';
        ctx.lineWidth = this.strokeWidth + DILATION;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        if (currentPath.length > 0) {
            ctx.moveTo(currentPath[0].x, currentPath[0].y);
            for (let i = 1; i < currentPath.length; i++) {
                ctx.lineTo(currentPath[i].x, currentPath[i].y);
            }
            ctx.closePath();
        }

        // Fill and stroke for complete coverage
        if (this.fillColor !== 'transparent') {
            ctx.fill();
        }
        ctx.stroke();

        ctx.restore();
    }

}

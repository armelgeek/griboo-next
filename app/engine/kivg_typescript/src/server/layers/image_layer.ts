import { CanvasRenderingContext2D, loadImage } from 'canvas';
import { ServerLayer } from '../core/layer';
import { LayerConfig, HybridImageConfig, WhiteboardConfig } from '../../shared/types';
import { HybridImageAnimator } from '../animators/hybrid_animator';
import { PathDrawingHandStrategy } from '../../shared/core/hand_overlay_manager';
import { resolveAssetPath, loadAssetFromPath } from '../utils/path_utils';
import { Logger } from '../../shared/infra/logger';

export class ServerImageLayer extends ServerLayer {
    private animator: HybridImageAnimator;
    private hybridConfig: HybridImageConfig;

    constructor(config: LayerConfig, handsConfig?: WhiteboardConfig['hands']) {
        super(config, handsConfig);

        // Extract hybrid-specific config or use defaults
        const specificConfig = (config as any).hybridConfig || {};

        this.hybridConfig = {
            width: config.width || 800,
            height: config.height || 600,
            ...specificConfig
        };

        this.animator = new HybridImageAnimator(this.hybridConfig);

        // Configure hand strategy if hand overlay is enabled
        if (this.handOverlayManager) {
            this.handOverlayManager.setStrategy(new PathDrawingHandStrategy());
        }
    }



    protected async doPrepare(): Promise<void> {
        await super.doPrepare();

        const imageUrl = (this.config as any).imageUrl;
        if (imageUrl) {
            try {
                const resolvedPath = resolveAssetPath(imageUrl);
                const buffer = await loadAssetFromPath(resolvedPath, 'image');
                if (buffer) {
                    await this.animator.loadImage(buffer);
                }
            } catch (error) {
                Logger.error(`ServerImageLayer: Failed to load image ${imageUrl}, using fallback`, error);
                // loadAssetFromPath already handles default fallback if not provided, 
                // but we might want to ensure it's loaded here if it failed.
            }
        } else {
            Logger.warn('ServerImageLayer: No imageUrl provided in config');
        }
    }

    async doRender(ctx: CanvasRenderingContext2D, time: number): Promise<void> {

        const progress = this.getAnimationProgress(time);

        ctx.save();
        this.applyTransform(ctx, progress, time);

        // Render the hybrid frame
        // Note: HybridImageAnimator returns a buffer or ImageData. 
        // Since we are in the same process, we might get a buffer.
        const frame = this.animator.renderFrame(progress);

        if (frame.imageData) {
            const img = await loadImage(frame.imageData);
            const width = this.config.width || img.width;
            const height = this.config.height || img.height;

            if (this.isCentered()) {
                ctx.drawImage(img, -width / 2, -height / 2, width, height);
            } else {
                ctx.drawImage(img, 0, 0, width, height);
            }
        }

        // Update hand position with rotation calculation using strategy
        if (this.handOverlayManager && frame.handPosition) {
            const [x, y] = frame.handPosition;

            let px = x;
            let py = y;

            // Use strategy to calculate position, applying global transform
            const handPos = this.handOverlayManager.calculateHandPosition(progress, {
                currentPoint: { x: px, y: py }
            }, (p) => this.transformToGlobalAnimated(p, time));

            this.currentHandPosition = handPos;
        }
        ctx.restore();
    }

    /**
     * Render the hybrid layer as a black mask for occlusion.
     * Uses a filled rectangle with dilation for the mask.
     */
    public async renderAsMask(ctx: CanvasRenderingContext2D, time: number, forceFull: boolean = false): Promise<void> {
        const progress = forceFull ? 1 : this.getAnimationProgress(time);

        ctx.save();
        this.applyTransform(ctx, progress, time);

        // Render the hybrid frame's mask as a filled rectangle
        const frame = this.animator.renderFrame(progress);

        // Dilation for soft edges
        const DILATION = 8;

        if (frame.imageData) {
            const img = await loadImage(frame.imageData);
            const width = this.config.width || img.width;
            const height = this.config.height || img.height;

            // Use shadowBlur for dilation to provide soft edges for the mask
            ctx.shadowColor = 'black';
            ctx.shadowBlur = DILATION;

            // Draw the actual revealed image as the mask
            if (this.isCentered()) {
                ctx.drawImage(img, -width / 2, -height / 2, width, height);
            } else {
                ctx.drawImage(img, 0, 0, width, height);
            }
        } else {
            // Fallback to proxy-based mask
            await super.renderAsMask(ctx, time, forceFull);
        }

        ctx.restore();
    }

}

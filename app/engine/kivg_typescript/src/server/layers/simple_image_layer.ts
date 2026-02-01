import { CanvasRenderingContext2D, loadImage, Image } from 'canvas';
import { ServerLayer } from '../core/layer';
import { LayerConfig, WhiteboardConfig } from '../../shared/types';
import { resolveAssetPath, loadAssetFromPath } from '../utils/path_utils';
import { DefaultHandStrategy, RevealHandStrategy } from '../../shared/core/hand_overlay_manager';
import { Logger } from '../../shared/infra/logger';

export class ServerSimpleImageLayer extends ServerLayer {
    private image: Image | null = null;

    constructor(config: LayerConfig, handsConfig?: WhiteboardConfig['hands']) {
        super(config, handsConfig);

        if (this.handOverlayManager) {
            this.handOverlayManager.setStrategy(new DefaultHandStrategy());
        }
    }

    protected async doPrepare(): Promise<void> {
        await super.doPrepare();

        const imageUrl = (this.config as any).imageUrl;
        const imageData = (this.config as any).imageData;

        if (imageUrl) {
            try {
                const resolvedPath = resolveAssetPath(imageUrl);
                const buffer = await loadAssetFromPath(resolvedPath, 'image');
                if (buffer) {
                    this.image = await loadImage(buffer);
                }
            } catch (error) {
                Logger.error(`ServerSimpleImageLayer: Failed to load image ${imageUrl}`, error);
            }
        } else if (imageData) {
            // Handle ImageData if provided (though usually it's a URL on server)
            // For now, we assume imageUrl is the primary source
        }
    }

    async doRender(ctx: CanvasRenderingContext2D, time: number): Promise<void> {
        if (!this.image) return;

        const progress = this.getAnimationProgress(time);

        ctx.save();
        this.applyTransform(ctx, progress, time);

        const width = this.config.width || this.image.width;
        const height = this.config.height || this.image.height;

        // Simple fade in for now, can be expanded based on animation type
        const animationType = this.config.entrance_animation?.type || 'fade_in';

        if (animationType === 'fade_in') {
            ctx.globalAlpha *= progress;
        }

        const isReveal = animationType.startsWith('reveal_');
        if (isReveal) {
            ctx.beginPath();
            if (animationType === 'reveal_horizontal') {
                ctx.rect(0, 0, width * progress, height);
            } else if (animationType === 'reveal_vertical') {
                ctx.rect(0, 0, width, height * progress);
            } else if (animationType === 'reveal_diagonal') {
                // Diagonal reveal from top-left to bottom-right
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

        // Always render from top-left (0,0) to match frontend behavior
        // Frontend ImageLayer renders an SVG image element which defaults to x=0, y=0
        ctx.drawImage(this.image, 0, 0, width, height);

        // Render hand if enabled and animation is in progress
        if (this.handOverlayManager && progress > 0 && progress < 1) {
            let px = width / 2;
            let py = height / 2;

            // For reveal animations, use RevealHandStrategy with proxy
            if (animationType.startsWith('reveal_')) {
                // Temporarily switch to RevealHandStrategy
                const originalStrategy = this.handOverlayManager.getStrategy();
                this.handOverlayManager.setStrategy(new RevealHandStrategy());

                // For reveal animations, the hand should follow the reveal edge
                // Calculate the effective revealed bounds based on progress
                let effectiveWidth = width;
                let effectiveHeight = height;

                if (animationType === 'reveal_horizontal') {
                    effectiveWidth = width * progress;
                } else if (animationType === 'reveal_vertical') {
                    effectiveHeight = height * progress;
                } else if (animationType === 'reveal_diagonal') {
                    // For diagonal, both dimensions are affected by progress
                    // The revealed area grows as a triangle/polygon
                    const p = progress * 2;
                    if (p <= 1) {
                        effectiveWidth = width * p;
                        effectiveHeight = height * p;
                    } else {
                        effectiveWidth = width;
                        effectiveHeight = height;
                    }
                }

                // Create a proxy representing the currently revealed area bounds
                const proxy: { left: number; top: number; width: number; height: number; x: number; y: number; type: 'rect' } = {
                    left: 0,
                    top: 0,
                    width: effectiveWidth,
                    height: effectiveHeight,
                    x: 0,
                    y: 0,
                    type: 'rect' as const
                };

                // Add progress > 0 and progress < 1 checks before setting currentHandPosition.
                if (progress > 0 && progress < 1) {
                    this.currentHandPosition = this.handOverlayManager.getHandPosition(progress, {
                        proxy,
                        revealPattern: animationType === 'reveal_horizontal' ? 'horizontal' :
                            animationType === 'reveal_vertical' ? 'vertical' : 'diagonal',
                        isGlobalProxy: false
                    }, (p) => this.transformToGlobalAnimated(p, time));
                }

                // Restore original strategy
                if (originalStrategy) {
                    this.handOverlayManager.setStrategy(originalStrategy);
                }
            } else {
                // For non-reveal animations, use currentPoint approach
                this.currentHandPosition = this.handOverlayManager.getHandPosition(progress, {
                    currentPoint: { x: px, y: py }
                }, (p) => this.transformToGlobalAnimated(p, time));
            }
        }

        ctx.restore();
    }

    /**
     * Render the image as a black mask for occlusion.
     * Renders a filled rectangle representing the image bounds with dilation.
     */
    public async renderAsMask(ctx: CanvasRenderingContext2D, time: number, forceFull: boolean = false): Promise<void> {
        if (!this.image) {
            // Fallback to proxy-based mask if image not loaded
            await super.renderAsMask(ctx, time, forceFull);
            return;
        }

        const progress = forceFull ? 1.0 : this.getAnimationProgress(time);
        const exitProgress = forceFull ? 0.0 : this.getExitProgress(time);

        // If the layer is not yet visible and we're not forcing full, nothing to mask
        if (!forceFull && !this.isVisible(time)) return;

        ctx.save();
        this.applyTransform(ctx, progress, time);

        const width = this.config.width || this.image.width;
        const height = this.config.height || this.image.height;

        // Apply reveal clipping if not forcing full
        const animationType = this.config.entrance_animation?.type || 'fade_in';
        const isReveal = !forceFull && animationType.startsWith('reveal_');

        if (isReveal) {
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
        ctx.shadowColor = 'black';
        ctx.shadowBlur = DILATION;

        if (this.isCentered()) {
            ctx.drawImage(this.image, -width / 2, -height / 2, width, height);
        } else {
            ctx.drawImage(this.image, 0, 0, width, height);
        }

        ctx.restore();
    }
}

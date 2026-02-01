import { CanvasRenderingContext2D, loadImage, Image } from 'canvas';
import { ServerLayer } from '../core/layer';
import { LayerConfig, PushLayerConfig, Coordinate, WhiteboardConfig } from '../../shared/types';
import { applyPushEasing } from '../../shared/core/push';
import { resolveAssetPath, loadAssetFromPath } from '../utils/path_utils';

export const DEFAULT_HAND_OFFSET: [number, number] = [-100, -80];

export class ServerPushLayer extends ServerLayer {
    private image: Image | null = null;
    private pushConfig: PushLayerConfig;

    private hasManualStartPosition: boolean = false;

    constructor(config: LayerConfig, handsConfig?: WhiteboardConfig['hands']) {
        super(config, handsConfig);
        this.pushConfig = (config as any).pushConfig || {};

        // Track if start position was manually provided
        this.hasManualStartPosition = !!this.pushConfig.startPosition;

        // Resolve end position: use config.position if endPosition is not provided
        if (!this.pushConfig.endPosition && config.position) {
            this.pushConfig.endPosition = [config.position.x, config.position.y];

            // Reset layer position to 0,0 to avoid double transformation
            // since we'll be moving the image element within the group
            // This also aligns logging with the frontend.
            this.config.position = { x: 0, y: 0 };
        }

        // Resolve start position: calculate from 'from' if startPosition is not provided
        // NOTE: We defer recalculateStartPosition to doRender() or first use to give time for
        // cameraTransform to be set by the scene.
    }

    private recalculateStartPosition(): void {
        if (!this.pushConfig.endPosition) return;

        const from = this.pushConfig.from || 'left';
        const [endX, endY] = this.pushConfig.endPosition;
        const width = this.pushConfig.width || 200;
        const height = this.pushConfig.height || 200;

        // Use camera viewport if available, otherwise fallback to canvas dimensions
        let viewport = {
            left: 0,
            top: 0,
            right: this.pushConfig.canvasWidth || 1920,
            bottom: this.pushConfig.canvasHeight || 1080
        };
        //console.log('camera', this.cameraTransform)
        if (this.cameraTransform) {
            const { zoom, position, virtualSize } = this.cameraTransform;
            const viewW = virtualSize.width / zoom;
            const viewH = virtualSize.height / zoom;
            viewport = {
                left: virtualSize.width * position.x - viewW / 2,
                top: virtualSize.height * position.y - viewH / 2,
                right: virtualSize.width * position.x + viewW / 2,
                bottom: virtualSize.height * position.y + viewH / 2
            };
        }
        //console.log('viewport', viewport);

        // Performance: Use a small buffer (50px) outside the visible viewport
        const BUFFER = 50;

        switch (from) {
            case 'left':
                this.pushConfig.startPosition = [viewport.left - width - BUFFER, endY];
                break;
            case 'right':
                this.pushConfig.startPosition = [viewport.right + BUFFER, endY];
                break;
            case 'top':
                this.pushConfig.startPosition = [endX, viewport.top - height - BUFFER];
                break;
            case 'bottom':
                this.pushConfig.startPosition = [endX, viewport.bottom + BUFFER];
                break;
            default:
                this.pushConfig.startPosition = [viewport.left - width - BUFFER, endY];
        }
    }

    /**
     * Set the camera transform and recalculate start position if it hasn't been manually set
     */
    setCameraTransform(zoom: number, position: { x: number; y: number }, virtualSize: { width: number; height: number }): void {
        super.setCameraTransform(zoom, position, virtualSize);

        // If startPosition was not manually provided, recalculate it based on the new camera view
        // This ensures the object always starts from just outside the visible area
        if (!this.hasManualStartPosition) {
            this.recalculateStartPosition();
        }
    }

    protected async doPrepare(): Promise<void> {
        await super.doPrepare();

        if (this.handOverlayManager) {
            const { PushHandStrategy } = require('../../shared/core/hand_overlay_manager');
            this.handOverlayManager.setStrategy(new PushHandStrategy());
        }

        const imageUrl = this.pushConfig.imageUrl;
        if (imageUrl) {
            const resolvedPath = resolveAssetPath(imageUrl);
            const buffer = await loadAssetFromPath(resolvedPath, 'image');
            this.image = await loadImage(buffer);
        }
    }

    // Settle ratio (20%) to ensure last part of animation is fully visible before resolving
    // Must match frontend/whiteboard/push-layer.ts
    private static readonly SETTLE_RATIO = 0.2;

    async doRender(ctx: CanvasRenderingContext2D, time: number): Promise<void> {
        if (!this.image) return;

        const progress = this.getAnimationProgress(time);
        const animType = this.getAnimationType();

        ctx.save();

        if (animType === 'push') {
            // Ensure startPosition is calculated (lazy init)
            if (!this.hasManualStartPosition && !this.pushConfig.startPosition) {
                this.recalculateStartPosition();
            }

            const startPos = this.pushConfig.startPosition || [0, 0];
            const endPos = this.pushConfig.endPosition || [0, 0];
            const easing = this.pushConfig.pushEasing || 'out_cubic';

            // Apply settle ratio logic to match frontend
            // Effective duration for push is total duration minus settle time
            // So we map progress [0, 1] to [0, 1 / (1 - SETTLE_RATIO)] and clamp at 1
            const effectiveProgress = Math.min(1, progress / (1 - ServerPushLayer.SETTLE_RATIO));

            // Apply easing to effective progress
            const easedProgress = applyPushEasing(effectiveProgress, easing);

            // Interpolate position
            const x = startPos[0] + (endPos[0] - startPos[0]) * easedProgress;
            const y = startPos[1] + (endPos[1] - startPos[1]) * easedProgress;

            const width = this.pushConfig.width || this.config.width || this.image.width;
            const height = this.pushConfig.height || this.config.height || this.image.height;
            // Apply global opacity and other transforms if any (though push usually overrides position)
            ctx.globalAlpha *= (this.config.opacity ?? 1);

            // Render the image at the calculated position
            ctx.drawImage(this.image, x, y, width, height);

        } else {
            // Fallback to standard transform for non-push animations
            this.applyTransform(ctx, progress, time);
            const width = this.config.width || this.image.width;
            const height = this.config.height || this.image.height;

            if (this.isCentered()) {
                ctx.drawImage(this.image, -width / 2, -height / 2, width, height);
            } else {
                ctx.drawImage(this.image, 0, 0, width, height);
            }
        }

        ctx.restore();
    }

    /**
     * Render as mask for occlusion.
     */
    public async renderAsMask(ctx: CanvasRenderingContext2D, time: number, forceFull: boolean = false): Promise<void> {
        if (!this.image) {
            await super.renderAsMask(ctx, time, forceFull);
            return;
        }

        const progress = forceFull ? 1 : this.getAnimationProgress(time);
        const animType = this.getAnimationType();

        ctx.save();
        ctx.fillStyle = 'black';

        const DILATION = 8;

        if (animType === 'push') {
            // Ensure startPosition is calculated (lazy init)
            if (!this.hasManualStartPosition && !this.pushConfig.startPosition) {
                this.recalculateStartPosition();
            }

            const startPos = this.pushConfig.startPosition || [0, 0];
            const endPos = this.pushConfig.endPosition || [0, 0];
            const easing = this.pushConfig.pushEasing || 'out_cubic';

            // Apply settle ratio logic
            const effectiveProgress = Math.min(1, progress / (1 - ServerPushLayer.SETTLE_RATIO));
            const easedProgress = applyPushEasing(effectiveProgress, easing);

            const x = startPos[0] + (endPos[0] - startPos[0]) * easedProgress;
            const y = startPos[1] + (endPos[1] - startPos[1]) * easedProgress;
            const width = this.pushConfig.width || this.config.width || this.image.width;
            const height = this.pushConfig.height || this.config.height || this.image.height;

            ctx.fillRect(x - DILATION / 2, y - DILATION / 2, width + DILATION, height + DILATION);
        } else {
            this.applyTransform(ctx, progress, time);
            const width = this.config.width || this.image.width;
            const height = this.config.height || this.image.height;

            if (this.isCentered()) {
                ctx.fillRect(-width / 2 - DILATION / 2, -height / 2 - DILATION / 2, width + DILATION, height + DILATION);
            } else {
                ctx.fillRect(-DILATION / 2, -DILATION / 2, width + DILATION, height + DILATION);
            }
        }

        ctx.restore();
    }
    /**
     * Get the current position of the push layer.
     * Overridden to account for the push animation which overrides the standard transform.
     */
    public getCurrentPosition(time: number): { x: number, y: number } {
        const progress = this.getAnimationProgress(time);
        const animType = this.getAnimationType();

        if (animType === 'push' && progress > 0) {
            // Ensure startPosition is calculated (lazy init)
            if (!this.hasManualStartPosition && !this.pushConfig.startPosition) {
                this.recalculateStartPosition();
            }

            const startPos = this.pushConfig.startPosition || [0, 0];
            const endPos = this.pushConfig.endPosition || [0, 0];
            const easing = this.pushConfig.pushEasing || 'out_cubic';

            // Apply settle ratio logic
            const effectiveProgress = Math.min(1, progress / (1 - ServerPushLayer.SETTLE_RATIO));
            const easedProgress = applyPushEasing(effectiveProgress, easing);

            return {
                x: startPos[0] + (endPos[0] - startPos[0]) * easedProgress,
                y: startPos[1] + (endPos[1] - startPos[1]) * easedProgress
            };
        }

        return super.getCurrentPosition(time);
    }

    protected getDefaultHandPreset(): string | undefined {
        return 'push';
    }


    protected getLayerDataForHand(progress: number): any {
        const effectiveProgress = Math.min(1.0, progress / (1.0 - ServerPushLayer.SETTLE_RATIO));
        const easing = this.pushConfig.pushEasing || 'out_cubic';
        const tEased = applyPushEasing(effectiveProgress, easing);

        if (!this.pushConfig.startPosition) {
            this.recalculateStartPosition();
        }

        const startPos = this.pushConfig.startPosition || [0, 0];
        const endPos = this.pushConfig.endPosition || [0, 0];

        const x = startPos[0] + (endPos[0] - startPos[0]) * tEased;
        const y = startPos[1] + (endPos[1] - startPos[1]) * tEased;

        return {
            currentObjectPosition: { x: x, y: y }
        };
    }
}

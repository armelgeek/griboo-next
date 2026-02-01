import { createCanvas, loadImage, Canvas, CanvasRenderingContext2D, Image } from 'canvas';
import { HybridImageAnimator } from './hybrid_animator';
import { HandOverlayManager } from '../core/hand_overlay_manager';
import { PathDrawingHandStrategy } from '../../shared/core/hand_overlay_manager';
import {
    HybridImageConfig,
    HybridFrame,
    Coordinate,
    RGBA
} from '../../shared/types';

/**
 * Server-side Hybrid Layer Animator
 * 
 * High-level controller for hybrid animations on the server.
 * Handles image loading, pre-processing, and frame-by-frame rendering.
 */
export class HybridLayerAnimator {
    private animator: HybridImageAnimator;
    private config: HybridImageConfig;
    private handOverlayManager: HandOverlayManager | null = null;
    private isPrepared: boolean = false;

    constructor(config: HybridImageConfig) {
        this.config = config;
        this.animator = new HybridImageAnimator(config);

        if (this.config.handOverlay?.enabled) {
            this.handOverlayManager = new HandOverlayManager(this.config.handOverlay);
            this.handOverlayManager.setStrategy(new PathDrawingHandStrategy());
        }
    }

    /**
     * Prepare the animator by loading and processing the image
     */
    async prepare(imageSource: string | Buffer): Promise<void> {
        console.log('  🔄 Preparing Hybrid Layer Animator...');

        // Load main image
        await this.animator.loadImage(imageSource);

        // Load hand image if enabled
        if (this.handOverlayManager && this.config.handOverlay) {
            await this.handOverlayManager.initialize(this.config.handOverlay);
            console.log('    ✅ Hand overlay prepared');
        }

        this.isPrepared = true;
        console.log('  ✅ Hybrid Layer Animator prepared');
    }

    /**
     * Render a frame at a specific progress (0.0 to 1.0)
     * Returns a Buffer containing the PNG data
     */
    async renderFrame(progress: number): Promise<Buffer> {
        if (!this.isPrepared) {
            throw new Error('Animator not prepared. Call prepare() first.');
        }

        // Get the base frame from the animator
        const frame = this.animator.renderFrame(progress);

        // Create a canvas to composite the frame and hand overlay
        const canvas = createCanvas(this.config.width, this.config.height);
        const ctx = canvas.getContext('2d');

        // Draw the base frame
        const frameImage = await loadImage(frame.imageData);
        ctx.drawImage(frameImage, 0, 0);

        // Draw hand overlay if enabled
        if (this.handOverlayManager && frame.handPosition) {
            const [x, y] = frame.handPosition;
            this.handOverlayManager.renderHand(ctx, progress, { currentPoint: { x, y } });
        }

        return canvas.toBuffer('image/png');
    }

    /**
     * Get total number of strokes
     */
    getStrokeCount(): number {
        return this.animator.getStrokeCount();
    }

    /**
     * Get total number of color regions
     */
    getColorRegionCount(): number {
        return this.animator.getColorRegionCount();
    }
}

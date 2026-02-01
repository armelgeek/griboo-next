import { CanvasRenderingContext2D } from 'canvas';
import { ServerLayer } from '../core/layer';
import { LayerConfig, WhiteboardConfig } from '../../shared/types';
import { ServerOcclusionManager } from '../core/occlusion_manager';

/**
 * Server-side OcclusionLayer
 * A meta-layer that handles occlusion culling and erase animations.
 * 
 * On the frontend, this is used to manage erase animations before revealing layers.
 * On the server, we use this to handle similar occlusion effects during rendering.
 * 
 * Note: This is primarily used internally by the rendering system and typically
 * not directly instantiated by users.
 */
export class ServerOcclusionLayer extends ServerLayer {
    private targetLayerId: string;
    private eraseDuration: number;

    constructor(config: LayerConfig & { targetLayerId?: string; eraseDuration?: number }, handsConfig?: WhiteboardConfig['hands']) {
        super(config, handsConfig);
        this.targetLayerId = config.targetLayerId || '';
        this.eraseDuration = config.eraseDuration || 1000;
    }

    /**
     * OcclusionLayer doesn't render visible content itself.
     * It manages the occlusion state for other layers.
     */
    async doRender(ctx: CanvasRenderingContext2D, time: number): Promise<void> {
        // Occlusion layer is a meta-layer and doesn't render visible content
        // The actual occlusion culling is handled by ServerOcclusionManager
        // during scene composition
    }

    /**
     * Get the target layer ID that this occlusion layer affects
     */
    public getTargetLayerId(): string {
        return this.targetLayerId;
    }

    /**
     * Get the erase duration for this occlusion layer
     */
    public getEraseDuration(): number {
        return this.eraseDuration;
    }

    /**
     * Render the occlusion mask (used by the occlusion system)
     * This creates a mask that defines what should be erased
     */
    public async renderAsMask(ctx: CanvasRenderingContext2D, time: number, forceFull: boolean = false): Promise<void> {
        const progress = forceFull ? 1 : this.getAnimationProgress(time);

        ctx.save();
        ctx.fillStyle = 'black';

        // Render a simple rectangular mask based on layer dimensions
        const width = this.config.width || 800;
        const height = this.config.height || 600;
        const x = this.config.position?.x || 0;
        const y = this.config.position?.y || 0;

        // Scale the mask based on animation progress
        const currentWidth = width * progress;
        const currentHeight = height * progress;

        ctx.fillRect(x, y, currentWidth, currentHeight);

        ctx.restore();
    }
}

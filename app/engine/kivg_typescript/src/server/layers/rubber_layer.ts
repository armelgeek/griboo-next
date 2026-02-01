import { CanvasRenderingContext2D } from 'canvas';
import { ServerEraserLayer } from './eraser_layer';
import { LayerConfig, WhiteboardConfig } from '../../shared/types';

/**
 * Server-side RubberLayer
 * Provides rubber erasing functionality similar to the frontend RubberLayer.
 * Internally uses ServerEraserLayer functionality for canvas-based erasing.
 * 
 * Note: The frontend RubberLayer performs direct pixel manipulation on ImageData.
 * On the server, we use canvas compositing operations for performance.
 */
export interface RubberLayerConfig {
    /** Eraser radius */
    radius?: number;
    /** Eraser shape */
    shape?: 'circle' | 'square';
    /** Background color for erasing */
    backgroundColor?: [number, number, number];
    /** Softness (0-1) for smooth edges */
    softness?: number;
    /** Erase pattern */
    pattern?: 'diagonal' | 'horizontal' | 'vertical';
}

export class ServerRubberLayer extends ServerEraserLayer {
    private rubberConfig: RubberLayerConfig;

    constructor(config: LayerConfig & { rubberConfig?: RubberLayerConfig }, handsConfig?: WhiteboardConfig['hands']) {
        // Transform rubberConfig to eraserConfig format
        const rubberConfig = config.rubberConfig || {} as RubberLayerConfig;
        
        const transformedConfig = {
            ...config,
            radius: rubberConfig.radius || 20,
            pattern: rubberConfig.pattern || 'diagonal'
        };

        super(transformedConfig, handsConfig);
        this.rubberConfig = {
            radius: 20,
            shape: 'circle',
            backgroundColor: [255, 255, 255],
            softness: 0,
            ...rubberConfig
        };
    }

    /**
     * Override doRender to apply rubber-specific rendering
     * Uses softer edges if softness is specified
     */
    async doRender(ctx: CanvasRenderingContext2D, time: number): Promise<void> {
        const progress = this.getAnimationProgress(time);

        ctx.save();
        
        // Apply softness via shadow blur if specified
        if (this.rubberConfig.softness && this.rubberConfig.softness > 0) {
            ctx.shadowBlur = this.rubberConfig.softness * 20;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        }

        // Use destination-out for erasing
        ctx.globalCompositeOperation = 'destination-out';
        
        // For rubber, we want to erase with the specified shape
        if (this.rubberConfig.shape === 'circle') {
            this.renderCircleEraser(ctx, progress);
        } else {
            this.renderSquareEraser(ctx, progress);
        }

        ctx.restore();

        // Update hand position
        if (this.handOverlayManager && progress < 1.0) {
            const layerData = this.getLayerDataForHand(progress);
            this.currentHandPosition = this.handOverlayManager.calculateHandPosition(
                progress, 
                layerData, 
                (p) => this.transformToGlobalAnimated(p, time)
            );
        } else if (this.handOverlayManager && progress >= 1.0) {
            this.currentHandPosition = null;
        }
    }

    /**
     * Render circular eraser along the path
     */
    private renderCircleEraser(ctx: CanvasRenderingContext2D, progress: number): void {
        const w = this.config.width || 800;
        const h = this.config.height || 600;
        const radius = this.rubberConfig.radius || 20;

        // Simple diagonal sweep with circles
        const total = w + h;
        const current = progress * total;
        
        ctx.fillStyle = 'black'; // Color doesn't matter for destination-out

        // Draw multiple circles along the diagonal for smooth erasing
        const step = radius / 2;
        for (let d = 0; d <= current; d += step) {
            let x, y;
            if (d <= w) {
                x = d;
                y = 0;
            } else {
                x = w;
                y = d - w;
            }
            
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /**
     * Render square eraser along the path
     */
    private renderSquareEraser(ctx: CanvasRenderingContext2D, progress: number): void {
        const w = this.config.width || 800;
        const h = this.config.height || 600;
        const size = (this.rubberConfig.radius || 20) * 2;

        // Simple diagonal sweep with squares
        const total = w + h;
        const current = progress * total;
        
        ctx.fillStyle = 'black'; // Color doesn't matter for destination-out

        // Draw multiple squares along the diagonal for smooth erasing
        const step = size / 2;
        for (let d = 0; d <= current; d += step) {
            let x, y;
            if (d <= w) {
                x = d;
                y = 0;
            } else {
                x = w;
                y = d - w;
            }
            
            ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
    }
}

import { Layer } from '../layer';
import { LayerConfig } from '../types';
import { OcclusionCullingManager } from '../managers/occlusion-culling';

/**
 * OcclusionLayer - An internal meta-layer that handles the erase animation
 * before a target layer is revealed.
 */
export class OcclusionLayer extends Layer {
    private targetLayerId: string;
    private manager: OcclusionCullingManager;

    // Smart Seek: Track last progress for this occlusion layer
    // Inherited from Layer: protected lastSeekProgress: number | null = null;

    constructor(targetLayerId: string, manager: OcclusionCullingManager, duration: number) {
        // Create a minimal config for the base Layer class
        const config: LayerConfig = {
            id: `occlusion-${targetLayerId}`,
            entrance_animation: {
                type: 'none', // We override playEntranceAnimation
                duration: duration
            },
            position: { x: 0, y: 0 },
            opacity: 1
        };

        super(config);
        this.targetLayerId = targetLayerId;
        this.manager = manager;
    }

    public getTargetLayerId(): string {
        return this.targetLayerId;
    }

    /**
     * OcclusionLayer has no visual content of its own.
     */
    render(): SVGElement {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('id', this.config.id);
        g.style.display = 'none'; // Ensure it's never visible
        this.element = g;
        return g;
    }

    /**
     * Override playEntranceAnimation to perform the occlusion erase.
     */
    async playEntranceAnimation(speed: number = 1.0): Promise<void> {
        // The manager currently handles its own timing via TimingManager.
        // By calling it here, we ensure it happens in the correct sequence.
        // We pass the duration explicitly to allow for overrides (e.g. instant erase for draw animations)
        await this.manager.applyAutomaticPartialErase(
            this.targetLayerId,
            speed,
            this.config.entrance_animation?.duration
        );
    }

    /**
     * Override seek to perform the occlusion erase seek.
     * Supports Smart Seek: bidirectional (forward/rewind) with incremental optimization.
     */
    seek(progress: number): void {
        // Track progress for potential future optimizations
        const previousProgress = this.lastSeekProgress;
        this.lastSeekProgress = progress;

        // Delegate to manager which has the Smart Seek implementation
        this.manager.seek(this.targetLayerId, progress);
    }

    /**
     * Identify this as an occlusion layer.
     */
    getLayerType(): string {
        return 'occlusion';
    }
}

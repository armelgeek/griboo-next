import { CanvasRenderingContext2D } from 'canvas';
import { HandOverlay } from './hand_overlay';
import { HandOverlayConfig, WhiteboardConfig } from '../../shared/types';
import {
    BaseHandOverlayManager,
    createHandStrategyForLayer
} from '../../shared/core/hand_overlay_manager';

import * as path from 'path';
import { resolveAssetPath } from '../utils/path_utils';

/**
 * Hand Overlay Manager - Manages hand overlay for a scene (Server)
 */
export class HandOverlayManager extends BaseHandOverlayManager {
    private handOverlay: HandOverlay | null = null;
    private currentImageUrl: string | null = null;

    constructor(config?: HandOverlayConfig) {
        super(config);
        if (config) {
            this.initialize(config);
        }
    }

    /**
     * Initialize the hand overlay with configuration
     * Caches hand images to avoid reloading when switching between hand presets with same image URL
     */
    async initialize(config: HandOverlayConfig, handsConfig?: WhiteboardConfig['hands']): Promise<void> {
        // Handle presets if provided
        if (config.preset) {
            const { registerHandPresetsFromConfig, getHandOverlayConfigFromPreset } = require('../../shared/config/hand_config');

            // Register all available presets from handsConfig upfront if provided
            // This ensures all presets are available regardless of which one is currently being used
            if (handsConfig) {
                const { globalHandConfig } = require('../../shared/config/hand_config');
                try {
                    registerHandPresetsFromConfig(handsConfig, globalHandConfig);
                } catch (error) {
                    console.error('Failed to register hand presets:', error);
                    // Continue with initialization even if preset registration fails
                }
            }

            const presetConfig = getHandOverlayConfigFromPreset(config.preset, config);
            if (presetConfig) {
                config = presetConfig;
            }
        }

        // Check if we can reuse the existing initialization
        if (this.isInitialized && this.handOverlay && this.config && this.currentImageUrl) {
            let newUrl = config.imageUrl;
            if (newUrl) {
                newUrl = resolveAssetPath(newUrl);


                // Compare resolved URLs to ensure we don't reload the same image
                if (this.currentImageUrl === newUrl) {
                    // Just update config and scale/offset without reloading image
                    this.config = config;
                    if (config.scale !== undefined) {
                        this.handOverlay.scale = config.scale;
                    }
                    this.handOverlay.offset = config.offset || [-18, -20];
                    return;
                }
            } // Close if (newUrl) block added above
        }

        this.config = config;

        if (config.enabled === false) {
            this.cleanup();
            return;
        }

        this.handOverlay = new HandOverlay(config);

        let imageUrl = config.imageUrl;
        if (!imageUrl) {
            console.warn('No image URL provided for server hand overlay');
            return;
        }
        imageUrl = resolveAssetPath(imageUrl);

        await this.handOverlay.load(imageUrl);
        this.currentImageUrl = imageUrl;

        this.isInitialized = true;
    }

    /**
     * Update hand position and render it to the context
     */
    renderHand(
        ctx: CanvasRenderingContext2D,
        progress: number,
        layerData: any,
        renderScale: number = 1.0
    ): void {
        if (!this.isInitialized || !this.handOverlay || !this.strategy) {
            return;
        }

        const position = this.getHandPosition(progress, layerData);

        if (!position) {
            return;
        }

        this.handOverlay.render(ctx, position.x, position.y, position.rotation, renderScale);
    }

    /**
     * Render hand at specific position
     */
    renderHandAt(ctx: CanvasRenderingContext2D, x: number, y: number, rotation: number = 0, renderScale: number = 1.0): void {
        if (!this.isInitialized || !this.handOverlay) {
            return;
        }
        this.handOverlay.render(ctx, x, y, rotation, renderScale);
    }

    /**
     * Calculate hand position without rendering
     * For server-side rendering, we don't apply offset here - it's applied in screen space after camera transform
     */
    calculateHandPosition(progress: number, layerData: any = {}, transform?: (p: { x: number, y: number }) => { x: number, y: number }, zoom: number = 1.0): { x: number, y: number, rotation?: number } | null {
        if (!this.isInitialized || !this.strategy) {
            return null;
        }
        // Pass applyOffset: false because offset will be applied in screen space in scene.ts
        return this.getHandPosition(progress, layerData, transform, false);
    }

    /**
     * Cleanup resources
     */
    cleanup(): void {
        this.handOverlay = null;
        this.strategy = null;
        this.isInitialized = false;
        this.currentImageUrl = null;
    }
}

export { createHandStrategyForLayer };

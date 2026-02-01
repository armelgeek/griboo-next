/**
 * Hand Overlay Manager - Centralized hand overlay management system
 * 
 * Uses Strategy pattern to handle different layer types and their hand positioning.
 * The hand overlay follows the drawing/animation position of layers to simulate
 * natural writing and stroke effects.
 */

import { HandOverlay } from '../../rendering/hand_overlay';
import { isDebugEnabled } from '../../../shared/config/debug_config';
import { AnimationTransition } from '../../core/logic/easing';
import {
  BaseHandOverlayManager,
  EraserHandStrategy,
  DefaultHandStrategy,
  TextWritingHandStrategy,
  PathDrawingHandStrategy,
  StrokeAnimationHandStrategy,
  ShapeHandStrategy,
  RevealHandStrategy,
  createHandStrategyForLayer as sharedCreateHandStrategyForLayer
} from '../../../shared/core/hand_overlay_manager';
import type {
  HandOverlayStrategy,
  HandPosition,
  EraserLayerData
} from '../../../shared/core/hand_overlay_manager';
import type { HandOverlayConfig, WhiteboardConfig } from '../types';

export type {
  HandOverlayStrategy,
  HandPosition,
  HandOverlayConfig,
  EraserLayerData
};
export {
  EraserHandStrategy,
  DefaultHandStrategy,
  TextWritingHandStrategy,
  PathDrawingHandStrategy,
  StrokeAnimationHandStrategy,
  ShapeHandStrategy,
  RevealHandStrategy
};

/**
 * Hand Overlay Manager - Manages hand overlay for a scene
 */
export class HandOverlayManager extends BaseHandOverlayManager {
  private handOverlay: HandOverlay | null = null;
  public isInitialized: boolean = false;
  // Cache canvas contexts to avoid repeated getContext() calls
  private canvasContextCache = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();
  private cameraTransform = { zoom: 1, position: { x: 0.5, y: 0.5 }, virtualSize: { width: 800, height: 450 } };

  constructor(config?: HandOverlayConfig) {
    super(config);
    if (config) {
      this.initialize(config);
    }
  }

  /**
   * Get cached canvas context to avoid repeated getContext() calls
   * PERFORMANCE: Uses WeakMap cache to minimize overhead in hot path
   */
  private getCachedContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
    let ctx = this.canvasContextCache.get(canvas) ?? null;
    if (!ctx) {
      ctx = canvas.getContext('2d');
      if (ctx) {
        this.canvasContextCache.set(canvas, ctx);
      }
    }
    return ctx;
  }

  /**
   * Get the current configuration
   */
  getConfig(): HandOverlayConfig | null {
    return this.config;
  }

  /**
   * Set the current camera transform for coordinate conversion
   */
  setCameraTransform(zoom: number, position: { x: number, y: number }, virtualSize?: { width: number, height: number }): void {
    this.cameraTransform = {
      zoom,
      position,
      virtualSize: virtualSize || this.cameraTransform.virtualSize
    };
  }

  /**
   * Initialize the hand overlay with configuration
   */
  async initialize(config: HandOverlayConfig, handsConfig?: WhiteboardConfig['hands']): Promise<void> {
    // Handle preset if provided
    if (config.preset) {
      const { registerHandPresetsFromConfig, getHandOverlayConfigFromPreset } = await import('../utils/hand-config');

      // Register all available presets from handsConfig upfront if provided
      // This ensures all presets are available regardless of which one is currently being used
      if (handsConfig) {
        const { globalHandConfig } = await import('../utils/hand-config');
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
    if (this.isInitialized && this.handOverlay && this.config) {
      // If image URL is the same, we don't need to reload the image
      // We can just update other properties if needed
      const currentUrl = this.config.imageUrl;
      const newUrl = config.imageUrl;

      if (currentUrl === newUrl) {
        // Just update config and scale/offset without reloading image
        this.config = config;
        if (config.scale !== undefined) {
          this.handOverlay.scale = config.scale;
        }
        this.handOverlay.offset = [0, 0]; // Offset handled by strategy
        return;
      }
    }

    this.config = config;

    // Only skip initialization if enabled is explicitly false
    if (config.enabled === false) {
      this.cleanup();
      return;
    }

    // Create hand overlay instance
    // Note: We pass [0, 0] as offset because the strategy will apply the configured offset
    this.handOverlay = new HandOverlay(
      config.imageUrl,
      config.scale, // Uses default from HandOverlay if undefined
      [0, 0],  // Offset is applied by strategy, not by HandOverlay
      config.anchorTopLeft || false,
      config.anchorPoint
    );

    // Wait for hand image to load
    await this.handOverlay.waitForLoad();
    this.isInitialized = true;
  }

  /**
   * Animate hand arrival from off-screen to a target position
   * @param targetPos - Target position {x, y}
   * @param canvas - Canvas to draw on
   * @param duration - Animation duration in seconds (default: 0.4)
   */
  async animateArrival(
    targetPos: { x: number; y: number },
    canvas: HTMLCanvasElement,
    duration: number = 0.4
  ): Promise<void> {
    if (!this.isInitialized || !this.handOverlay) return;

    const canvasW = canvas.width;
    const canvasH = canvas.height;
    // Default off-screen position: bottom-right
    const offScreenPos = { x: canvasW + 100, y: canvasH + 100 };
    const durationMs = duration * 1000;
    const startTime = performance.now();

    // PERFORMANCE: Cache context once instead of on every frame
    const ctx = this.getCachedContext(canvas);
    if (!ctx) return;

    return new Promise((resolve) => {
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const t = Math.min(1, elapsed / durationMs);
        const tEased = AnimationTransition.outQuad(t);

        // Apply offset from config for proper pencil tip alignment during arrival
        const offset = this.config?.offset || [0, 0];
        const currentX = offScreenPos.x + (targetPos.x + offset[0] - offScreenPos.x) * tEased;
        const currentY = offScreenPos.y + (targetPos.y + offset[1] - offScreenPos.y) * tEased;

        ctx.clearRect(0, 0, canvasW, canvasH);
        this.handOverlay!.render(ctx, currentX, currentY, 0, this.viewportScale);

        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });
  }

  /**
   * Animate hand departure from a position to off-screen
   * @param fromPos - Starting position {x, y}
   * @param canvas - Canvas to draw on
   * @param duration - Animation duration in seconds (default: 0.4)
   */
  async animateDeparture(
    fromPos: { x: number; y: number },
    canvas: HTMLCanvasElement,
    duration: number = 0.4
  ): Promise<void> {
    if (!this.isInitialized || !this.handOverlay) return;

    const canvasW = canvas.width;
    const canvasH = canvas.height;
    // Default off-screen position: bottom-right
    const offScreenPos = { x: canvasW + 100, y: canvasH + 100 };
    const durationMs = duration * 1000;
    const startTime = performance.now();

    // PERFORMANCE: Cache context once instead of on every frame
    const ctx = this.getCachedContext(canvas);
    if (!ctx) return;

    return new Promise((resolve) => {
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const t = Math.min(1, elapsed / durationMs);
        const tEased = AnimationTransition.inQuad(t);

        // Apply offset from config for proper pencil tip alignment during departure
        const offset = this.config?.offset || [0, 0];
        const startX = fromPos.x + offset[0];
        const startY = fromPos.y + offset[1];

        const currentX = startX + (offScreenPos.x - startX) * tEased;
        const currentY = startY + (offScreenPos.y - startY) * tEased;

        ctx.clearRect(0, 0, canvasW, canvasH);
        this.handOverlay!.render(ctx, currentX, currentY, 0, this.viewportScale);

        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          // Clear canvas after departure
          ctx.clearRect(0, 0, canvasW, canvasH);
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });
  }

  /**
   * Set the positioning strategy for the hand
   */
  setStrategy(strategy: HandOverlayStrategy): void {
    this.strategy = strategy;
  }

  /**
   * Get current strategy
   */
  getStrategy(): HandOverlayStrategy | null {
    return this.strategy;
  }

  /**
   * Update hand position based on animation progress
   * PERFORMANCE CRITICAL: This method is called on every animation frame
   * @param progress - Animation progress (0-1)
   * @param layerData - Layer-specific data for positioning
   * @param canvas - Canvas to draw hand on
   */
  updateHandPosition(
    progress: number,
    layerData: any,
    canvas?: HTMLCanvasElement,
    transform?: (p: { x: number, y: number }) => { x: number, y: number }
  ): void {
    if (isDebugEnabled() && Math.random() < 0.01) {
      console.log('[HandOverlayManager Debug] updateHandPosition:', {
        isInitialized: this.isInitialized,
        hasOverlay: !!this.handOverlay,
        hasStrategy: !!this.strategy,
        hasCanvas: !!canvas
      });
    }
    if (!this.isInitialized || !this.handOverlay || !this.strategy) {
      return;
    }

    // Get hand position from strategy (strategy may apply offset and transform)
    const position = this.getHandPosition(progress, layerData, transform);

    if (!position) {
      // If not visible, we should clear the canvas if provided
      if (canvas) {
        const ctx = this.getCachedContext(canvas);
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      return;
    }

    // Draw hand at position if canvas provided
    if (canvas && canvas instanceof HTMLCanvasElement) {
      // PERFORMANCE NOTE: clearRect is necessary to prevent ghost images as hand moves
      // The caller is responsible for clearing if they want to avoid double-clear
      // We only clear here if we're actually drawing
      const ctx = this.getCachedContext(canvas);
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Apply camera transform to convert scene coordinates to viewport coordinates
        // MUST match Scene.applyCameraTransformToSvg() exactly
        const { zoom, position: cameraPos, virtualSize } = this.cameraTransform;
        const width = canvas.width;
        const height = canvas.height;

        // Calculate transform using virtual canvas dimensions (matches server and scene.ts)
        const centerX = virtualSize.width * cameraPos.x;
        const centerY = virtualSize.height * cameraPos.y;

        const translateX = width / 2 - centerX * zoom;
        const translateY = height / 2 - centerY * zoom;

        const viewportX = position.x * zoom + translateX;
        const viewportY = position.y * zoom + translateY;

        // Pass position directly without additional offset since strategy already applied it
        // PERFORMANCE: Pass cached context to avoid repeated getContext() calls
        if (isDebugEnabled() && Math.random() < 0.01) {
          console.log('[HandOverlayManager Debug] Drawing hand at viewport:', { viewportX, viewportY });
        }
        this.handOverlay.render(ctx, viewportX, viewportY, 0, this.viewportScale);
      }
    }
  }

  /**
   * Hide the hand overlay (clear canvas)
   * PERFORMANCE: Simplified to clear immediately instead of using requestAnimationFrame
   */
  hideHand(canvas: HTMLCanvasElement): void {
    const ctx = this.getCachedContext(canvas);
    if (ctx) {
      // Ensure we clear the entire canvas by resetting transform
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  }

  /**
   * Draw hand at specific position on canvas (scene coordinates)
   * Applies camera transform to convert to viewport coordinates.
   */
  drawHandAt(x: number, y: number, canvas: HTMLCanvasElement): void {
    if (!this.isInitialized || !this.handOverlay || !this.config) {
      return;
    }

    // Apply offset from config since drawHandAt bypasses the strategy
    const offset = this.config.offset || [0, 0];
    const sceneX = x + offset[0];
    const sceneY = y + offset[1];

    // Apply camera transform to convert scene coordinates to viewport coordinates
    // MUST match Scene.applyCameraTransformToSvg() exactly
    const { zoom, position: cameraPos, virtualSize } = this.cameraTransform;
    const width = canvas.width;
    const height = canvas.height;

    // Calculate transform using virtual canvas dimensions (matches server and scene.ts)
    const centerX = virtualSize.width * cameraPos.x;
    const centerY = virtualSize.height * cameraPos.y;

    const translateX = width / 2 - centerX * zoom;
    const translateY = height / 2 - centerY * zoom;

    const viewportX = sceneX * zoom + translateX;
    const viewportY = sceneY * zoom + translateY;

    // PERFORMANCE: Pass cached context to avoid extra getContext() call
    const ctx = this.getCachedContext(canvas);
    if (ctx) {
      this.handOverlay.render(ctx, viewportX, viewportY, 0, this.viewportScale);
    }
  }

  /**
   * Set the scale of the hand overlay
   * @param scale - New scale factor
   */
  setScale(scale: number): void {
    if (this.handOverlay) {
      this.handOverlay.scale = scale;
    }
    if (this.config) {
      this.config.scale = scale;
    }
  }

  /**
   * Check if hand overlay is enabled and ready
   */
  isEnabled(): boolean {
    return this.config?.enabled !== false && this.isInitialized;
  }

  /**
   * Check if hand is loaded
   */
  isLoaded(): boolean {
    return this.isInitialized && this.handOverlay !== null && this.handOverlay.isLoaded;
  }

  /**
   * Get the hand overlay instance
   */
  getHandOverlay(): HandOverlay | null {
    return this.handOverlay;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.handOverlay) {
      this.handOverlay.dispose();
      this.handOverlay = null;
    }
    this.strategy = null;
    this.isInitialized = false;
  }
}

/**
 * Factory function to create appropriate strategy based on layer type
 */
export function createHandStrategyForLayer(layerType: string, layerData?: any): HandOverlayStrategy {
  return sharedCreateHandStrategyForLayer(layerType, layerData);
}

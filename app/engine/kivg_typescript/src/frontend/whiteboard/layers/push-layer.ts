import { LayerConfig, AnimationType, AnimationConfig, PushLayerConfig, WhiteboardConfig } from '../../../shared/types';
export type { PushLayerConfig };
import { applyPushEasing } from '../../../shared/core/push';

import { LoadableLayer } from './loadable-layer';

// Settle ratio (20%) to ensure last part of animation is fully visible before resolving
const SETTLE_RATIO = 0.2;

// Smart Seek thresholds for incremental updates
const SEEK_POSITION_THRESHOLD = 1.0; // pixels

/**
 * PushLayer - Layer that animates an object being pushed across the canvas
 * 
 * Extends LoadableLayer for automatic loading indicators during image loading
 * and frame generation. It manages its own hand overlay for push animations.
 * 
 * Example usage:
 * ```typescript
 * const pushLayer = new PushLayer({
 *   id: 'push-object',
 *   position: { x: 0, y: 0 },
 *   handOverlay: {
 *     enabled: true,
 *     scale: 0.8,
 *     offset: [-80, -50]
 *   }
 * }, {
 *   imageUrl: 'path/to/image.png',
 *   startPosition: [100, 500],
 *   endPosition: [800, 500],
 *   pushDuration: 2.0,
 *   pushEasing: 'ease_out'
 * });
 * ```
 */
export class PushLayer extends LoadableLayer {
  private pushConfig: PushLayerConfig;
  private imageElement: SVGImageElement | null = null;

  // Smart Seek: Track last state for incremental updates
  private lastSeekState: {
    x: number;
    y: number;
    opacity: number;
  } | null = null;

  constructor(config: LayerConfig, pushConfig: PushLayerConfig, handsConfig?: WhiteboardConfig['hands']) {
    super(config, handsConfig);
    this.pushConfig = { ...pushConfig };

    // Resolve end position: use config.position if endPosition is not provided
    if (!this.pushConfig.endPosition && config.position) {
      this.pushConfig.endPosition = [config.position.x, config.position.y];

      // Reset layer position to 0,0 to avoid double transformation
      // since we'll be moving the image element within the group
      this.config.position = { x: 0, y: 0 };
    }

    // Resolve start position: calculate from 'from' if startPosition is not provided
    // NOTE: We defer recalculateStartPosition to render() or first use to give time for
    // cameraTransform to be set by the scene.
  }

  /**
   * Recalculate start position based on 'from' direction and camera viewport
   */
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
    }
  }

  /**
   * Set the camera transform and recalculate start position if it hasn't been manually set
   */
  setCameraTransform(zoom: number, position: { x: number; y: number }, virtualSize: { width: number; height: number }): void {
    super.setCameraTransform(zoom, position, virtualSize);

    // If startPosition was not manually provided, recalculate it based on the new camera view
    // This ensures the object always starts from just outside the visible area
    if (!this.pushConfig.startPosition) {
      this.recalculateStartPosition();
    }
  }

  /**
   * Get the layer type for hand overlay strategy selection
   * PushLayer uses push strategy with dynamic hand positioning
   */
  protected getLayerType(): string {
    return 'push';
  }

  /**
   * Get the geometric proxy for occlusion culling.
   * For push animations, we use the final position as the proxy area.
   */
  public getOcclusionProxy(): any {
    const config = this.config.entrance_animation;
    if (config?.type.startsWith('push')) {
      const endPos = this.pushConfig.endPosition || [this.config.position?.x || 0, this.config.position?.y || 0];
      return {
        type: 'rect',
        x: endPos[0],
        y: endPos[1],
        width: this.config.width || 100,
        height: this.config.height || 100,
        isGlobalProxy: true
      };
    }
    return super.getOcclusionProxy();
  }


  /**
   * Render the push layer
   * Initially renders the object at its start position but hidden
   */
  render(): SVGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('id', this.config.id);
    g.setAttribute('opacity', '0');

    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');

    // Ensure startPosition is calculated (lazy init)
    if (!this.pushConfig.startPosition) {
      this.recalculateStartPosition();
    }

    const startPos = this.pushConfig.startPosition || [0, 0];
    const width = this.pushConfig.width || 200;
    const height = this.pushConfig.height || 200;

    image.setAttribute('x', startPos[0].toString());
    image.setAttribute('y', startPos[1].toString());
    image.setAttribute('width', width.toString());
    image.setAttribute('height', height.toString());
    image.setAttribute('opacity', '0');

    if (this.pushConfig.imageUrl) {
      image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', this.pushConfig.imageUrl);
    } else if (this.pushConfig.imageData) {
      // Convert ImageData to data URL
      const canvas = document.createElement('canvas');
      canvas.width = this.pushConfig.imageData.width;
      canvas.height = this.pushConfig.imageData.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(this.pushConfig.imageData, 0, 0);
        image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', canvas.toDataURL('image/png'));
      }
    }

    this.imageElement = image;
    g.appendChild(image);

    this.element = g;
    this.applyTransform();
    return g;
  }

  /**
   * Animate the push layer
   */

  /**
   * Preload resources needed for animation (hand overlay, etc.)
   * Call this before timing-sensitive operations to ensure initialization
   * overhead doesn't affect animation precision measurements.
   */
  async preload(): Promise<void> {
    await this.waitForHandOverlayReady();
  }

  /**
   * Prepare method called by Scene during preload phase.
   * Delegates to preload() and marks layer as prepared.
   */
  async prepare(): Promise<void> {
    if (this.isPrepared) return;
    await this.preload();
    this.isPrepared = true;
  }

  async animate(type: AnimationType, config: AnimationConfig, initialProgress: number = 0): Promise<void> {
    if (!this.element || !this.imageElement) return;

    // Wait for hand overlay to be ready before starting animation
    await this.waitForHandOverlayReady();

    if (config.warmUp) {
      return;
    }

    if (type.startsWith('push')) {
      const startTime = performance.now() - (initialProgress * config.duration);
      await this.animatePush(config.duration, initialProgress);
      const actualDuration = performance.now() - startTime;
      console.log(`[PushLayer] Layer ${this.config.id} (push): Expected ${config.duration}ms, Actual ${actualDuration.toFixed(2)}ms`);
      return;
    } else {
      // Fallback to base layer animation for other types (fade, zoom, etc.)
      return super.animate(type, config, initialProgress);
    }
  }

  /**
   * Perform the push animation using requestAnimationFrame
   */
  private async animatePush(duration: number, initialProgress: number = 0): Promise<void> {
    return new Promise(async (resolve) => {
      try {
        if (!this.element || !this.imageElement) {
          resolve();
          return;
        }

        const animationStartTime = performance.now() - (initialProgress * duration);

        if (this.pushConfig.imageUrl && !this.imageElement.getAttribute('href')) {
          this.imageElement.setAttributeNS('http://www.w3.org/1999/xlink', 'href', this.pushConfig.imageUrl);
        }

        // Ensure startPosition is calculated (lazy init)
        if (!this.pushConfig.startPosition) {
          this.recalculateStartPosition();
        }

        const startPos = this.pushConfig.startPosition || [100, 500];
        const endPos = this.pushConfig.endPosition || [800, 500];

        // Use exact duration without compensation
        const compensatedDuration = Math.max(0.1, duration);
        // Effective duration for push is compensated duration minus settle time
        const settleTimeMs = compensatedDuration * SETTLE_RATIO;
        const pushDuration = Math.max(100, compensatedDuration - settleTimeMs);
        const easing = this.pushConfig.pushEasing || 'out_cubic';

        const handManager = this.handOverlayManager;
        const handCanvas = this.handOverlayCanvas;

        // Show the group
        this.element.setAttribute('opacity', '1');
        this.imageElement.setAttribute('opacity', '1');

        // Phase 1: Hand Arrival - REMOVED as per user request

        let startTime: number | null = null;

        const animate = async (currentTime: number) => {
          if (this.isStopped) {
            if (handManager && handCanvas) {
              handManager.hideHand(handCanvas);
            }
            resolve();
            return;
          }

          try {
            await this.checkPlaybackState();
          } catch (e) {
            // If checkPlaybackState throws (e.g. PlaybackStoppedError), resolve and exit
            if (handManager && handCanvas) {
              handManager.hideHand(handCanvas);
            }
            resolve();
            return;
          }

          if (!startTime) {
            startTime = currentTime;
            if (initialProgress > 0) {
              startTime -= (pushDuration * initialProgress);
            }
          }
          const elapsed = currentTime - startTime;

          const t = Math.min(1, elapsed / pushDuration);
          const tEased = applyPushEasing(t, easing);

          const currentX = Math.round(startPos[0] + (endPos[0] - startPos[0]) * tEased);
          const currentY = Math.round(startPos[1] + (endPos[1] - startPos[1]) * tEased);

          this.imageElement!.setAttribute('x', currentX.toString());
          this.imageElement!.setAttribute('y', currentY.toString());

          if (handManager && handManager.isEnabled() && handCanvas) {
            // Transform current position to global coordinates
            const globalPos = this.transformToGlobal({ x: currentX, y: currentY });

            handManager.updateHandPosition(t, {
              currentObjectPosition: globalPos
            }, handCanvas);
          }

          if (t < 1) {
            requestAnimationFrame(animate);
          } else {
            // Frame-perfect timing: Calculate precise settle time to hit exact target duration
            const elapsedBeforeSettle = performance.now() - animationStartTime;
            const remainingTime = duration - elapsedBeforeSettle;
            const preciseSettleTime = Math.max(0, remainingTime / 1000);

            // Wait for precise settle time
            if (!this.isStopped && preciseSettleTime > 0) {
              await this.wait(preciseSettleTime);

              // FORCE EXACT TIMING: Ensure we hit the exact target duration
              // This handles setTimeout firing slightly early
              while (performance.now() - animationStartTime < duration) {
                // Busy wait for final micro-adjustments to hit exact target
              }
            }

            // Hide hand after settle time
            if (handManager && handCanvas) {
              handManager.hideHand(handCanvas);
            }
            resolve();
          }
        };

        requestAnimationFrame(animate);
      } catch (error) {
        console.error('Error in animatePush:', error);
        resolve(); // Always resolve to avoid hanging the engine
      }
    });
  }

  /**
   * Get the generated animation frames
   * @deprecated No longer used as we move SVG elements directly
   */
  getAnimationFrames(): ImageData[] {
    return [];
  }

  /**
   * Get push configuration
   */
  getPushConfig(): PushLayerConfig {
    return this.pushConfig;
  }

  /**
   * Seek to a specific progress in the animation with Smart Seek optimization.
   * PushLayer supports push animations with smooth position interpolation.
   */
  seek(progress: number): void {
    // Call super to handle generic properties and track lastSeekProgress
    super.seek(progress);

    const config = this.config.entrance_animation;
    if (!config || !this.imageElement) return;

    // Initialize state tracking if needed
    if (!this.lastSeekState) {
      this.lastSeekState = { x: 0, y: 0, opacity: 0 };
    }

    // Get seek direction for potential optimizations
    const direction = this.getSeekDirection(progress);
    const isIncremental = this.isIncrementalSeek(progress, 0.05);

    const type = config.type;

    if (type.startsWith('push')) {
      this.seekPush(progress, direction, isIncremental);
    } else {
      // For non-push animations, the base Layer.seek handles it
      // Just ensure the image is visible and at end position
      if (progress > 0 && this.pushConfig.endPosition) {
        this.imageElement.setAttribute('opacity', '1');
        this.imageElement.setAttribute('x', this.pushConfig.endPosition[0].toString());
        this.imageElement.setAttribute('y', this.pushConfig.endPosition[1].toString());
        if (this.element) {
          this.element.setAttribute('opacity', '1');
        }
      }
    }
  }

  /**
   * Seek implementation for push animation
   */
  private seekPush(progress: number, direction: 'forward' | 'rewind' | null, isIncremental: boolean): void {
    if (!this.imageElement) return;

    // Note: Hand canvas is cleared once at scene level, not per layer
    // This allows multiple layers to show hands simultaneously during seek

    // Ensure startPosition is calculated (lazy init)
    if (!this.pushConfig.startPosition) {
      this.recalculateStartPosition();
    }

    const startPos = this.pushConfig.startPosition || [0, 0];
    const endPos = this.pushConfig.endPosition || [0, 0];

    // Apply easing to progress
    const easedProgress = applyPushEasing(progress, this.pushConfig.pushEasing || 'ease_out');

    // Interpolate position
    const x = startPos[0] + (endPos[0] - startPos[0]) * easedProgress;
    const y = startPos[1] + (endPos[1] - startPos[1]) * easedProgress;

    // During seek, if progress > 0, the element should definitely be visible
    const opacity = progress > 0 ? 1 : 0;

    // Ensure the group element is visible if progress > 0
    if (this.element && opacity > 0) {
      this.element.setAttribute('opacity', '1');
      this.element.style.display = '';
    }

    // SMART SEEK: Only update if changed significantly
    if (!isIncremental ||
      Math.abs(this.lastSeekState!.x - x) > SEEK_POSITION_THRESHOLD ||
      Math.abs(this.lastSeekState!.y - y) > SEEK_POSITION_THRESHOLD ||
      this.lastSeekState!.opacity !== opacity) {

      this.imageElement.setAttribute('x', x.toString());
      this.imageElement.setAttribute('y', y.toString());
      this.imageElement.setAttribute('opacity', opacity.toString());

      if (this.element) {
        this.element.setAttribute('opacity', opacity.toString());
      }

      this.lastSeekState!.x = x;
      this.lastSeekState!.y = y;
      this.lastSeekState!.opacity = opacity;
    }

    // Update hand position - only during active animation
    if (this.handOverlayCanvas && progress > 0 && progress < 1) {
      // Use SeekHandManager for consistent hand positioning
      this.updateHandDuringSeek(progress, {
        currentObjectPosition: { x: x, y: y }
      });
    } else if (this.handOverlayCanvas && this.handOverlayManager) {
      this.handOverlayManager.hideHand(this.handOverlayCanvas);
    }
  }

  /**
   * Get the current position of the push layer.
   * Overridden to account for the push animation which overrides the standard transform.
   */
  public getCurrentPosition(time: number): { x: number, y: number } {
    const progress = this.getAnimationProgress(time);
    const config = this.config.entrance_animation;

    if (config?.type.startsWith('push') && progress > 0 && progress < 1) {
      // Ensure startPosition is calculated (lazy init)
      if (!this.pushConfig.startPosition) {
        this.recalculateStartPosition();
      }

      const startPos = this.pushConfig.startPosition || [0, 0];
      const endPos = this.pushConfig.endPosition || [0, 0];
      const easing = this.pushConfig.pushEasing || 'out_cubic';
      const easedProgress = applyPushEasing(progress, easing);

      return {
        x: startPos[0] + (endPos[0] - startPos[0]) * easedProgress,
        y: startPos[1] + (endPos[1] - startPos[1]) * easedProgress
      };
    }

    return super.getCurrentPosition(time);
  }
}

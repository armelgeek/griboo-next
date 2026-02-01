/**
 * RubberLayer - A layer that performs rubber erasing (direct pixel manipulation)
 * Extends LoadableLayer for consistent API with other layers
 */

import { LoadableLayer } from './loadable-layer';
import { LayerConfig, WhiteboardConfig } from '../types';
import { Rubber, Point } from '../../core/layers/eraser';
import { completeTimingPrecision } from '../utils/timing-precision';

/**
 * Configuration for rubber layer
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
}

/**
 * RubberLayer - Renders rubber erasing as a layer
 * Uses direct pixel manipulation for erasing
 */
export class RubberLayer extends LoadableLayer {
  private rubberConfig: RubberLayerConfig;
  private rubber: Rubber;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  // Smart Seek: Track last state for incremental updates
  private lastSeekState: { 
    progress: number;
    pathCoords: Point[] | null;
    sourceImage: ImageData | null;
  } | null = null;

  constructor(config: LayerConfig, rubberConfig: RubberLayerConfig = {}, handsConfig?: WhiteboardConfig['hands']) {
    super(config, handsConfig);
    this.rubberConfig = {
      radius: 20,
      shape: 'circle',
      backgroundColor: [255, 255, 255],
      softness: 0,
      ...rubberConfig
    };

    // Initialize rubber tool
    this.rubber = new Rubber(
      this.rubberConfig.radius,
      this.rubberConfig.shape,
      this.rubberConfig.backgroundColor,
      this.rubberConfig.softness
    );
  }

  /**
   * Prepare method called by Scene during preload phase.
   */
  async prepare(): Promise<void> {
    if (this.isPrepared) return;
    await this.waitForHandOverlayReady();
    this.isPrepared = true;
  }

  /**
   * Get layer type for hand overlay strategy selection
   * RubberLayer uses eraser hand overlay strategy (same as EraserLayer)
   */
  protected getLayerType(): string {
    return 'rubber';
  }

  /**
   * Render the rubber layer
   * Creates a foreignObject with canvas for rendering rubber effects
   */
  render(): SVGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // Create a foreignObject to embed canvas for rubber rendering
    const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foreignObject.setAttribute('width', String(this.config.width || 800));
    foreignObject.setAttribute('height', String(this.config.height || 600));
    foreignObject.setAttribute('x', '0');
    foreignObject.setAttribute('y', '0');
    // Ensure foreignObject doesn't block hand overlay
    foreignObject.style.pointerEvents = 'none';

    // Create canvas for rubber rendering
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.config.width || 800;
    this.canvas.height = this.config.height || 600;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    // Ensure canvas doesn't interfere with hand overlay
    this.canvas.style.pointerEvents = 'none';

    this.ctx = this.canvas.getContext('2d');

    foreignObject.appendChild(this.canvas);
    g.appendChild(foreignObject);

    this.element = g;
    this.applyTransform();

    return g;
  }

  /**
   * Apply rubber eraser at a specific position
   */
  applyRubberAt(imageData: ImageData, x: number, y: number): ImageData {
    return this.rubber.applyEraser(imageData, x, y);
  }

  /**
   * Erase along a path
   */
  eraseAlongPath(imageData: ImageData, pathCoords: Point[]): ImageData {
    return this.rubber.eraseAlongPath(imageData, pathCoords);
  }

  /**
   * Animate erase along a path with hand overlay
   * Shows animated hand during the erase sweep
   */
  async animateEraseAlongPath(
    imageData: ImageData,
    pathCoords: Point[],
    duration: number = 2000
  ): Promise<void> {
    if (!this.ctx || !this.canvas) {
      console.warn('Canvas not initialized for rubber layer');
      return;
    }

    // Validate path has points
    if (!pathCoords || pathCoords.length === 0) {
      console.warn('Empty path provided for erase animation');
      return;
    }

    const startTime = performance.now();
    let totalPausedTime = 0;
    const totalDurationMs = duration;

    let currentImage = imageData;

    return new Promise<void>((resolve) => {
      let lastProcessedIdx = -1;

      const animate = async (currentTime: number) => {
        if (this.isStopped) {
          resolve();
          return;
        }

        const pauseStart = performance.now();
        await this.checkPlaybackState();
        const pauseDuration = performance.now() - pauseStart;
        totalPausedTime += pauseDuration;

        const elapsed = currentTime - startTime - totalPausedTime;
        const progress = Math.min(elapsed / totalDurationMs, 1);
        const targetIdx = Math.floor(progress * (pathCoords.length - 1));

        // Process all points up to targetIdx that haven't been processed yet
        if (targetIdx > lastProcessedIdx) {
          for (let i = lastProcessedIdx + 1; i <= targetIdx; i++) {
            const point = pathCoords[i];
            currentImage = this.rubber.applyEraser(currentImage, point[0], point[1]);
          }

          // Display the updated image once per frame
          this.ctx!.putImageData(currentImage, 0, 0);
          lastProcessedIdx = targetIdx;

          // Update hand position if hand overlay is enabled
          if (this.handOverlayManager && this.handOverlayManager.isEnabled() && this.handOverlayCanvas) {
            const point = pathCoords[targetIdx];
            const nextPos = targetIdx + 1 < pathCoords.length ? pathCoords[targetIdx + 1] : point;

            this.handOverlayManager.updateHandPosition(progress, {
              currentErasePosition: { x: point[0], y: point[1] },
              nextErasePosition: { x: nextPos[0], y: nextPos[1] }
            }, this.handOverlayCanvas);
          }
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Final Micro-Adjustment: Busy-wait for absolute precision
          await completeTimingPrecision(startTime + totalPausedTime, totalDurationMs, (s) => this.wait(s));

          // Clear hand overlay after animation completes
          if (this.handOverlayManager && this.handOverlayManager.isEnabled() && this.handOverlayCanvas) {
            this.handOverlayManager.hideHand(this.handOverlayCanvas);
          }
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  /**
   * Display erased image on canvas
   */
  displayImage(imageData: ImageData): void {
    if (this.ctx) {
      this.ctx.putImageData(imageData, 0, 0);
    }
  }

  /**
   * Get the canvas element
   */
  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  /**
   * Get the canvas context
   */
  getContext(): CanvasRenderingContext2D | null {
    return this.ctx;
  }

  /**
   * Get the rubber instance
   */
  getRubber(): Rubber {
    return this.rubber;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    super.cleanup();
    this.canvas = null;
    this.ctx = null;
  }

  /**
   * Seek to a specific progress in the animation with Smart Seek optimization.
   * RubberLayer has complex canvas-based animation state.
   * 
   * Note: For rubber eraser animations, full seeking requires the source image 
   * and erase path to be available. This method provides basic seek support.
   */
  seek(progress: number): void {
    // Call super to handle generic properties and track lastSeekProgress
    super.seek(progress);

    // RubberLayer animations are canvas-based and require path coordinates
    // Without cached state (path + source image), we can't fully seek
    // The base Layer.seek handles opacity/transform which is sufficient for most cases
    
    if (this.lastSeekState?.pathCoords && this.lastSeekState?.sourceImage && this.ctx) {
      const direction = this.getSeekDirection(progress);
      const isIncremental = this.isIncrementalSeek(progress, 0.05);

      // Only update if progress changed significantly or not incremental
      if (!isIncremental || Math.abs(this.lastSeekState.progress - progress) > 0.01) {
        try {
          const pathCoords = this.lastSeekState.pathCoords;
          const totalPoints = pathCoords.length;
          const targetIndex = Math.floor(progress * totalPoints);

          // Erase up to the target point
          let currentImage = this.lastSeekState.sourceImage;
          for (let i = 0; i < targetIndex && i < totalPoints; i++) {
            const point = pathCoords[i];
            currentImage = this.rubber.applyEraser(currentImage, point[0], point[1]);
          }

          this.ctx.putImageData(currentImage, 0, 0);
          this.lastSeekState.progress = progress;

          // Update hand position - only show during active animation
          if (this.handOverlayCanvas && progress > 0 && progress < 1 && targetIndex < totalPoints) {
            const currentPoint = pathCoords[targetIndex];
            const nextIndex = Math.min(targetIndex + 1, totalPoints - 1);
            const nextPoint = pathCoords[nextIndex];
            
            // Use SeekHandManager for consistent hand positioning
            this.updateHandDuringSeek(progress, {
              currentErasePosition: { x: currentPoint[0], y: currentPoint[1] },
              nextErasePosition: nextPoint ? { x: nextPoint[0], y: nextPoint[1] } : undefined
            });
          }
          // Note: We don't hide the hand here, as other layers might be showing their hands
          // The scene clears the hand canvas once at the start of seek
        } catch (error) {
          // If seeking fails, clear the cached state
          this.lastSeekState.pathCoords = null;
          this.lastSeekState.sourceImage = null;
        }
      }
    }
  }

  /**
   * Initialize seek context for rubber layer.
   * Should be called with the source image and erase path before seeking is used.
   */
  initializeSeekContext(sourceImage: ImageData, pathCoords: Point[]): void {
    if (!this.lastSeekState) {
      this.lastSeekState = {
        progress: 0,
        pathCoords: pathCoords,
        sourceImage: sourceImage
      };
    } else {
      this.lastSeekState.pathCoords = pathCoords;
      this.lastSeekState.sourceImage = sourceImage;
    }
  }
}

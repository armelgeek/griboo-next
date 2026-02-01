import { LoadableLayer } from './loadable-layer';
import { LayerConfig, WhiteboardConfig } from '../types';


// Settle ratio (20%) to ensure last part of animation is fully visible before resolving
const SETTLE_RATIO = 0.2;
import { LayerEraser, Rubber, EraserStyleType, Point, ProgressiveEraseContext } from '../../core/layers/eraser';

/**
 * Configuration for eraser layer
 */
export interface EraserLayerConfig {
  /** Eraser style */
  style?: EraserStyleType;
  /** Eraser direction */
  direction?: 'normal' | 'reversed' | 'inside_out' | 'outside_in';
  /** Duration ratio relative to draw duration */
  durationRatio?: number;
  /** Background color for erasing */
  backgroundColor?: [number, number, number];
  /** Path to eraser image */
  eraserImagePath?: string;
  /** Path to eraser mask */
  eraserMaskPath?: string;
  /** Erase radius */
  radius?: number;
  /** Whether to use rubber (direct pixel manipulation) */
  useRubber?: boolean;
  /** Rubber shape (if using rubber) */
  rubberShape?: 'circle' | 'square';
  /** Rubber softness (0-1, if using rubber) */
  rubberSoftness?: number;
  /** Custom hand image URL */
  handImage?: string;
  /** Custom hand offset [x, y] */
  handOffset?: [number, number];
  /** Custom hand scale */
  handScale?: number;
}

/**
 * EraserLayer - Renders erasing animations as a layer
 */
export class EraserLayer extends LoadableLayer {
  private eraserConfig: EraserLayerConfig;
  private layerEraser: LayerEraser | null = null;
  private rubber: Rubber | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  // Smart Seek: Track last state and progressive context
  private lastSeekState: {
    progress: number;
    sourceImage: ImageData | null;
    progressiveCtx: ProgressiveEraseContext | null;
  } | null = null;

  constructor(config: LayerConfig, eraserConfig: EraserLayerConfig = {}, handsConfig?: WhiteboardConfig['hands']) {
    super(config, handsConfig);
    this.eraserConfig = {
      style: 'progressive',
      direction: 'normal',
      durationRatio: 1.0,
      backgroundColor: [255, 255, 255],
      radius: 30,
      useRubber: false,
      rubberShape: 'circle',
      rubberSoftness: 0,
      ...eraserConfig
    };

    // Initialize eraser or rubber
    if (this.eraserConfig.useRubber) {
      this.rubber = new Rubber(
        this.eraserConfig.radius,
        this.eraserConfig.rubberShape,
        this.eraserConfig.backgroundColor,
        this.eraserConfig.rubberSoftness
      );
    } else {
      this.layerEraser = new LayerEraser({
        style: this.eraserConfig.style,
        direction: this.eraserConfig.direction,
        durationRatio: this.eraserConfig.durationRatio,
        backgroundColor: this.eraserConfig.backgroundColor,
        eraserImagePath: this.eraserConfig.eraserImagePath,
        eraserMaskPath: this.eraserConfig.eraserMaskPath
      });
    }
  }

  /**
   * Get layer type for hand overlay strategy selection
   * EraserLayer uses eraser hand overlay strategy
   */
  protected getLayerType(): string {
    return 'eraser';
  }

  /**
   * Load eraser assets with loading indicator
   */
  async loadEraserAssets(eraserPath: string, maskPath?: string): Promise<boolean> {
    if (this.layerEraser) {
      return await this.withLoading(
        'load-eraser',
        'Chargement de la gomme...',
        async () => {
          return await this.layerEraser!.loadEraser(eraserPath, maskPath);
        }
      );
    }
    return false;
  }

  /**
   * Render the eraser layer
   * Creates a foreignObject with canvas for rendering eraser animations
   */
  render(): SVGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // Create a foreignObject to embed canvas for eraser rendering
    const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foreignObject.setAttribute('width', String(this.config.width || 800));
    foreignObject.setAttribute('height', String(this.config.height || 600));
    foreignObject.setAttribute('x', '0');
    foreignObject.setAttribute('y', '0');
    // Ensure foreignObject doesn't block hand overlay
    foreignObject.style.pointerEvents = 'none';

    // Create canvas for eraser rendering
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
   * Apply eraser effect to an image
   */
  async applyEraserEffect(sourceImage: ImageData, numFrames: number = 60): Promise<void> {
    if (!this.ctx || !this.canvas) {
      console.warn('Canvas not initialized for eraser layer');
      return;
    }

    if (this.eraserConfig.useRubber && this.rubber) {
      // Use rubber for direct pixel manipulation
      // For now, just apply a simple eraser effect
      const result = this.rubber.applyEraser(
        sourceImage,
        Math.floor(sourceImage.width / 2),
        Math.floor(sourceImage.height / 2)
      );
      this.ctx.putImageData(result, 0, 0);
    } else if (this.layerEraser) {
      // Use LayerEraser for animation
      const result = this.layerEraser.generateEraseFrames(
        sourceImage,
        numFrames,
        this.eraserConfig.radius,
        true, // showEraser
        true  // useWhiteboardWipe
      );

      // For now, just show the final frame
      if (result.frames.length > 0) {
        this.ctx.putImageData(result.frames[result.frames.length - 1], 0, 0);
      }
    }
  }

  /**
   * Render the final erased state directly (optimization for keyframes/end of scene).
   * This avoids regenerating all intermediate frames when only the final state is needed.
   * Useful when:
   * - Seeking to the end of an eraser animation
   * - Rendering the last keyframe of a scene with eraser effect
   * - Performance optimization when intermediate frames aren't needed
   * 
   * @param sourceImage - The source image to erase
   * @param showEraser - Whether to render the eraser graphic at final position (default: false)
   */
  renderFinalState(sourceImage: ImageData, showEraser: boolean = false): void {
    if (!this.ctx || !this.canvas) {
      console.warn('Canvas not initialized for eraser layer');
      return;
    }

    if (this.layerEraser) {
      // Create progressive context for efficient single-frame generation
      const progressiveCtx = this.layerEraser.createProgressiveEraseContext(
        sourceImage,
        this.eraserConfig.radius,
        true // useWhiteboardWipe
      );

      if (progressiveCtx) {
        // Generate only the final frame (progress = 1.0)
        const { frame } = progressiveCtx.generateFrame(1.0, showEraser);
        this.ctx.putImageData(frame, 0, 0);
        progressiveCtx.cleanup();
      }
    } else if (this.eraserConfig.useRubber && this.rubber) {
      // For rubber mode, apply full erase
      const result = this.rubber.applyEraser(
        sourceImage,
        Math.floor(sourceImage.width / 2),
        Math.floor(sourceImage.height / 2)
      );
      this.ctx.putImageData(result, 0, 0);
    }
  }

  /**
   * Animate eraser effect with hand overlay (OPTIMIZED - Progressive Generation)
   * Shows animated hand during the erase sweep.
   * Uses lazy frame generation for instant startup (< 50ms) and minimal memory usage.
   * Simplified version - hand always shows during sweep.
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

  async animateEraseEffect(
    sourceImage: ImageData,
    _numFrames: number = 60, // Kept for API compatibility but not used in progressive generation
    duration: number = 2000
  ): Promise<void> {
    if (!this.ctx || !this.canvas) {
      console.warn('Canvas not initialized for eraser layer');
      return;
    }

    if (this.layerEraser) {
      // Create progressive erase context (fast - calculates path only)
      const progressiveCtx = this.layerEraser.createProgressiveEraseContext(
        sourceImage,
        this.eraserConfig.radius,
        true  // useWhiteboardWipe
      );

      if (!progressiveCtx) {
        console.warn('Failed to create progressive erase context');
        return;
      }

      // Effective duration for erase is total duration minus settle time
      // Use exact duration without compensation
      const compensatedDuration = Math.max(0.1, duration);
      const settleTimeMs = compensatedDuration * SETTLE_RATIO;
      const eraseDuration = Math.max(100, compensatedDuration - settleTimeMs);

      // Use requestAnimationFrame for smooth animation
      const startTime = performance.now();
      let totalPausedTime = 0;

      // Create promise that resolves when animation completes
      await new Promise<void>(resolve => {
        const animate = async () => {
          if (this.isStopped) return;

          const pauseStart = performance.now();
          await this.checkPlaybackState();
          const pauseDuration = performance.now() - pauseStart;
          totalPausedTime += pauseDuration;

          const elapsed = performance.now() - startTime - totalPausedTime;
          const progress = Math.min(elapsed / eraseDuration, 1.0);

          // Generate frame on-demand (lazy generation)
          const { frame, position } = progressiveCtx.generateFrame(
            progress,
            true // showEraser
          );

          // Render current frame
          this.ctx!.putImageData(frame, 0, 0);

          // Update hand position if hand overlay is enabled
          if (this.handOverlayManager && this.handOverlayManager.isEnabled() && this.handOverlayCanvas) {
            // Calculate next position for smooth hand movement
            const totalPoints = progressiveCtx.getTotalPoints();
            const currentIndex = Math.floor(progress * totalPoints);
            const nextIndex = Math.min(currentIndex + 1, totalPoints - 1);
            const erasePath = progressiveCtx.getErasePath();
            const nextPos = erasePath[nextIndex];

            // CRITICAL: Pass transform callback to convert layer-local coordinates to scene/virtual coordinates
            // The erase position is in canvas-local pixels, which needs to be transformed to global scene coordinates
            // accounting for layer position, rotation, scale, and camera transform
            this.handOverlayManager.updateHandPosition(progress, {
              currentErasePosition: { x: position[0], y: position[1] },
              nextErasePosition: nextPos ? { x: nextPos[0], y: nextPos[1] } : undefined
            }, this.handOverlayCanvas, (p) => this.transformToGlobal(p));
          }

          // Continue animation if not complete
          if (progress < 1.0) {
            requestAnimationFrame(animate);
          } else {
            // Animation complete - cleanup and resolve
            progressiveCtx.cleanup();

            // Clear hand overlay after animation completes
            if (this.handOverlayManager && this.handOverlayManager.isEnabled() && this.handOverlayCanvas) {
              this.handOverlayManager.hideHand(this.handOverlayCanvas);
            }

            // Frame-perfect timing: Calculate precise settle time to hit exact target duration
            const elapsedBeforeSettle = performance.now() - startTime;
            const remainingTime = duration - elapsedBeforeSettle;
            const preciseSettleTime = Math.max(0, remainingTime / 1000);

            // Resolve promise
            if (!this.isStopped && preciseSettleTime > 0) {
              await this.wait(preciseSettleTime);

              // FORCE EXACT TIMING: Ensure we hit the exact target duration
              // This handles setTimeout firing slightly early
              while (performance.now() - startTime < duration) {
                // Busy wait for final micro-adjustments to hit exact target
              }

              // Hide hand after settle time
              if (this.handOverlayManager && this.handOverlayCanvas) {
                this.handOverlayManager.hideHand(this.handOverlayCanvas);
              }

              resolve();
            } else {
              // Hide hand immediately if no settle time
              if (this.handOverlayManager && this.handOverlayCanvas) {
                this.handOverlayManager.hideHand(this.handOverlayCanvas);
              }
              resolve();
            }
          }
        };

        // Start animation
        requestAnimationFrame(animate);
      });

    } else if (this.rubber) {
      // For rubber, we don't have frame-by-frame animation yet
      // Just apply the effect
      const result = this.rubber.applyEraser(
        sourceImage,
        Math.floor(sourceImage.width / 2),
        Math.floor(sourceImage.height / 2)
      );
      this.ctx.putImageData(result, 0, 0);
    }
  }

  /**
   * Erase along a path using Rubber
   */
  eraseAlongPath(imageData: ImageData, pathCoords: Point[]): ImageData {
    if (this.rubber) {
      return this.rubber.eraseAlongPath(imageData, pathCoords);
    }
    return imageData;
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
   * Cleanup resources
   */
  cleanup(): void {
    super.cleanup();
    if (this.lastSeekState?.progressiveCtx) {
      this.lastSeekState.progressiveCtx.cleanup();
      this.lastSeekState.progressiveCtx = null;
    }
    this.canvas = null;
    this.ctx = null;
    this.layerEraser = null;
    this.rubber = null;
  }

  /**
   * Seek to a specific progress in the animation with Smart Seek optimization.
   * EraserLayer has complex animation state, so seeking requires special handling.
   * 
   * Note: For eraser animations, full seeking requires the source image to be available.
   * This method provides basic seek support but may need enhancement for complex scenarios.
   */
  seek(progress: number): void {
    // Call super to handle generic properties and track lastSeekProgress
    super.seek(progress);

    // EraserLayer animations are primarily canvas-based and stateful
    // Without a source image and progressive context, we can't fully seek
    // The base Layer.seek handles opacity/transform which is sufficient for most cases

    // If we have a cached progressive context from a previous animation, we can use it
    if (this.lastSeekState?.progressiveCtx && this.ctx) {
      const direction = this.getSeekDirection(progress);
      const isIncremental = this.isIncrementalSeek(progress, 0.05);

      // Only update if progress changed significantly or not incremental
      if (!isIncremental || Math.abs(this.lastSeekState.progress - progress) > 0.01) {
        try {
          const { frame, position } = this.lastSeekState.progressiveCtx.generateFrame(
            progress,
            true // showEraser
          );

          this.ctx.putImageData(frame, 0, 0);
          this.lastSeekState.progress = progress;

          // Update hand position - only show during active animation
          if (this.handOverlayCanvas) {
            if (progress >= 1) {
              // Show hand at the end position when animation is complete
              const totalPoints = this.lastSeekState.progressiveCtx.getTotalPoints();
              const erasePath = this.lastSeekState.progressiveCtx.getErasePath();
              const lastPos = erasePath[totalPoints - 1];
              if (lastPos) {
                // Calculate next position for direction
                const nextPos = totalPoints > 1 ? erasePath[totalPoints - 2] : lastPos;

                // Use SeekHandManager for consistent hand positioning
                this.updateHandDuringSeek(progress, {
                  currentErasePosition: { x: lastPos[0], y: lastPos[1] },
                  nextErasePosition: nextPos ? { x: nextPos[0], y: nextPos[1] } : undefined
                });
              }
              // Note: If no lastPos, don't hide - other layers might be showing hands
            } else if (progress > 0) {
              // Calculate next position for direction
              const totalPoints = this.lastSeekState.progressiveCtx.getTotalPoints();
              const currentIndex = Math.floor(progress * totalPoints);
              const nextIndex = Math.min(currentIndex + 1, totalPoints - 1);
              const erasePath = this.lastSeekState.progressiveCtx.getErasePath();
              const nextPos = erasePath[nextIndex];

              // Use SeekHandManager for consistent hand positioning
              this.updateHandDuringSeek(progress, {
                currentErasePosition: { x: position[0], y: position[1] },
                nextErasePosition: nextPos ? { x: nextPos[0], y: nextPos[1] } : undefined
              });
            }
            // Note: At progress=0, don't hide hand - other layers might be showing hands
            // The scene clears the hand canvas once at the start of seek
          }
        } catch (error) {
          // If seeking fails, clear the cached context
          if (this.lastSeekState.progressiveCtx) {
            this.lastSeekState.progressiveCtx.cleanup();
            this.lastSeekState.progressiveCtx = null;
          }
        }
      }
    }
  }

  /**
   * Initialize progressive context for seeking.
   * Should be called with the source image before seeking is used.
   */
  initializeSeekContext(sourceImage: ImageData): void {
    if (!this.layerEraser) return;

    // Clean up any existing context
    if (this.lastSeekState?.progressiveCtx) {
      this.lastSeekState.progressiveCtx.cleanup();
    }

    // Create new progressive context
    const progressiveCtx = this.layerEraser.createProgressiveEraseContext(
      sourceImage,
      this.eraserConfig.radius,
      true  // useWhiteboardWipe
    );

    if (!this.lastSeekState) {
      this.lastSeekState = {
        progress: 0,
        sourceImage: sourceImage,
        progressiveCtx: progressiveCtx
      };
    } else {
      this.lastSeekState.sourceImage = sourceImage;
      this.lastSeekState.progressiveCtx = progressiveCtx;
    }
  }
}

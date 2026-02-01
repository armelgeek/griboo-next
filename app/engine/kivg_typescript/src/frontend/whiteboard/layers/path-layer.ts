import { LoadableLayer } from './loadable-layer';
import { LayerConfig, AnimationType, AnimationConfig, WhiteboardConfig } from '../types';


// Settle ratio (20%) to ensure last part of animation is fully visible before resolving
const SETTLE_RATIO = 0.2;

export class PathLayer extends LoadableLayer {
  private pathData: string;
  private strokeColor: string;
  private fillColor: string;
  private strokeWidth: number;
  // Cache for getTotalLength() to avoid expensive recalculations during animation
  private cachedPathLength: number | null = null;

  // Smart Seek: Track last state for incremental updates
  private lastSeekState: { dashOffset: number; fillOpacity: number } | null = null;

  constructor(
    config: LayerConfig,
    pathData: string,
    strokeColor: string = '#000000',
    fillColor: string = 'none',
    strokeWidth: number = 2,
    handsConfig?: WhiteboardConfig['hands']
  ) {
    super(config, handsConfig);
    this.pathData = pathData;
    this.strokeColor = strokeColor;
    this.fillColor = fillColor;
    this.strokeWidth = strokeWidth;
  }

  render(): SVGElement {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', this.pathData);
    path.setAttribute('stroke', this.strokeColor);
    path.setAttribute('fill', this.fillColor);
    path.setAttribute('stroke-width', this.strokeWidth.toString());
    path.setAttribute('opacity', '0');

    this.element = path;
    this.applyTransform();
    return path;
  }

  /**
   * Preload resources needed for animation (hand overlay, path length, etc.)
   * Call this before timing-sensitive operations to ensure initialization
   * overhead doesn't affect animation precision measurements.
   * 
   * CRITICAL: Preloading path length avoids expensive getTotalLength() calls
   * during animation, which cause timing drift and animation "cuts" when
   * there are many draw animations in a scene.
   */
  async preload(): Promise<void> {
    await this.waitForHandOverlayReady();

    // CRITICAL FIX: Pre-calculate path length to avoid reflow during animation
    // getTotalLength() is expensive and causes jank when called during animation loop
    if (this.element && this.cachedPathLength === null) {
      const path = this.element as SVGPathElement;
      // Import LayerAnimator to use shared cache
      const { LayerAnimator } = await import('../managers/animator');
      // Force layout calculation now (during preload) instead of during animation
      this.cachedPathLength = LayerAnimator.preloadPathLength(path);

      if (this.config.debug) {
        console.log(`[PathLayer ${this.config.id}] Preloaded path length: ${this.cachedPathLength.toFixed(2)}px`);
      }
    }
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
    if (!this.element) return;

    if (config.warmUp) {
      return;
    }

    // Wait for hand overlay to be ready before starting animation
    await this.waitForHandOverlayReady();

    // For draw animation, we use the specific implementation in PathLayer
    if (type === 'draw') {
      return new Promise((resolve) => {
        // Normalize duration: config.duration is in MS, while internal methods expect seconds
        const duration = config.duration !== undefined ? config.duration / 1000 : 3.0;
        const expectedDurationMs = config.duration !== undefined ? config.duration : 3000;
        const startTime = performance.now();
        this.animateDraw(duration, () => {
          const actualDuration = performance.now() - startTime;
          console.log(`[PathLayer] Layer ${this.config.id} (draw): Expected ${expectedDurationMs}ms, Actual ${actualDuration.toFixed(2)}ms`);
          resolve();
        }, initialProgress);
      });
    }

    // For other animation types, use the parent class implementation (LayerAnimator)
    // LayerAnimator will handle opacity/transform animations
    // Ensure the path is not hidden by stroke-dashoffset
    this.element!.removeAttribute('stroke-dasharray');
    this.element!.removeAttribute('stroke-dashoffset');
    this.element!.setAttribute('fill-opacity', '1');

    return super.animate(type, config, initialProgress);
  }

  /**
   * Seek to a specific progress in the animation with Smart Seek optimization
   */
  seek(progress: number): void {
    // Call super to handle generic properties and track lastSeekProgress
    super.seek(progress);

    const config = this.config.entrance_animation;
    if (!config || config.type !== 'draw') return;

    // Get seek direction for potential optimizations
    const direction = this.getSeekDirection(progress);
    const isIncremental = this.isIncrementalSeek(progress, 0.05);

    // Handle draw animation state
    this.seekDraw(progress, direction, isIncremental);
  }

  private seekDraw(progress: number, direction: 'forward' | 'rewind' | null, isIncremental: boolean): void {
    const path = this.element as SVGPathElement;
    const pathLength = this.cachedPathLength !== null ? this.cachedPathLength : path.getTotalLength();

    // Note: Hand canvas is cleared once at scene level, not per layer
    // This allows multiple layers to show hands simultaneously during seek

    const strokeRatio = 0.7;

    if (progress <= strokeRatio) {
      const strokeProgress = progress / strokeRatio;
      const offset = pathLength * (1 - strokeProgress);

      // SMART SEEK: Only update if changed significantly (incremental mode)
      if (!isIncremental || !this.lastSeekState || Math.abs(this.lastSeekState.dashOffset - offset) > 0.5) {
        path.setAttribute('stroke-dasharray', pathLength.toString());
        path.setAttribute('stroke-dashoffset', offset.toString());
        path.setAttribute('fill-opacity', '0');

        this.lastSeekState = { dashOffset: offset, fillOpacity: 0 };
      }

      // Hand position - only during active animation
      if (this.handOverlayCanvas && progress > 0 && progress < 1) {
        const currentLength = strokeProgress * pathLength;
        const localPoint = path.getPointAtLength(currentLength);
        const point = this.transformToGlobal({ x: localPoint.x, y: localPoint.y });

        // Get next point for direction calculation
        let nextPoint = point;
        if (strokeProgress < 1.0) {
          const nextLength = Math.min(currentLength + 5, pathLength);
          const localNextPoint = path.getPointAtLength(nextLength);
          nextPoint = this.transformToGlobal({ x: localNextPoint.x, y: localNextPoint.y });
        }

        // Use SeekHandManager for consistent hand positioning
        this.updateHandDuringSeek(progress, {
          currentPoint: point,
          nextPoint: nextPoint,
          pathElement: path
        });
      }
    } else {
      // Fill phase
      const fillProgress = (progress - strokeRatio) / (1 - strokeRatio);
      const easedFill = this.easeOutCubic(fillProgress);

      // SMART SEEK: Only update if changed significantly
      if (!isIncremental || !this.lastSeekState ||
        this.lastSeekState.dashOffset !== 0 ||
        Math.abs(this.lastSeekState.fillOpacity - easedFill) > 0.01) {
        path.setAttribute('stroke-dashoffset', '0');
        path.setAttribute('fill-opacity', easedFill.toString());

        this.lastSeekState = { dashOffset: 0, fillOpacity: easedFill };
      }

      // Only show hand during active animation (not at end)
      if (this.handOverlayCanvas && progress < 1) {
        // Draw hand at the end of the path
        try {
          const localPoint = path.getPointAtLength(pathLength);
          const point = this.transformToGlobal({ x: localPoint.x, y: localPoint.y });

          // Use SeekHandManager for consistent hand positioning
          this.updateHandDuringSeek(progress, {
            currentPoint: point,
            pathElement: path
          });
        } catch (e) {
          // Ignore error
        }
      }
    }
  }

  private animateDraw(duration: number, callback: () => void, initialProgress: number = 0): void {
    const path = this.element as SVGPathElement;

    // Use cached path length if available (from preload), otherwise calculate now
    // PERFORMANCE: Cache prevents expensive getTotalLength() calls during animation
    const pathLength = this.cachedPathLength !== null
      ? this.cachedPathLength
      : path.getTotalLength();

    // If not already cached, cache it now for potential future use
    if (this.cachedPathLength === null) {
      this.cachedPathLength = pathLength;
      if (this.config.debug) {
        console.warn(`[PathLayer ${this.config.id}] Path length not preloaded - calculating during animation (may cause jank)`);
      }
    }

    // Start with opacity 1 but hide fill initially
    this.setOpacity(1);
    const strokeRatio = 0.7;
    const strokeInitialProgress = Math.min(1, initialProgress / strokeRatio);
    const fillInitialProgress = Math.max(0, (initialProgress - strokeRatio) / (1 - strokeRatio));

    path.setAttribute('stroke-dasharray', pathLength.toString());
    path.setAttribute('stroke-dashoffset', (pathLength * (1 - strokeInitialProgress)).toString());

    // Use exact duration without compensation
    const compensatedDuration = Math.max(0.1, duration);

    // Calculate settle time based on compensated duration
    const settleTime = compensatedDuration * SETTLE_RATIO;
    // Effective duration for drawing is compensated duration minus settle time
    const drawingDuration = Math.max(0.1, compensatedDuration - settleTime);

    // Split drawing duration: 70% for stroke, 30% for fill fade-in
    const strokeDuration = drawingDuration * 0.7;
    const fillDuration = drawingDuration * 0.3;

    const startTime = performance.now() - (initialProgress * duration * 1000);
    let totalPausedTime = 0;
    const strokeDurationMs = strokeDuration * 1000;

    const animate = async (currentTime: number) => {
      if (this.isStopped) return;

      const pauseStart = performance.now();
      await this.checkPlaybackState();
      const pauseDuration = performance.now() - pauseStart;
      totalPausedTime += pauseDuration;

      const elapsed = currentTime - startTime - totalPausedTime;
      const progress = Math.min(elapsed / strokeDurationMs, 1);

      // Adjust progress based on strokeInitialProgress to ensure we start from the right point
      // if we are already in the stroke phase.
      const effectiveProgress = strokeInitialProgress < 1
        ? Math.max(strokeInitialProgress, progress)
        : 1;
      const offset = pathLength * (1 - effectiveProgress);
      path.setAttribute('stroke-dashoffset', offset.toString());

      // Update hand overlay position during animation
      if (this.handOverlayManager && this.handOverlayManager.isEnabled()) {
        const currentLength = progress * pathLength;
        const localPoint = path.getPointAtLength(currentLength);

        // Transform from local coordinates to global/scene coordinates
        const point = this.transformToGlobal({ x: localPoint.x, y: localPoint.y });

        // Get next point for direction calculation
        let nextPoint = point;
        if (progress < 1.0) {
          const nextLength = Math.min(currentLength + 5, pathLength);
          const localNextPoint = path.getPointAtLength(nextLength);
          nextPoint = this.transformToGlobal({ x: localNextPoint.x, y: localNextPoint.y });
        }

        this.handOverlayManager.updateHandPosition(effectiveProgress, {
          currentPoint: point,
          nextPoint: nextPoint,
          pathElement: path
        }, this.handOverlayCanvas || undefined);
      }

      if (effectiveProgress < 1) {
        requestAnimationFrame(animate);
      } else {
        path.removeAttribute('stroke-dasharray');
        path.removeAttribute('stroke-dashoffset');

        // Fade in the fill after stroke is done
        this.animateFillFadeIn(fillDuration, async () => {
          // Frame-perfect timing: Calculate precise settle time to hit exact target duration
          const elapsedBeforeSettle = performance.now() - startTime;
          const remainingTime = (duration * 1000) - elapsedBeforeSettle;
          const preciseSettleTime = Math.max(0, remainingTime / 1000);

          // Wait for precise settle time
          if (!this.isStopped && preciseSettleTime > 0) {
            await this.wait(preciseSettleTime);
          }

          // FORCE EXACT TIMING: Ensure we hit the exact target duration
          const targetDurationMs = duration * 1000;
          while (!this.isStopped && performance.now() - startTime < targetDurationMs) {
            // Busy wait for final micro-adjustments to hit exact target
          }

          // Hide hand after settle time
          if (this.handOverlayManager && this.handOverlayManager.isEnabled() && this.handOverlayCanvas) {
            this.handOverlayManager.hideHand(this.handOverlayCanvas);
          }

          callback();
        }, fillInitialProgress);
      }
    };

    requestAnimationFrame(animate);
  }

  private animateFillFadeIn(duration: number, callback: () => void, initialProgress: number = 0): void {
    const startTime = performance.now() - (initialProgress * duration * 1000);
    let totalPausedTime = 0;
    // Use exact duration without compensation
    const compensatedDuration = Math.max(0.05, duration);
    const durationMs = compensatedDuration * 1000;

    const animate = async (currentTime: number) => {
      if (this.isStopped) return;

      const pauseStart = performance.now();
      await this.checkPlaybackState();
      const pauseDuration = performance.now() - pauseStart;
      totalPausedTime += pauseDuration;

      const elapsed = currentTime - startTime - totalPausedTime;
      const progress = Math.min(elapsed / durationMs, 1);
      this.element!.setAttribute('fill-opacity', this.easeOutCubic(progress).toString());

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.element!.setAttribute('fill-opacity', '1');
        callback();
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Get layer type for hand overlay strategy selection
   * PathLayer uses path drawing strategy
   */
  protected getLayerType(): string {
    return 'path';
  }

  /**
   * Check if the layer is "hollow" (no fill).
   */
  public isHollow(): boolean {
    return this.fillColor === 'none' || this.fillColor === 'transparent';
  }

  /**
   * Get a set of points representing the geometric path of the layer.
   * Used for precise occlusion erasing.
   */
  public getErasePath(resolution: number = 100): [number, number][] {
    if (!this.element) return [];
    const path = this.element as SVGPathElement;
    const pathLength = this.cachedPathLength !== null ? this.cachedPathLength : path.getTotalLength();
    const points: [number, number][] = [];

    for (let i = 0; i <= resolution; i++) {
      const progress = i / resolution;
      const currentLength = progress * pathLength;
      try {
        const localPoint = path.getPointAtLength(currentLength);
        const point = this.transformToGlobal({ x: localPoint.x, y: localPoint.y });
        points.push([point.x, point.y]);
      } catch (e) {
        // Ignore errors
      }
    }
    return points;
  }
}

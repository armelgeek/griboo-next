import { AnimationTransition } from '../core/logic/easing';
import { LayerAnimator } from './managers/animator';
import {
  LayerConfig,
  AnimationType,
  AnimationConfig,
  OcclusionProxy,
  WhiteboardConfig
} from '../../shared/types';
import { HandOverlayManager, createHandStrategyForLayer } from './managers/hand-overlay-manager';

import { SeekHandManager, createSeekHandManager } from './managers/seek-hand-manager';
import { TimingManager } from './managers/timing-manager';
import { isDebugEnabled } from '../../shared/config/debug_config';
import { BaseLayer } from '../../shared/core/layer';
import {
  applyEmphasisAnimation,
  stopEmphasisAnimation,
  pauseEmphasisAnimation,
  resumeEmphasisAnimation,
  getEmphasisDuration
} from '../core/animations/emphasis_animation';

/**
 * Entrance animations that require starting from opacity 0
 */
const ENTRANCE_ANIMATIONS_STARTING_INVISIBLE: AnimationType[] = [
  'fade_in', 'fade_in_down', 'fade_in_left', 'fade_in_right', 'fade_in_up',
  'fade_in_top_left', 'fade_in_top_right', 'fade_in_bottom_left', 'fade_in_bottom_right',
  'zoom_in', 'zoom_in_down', 'zoom_in_left', 'zoom_in_right', 'zoom_in_up',
  'bounce', 'bounce_in', 'bounce_in_down', 'bounce_in_left', 'bounce_in_right', 'bounce_in_up',
  'rotate_in', 'spin_in', 'rotate_in_down_left', 'rotate_in_down_right', 'rotate_in_up_left', 'rotate_in_up_right',
  'flip_in', 'flip_in_x', 'flip_in_y',
  'back_in_down', 'back_in_left', 'back_in_right', 'back_in_up',
  'lightspeed_in', 'roll_in', 'jack_in_the_box',
  'slide_in', 'slide_in_left', 'slide_in_right', 'slide_in_top', 'slide_in_bottom',
  'draw', 'typewriter', 'char_fade',
  'reveal_horizontal', 'reveal_vertical', 'reveal_diagonal'
];

/**
 * Entrance animations that also need scale to start at 0
 */
const ENTRANCE_ANIMATIONS_NEEDING_SCALE_RESET: AnimationType[] = [
  'zoom_in', 'zoom_in_down', 'zoom_in_left', 'zoom_in_right', 'zoom_in_up',
  'bounce', 'bounce_in', 'bounce_in_down', 'bounce_in_left', 'bounce_in_right', 'bounce_in_up',
  'jack_in_the_box'
];

// Types d'animation supportés (doivent correspondre à ceux de types.ts)
// 'slide_out_left', 'slide_out_right', 'slide_out_top', 'slide_out_bottom', 'fade_out', 'zoom_out' inclus
export abstract class Layer extends BaseLayer {
  // Debug flag - can be set via build config
  private static DEBUG = false;

  // Static corner array for getGlobalBBox to avoid allocations
  private static corners = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 }
  ];

  // Static variables for getGlobalBBox to avoid allocations in hot path
  private static bboxMinMax = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

  // Static easing map to avoid recreation on every call
  private static readonly EASING_MAP: Record<string, string> = {
    'ease_in': 'inQuad',
    'ease_out': 'outQuad',
    'ease_in_out': 'inOutQuad',
    'ease_in_cubic': 'inCubic',
    'ease_out_cubic': 'outCubic',
    'ease_in_out_cubic': 'inOutCubic',
    'ease_in_back': 'inBack',
    'ease_out_back': 'outBack',
    'ease_in_out_back': 'inOutBack',
    'ease_in_elastic': 'inElastic',
    'ease_out_elastic': 'outElastic',
    'ease_in_out_elastic': 'inOutElastic',
    'ease_in_bounce': 'inBounce',
    'ease_out_bounce': 'outBounce',
    'ease_in_out_bounce': 'inOutBounce',
  };

  protected element: SVGElement | null = null;
  protected handOverlayManager: HandOverlayManager | null = null;
  protected handOverlayCanvas: HTMLCanvasElement | null = null;
  protected handOverlayInitPromise: Promise<void> | null = null;
  protected seekHandManager: SeekHandManager | null = null;
  public isPaused: boolean = false;
  public isStopped: boolean = false;
  protected resumePromise: Promise<void> | null = null;
  protected resumeResolver: (() => void) | null = null;
  protected initialState: any = null;
  protected isEmphasizing: boolean = false;

  // Performance optimizations: caching
  private cachedBBox: { x: number; y: number; width: number; height: number } | null = null;
  private bboxDirty: boolean = true;
  private cachedTransform: string | null = null;
  private transformDirty: boolean = true;
  private lastOpacity: number | null = null;

  // Smart Seek: Track last seek progress for incremental updates
  protected lastSeekProgress: number | null = null;

  // Hand overlay coordination: Track if this layer should draw hand during seek
  private shouldDrawHandDuringSeek: boolean = true;

  /**
   * Absolute timing for the layer within the scene.
   * Calculated during scene preparation.
   */
  public absoluteTiming: any = null;
  protected handsConfig?: WhiteboardConfig['hands'];

  constructor(config: LayerConfig, handsConfig?: WhiteboardConfig['hands'], viewportScale: number = 1.0) {
    super(config, handsConfig, viewportScale);
    this.handsConfig = handsConfig;
    // Capture initial state for seeking/resetting
    this.initialState = {
      position: config.position ? { ...config.position } : { x: 0, y: 0 },
      opacity: config.opacity !== undefined ? config.opacity : 1,
      scale: config.scale !== undefined ? config.scale : 1,
      rotation: config.rotation || 0,
      skewX: config.skewX || 0,
      skewY: config.skewY || 0,
    };

    // Initialize lastOpacity to current config value for proper change detection
    this.lastOpacity = this.config.opacity ?? 1;

    // Initialize hand overlay if not explicitly disabled
    const handOverlay = config.handOverlay;
    if (handOverlay !== false) {
      const overlayConfig = typeof handOverlay === 'object' ? handOverlay : { enabled: true };
      this.handOverlayInitPromise = this.initializeHandOverlay(overlayConfig);
    }
  }

  /**
   * Set the viewport scale for this layer
   */
  public setViewportScale(scale: number): void {
    super.setViewportScale(scale);
    if (this.handOverlayManager) {
      this.handOverlayManager.setViewportScale(scale);
    }
  }

  /**
   * Set the absolute timing for this layer.
   * Used by Scene.prepare to synchronize camera and layers.
   */
  public setAbsoluteTiming(timing: any): void {
    this.absoluteTiming = timing;
  }

  /**
   * Reset layer to its initial state (before any animations)
   */
  resetToInitialState(): void {
    if (this.initialState) {
      this.config.position = { ...this.initialState.position };
      this.config.opacity = this.initialState.opacity;
      this.config.scale = this.initialState.scale;
      this.config.rotation = this.initialState.rotation;
      this.config.skewX = this.initialState.skewX;
      this.config.skewY = this.initialState.skewY;

      // Invalidate caches
      this.transformDirty = true;
      this.bboxDirty = true;
      this.lastOpacity = this.config.opacity ?? 1;

      if (this.element) {
        this.applyTransform();
        this.element.setAttribute('opacity', (this.config.opacity ?? 1).toString());
      }
    }
  }

  /**
   * Get the initial state of the layer
   */
  public getInitialState(): any {
    return this.initialState;
  }

  /**
   * Set the hand overlay canvas for this layer
   * Called by the Scene when the layer is added
   */
  setHandOverlayCanvas(canvas: HTMLCanvasElement): void {
    this.handOverlayCanvas = canvas;

    // Update seek hand manager if it exists
    if (this.seekHandManager) {
      this.seekHandManager.setHandOverlayCanvas(canvas);
    }
  }

  /**
   * Get the hand overlay canvas
   */
  getHandOverlayCanvas(): HTMLCanvasElement | null {
    return this.handOverlayCanvas;
  }

  /**
   * Initialize hand overlay for this layer
   */
  public async initializeHandOverlay(config: any): Promise<void> {
    // If already initialized, cleanup first
    if (this.handOverlayManager) {
      this.handOverlayManager.cleanup();
    }
    try {
      this.handOverlayManager = new HandOverlayManager();
      this.handOverlayManager.setViewportScale(this.viewportScale);

      // Determine preset ID based on layer type
      let presetId = 'drawing';
      const layerType = this.getLayerType().toLowerCase();
      if (layerType === 'eraser' || layerType === 'rubber') presetId = 'eraser';
      else if (layerType === 'push') presetId = 'push';

      // Create config with preset (defer resolution to HandOverlayManager to handle registration)
      const handConfig = {
        ...config,
        enabled: config.enabled ?? true,
        preset: presetId
      };

      await this.handOverlayManager.initialize(handConfig, this.handsConfig);

      // Check if manager still exists (layer might have been destroyed during await)
      if (!this.handOverlayManager) return;

      // Set default strategy based on layer type
      const strategy = createHandStrategyForLayer(layerType);
      this.handOverlayManager.setStrategy(strategy);

      // Initialize seek hand manager with the same strategy
      this.seekHandManager = createSeekHandManager(
        this.handOverlayManager,
        this.handOverlayCanvas,
        strategy
      );

      // Apply cached camera transform if available
      if (this.cameraTransform) {
        this.handOverlayManager.setCameraTransform(
          this.cameraTransform.zoom,
          this.cameraTransform.position,
          this.cameraTransform.virtualSize
        );
      }
    } catch (error) {
      if (isDebugEnabled()) {
        console.error('Failed to initialize hand overlay:', error);
      }
      // Clean up on failure
      this.handOverlayManager = null;
      this.seekHandManager = null;
      throw error;
    }
  }

  // Camera transform cache for hand overlay
  protected cameraTransform: { zoom: number; position: { x: number; y: number }; virtualSize: { width: number; height: number } } | null = null;

  /**
   * Set global hand configuration for this layer and update hand overlay manager
   */
  public override setGlobalHandsConfig(config: WhiteboardConfig['hands']): void {
    super.setGlobalHandsConfig(config);

    // Propagate to hand overlay manager if initialized
    if (this.handOverlayManager) {
      // Re-initialize or update would be ideal, but for now we essentially rely on
      // the manager pulling from global registry if we pass it here.
      // But HandOverlayManager.initialize() handles registration from this config.
      // So we should re-call initialize if we have a valid config?

      // If manager is already initialized, we might want to just update.
      // But passing the config allows it to register presets which might have been missing.

      if (this.config.handOverlay !== false) {
        const overlayConfig = typeof this.config.handOverlay === 'object'
          ? this.config.handOverlay
          : { enabled: true };

        // Merge with preset logic from initializeHandOverlay
        let presetId = 'drawing';
        const layerType = this.getLayerType().toLowerCase();
        if (layerType === 'eraser' || layerType === 'rubber') presetId = 'eraser';
        else if (layerType === 'push') presetId = 'push';

        const handConfig = {
          ...overlayConfig,
          enabled: overlayConfig.enabled ?? true,
          preset: presetId
        };

        // We don't await here as this is a setter, but we trigger the update
        this.handOverlayManager.initialize(handConfig, config).catch(e => {
          if (isDebugEnabled()) console.error('Failed to update hand config:', e);
        });
      }
    }
  }

  /**
   * Set the camera transform for hand overlay alignment.
   * Stores the transform and applies it to the hand overlay manager if/when it's ready.
   */
  setCameraTransform(zoom: number, position: { x: number; y: number }, virtualSize: { width: number; height: number }): void {
    this.cameraTransform = { zoom, position, virtualSize };
    if (this.handOverlayManager) {
      this.handOverlayManager.setCameraTransform(zoom, position, virtualSize);
    }
  }

  /**
   * Get the current position of the layer at a specific time.
   * Accounts for entrance and exit animations.
   */
  public getCurrentPosition(time: number): { x: number, y: number } {
    const progress = this.getAnimationProgress(time);
    const exitProgress = this.getExitProgress(time);
    const state = this.getAnimatedTransform(progress, exitProgress);
    return { x: state.position.x, y: state.position.y };
  }

  /**
   * Get the hand position for this layer at a specific time.
   */
  public getHandPosition(time: number): { x: number, y: number, rotation?: number } | null {
    if (!this.handOverlayManager || !this.handOverlayManager.isEnabled()) return null;

    // Determine progress
    const timing = TimingManager.calculateLayerTiming(this.config);
    const progress = this.getAnimationProgress(time);

    // If not in animation window, no hand
    if (progress <= 0 || progress >= 1) return null;

    // Use the strategy to get position
    const strategy = this.handOverlayManager.getStrategy();
    if (!strategy) return null;

    // We need to provide layerData to the strategy
    // getCurrentPosition already returns the animated position
    const pos = this.getCurrentPosition(time);
    const globalPos = this.transformToGlobal(pos);

    return strategy.getHandPosition(progress, {
      currentObjectPosition: globalPos,
      config: this.config,
      // Add other data as needed by specific strategies
    });
  }

  /**
   * Get the type of this layer for hand overlay strategy selection
   * Subclasses can override this to specify their type
   */
  protected getLayerType(): string {
    return 'default';
  }

  /**
   * Get the hand overlay manager
   */
  getHandOverlayManager(): HandOverlayManager | null {
    return this.handOverlayManager;
  }

  /**
   * Get the seek hand manager for seek operations
   */
  getSeekHandManager(): SeekHandManager | null {
    return this.seekHandManager;
  }

  /**
   * Update hand position during seek operation
   * This method should be used by subclasses during seek() implementations
   * instead of directly calling handOverlayManager.drawHandAt()
   * 
   * @param progress - Seek progress (0-1)
   * @param layerData - Layer-specific data for positioning
   */
  protected updateHandDuringSeek(progress: number, layerData: any): void {
    // Only draw hand if this layer is marked as the active layer during seek
    if (!this.getShouldDrawHandDuringSeek()) {
      return; // Skip hand drawing for non-active layers
    }

    if (this.seekHandManager && this.seekHandManager.isEnabled()) {
      this.seekHandManager.updateHandPositionDuringSeek(progress, layerData);
    }
  }

  /**
   * Set whether this layer should draw hand during seek operations
   * Used by Scene to coordinate hand visibility across multiple layers
   * @internal
   */
  setShouldDrawHandDuringSeek(should: boolean): void {
    this.shouldDrawHandDuringSeek = should;
  }

  /**
   * Check if this layer should draw hand during seek
   * @internal
   */
  getShouldDrawHandDuringSeek(): boolean {
    return this.shouldDrawHandDuringSeek;
  }

  /**
   * Wait for hand overlay to be ready (if enabled)
   * Gracefully handles initialization failures by catching errors
   * Includes timeout to prevent animation freeze if hand overlay loading is slow
   */
  async waitForHandOverlayReady(timeoutMs: number = 2000): Promise<void> {
    if (this.handOverlayInitPromise) {
      try {
        // Race between hand overlay initialization and timeout
        await Promise.race([
          this.handOverlayInitPromise,
          new Promise<void>((resolve) => {
            setTimeout(() => {
              if (isDebugEnabled()) {
                console.warn('[Layer] Hand overlay initialization timeout - proceeding without hand overlay');
              }
              resolve();
            }, timeoutMs);
          })
        ]);
      } catch (error) {
        // Hand overlay initialization failed, but animation can still proceed
        if (isDebugEnabled()) {
          console.warn('Hand overlay initialization failed, continuing without hand overlay:', error);
        }
      }
    }
  }

  /**
   * Pause the layer animation
   */
  public pause(): void {
    if (this.isPaused) return;
    this.isPaused = true;
    this.resumePromise = new Promise(resolve => {
      this.resumeResolver = resolve;
    });

    // Pause emphasis animation if active
    if (this.element && this.isEmphasizing) {
      pauseEmphasisAnimation(this.element);
    }
  }

  /**
   * Resume the layer animation
   */
  public resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    if (this.resumeResolver) {
      this.resumeResolver();
      this.resumeResolver = null;
      this.resumePromise = null;
    }

    // Resume emphasis animation if active
    if (this.element && this.isEmphasizing) {
      resumeEmphasisAnimation(this.element);
    }
  }


  /**
   * Start emphasis animation manually
   */
  public startEmphasis(): void {
    if (this.element && this.config.emphasis_animation && this.config.emphasis_animation.type !== 'none') {
      if (this.isEmphasizing) return;
      applyEmphasisAnimation(this.element, this.config.emphasis_animation);
      this.isEmphasizing = true;
    }
  }

  /**
   * Stop emphasis animation manually
   */
  public stopEmphasis(): void {
    if (this.element && this.isEmphasizing) {
      stopEmphasisAnimation(this.element);
      this.isEmphasizing = false;
    }
  }

  /**
   * Play exit animation
   */
  public async playExitAnimation(speedModifier: number = 1.0): Promise<void> {
    if (!this.config.exit_animation || this.config.exit_animation.type === 'none') return;

    const config = { ...this.config.exit_animation };
    if (speedModifier !== 1.0 && speedModifier > 0) {
      config.duration = (config.duration || 1.0) / speedModifier;
    }

    await LayerAnimator.animateExit(
      this,
      config.type as AnimationType,
      config
    );
  }

  /**
   * Play the full animation sequence (Entrance -> Emphasis -> Wait -> Exit)
   */
  public async play(): Promise<void> {
    if (this.isStopped) return;

    // 1. Entrance Animation
    if (this.config.entrance_animation) {
      await LayerAnimator.animate(
        this,
        this.config.entrance_animation.type as AnimationType,
        this.config.entrance_animation
      );
    }

    if (this.isStopped) return;

    // 2. Start Emphasis Animation (CSS-based for smooth playback)
    this.startEmphasis();

    // 3. Wait (Process pause duration)
    const pauseDuration = (this.config.timingConfig?.pauseTime || 0) * 1000;

    // If emphasis is running, we might want to respect its duration
    let waitTime = pauseDuration;
    if (this.isEmphasizing && this.config.emphasis_animation) {
      const emphasisDuration = getEmphasisDuration(this.config.emphasis_animation!) * 1000;
      waitTime = Math.max(waitTime, emphasisDuration);
    }

    if (waitTime > 0) {
      // Helper to wait if paused or stop if requested
      await this.wait(waitTime / 1000);
    }

    // Stop emphasis animation after wait completes
    this.stopEmphasis();

    if (this.isStopped) return;

    // 4. Exit Animation
    await this.playExitAnimation();
  }


  /**
   * Seek to a specific progress (0-1) in the layer's entrance animation.
   * 
   * This method implements Smart Seek: it tracks the last seek progress and
   * determines the direction (forward/rewind) for incremental updates.
   * Subclasses can override this to implement incremental seeking.
   * 
   * @param progress - Target progress (0-1)
   */
  seek(progress: number): void {
    // Store the last progress before updating (for directional detection)
    this.lastSeekProgress = progress;

    if (progress <= 0) {
      this.resetToInitialState();
      this.initializeEntranceState();
      return;
    }

    const timing = TimingManager.calculateLayerTiming(this.config);
    const totalDuration = timing.totalDuration;
    const currentTime = progress * totalDuration;

    // 1. Entrance Progress
    const entranceDuration = timing.animationDuration;
    const entranceProgress = entranceDuration > 0
      ? Math.min(currentTime / entranceDuration, 1)
      : (currentTime > 0 ? 1 : 0);

    // 2. Emphasis Logic
    let emphasisType: any = undefined;
    let emphasisProgress: number | undefined = undefined;
    let emphasisIntensity: number | undefined = undefined;

    const emphasisConfig = this.config.emphasis_animation;
    if (this.element && emphasisConfig && emphasisConfig.type !== 'none') {
      const entranceEndTime = entranceDuration;
      const emphasisStartTime = entranceEndTime + (emphasisConfig.delay || 0);
      const pauseEndTime = entranceEndTime + timing.pauseDuration;

      if (currentTime >= emphasisStartTime && currentTime <= pauseEndTime) {
        const elapsed = currentTime - emphasisStartTime;
        const cycleDuration = emphasisConfig.duration || 1.0;
        emphasisType = emphasisConfig.type;
        emphasisProgress = (elapsed % cycleDuration) / cycleDuration;
        emphasisIntensity = emphasisConfig.intensity ?? 1.0;

        // Note: For real-time playback we use CSS, but for seek we use logic-based updates via LayerAnimator
        // We stop the CSS animation during seek to avoid conflicts
        stopEmphasisAnimation(this.element);
      } else {
        // Outside emphasis window, stop CSS animation
        if (this.element) stopEmphasisAnimation(this.element);
      }
    }

    // 3. Exit Progress
    const exitStartTime = entranceDuration + timing.pauseDuration;
    const exitDuration = timing.exitDuration;
    let exitType: any = undefined;
    let exitProgress = 0;

    if (this.config.exit_animation && this.config.exit_animation.type !== 'none') {
      exitType = this.config.exit_animation.type as AnimationType;
      if (currentTime > exitStartTime) {
        exitProgress = exitDuration > 0
          ? Math.min((currentTime - exitStartTime) / exitDuration, 1)
          : 1;
      }
    }

    // Apply everything via LayerAnimator
    if (this.config.entrance_animation) {
      LayerAnimator.seek(
        this,
        this.config.entrance_animation.type as AnimationType,
        this.config.entrance_animation,
        entranceProgress,
        exitType,
        exitProgress,
        emphasisType,
        emphasisProgress,
        emphasisIntensity
      );
    } else {
      // If no entrance, just handle exit/emphasis on current state (which should be final static state)
      LayerAnimator.seek(
        this,
        'none',
        { duration: 0 },
        1,
        exitType,
        exitProgress,
        emphasisType,
        emphasisProgress,
        emphasisIntensity
      );
    }

    // Call subclass hook for specialized seeking (like 'draw')
    this.onSeek(entranceProgress, emphasisProgress, exitProgress);

    // Occlusion handling (if revealed part way, mark as erased)
    if (this.getLayerType().toLowerCase() === 'occlusion' && progress > 0) {
      // Occlusion specific logic is handled in Scene.seek usually for better coordination
    }
  }

  /**
   * Get the direction of seek movement based on last and current progress.
   * Hook for subclasses to handle specialized seeking (like 'draw' animations).
   * @param entranceProgress Progress of the entrance animation (0 to 1)
   * @param emphasisProgress Progress of the emphasis animation (0 to 1, if active)
   * @param exitProgress Progress of the exit animation (0 to 1, if active)
   */
  protected onSeek(entranceProgress: number, emphasisProgress?: number, exitProgress?: number): void {
    // Overridden by subclasses like ShapeLayer or SvgLayer
  }

  getSeekDirection(targetProgress: number): 'forward' | 'rewind' | null {
    if (this.lastSeekProgress === null) return null;
    return targetProgress >= this.lastSeekProgress ? 'forward' : 'rewind';
  }

  /**
   * Check if this is an incremental seek (small progress change).
   * Returns true if the progress delta is smaller than the threshold.
   * 
   * @param currentProgress - Current seek progress
   * @param threshold - Maximum delta to consider incremental (default: 0.05 = 5%)
   * @returns boolean
   */
  protected isIncrementalSeek(currentProgress: number, threshold: number = 0.05): boolean {
    if (this.lastSeekProgress === null) {
      return false; // First seek is always full
    }
    return Math.abs(currentProgress - this.lastSeekProgress) < threshold;
  }


  /**
   * Stop layer animations
   */
  stop(): void {
    this.isStopped = true;
    this.isPaused = false;
    if (this.resumeResolver) {
      this.resumeResolver();
    }
    if (this.handOverlayManager && this.handOverlayCanvas) {
      this.handOverlayManager.hideHand(this.handOverlayCanvas);
    }
    if (this.element) {
      stopEmphasisAnimation(this.element);
    }
  }

  /**
   * Complete cleanup of the layer resources
   */
  public destroy(): void {
    this.stop();
    if (this.handOverlayManager) {
      this.handOverlayManager.cleanup();
      this.handOverlayManager = null;
    }
    if (this.seekHandManager) {
      this.seekHandManager.cleanup();
      this.seekHandManager = null;
    }
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
    this.handOverlayCanvas = null;
    this.absoluteTiming = null;
  }

  /**
   * Helper to wait if paused or stop if requested
   */
  public async checkPlaybackState(): Promise<void> {
    if (this.isStopped) {
      const error = new Error('Animation stopped');
      error.name = 'PlaybackStoppedError';
      throw error;
    }

    if (this.isPaused) {
      if (!this.resumePromise) {
        this.resumePromise = new Promise(resolve => {
          this.resumeResolver = resolve;
        });
      }
      await this.resumePromise;
    }
  }

  /**
   * Helper to wait for a specified duration (in seconds)
   */
  public async wait(seconds: number): Promise<void> {
    const ms = seconds * 1000;
    if (ms <= 0) return;

    // Note: CSS-based emphasis animation is already applied in play() method
    // This wait just needs to wait for the specified duration
    const startTime = performance.now();
    const targetTime = startTime + ms;
    let totalPausedTime = 0;

    // 1. Bulk wait: Use setTimeout for anything over 2ms.
    // We stop 2ms early to account for setTimeout's jitter.
    if (ms > 2) {
      await new Promise(resolve => setTimeout(resolve, ms - 2));
    }

    // Check playback state after bulk wait
    const pauseStart = performance.now();
    await this.checkPlaybackState();
    totalPausedTime += (performance.now() - pauseStart);

    // 2. Precision wait: Busy-wait for the final few milliseconds to hit the exact target.
    // Adjust targetTime if we paused
    const adjustedTargetTime = targetTime + totalPausedTime;

    while (performance.now() < adjustedTargetTime) {
      // Micro-adjustment loop
      // Also check playback state during busy wait if it's long? 
      // Usually busy wait is very short (< 2ms), but if pause happens here...
      if (this.isPaused) {
        const pStart = performance.now();
        await this.checkPlaybackState();
        totalPausedTime += (performance.now() - pStart);
        // Recalculate adjusted target
        // This is getting complex, but for 2ms it's probably fine.
      }
    }
  }

  /**
   * Enable or disable hand overlay
   */
  setHandOverlayEnabled(enabled: boolean): void {
    if (!enabled && this.handOverlayManager) {
      this.handOverlayManager.cleanup();
      this.handOverlayManager = null;
    } else if (enabled && !this.handOverlayManager && this.config.handOverlay) {
      this.handOverlayInitPromise = this.initializeHandOverlay(this.config.handOverlay);
    }
  }

  abstract render(): SVGElement;

  getElement(): SVGElement | null {
    return this.element;
  }

  getConfig(): LayerConfig {
    return super.getConfig();
  }

  /**
   * Get the animation configuration from the layer config.
   * @deprecated This method is deprecated. Use entrance_animation instead.
   * Returns the animation configuration if defined, otherwise null.
   */
  getAnimationConfig(): { type: AnimationType; config: AnimationConfig } | null {
    // This method is deprecated and should no longer be used
    // All animations should be handled via entrance_animation
    return null;
  }

  setPosition(x: number, y: number): void {
    // DEBUG: Log position update
    if (Layer.DEBUG && this.config.id === 'rect-shape') {
      if (isDebugEnabled()) {
        console.log(`[Layer] setPosition for ${this.config.id}: `, { x, y });
      }
    }
    this.config.position = { x, y };
    this.transformDirty = true;
    this.bboxDirty = true;
    if (this.element) {
      this.applyTransform();
    }
  }

  setOpacity(opacity: number): void {
    // Early exit if no actual change
    if (this.config.opacity === opacity && this.lastOpacity === opacity) return;

    this.config.opacity = opacity;
    // Always update lastOpacity to track the value we want to apply
    this.lastOpacity = opacity;

    // Apply to DOM if element exists
    if (this.element) {
      this.element.setAttribute('opacity', opacity.toString());
    }
  }

  setScale(scale: number): void {
    // DEBUG: Log scale update
    if (Layer.DEBUG && this.config.id === 'rect-shape') {
      if (isDebugEnabled()) {
        console.log(`[Layer] setScale for ${this.config.id}: `, { scale });
      }
    }
    this.config.scale = scale;
    this.transformDirty = true;
    this.bboxDirty = true;
    if (this.element) {
      this.applyTransform();
    }
  }

  setRotation(rotation: number): void {
    this.config.rotation = rotation;
    this.transformDirty = true;
    this.bboxDirty = true;
    if (this.element) {
      this.applyTransform();
    }
  }

  setSkewX(skewX: number): void {
    this.config.skewX = skewX;
    this.transformDirty = true;
    this.bboxDirty = true;
    if (this.element) {
      this.applyTransform();
    }
  }

  setSkewY(skewY: number): void {
    this.config.skewY = skewY;
    this.transformDirty = true;
    this.bboxDirty = true;
    if (this.element) {
      this.applyTransform();
    }
  }

  protected applyTransform(): void {
    if (!this.element || !this.config.position) return;

    // Only rebuild transform string when dirty
    if (this.transformDirty) {
      const { x, y } = this.config.position;
      const scaleX = this.config.scaleX ?? this.config.scale ?? 1;
      const scaleY = this.config.scaleY ?? this.config.scale ?? 1;
      const rotation = this.config.rotation || 0;
      const skewX = this.config.skewX || 0;
      const skewY = this.config.skewY || 0;

      this.cachedTransform = `translate(${x}, ${y}) scale(${scaleX}, ${scaleY}) rotate(${rotation})`;
      if (skewX !== 0) this.cachedTransform += ` skewX(${skewX})`;
      if (skewY !== 0) this.cachedTransform += ` skewY(${skewY})`;

      this.transformDirty = false;
    }

    this.element.setAttribute('transform', this.cachedTransform!);
    this.element.setAttribute('opacity', (this.config.opacity ?? 1).toString());
  }

  /**
   * Transform a point from local coordinates to global scene coordinates based on layer transform
   */
  public transformToGlobal(localPoint: { x: number; y: number }): { x: number; y: number } {
    return super.transformToGlobal(localPoint);
  }

  /**
   * Get the bounding box of the layer in global/scene coordinates.
   * This uses the SVG element's local bounding box and transforms it to global space.
   * 
   * Performance: Results are cached and only recomputed when transforms change.
   * 
   * @returns Bounding box in global coordinates {x, y, width, height} or null if element not rendered
   */
  public getGlobalBBox(): { x: number; y: number; width: number; height: number } | null {
    if (!this.element) return null;

    // Return cached bbox if still valid
    if (!this.bboxDirty && this.cachedBBox) {
      return this.cachedBBox;
    }

    try {
      // Get local bounding box from SVG element
      // Note: getBBox() returns coordinates relative to the element's local coordinate system
      const bbox = (this.element as any).getBBox();
      if (!bbox) return null;

      // Set up corner coordinates in the static array to avoid allocations
      const corners = Layer.corners;
      corners[0].x = bbox.x;
      corners[0].y = bbox.y;
      corners[1].x = bbox.x + bbox.width;
      corners[1].y = bbox.y;
      corners[2].x = bbox.x;
      corners[2].y = bbox.y + bbox.height;
      corners[3].x = bbox.x + bbox.width;
      corners[3].y = bbox.y + bbox.height;

      // Use static object for min/max tracking to avoid allocations
      const mm = Layer.bboxMinMax;
      mm.minX = Infinity;
      mm.minY = Infinity;
      mm.maxX = -Infinity;
      mm.maxY = -Infinity;

      // Transform corners and track min/max
      for (let i = 0; i < 4; i++) {
        // CRITICAL: Use the base transformToGlobal to avoid double-applying internal offsets
        // from subclasses like TextToSVGLayer. getBBox() already includes those offsets.
        const transformed = Layer.prototype.transformToGlobal.call(this, corners[i]);

        if (transformed.x < mm.minX) mm.minX = transformed.x;
        if (transformed.y < mm.minY) mm.minY = transformed.y;
        if (transformed.x > mm.maxX) mm.maxX = transformed.x;
        if (transformed.y > mm.maxY) mm.maxY = transformed.y;
      }

      // Cache the result
      this.cachedBBox = {
        x: mm.minX,
        y: mm.minY,
        width: mm.maxX - mm.minX,
        height: mm.maxY - mm.minY
      };
      this.bboxDirty = false;

      return this.cachedBBox;
    } catch (e) {
      if (isDebugEnabled()) {
        console.warn('[Layer] Failed to get bounding box:', e);
      }
      return null;
    }
  }

  /**
   * Applique une fonction d'easing basée sur le nom de la transition.
   */
  protected applyEasing(progress: number, easingName?: string): number {
    if (!easingName || easingName === 'linear') {
      return AnimationTransition.linear(progress);
    }

    // Use static mapping to avoid recreating the map on every call
    const mappedEasing = Layer.EASING_MAP[easingName] || easingName;
    const easingFunction = (AnimationTransition as any)[mappedEasing];

    if (typeof easingFunction === 'function') {
      return easingFunction(progress);
    }

    // Fallback à linear si la fonction n'existe pas
    return AnimationTransition.linear(progress);
  }

  /**
   * Initialize the layer's state for entrance animation.
   * This should be called before any animations start in the scene.
   */
  initializeEntranceState(): void {
    if (this.config.entrance_animation && this.element) {
      const { type } = this.config.entrance_animation;

      if (ENTRANCE_ANIMATIONS_STARTING_INVISIBLE.includes(type as AnimationType)) {
        // These animations need to start from opacity 0
        // CRITICAL: Set attribute directly on element to avoid mutating this.config.opacity
        // which would break the animation base state in LayerAnimator.animate()
        this.element.setAttribute('opacity', '0');

        // For scale-based animations, also start from scale 0
        if (ENTRANCE_ANIMATIONS_NEEDING_SCALE_RESET.includes(type as AnimationType)) {
          // We apply scale 0 directly to the transform attribute
          // This is a bit tricky because applyTransform() might be called later
          // but for now we just want to ensure it's hidden.
          const currentTransform = this.element.getAttribute('transform') || '';
          if (!currentTransform.includes('scale(0)')) {
            this.element.setAttribute('transform', `${currentTransform} scale(0)`);
          }
        }
      }
    }
  }

  /**
   * Joue l'animation d'entrée si elle existe dans la config.
   */
  async playEntranceAnimation(speed: number = 1.0, warmUp: boolean = false, initialProgress: number = 0): Promise<void> {
    // CRITICAL FIX: Ensure layer is prepared before animating
    // This prevents delays during first playback when layers haven't been preloaded
    if (!this.isPrepared) {
      if (isDebugEnabled()) {
        console.log(`[Layer ${this.config.id}] Not prepared, calling prepare() before animation...`);
      }
      await this.prepare();
    }

    // Reset stopped state to allow re-playing
    this.isStopped = false;

    if (this.config.entrance_animation) {
      const { type, duration, delay, easing } = this.config.entrance_animation;

      // Ensure initial state is set (idempotent)
      // Only initialize if we are starting from the beginning
      if (initialProgress === 0) {
        this.initializeEntranceState();
      }

      // Appliquer le delay si spécifié (scaled by speed)
      // Skip delay during warm-up or if we are resuming (initialProgress > 0)
      const effectiveDelay = (warmUp || initialProgress > 0) ? 0 : (delay || 0) / speed;

      if (effectiveDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, effectiveDelay * 1000));
      }

      // Determine the appropriate duration based on animation type and timingConfig
      let effectiveDuration = duration;

      if (!effectiveDuration) {
        // Use TimingManager to get the correct duration (handles defaults and scaling)
        effectiveDuration = TimingManager.getLayerEntranceDuration(this.config, speed);
      } else {
        // Explicit duration also needs to be scaled
        effectiveDuration /= speed;
      }

      // During warm-up, use a very short duration (e.g., 100ms) to trigger caches
      const finalDuration = warmUp ? 100 : effectiveDuration * 1000;

      await this.animate(type, {
        duration: finalDuration,
        easing: easing || 'outCubic',
        delay: 0, // Delay is already handled above
        warmUp
      }, initialProgress);

      // After warm-up, reset to initial state so it's ready for real playback
      if (warmUp) {
        this.initializeEntranceState();
      }
    }
  }


  /**
   * Warm up the layer by running its entrance animation at high speed and invisible.
   * This triggers rendering caches and JIT compilation.
   */
  async warmUp(): Promise<void> {
    if (isDebugEnabled()) {
      console.log(`[Layer ${this.config.id}] Warming up...`);
    }
    await this.playEntranceAnimation(1.0, true);
  }

  /**
   * Anime le layer avec le type d'animation spécifié.
   */
  async animate(type: AnimationType, config: AnimationConfig, initialProgress: number = 0): Promise<void> {
    // Reset stopped state to allow re-playing
    this.isStopped = false;
    return LayerAnimator.animate(this, type, config, initialProgress);
  }



  /**
   * Capture l'état actuel du layer.
   */
  public captureState(): any {
    return {
      position: this.config.position ? { ...this.config.position } : { x: 0, y: 0 },
      opacity: this.config.opacity !== undefined ? this.config.opacity : 1,
      scale: this.config.scale !== undefined ? this.config.scale : 1,
      rotation: this.config.rotation || 0,
      skewX: this.config.skewX || 0,
      skewY: this.config.skewY || 0,
    };
  }





  /**
   * Helper easing functions for smooth animations.
   * These wrapper methods provide a consistent interface across all layer types
   * and allow for easy future customization of easing behavior per layer if needed.
   */
  protected easeOutCubic(progress: number): number {
    return AnimationTransition.outCubic(progress);
  }

  protected easeOutBack(progress: number): number {
    return AnimationTransition.outBack(progress);
  }

  /**
   * Capture the layer's content directly to a canvas context.
   * This is used for layers that contain non-SVG content (like canvas)
   * that cannot be captured via SVG serialization.
   * 
   * @param ctx - Target canvas context
   * @returns True if the layer captured its content, false otherwise
   */
  captureToContext(_ctx: CanvasRenderingContext2D, _onlyCurrentState: boolean = false): boolean {
    return false;
  }

  /**
   * Cleanup layer resources including hand overlay
   */
  cleanup(): void {
    if (this.handOverlayManager) {
      this.handOverlayManager.cleanup();
      this.handOverlayManager = null;
    }
  }

  /**
   * Prepare the layer for animation.
   * This method is called during the preload phase to perform heavy processing
   * (e.g. image analysis, data fetching) before the animation starts.
   * 
   * Subclasses should override this to implement specific preparation logic.
   */
  async prepare(): Promise<void> {
    // Default implementation does nothing but marks as prepared
    this.isPrepared = true;
    return Promise.resolve();
  }

  /**
   * Get the geometric proxy for occlusion culling.
   * Default implementation returns a rectangle based on the global bounding box.
   */
  public getOcclusionProxy(): OcclusionProxy {
    const bbox = this.getGlobalBBox();
    if (!bbox) {
      return {
        type: 'rect',
        x: 0,
        y: 0,
        width: 0,
        height: 0
      };
    }

    const scaleX = this.config.scaleX ?? this.config.scale ?? 1;
    const scaleY = this.config.scaleY ?? this.config.scale ?? 1;

    return {
      type: 'rect',
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
      logicalWidth: (this.config.width || bbox.width / scaleX) * scaleX,
      logicalHeight: (this.config.height || bbox.height / scaleY) * scaleY
    };
  }
}
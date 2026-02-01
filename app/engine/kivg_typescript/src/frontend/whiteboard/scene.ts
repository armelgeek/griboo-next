import { SceneConfig, SceneTransitionConfig, WhiteboardConfig } from "./types";
import { BackgroundManager } from "./managers/background-manager";
import { Layer } from "./layer";
import {
  SlideEraserConfig,
  addWiggleToPosition,
} from "../core/layers/eraser";
import { AnimationTransition } from "../core/logic/easing";
import { isDebugEnabled } from '../../shared/config/debug_config';
import {
  OcclusionCullingManager,
  OcclusionSceneContext,
  GeometricEraseData,
  isEraserOrRubberLayer
} from "./managers/occlusion-culling";
import { HandOverlayManager, EraserHandStrategy } from "./managers/hand-overlay-manager";

import { getHandOverlayConfigFromPreset } from "./utils/hand-config";
import { TimingManager } from "./managers/timing-manager";
import { OcclusionLayer } from "./layers/occlusion-layer";
import { LRUCache, AnimationScheduler, DOMBatcher } from "./utils/performance-utils";
import { AudioManager } from "../core/infra/audio";
import { CameraController } from "../core/logic/camera";
import { PreciseAnimationEngine } from "../core/logic/precise-animation-engine";
import { layerPreparationCache } from "../../shared/infra/layer-preparation-cache";
import { PersistentCacheManager } from "./utils/persistent-cache";
import { interpolateCamera } from "../../shared/utils/camera_utils";
import { getEmphasisDuration } from "../core/animations/emphasis_animation";
import { LoadingManager } from "../core/infra/loading";

export const DEFAULT_ERASER_IMAGE_QUALITY = 0.8;

/**
 * Default background color used when scene background is not specified.
 * Used by eraser animations to fill transparent pixels.
 */
export const DEFAULT_BACKGROUND_COLOR = "#ffffff";

/**
 * Type guard to check if a layer has been prepared (has isPrepared property set to true)
 */
function isLayerPrepared(layer: Layer): boolean {
  return (layer as any).isPrepared === true;
}
export class Scene implements OcclusionSceneContext {
  public config: SceneConfig;
  public layers: Map<string, Layer> = new Map();
  public layerOrder: string[] = [];
  private sceneContainer: SVGGElement;
  private group: SVGGElement;
  private eraserConfig?: SlideEraserConfig;
  public parentSvg: SVGSVGElement | null = null;
  public sceneHandOverlayManager: HandOverlayManager | null = null;
  public handOverlayCanvas: HTMLCanvasElement | null = null;
  public backgroundManager: BackgroundManager | null = null;
  private occlusionApplied: boolean = false;
  private activeEngine: PreciseAnimationEngine | null = null;

  // OPTIMIZATION: Replace unbounded Map with LRU cache
  public partialEraseCache: LRUCache<string, GeometricEraseData[]>;

  public partialEraseEnabled: boolean = true;
  private isPaused: boolean = false;
  private currentTime: number = 0;
  private static readonly VIRTUALIZATION_WINDOW = 10; // +/- 10 seconds
  private isStopped: boolean = false;
  private resumeResolver: (() => void) | null = null;
  private resumePromise: Promise<void> | null = null;
  private occlusionCullingManager: OcclusionCullingManager;
  private audioManager: AudioManager | null = null;
  private width: number = 0;
  private height: number = 0;
  private cameraController: CameraController | null = null;
  private cameraAnimationId: number | null = null;
  private isPrepared: boolean = false;
  private handsConfig?: WhiteboardConfig['hands'];
  private viewportScale: number = 1.0;
  private cachedPlaybackSequence: Layer[] | null = null;

  // Caching for durations
  private cachedTiming: any = null;
  private lastTimingUpdate: number = 0;

  /**
   * Timing error accumulator for precise duration control.
   * 
   * This system compensates timing drift to ensure scenes hit their target duration:
   * - **Negative error (running ahead)**: Adds wait periods to slow down ✅
   * - **Positive error (running behind)**: Cannot compensate without breaking animations ❌
   * 
   * Design rationale:
   * - Completed animations cannot be "sped up" retroactively without losing frames
   * - Preserving animation integrity is prioritized over millisecond accuracy
   * - In extreme conditions (CPU throttling, background tabs), scenes may exceed target duration
   * 
   * Note: Large positive drift (>10% of scene duration) cannot be recovered
   * without sacrificing visual quality.
   */

  // OPTIMIZATION: Replace unbounded Map with LRU cache with blob URL cleanup
  private blobUrlCache: LRUCache<string, string>;

  public get id(): string {
    return this.config.id;
  }

  public get duration(): number {
    return this.config.duration || 5;
  }

  constructor(config: SceneConfig, handsConfig?: WhiteboardConfig['hands'], viewportScale: number = 1.0) {
    this.config = config;
    this.handsConfig = handsConfig;
    this.viewportScale = viewportScale;
    this.sceneContainer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    this.sceneContainer.setAttribute("class", "scene-container");
    this.sceneContainer.setAttribute("opacity", "0");

    this.group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    this.group.setAttribute("id", config.id);
    this.group.setAttribute("class", "scene-transformed-group");

    this.sceneContainer.appendChild(this.group);

    // OPTIMIZATION: Initialize LRU caches with bounded size
    // Prevents unbounded memory growth
    this.partialEraseCache = new LRUCache<string, GeometricEraseData[]>(
      50,  // Max 50 entries
      30000 // Cleanup every 30s
    );

    // Blob URL cache with automatic cleanup on eviction
    this.blobUrlCache = new LRUCache<string, string>(
      20,  // Max 20 blob URLs
      30000,
      // Revoke blob URL on eviction to prevent memory leak
      (key, url) => {
        URL.revokeObjectURL(url);
        if (isDebugEnabled()) {
          console.log(`[Scene ${this.config.id}] Revoked blob URL: ${key}`);
        }
      }
    );

    // Configuration eraser si présente dans config
    if (config.eraser_config) {
      this.eraserConfig = config.eraser_config as any;
    } else if (config.eraser) {
      this.eraserConfig = config.eraser as any;
    }

    // Initialize persistent cache and try to load existing data
    this.initPersistentCache();

    // Initialize scene-level hand overlay if not explicitly disabled
    if (config.handOverlay?.enabled !== false) {
      this.sceneHandOverlayManager = new HandOverlayManager({ enabled: true });
    }

    // Initialize occlusion culling manager
    this.occlusionCullingManager = new OcclusionCullingManager(this);

    // Initialize Audio and Camera if config is present
    // This will be called again by setParentSvg/attachTo once dimensions are known
    this.initAudioAndCamera();
  }

  /**
   * Initialize persistent cache for the scene
   */
  private async initPersistentCache(): Promise<void> {
    const cache = PersistentCacheManager.getInstance();
    await cache.init();

    // We can't easily load all data into memory at start, 
    // but the cache is ready for get/set calls.
    if (isDebugEnabled()) {
      console.log(`[Scene ${this.config.id}] Persistent cache initialized`);
    }
  }

  /**
   * Initialize Audio and Camera modules based on config
   */
  private initAudioAndCamera(): void {
    const { width, height } = this.getSceneDimensions();

    // Initialize Camera
    if (this.config.camera) {
      const initial = this.config.camera.initial || {};
      this.cameraController = new CameraController(
        width,
        height,
        initial,
        this.config.camera.virtualSize,
        this.config.camera.followMode
      );
      if (this.config.camera.keyframes) {
        this.config.camera.keyframes.forEach(kf => {
          this.cameraController?.addKeyframe(kf);
        });
      }
    }

    // Initialize Audio Manager (loading will happen in preload)
    if (this.config.audio) {
      this.audioManager = new AudioManager();
      if (this.config.duration) {
        this.audioManager.setTotalDuration(this.config.duration);
      }
    }
  }

  /**
   * Load audio tracks based on config
   */
  private async loadAudio(): Promise<void> {
    if (!this.audioManager || !this.config.audio) return;

    const audioConfig = this.config.audio;

    // Load background music
    if (audioConfig.background_music) {
      if (typeof audioConfig.background_music === 'string') {
        await this.audioManager.loadBackgroundMusic(audioConfig.background_music);
      } else {
        await this.audioManager.loadBackgroundMusic(audioConfig.background_music.path, {
          volume: audioConfig.background_music.volume,
          loop: audioConfig.background_music.loop,
          fadeIn: audioConfig.background_music.fade_in,
          fadeOut: audioConfig.background_music.fade_out
        });
      }
    }

    // Add sound effects
    if (audioConfig.sound_effects) {
      for (const sf of audioConfig.sound_effects) {
        await this.audioManager.addSoundEffect(sf.path, sf.start_time || 0, sf.volume, sf.duration);
      }
    }

    // Add voice overs
    if (audioConfig.voice_overs) {
      for (const vo of audioConfig.voice_overs) {
        await this.audioManager.addVoiceOver(vo.path, vo.start_time || 0, vo.volume);
      }
    }
  }

  /**
   * Clean up scene resources
   */
  /**
   * OPTIMIZED: Properly destroy all resources including LRU caches
   * Prevents memory leaks by cleaning up blob URLs and cache intervals
   */
  public destroy(): void {
    this.stop();

    // Clean up layers
    this.layers.forEach(layer => {
      if (typeof (layer as any).destroy === 'function') {
        (layer as any).destroy();
      }
    });
    this.layers.clear();

    // OPTIMIZATION: Destroy LRU caches (revokes all blob URLs, clears intervals)
    this.partialEraseCache.destroy();
    this.blobUrlCache.destroy();

    if (this.occlusionCullingManager) {
      this.occlusionCullingManager.destroy();
    }

    // Clean up camera animation
    this.stopCameraAnimation();

    if (this.audioManager) {
      this.audioManager.clear();
    }
  }

  /**
   * Set global hand configuration for this scene.
   * Propagates to all existing layers and any future layers.
   */
  public setGlobalHandsConfig(config: WhiteboardConfig['hands']): void {
    this.handsConfig = config;
    this.layers.forEach(layer => {
      layer.setGlobalHandsConfig(config);
    });
    if (this.sceneHandOverlayManager) {
      this.sceneHandOverlayManager.initialize({ enabled: true }, config);
    }
  }

  /**
   * Set the hand overlay manager (used by OcclusionCullingManager)
   */
  public setHandOverlayManager(manager: HandOverlayManager): void {
    this.sceneHandOverlayManager = manager;
  }

  /**
   * Enable or disable hand overlay for all layers in this scene
   */
  setHandOverlayEnabled(enabled: boolean): void {
    this.config.handOverlay = { enabled };
    this.layers.forEach(layer => {
      layer.setHandOverlayEnabled(enabled);
    });
    if (this.sceneHandOverlayManager) {
      this.sceneHandOverlayManager.initialize({ enabled }, this.handsConfig);
    }
  }

  /**
   * Set the hand overlay canvas for this scene
   * Called by the Whiteboard when the scene is added
   */
  setHandOverlayCanvas(canvas: HTMLCanvasElement): void {
    if (isDebugEnabled()) {
      console.log(`[Scene ${this.config.id}] setHandOverlayCanvas:`, !!canvas);
    }
    this.handOverlayCanvas = canvas;
    // Propagate to all existing layers
    this.layers.forEach(layer => {
      layer.setHandOverlayCanvas(canvas);
    });
  }

  /**
   * Pause scene animations
   */
  public pause(): void {
    if (this.isPaused) return;
    this.isPaused = true;
    this.resumePromise = new Promise(resolve => {
      this.resumeResolver = resolve;
    });
    this.layers.forEach(layer => layer.pause());

    // Delegate pause to the active animation engine
    if (this.activeEngine) {
      this.activeEngine.pause();
    }

    if (this.audioManager) {
      this.audioManager.pause();
    }
  }

  /**
   * Resume scene animations
   */
  public resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    if (this.resumeResolver) {
      this.resumeResolver();
      this.resumeResolver = null;
      this.resumePromise = null;
    }
    this.layers.forEach(layer => layer.resume());

    // Delegate resume to the active animation engine
    if (this.activeEngine) {
      this.activeEngine.resume();
    }

    if (this.audioManager) {
      this.audioManager.play().catch(err => {
        if (isDebugEnabled()) {
          console.error('[Scene] Failed to resume audio:', err);
        }
      });
    }
  }

  /**
   * Stop scene animations and reset
   */

  /**
   * OPTIMIZED: Clean up scheduler tasks on stop
   */
  stop(): void {
    if (isDebugEnabled()) {
      console.log(`[Scene ${this.config.id}] Stopping - setting isStopped flag`);
    }
    this.isStopped = true;
    this.isPaused = false;
    this.isPrepared = false; // Reset prepared flag to allow re-initialization

    if (this.resumeResolver) {
      this.resumeResolver();
    }

    // Clean up any scheduled wait tasks
    // const scheduler = AnimationScheduler.getInstance();
    // Tasks will auto-remove when they detect isStopped flag

    // Reset scene group attributes
    this.reset();

    this.layers.forEach(layer => {
      layer.stop();
      // Reset layer to its initial entrance state
      layer.initializeEntranceState();
    });

    if (this.audioManager) {
      this.audioManager.stop();
    }

    this.stopCameraAnimation();
  }

  /**
   * Reset the scene to its initial state.
   * Clears any transition effects (opacity, transform, clip-path) and removes overlays.
   */
  reset(): void {
    if (!this.group) return;

    // Reset attributes modified by transitions
    this.sceneContainer.setAttribute("opacity", "1");
    this.sceneContainer.setAttribute("transform", "translate(0, 0) scale(1) rotate(0)");
    this.sceneContainer.removeAttribute("clip-path");

    this.group.setAttribute("transform", "translate(0, 0) scale(1) rotate(0)");
    this.group.removeAttribute("clip-path");

    // Remove any overlay elements (e.g. eraser overlay)
    const overlayId = `${this.id}-erase-overlay`;
    const overlayGroup = document.getElementById(overlayId);
    if (overlayGroup && overlayGroup.parentNode === this.group) {
      this.group.removeChild(overlayGroup);
    }
  }

  /**
   * Abort all animations in the scene promptly.
   * Unlike stop(), this does NOT reset the isPrepared flag or call initializeEntranceState.
   * It is used for seeking to stop ongoing animations without a full reset.
   */
  abortAnimations(): void {
    if (isDebugEnabled()) {
      console.log(`[Scene ${this.config.id}] Aborting animations`);
    }
    this.isStopped = true;
    this.isPaused = false;

    if (this.resumeResolver) {
      this.resumeResolver();
    }

    this.layers.forEach(layer => {
      layer.stop();
    });
  }

  /**
   * Helper to wait if paused or stop if requested
   */
  private async checkPlaybackState(): Promise<void> {
    if (this.isStopped) {
      if (isDebugEnabled()) {
        console.log(`[Scene ${this.config.id}] Animation stopped - isStopped flag is true`);
      }
      // Use a specific error name to allow catching it specifically
      const error = new Error('Animation stopped');
      error.name = 'PlaybackStoppedError';
      throw error;
    }

    if (this.isPaused) {
      if (isDebugEnabled()) {
        console.log(`[Scene ${this.config.id}] Animation paused - waiting for resume`);
      }
      if (!this.resumePromise) {
        this.resumePromise = new Promise(resolve => {
          this.resumeResolver = resolve;
        });
      }
      await this.resumePromise;
    }
  }

  /**
   * Get the hand overlay canvas
   */
  getHandOverlayCanvas(): HTMLCanvasElement | null {
    return this.handOverlayCanvas;
  }

  /**
   * Get the scene dimensions from the parent SVG.
   * Prioritizes viewBox dimensions for correct coordinate mapping.
   */
  public getSceneDimensions(): { width: number; height: number } {
    // Priority 1: Explicitly set dimensions (most robust)
    if (this.width > 0 && this.height > 0) {
      return { width: this.width, height: this.height };
    }

    // Priority 2: Parent SVG attributes or client dimensions
    if (this.parentSvg) {
      const widthAttr = this.parentSvg.getAttribute('width');
      const heightAttr = this.parentSvg.getAttribute('height');

      if (widthAttr && heightAttr) {
        return {
          width: parseFloat(widthAttr),
          height: parseFloat(heightAttr)
        };
      }

      const clientWidth = this.parentSvg.clientWidth;
      const clientHeight = this.parentSvg.clientHeight;

      if (clientWidth > 0 && clientHeight > 0) {
        return { width: clientWidth, height: clientHeight };
      }
    }

    // Fallback: Default or current config
    return {
      width: this.config.camera?.virtualSize?.width || 800,
      height: this.config.camera?.virtualSize?.height || 450
    };
  }

  /**
   * Attach the scene to an SVG element.
   */
  attachTo(svg: SVGSVGElement, width?: number, height?: number): void {
    this.setParentSvg(svg, width, height);
    svg.appendChild(this.sceneContainer);
  }

  /**
   * Set the parent SVG element.
   */
  setParentSvg(svg: SVGSVGElement, width?: number, height?: number): void {
    this.parentSvg = svg;
    if (width !== undefined) this.width = width;
    if (height !== undefined) this.height = height;
    this.initAudioAndCamera();
  }

  addLayer(layer: Layer): Scene {
    // Propagate viewport scale to layer
    layer.setViewportScale(this.viewportScale);
    layer.render();
    const layerConfig = layer.getConfig();

    this.layers.set(layerConfig.id, layer);

    // Only add to order if not already present
    if (!this.layerOrder.includes(layerConfig.id)) {
      this.layerOrder.push(layerConfig.id);
    }

    // Initialize entrance state BEFORE adding to DOM to avoid flicker
    layer.initializeEntranceState();

    this.refreshDOM();

    // Pass the hand overlay canvas to the layer if available
    if (this.handOverlayCanvas) {
      layer.setHandOverlayCanvas(this.handOverlayCanvas);
    }

    // Pass global hand configuration to the layer
    if (this.handsConfig) {
      layer.setGlobalHandsConfig(this.handsConfig);
    }

    // Inherit hand overlay config from scene if not specified in layer
    if (layer.getConfig().handOverlay === undefined && this.config.handOverlay) {
      layer.initializeHandOverlay(this.config.handOverlay);
    }

    // Mark that occlusion needs to be reapplied
    this.occlusionApplied = false;
    this.isPrepared = false;

    // Eagerly prepare layer in background (non-blocking)
    // This ensures layers are ready before preview mode starts
    this.preloadLayerInBackground(layerConfig.id);

    // Apply current camera transform to the new layer immediately
    // This ensures hand overlay has correct virtualSize even if camera is static
    if (this.cameraController) {
      const config = this.cameraController.getConfigAtTime(0, []);
      const { width, height } = this.getSceneDimensions();
      const virtualWidth = this.config.camera?.virtualSize?.width || width;
      const virtualHeight = this.config.camera?.virtualSize?.height || height;
      const virtualSize = { width: virtualWidth, height: virtualHeight };

      // Use layer's setCameraTransform to cache and apply the transform
      if (typeof layer.setCameraTransform === 'function') {
        layer.setCameraTransform(config.zoom || 1, config.position || { x: 0.5, y: 0.5 }, virtualSize);
      }
    }

    return this;
  }

  /**
   * Update an existing layer or add it if it doesn't exist.
   */
  updateLayer(layer: Layer): Scene {
    const layerId = layer.getConfig().id;
    const existingLayer = this.layers.get(layerId);

    if (existingLayer) {
      // Cleanup old layer
      existingLayer.cleanup();
      // Replace in map
      this.layers.set(layerId, layer);
    } else {
      // Add as new
      return this.addLayer(layer);
    }

    // Render the new layer
    layer.render();

    // Initialize entrance state BEFORE adding to DOM to avoid flicker
    layer.initializeEntranceState();

    // Pass hand overlay
    if (this.handOverlayCanvas) {
      layer.setHandOverlayCanvas(this.handOverlayCanvas);
    }

    // Pass global hand configuration
    if (this.handsConfig) {
      layer.setGlobalHandsConfig(this.handsConfig);
    }

    // Inherit hand overlay config from scene if not specified in layer
    if (layer.getConfig().handOverlay === undefined && this.config.handOverlay) {
      layer.initializeHandOverlay(this.config.handOverlay);
    }

    // Refresh DOM to reflect changes and maintain z-index
    this.refreshDOM();

    this.occlusionApplied = false;
    this.isPrepared = false;

    // Eagerly prepare updated layer in background (non-blocking)
    this.preloadLayerInBackground(layerId);

    // Apply current camera transform to the updated layer immediately
    if (this.cameraController) {
      const config = this.cameraController.getConfigAtTime(0, []);
      const { width, height } = this.getSceneDimensions();
      const virtualWidth = this.config.camera?.virtualSize?.width || width;
      const virtualHeight = this.config.camera?.virtualSize?.height || height;
      const virtualSize = { width: virtualWidth, height: virtualHeight };

      // Use layer's setCameraTransform to cache and apply the transform
      if (typeof layer.setCameraTransform === 'function') {
        layer.setCameraTransform(config.zoom || 1, config.position || { x: 0.5, y: 0.5 }, virtualSize);
      }
    }

    return this;
  }

  /**
   * Delete a layer from the scene.
   */
  deleteLayer(layerId: string): Scene {
    const layer = this.layers.get(layerId);
    if (layer) {
      // Cleanup layer resources
      layer.cleanup();
      // Remove from map and order
      this.layers.delete(layerId);
      this.layerOrder = this.layerOrder.filter(id => id !== layerId);
      // Refresh DOM
      this.refreshDOM();
      this.occlusionApplied = false;
      this.isPrepared = false;
    }
    return this;
  }

  /**
   * Reorder layers based on the provided layer IDs.
   */
  reorderLayers(layerIds: string[]): Scene {
    // Validate that all IDs exist in current layers
    const validIds = layerIds.filter(id => this.layers.has(id));
    if (validIds.length !== this.layers.size) {
      console.warn('[Scene] Layer reorder mismatch - some layers missing from new order');
    }
    this.layerOrder = validIds;
    // Refresh DOM to reflect new order
    this.refreshDOM();
    return this;
  }


  /**
   * Refresh the DOM elements for all layers in the correct z-index order.
   */
  private refreshDOM(): void {
    // OPTIMIZATION: Batch all DOM operations to minimize reflows
    const domBatcher = DOMBatcher.getInstance();
    domBatcher.write(() => {
      // Sort by zIndex
      this.layerOrder.sort((a, b) => {
        const layerA = this.layers.get(a)!;
        const layerB = this.layers.get(b)!;
        return (
          (layerA.getConfig().zIndex || 0) - (layerB.getConfig().zIndex || 0)
        );
      });

      // Clear group
      this.group.innerHTML = "";

      // Use DocumentFragment for batch append (single reflow)
      const fragment = document.createDocumentFragment();

      this.layerOrder.forEach((id) => {
        const l = this.layers.get(id);
        if (!l) return;

        // DOM VIRTUALIZATION:
        // Only attach elements that are within the current time window (+/- 10s)
        // to prevent 10,000+ DOM nodes from slowing down the browser.
        const timing = (l as any).absoluteTiming;
        if (timing && this.currentTime !== undefined) {
          const margin = Scene.VIRTUALIZATION_WINDOW;
          const isVisible = (timing.startTime <= this.currentTime + margin) &&
            (timing.totalDuration >= this.currentTime - margin);

          // If not visible and not currently drawing (important for layers with long durations)
          if (!isVisible) return;
        }

        const el = l.getElement();
        if (el) {
          // If the element is wrapped in an occlusion wrapper, append the wrapper instead
          const wrapper = (l as any).occlusionWrapper;
          if (wrapper && wrapper.parentNode !== fragment) {
            fragment.appendChild(wrapper);
          } else if (!wrapper && el.parentNode !== fragment) {
            fragment.appendChild(el);
          }
        }
      });

      // Single append = single reflow
      this.group.appendChild(fragment);
    });

    // Flush DOM changes immediately
    domBatcher.flush();
  }



  /**
   * Configure l'effet eraser pour cette scène.
   */
  setEraserConfig(config: SlideEraserConfig): Scene {
    this.eraserConfig = config;
    return this;
  }

  getGroup(): SVGGElement {
    return this.group;
  }

  getConfig(): SceneConfig {
    return this.config;
  }

  /**
   * Get the time when the camera will be settled (not transitioning).
   * Returns the provided time if camera is already settled or has no keyframes.
   */
  getCameraSettleTime(currentTime: number): number {
    if (!this.cameraController || !this.cameraController.hasKeyframes()) {
      return currentTime;
    }
    return this.cameraController.getCameraSettleTime(currentTime);
  }

  /**
   * Get the current timing breakdown using live layers and settings.
   * Matches ServerScene.getDuration() behavior by including camera keyframes.
   */
  public getLiveTiming(): any {
    // Check cache
    const now = Date.now();
    if (this.cachedTiming && (now - this.lastTimingUpdate < 2000)) {
      return this.cachedTiming;
    }

    const configWithLayers = {
      ...this.config,
      layers: Array.from(this.layers.values())
    };

    const timing = TimingManager.calculateSceneTiming(configWithLayers);

    this.cachedTiming = timing;
    this.lastTimingUpdate = now;
    return timing;
  }

  /**
   * Get all layers in the scene as an array.
   */
  public getLayers(): Layer[] {
    return Array.from(this.layers.values());
  }

  /**
   * Get the camera controller for this scene.
   */
  public getCameraController(): CameraController | null {
    return this.cameraController;
  }

  /**
   * Get the total duration of the scene in seconds.
   */
  public getDuration(): number {
    return this.getLiveTiming().totalDuration || this.config.duration || 0;
  }

  /**
   * Enable or disable partial erase optimization.
   * When disabled, applyAutomaticPartialErase will be skipped, making transitions instant.
   * @param enabled - Whether to enable partial erase (default: true)
   */
  setPartialEraseEnabled(enabled: boolean): Scene {
    this.partialEraseEnabled = enabled;
    return this;
  }

  /**
   * Preload occlusion data for all layers in the background.
   */
  async preloadOcclusionData(onProgress?: (progress: number) => void): Promise<void> {
    if (!this.parentSvg) {
      if (this.config.debug) {
        if (isDebugEnabled()) {
          console.warn('[Preload] Scene not attached to SVG yet');
        }
      }
      return;
    }

    if (this.config.debug) {
      if (isDebugEnabled()) {
        console.log(`[Preload] Starting preload for ${this.layerOrder.length} layers`);
      }
    }
    const startTime = performance.now();

    // Pre-calculate partial erase frames if applicable
    let completed = 0;
    const total = this.layerOrder.length + (this.audioManager ? 1 : 0);

    const reportProgress = () => {
      completed++;
      if (onProgress) onProgress(completed / total);
    };

    // OPTIMIZED: Larger batch size for preloading to improve parallelism
    const BATCH_SIZE = 200;
    for (let i = 0; i < this.layerOrder.length; i += BATCH_SIZE) {
      const batch = this.layerOrder.slice(i, i + BATCH_SIZE);
      const preloadPromises = batch.map(async (layerId) => {
        await this.preloadLayer(layerId);
        reportProgress();
      });
      await Promise.all(preloadPromises);
    }

    // Also preload audio
    if (this.audioManager) {
      await this.loadAudio();
      reportProgress();
    }

    const duration = performance.now() - startTime;
    if (this.config.debug) {
      if (isDebugEnabled()) {
        console.log(`[Preload] Completed in ${duration.toFixed(2)}ms`);
      }
    }
  }

  /**
   * Preload a specific layer in the background.
   * Uses persistent cache to avoid redundant preparation when config hasn't changed.
   * @param layerId - The ID of the layer to preload
   * @param loadingId - Optional loading manager ID for progress tracking
   */
  async preloadLayer(layerId: string, loadingId?: string): Promise<void> {
    const layer = this.layers.get(layerId);
    if (!layer) return;

    const loadingManager = loadingId ? LoadingManager.getInstance() : null;

    try {
      // Generate config hash for this layer
      const configHash = layerPreparationCache.generateConfigHash((layer as any).config || layer);

      // Check persistent cache first - avoids prepare() even across page reloads
      const isPreparedInCache = layerPreparationCache.isPrepared(configHash);
      const isPreparedInLayer = isLayerPrepared(layer);

      if (!isPreparedInCache && !isPreparedInLayer) {
        // Layer needs preparation - do the heavy work
        if (isDebugEnabled()) {
          console.debug(`[Scene] Preparing layer ${layerId} (cache miss)...`);
        }

        // Update progress: starting preparation
        if (loadingManager && loadingId) {
          loadingManager.updateProgress(loadingId, 30, 'Préparation des données...');
        }

        await layer.prepare();

        // Mark as prepared in cache for future use
        const layerType = (layer as any).config?.type || layer.constructor.name;
        layerPreparationCache.markPrepared(configHash, layerType);

        // Update progress: preparation complete
        if (loadingManager && loadingId) {
          loadingManager.updateProgress(loadingId, 70, 'Finalisation...');
        }
      } else if (isPreparedInCache && !isPreparedInLayer) {
        // Cache says it's prepared, but layer instance doesn't know
        // This happens after whiteboard.clear() - just mark the layer as prepared
        if (isDebugEnabled()) {
          console.debug(`[Scene] Layer ${layerId} already prepared in cache, skipping prepare()`);
        }
        (layer as any).isPrepared = true;

        // Update progress: using cached data
        if (loadingManager && loadingId) {
          loadingManager.updateProgress(loadingId, 50, 'Utilisation du cache...');
        }
      } else {
        if (isDebugEnabled()) {
          console.debug(`[Scene] Layer ${layerId} already prepared, skipping`);
        }

        // Update progress: already prepared
        if (loadingManager && loadingId) {
          loadingManager.updateProgress(loadingId, 90, 'Déjà chargé...');
        }
      }

      if (this.partialEraseEnabled) {
        try {
          await this.occlusionCullingManager.generatePartialEraseFramesForLayer(layerId);
        } catch (error) {
          if (isDebugEnabled()) {
            console.error(`[Preload] Failed to preload occlusion for layer ${layerId}:`, error);
          }
        }
      }

      // Update progress: complete
      if (loadingManager && loadingId) {
        loadingManager.updateProgress(loadingId, 100, 'Terminé');
      }
    } catch (error) {
      if (isDebugEnabled()) {
        console.error(`[Preload] Failed to prepare layer ${layerId}:`, error);
      }
      // Re-throw with additional context while preserving the original error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const enhancedError = new Error(`Failed to preload layer ${layerId}: ${errorMessage}`);
      if (error instanceof Error && 'cause' in Error) {
        (enhancedError as any).cause = error;
      }
      throw enhancedError;
    }
  }

  /**
   * Preload a layer in the background (non-blocking).
   * Uses requestIdleCallback to avoid blocking the main thread.
   * This ensures layers are prepared during editor mode before preview starts.
   * Shows a loading indicator for user feedback during layer preparation.
   */
  private preloadLayerInBackground(layerId: string): void {
    // Use requestIdleCallback for background preparation (non-blocking)
    const requestIdle = typeof window.requestIdleCallback === 'function'
      ? window.requestIdleCallback
      : (cb: IdleRequestCallback) => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 } as IdleDeadline), 1);

    // Generate unique loading operation ID for this layer
    const loadingId = `layer-add-${layerId}`;
    const loadingManager = LoadingManager.getInstance();

    // Get layer type for better loading message
    const layer = this.layers.get(layerId);
    const layerType = layer ? (layer.getConfig().type || 'layer') : 'layer';
    const loadingMessage = `Chargement du ${layerType}...`;

    requestIdle(() => {
      if (isDebugEnabled()) {
        console.debug(`[Scene] Starting background preparation for layer ${layerId}`);
      }

      // Start loading indicator
      loadingManager.start(loadingId, loadingMessage, 0);

      this.preloadLayer(layerId, loadingId)
        .then(() => {
          if (isDebugEnabled()) {
            console.debug(`[Scene] Background preparation complete for layer ${layerId}`);
          }
          // Complete loading indicator on success
          loadingManager.complete(loadingId);
        })
        .catch((error) => {
          console.error(`[Scene] Background preparation failed for layer ${layerId}:`, error);
          // Complete loading indicator on error (cleanup)
          loadingManager.complete(loadingId);
        });
    }, { timeout: 500 }); // 500ms timeout to ensure timely preparation
  }

  /**
   * Clear the occlusion data cache to free memory.
   * Should be called when the scene is no longer needed or memory is constrained.
   */
  clearOcclusionCache(): void {
    this.partialEraseCache.clear();
  }

  /**
   * Synchronize layer durations with scene duration.
   * When scene.duration is set, all visible layers are proportionally adjusted
   * to fit within the specified total duration.
   * 
   * This method should be called before playAnimations() to ensure layers
   * are adjusted according to the scene duration constraint.
   */
  private synchronizeLayerDurations(): void {
    // 1. Determine the draw speed
    let drawSpeed = 1.0;

    // Priority 1: Use existing drawSpeed if available and no explicit duration override
    if (this.config.timingConfig?.drawSpeed && !this.config.duration) {
      drawSpeed = this.config.timingConfig.drawSpeed;
    }
    if (this.config.duration !== undefined && this.config.duration > 0) {
      // 1. Calculate the "natural" duration of the scene (at 1.0x speed)
      const configForNaturalTiming = {
        ...this.config,
        timingConfig: { ...this.config.timingConfig, drawSpeed: 1.0 },
        layers: this.layerOrder.map(id => this.layers.get(id)!.getConfig())
      };

      const timing = TimingManager.calculateSceneTiming(configForNaturalTiming);
      let naturalDuration = timing.totalDuration;

      // IMPORTANT: Also account for camera keyframes (match server behavior)
      // This ensures that if camera animations extend beyond layer animations,
      // they are included in the natural duration
      if (this.config.camera?.keyframes && this.config.camera.keyframes.length > 0) {
        for (const kf of this.config.camera.keyframes) {
          const kfEnd = (kf.startTime || 0) + (kf.pauseTime || 0) + (kf.transitionDuration || 0);
          if (kfEnd > naturalDuration) {
            naturalDuration = kfEnd;
          }
        }
      }

      if (naturalDuration > 0) {
        // Speed = Natural Duration / Target Duration
        // e.g. 10s natural / 5s target = 2.0x speed
        drawSpeed = naturalDuration / this.config.duration;
      }
    } else if (this.config.timingConfig?.drawSpeed !== undefined) {
      // No duration and no drawSpeed, use normal speed
      return;
    }

    // Store the calculated speed back into timingConfig for future use
    if (!this.config.timingConfig) {
      this.config.timingConfig = {};
    }
    this.config.timingConfig.drawSpeed = drawSpeed;

  }

  /**
   * Prepare the scene for playback.
   * This includes preloading layers, calculating occlusion, and initializing states.
   * @param onProgress - Optional callback for preparation progress (0-1)
   */
  async prepare(onProgress?: (progress: number) => void): Promise<void> {
    if (this.isPrepared) {
      if (onProgress) onProgress(1.0);
      return;
    }

    if (isDebugEnabled()) {
      console.log(`[Scene ${this.config.id}] Preparing scene...`);
    }
    const prepareStartTime = performance.now();

    // 1. Synchronize layer durations with scene duration if specified
    this.synchronizeLayerDurations();

    // Warm up camera to resolve dynamic targets
    let snappedToFirst = false;
    if (this.cameraController) {
      this.cameraController.warmup(Array.from(this.layers.values()));

      // Snapping logic: Only snap when explicitly requested via snapToFirstKeyframe: true
      // This allows smooth camera transitions from initial position to first keyframe
      // even when the first keyframe starts at t=0
      const firstKf = this.config.camera?.keyframes?.[0];
      const shouldSnap = this.config.camera?.snapToFirstKeyframe === true;

      if (shouldSnap && this.config.camera?.keyframes && this.config.camera.keyframes.length > 0) {
        // @ts-ignore - access private resolvedKeyframes
        const firstResolved = this.cameraController.resolvedKeyframes.get(0);
        if (firstResolved) {
          this.cameraController.setInitialConfig(firstResolved);
          snappedToFirst = true;
          if (isDebugEnabled()) {
            console.log(`[Scene ${this.id}] Snapped initial camera to first keyframe.`);
          }
        }
      }

      // Apply initial camera transform (AFTER snapping)
      const initialConfig = this.cameraController.getConfigAtTime(0, Array.from(this.layers.values()));
      this.applyCameraTransformToSvg(
        initialConfig.zoom ?? 1.0,
        initialConfig.position ?? { x: 0.5, y: 0.5 }
      );
    }

    // 1.5. Calculate absolute timing and align camera keyframes
    const drawSpeed = this.config.timingConfig?.drawSpeed ?? 1.0;
    const sceneOcclusionDuration = this.config.occlusionCulling ? TimingManager.getOcclusionDuration(this) : 0;

    // 1. Calculate absolute timing for all layers and synchronize with camera
    let currentStartTime = 0;
    const updatedKeyframes = this.config.camera?.keyframes ? JSON.parse(JSON.stringify(this.config.camera.keyframes)) : [];
    let lastCameraKfIndex = -1;

    for (let i = 0; i < this.layerOrder.length; i++) {
      const layerId = this.layerOrder[i];
      const layer = this.layers.get(layerId);
      if (!layer) continue;

      const layerConfig = layer.getConfig();

      // 1. Find camera keyframe targeting this layer
      const cameraKfIndex = updatedKeyframes.findIndex((kf: any) => kf.targetLayerId === layerId);

      if (cameraKfIndex !== -1) {
        const kf = updatedKeyframes[cameraKfIndex];
        const transitionDuration = kf.transitionDuration || 0;

        // SEQUENTIAL EXECUTION: Camera arrives at the element FIRST, then the layer
        // animation begins. This mimics a real camera that pans to a subject before
        // seeing the drawing/animation start.
        // 
        // Timeline:
        // 1. Camera transition starts at currentStartTime
        // 2. Camera arrives at element at (currentStartTime + transitionDuration)
        // 3. Layer animation starts AFTER camera arrives

        // Camera transition starts at current time
        const transitionStart = Math.max(0, currentStartTime);
        // Camera arrives at the element after the transition completes
        const cameraArrivalTime = transitionStart + transitionDuration;

        // Shift the keyframe to align with the transition timing
        const shift = cameraArrivalTime - (kf.startTime || 0);

        if (shift !== 0) {
          // Shift this and all subsequent keyframes
          for (let j = cameraKfIndex; j < updatedKeyframes.length; j++) {
            updatedKeyframes[j].startTime = Math.max(0, (updatedKeyframes[j].startTime || 0) + shift);
          }
        }

        // Layer starts AFTER the camera arrives (sequential execution)
        currentStartTime = cameraArrivalTime;
        lastCameraKfIndex = cameraKfIndex;

        // IMPORTANT: When targeted by a camera, we ignore the layer's internal delay
        // to avoid "double-delaying" (camera delay + layer delay).
        if (layerConfig.entrance_animation) {
          layerConfig.entrance_animation.delay = 0;
        }
      }

      // 2. Determine occlusion
      let occlusionDuration = 0;
      if (sceneOcclusionDuration > 0 && i > 0) {
        for (let j = 0; j < i; j++) {
          const prevLayer = this.layers.get(this.layerOrder[j]);
          if (prevLayer && TimingManager.doLayersOverlap(layer, prevLayer)) {
            occlusionDuration = sceneOcclusionDuration;
            break;
          }
        }
      }

      // 3. Calculate timing for this layer
      const timing = TimingManager.calculateLayerTiming(layerConfig, drawSpeed, occlusionDuration);

      // 4. Set absolute timing
      const absoluteTiming = {
        ...timing,
        startTime: currentStartTime,
        entranceDelay: currentStartTime + timing.occlusionDuration + timing.entranceDelay,
        totalDuration: currentStartTime + timing.totalDuration
      };
      layer.setAbsoluteTiming(absoluteTiming);

      if (isDebugEnabled()) {
        console.log(`[Scene ${this.id}] Layer ${layerId} timing:`, absoluteTiming);
        console.log(`[Scene ${this.id}] Draw speed:`, drawSpeed);
      }

      // 5. Update currentStartTime for next layer
      currentStartTime += timing.totalDuration;

      // 6. Ensure NEXT camera transition doesn't start until this layer is finished drawing
      // We check against the next keyframe after the last one we processed
      if (lastCameraKfIndex < updatedKeyframes.length - 1) {
        const drawingFinished = absoluteTiming.totalDuration;
        const nextKf = updatedKeyframes[lastCameraKfIndex + 1];
        const nextTransitionStart = (nextKf.startTime || 0) - (nextKf.transitionDuration || 0);

        if (nextTransitionStart < drawingFinished) {
          const shift = drawingFinished - nextTransitionStart;
          for (let j = lastCameraKfIndex + 1; j < updatedKeyframes.length; j++) {
            updatedKeyframes[j].startTime = (updatedKeyframes[j].startTime || 0) + shift;
          }
        }
      }
    }

    // Update camera controller and config with shifted keyframes
    if (updatedKeyframes.length > 0) {
      if (this.config.camera) {
        this.config.camera.keyframes = updatedKeyframes;
      }
      if (this.cameraController) {
        this.cameraController.clearKeyframes();
        updatedKeyframes.forEach((kf: any) => {
          this.cameraController?.addKeyframe(kf);
        });
        // Re-warmup after shifting keyframes
        this.cameraController.warmup(Array.from(this.layers.values()));
      }
    }

    // 2. Preload all layers and occlusion data
    if (this.layerOrder.length > 0) {
      await this.preloadOcclusionData(onProgress);
    }

    // 3. Apply static occlusion to all layers
    if (this.config.occlusionCulling) {
      this.occlusionCullingManager.reset();
      for (const id of this.layerOrder) {
        await this.occlusionCullingManager.applyStaticOcclusion(id);
      }
    }

    // 4. Initialize entrance state for ALL layers
    for (const id of this.layerOrder) {
      const layer = this.layers.get(id);
      if (layer) {
        layer.initializeEntranceState();
      }
    }

    // 5. Warm up animations to trigger caches and JIT
    if (onProgress) onProgress(0.9);
    await this.warmUp();
    if (onProgress) onProgress(1.0);

    this.isPrepared = true;
  }

  /**
   * Check if the scene has been prepared for playback.
   * Used by Whiteboard to skip preparation for already-prepared scenes.
   */
  public get isPreparedForPlayback(): boolean {
    return this.isPrepared;
  }

  /**
   * Fast preparation for seek operations.
   * This prepares layers minimally to allow immediate seeking without blocking.
   * Full preparation (warm-up, occlusion) will happen lazily on playback.
   * 
   * @param onProgress - Optional callback for preparation progress (0-1)
   */
  async prepareFast(onProgress?: (progress: number) => void): Promise<void> {
    if (this.isPrepared) {
      if (onProgress) onProgress(1.0);
      return;
    }

    if (isDebugEnabled()) {
      console.log(`[Scene ${this.config.id}] Fast preparing scene for seek (minimal mode)...`);
    }

    // 0. Apply initial camera transform
    if (this.cameraController) {
      const initialConfig = this.cameraController.getConfigAtTime(0, Array.from(this.layers.values()));
      this.applyCameraTransformToSvg(
        initialConfig.zoom!,
        initialConfig.position!
      );
    }

    // 1. Synchronize layer durations with scene duration if specified
    this.synchronizeLayerDurations();

    // Warm up camera to resolve dynamic targets
    if (this.cameraController) {
      this.cameraController.warmup(Array.from(this.layers.values()));
    }

    // 2. OPTIMIZATION: Prepare only critical layers (those visible at seek time)
    // Background preparation of remaining layers continues asynchronously
    // This prevents blocking the UI when seeking before full preparation
    // Default to first 3 layers as they're typically visible at start
    const FAST_PREPARE_CRITICAL_LAYER_COUNT = 3;
    const criticalLayerCount = Math.min(
      this.config.fastPrepareLayerCount || FAST_PREPARE_CRITICAL_LAYER_COUNT,
      this.layerOrder.length
    );

    for (let i = 0; i < criticalLayerCount; i++) {
      const id = this.layerOrder[i];
      await this.preloadLayer(id);
    }

    // Start background preparation of remaining layers (non-blocking)
    for (let i = criticalLayerCount; i < this.layerOrder.length; i++) {
      const id = this.layerOrder[i];
      this.preloadLayer(id).catch(error => {
        // Always log background preload failures as they may affect playback
        console.warn(`[Scene ${this.config.id}] Background preload failed for layer ${id}:`, error);
      });
    }

    if (onProgress) onProgress(0.7);

    // 4. Initialize entrance state for ALL layers (fast operation)
    // This is already done in addLayer, but we do it again here to be safe
    // and to handle layers added via other means.
    for (const id of this.layerOrder) {
      const layer = this.layers.get(id);
      if (layer) {
        layer.initializeEntranceState();
      }
    }

    // 5. SKIP warm-up for fast preparation
    // Warm-up will happen on first actual playback
    if (onProgress) onProgress(1.0);

    // Mark as prepared to allow seeking
    // Full preparation will complete in background
    this.isPrepared = true;
  }

  /**
   * Warm up all animations in the scene.
   * This runs all entrance animations at high speed and invisible.
   */
  async warmUp(): Promise<void> {
    if (isDebugEnabled()) {
      if (isDebugEnabled()) {
        console.log(`[Scene ${this.config.id}] Warming up animations...`);
      }
    }

    // OPTIMIZED: Windowed warm-up to avoid heavy JIT/rendering for distal layers
    // Only warm up the first 100 layers that are most likely to be seen first
    const MAX_WARMUP_LAYERS = 100;
    const layers = Array.from(this.layers.values());
    const toWarmUp = layers.slice(0, MAX_WARMUP_LAYERS);

    // Warm up in small batches of 10 to keep the event loop responsive
    const WARMUP_BATCH_SIZE = 10;
    for (let i = 0; i < toWarmUp.length; i += WARMUP_BATCH_SIZE) {
      const batch = toWarmUp.slice(i, i + WARMUP_BATCH_SIZE);
      const warmUpPromises = batch.map(layer => layer.warmUp());
      try {
        await Promise.all(warmUpPromises);
      } catch (error: any) {
        // If stopped during warm-up, just abort gracefully
        if (error.name === 'PlaybackStoppedError') {
          if (isDebugEnabled()) {
            console.log(`[Scene ${this.config.id}] Warm-up stopped.`);
          }
          return;
        }
        throw error;
      }
    }

    if (isDebugEnabled()) {
      if (isDebugEnabled()) {
        console.log(`[Scene ${this.config.id}] Warm-up complete.`);
      }
    }
  }

  async playAnimations(onStart?: () => void, onProgress?: (logicalTime: number) => void, signal?: AbortSignal, startTime: number = 0): Promise<void> {
    if (isDebugEnabled()) {
      if (isDebugEnabled()) {
        console.log(`[Scene ${this.config.id}] Starting playAnimations - isStopped: ${this.isStopped}, isPaused: ${this.isPaused}, layers: ${this.layerOrder.length}`);
      }
    }

    // Reset stopped state to allow re-playing
    this.isStopped = false;

    // Reset stopped state to allow re-playing
    this.isStopped = false;

    // Ensure scene is prepared if it hasn't been already
    if (!this.isPrepared) {
      await this.prepare();
    }

    if (isDebugEnabled()) {
      if (isDebugEnabled()) {
        console.log(`[Occlusion Debug] Scene ${this.config.id} Layer order:`, this.layerOrder);
      }
    }

    // Start Audio if available
    if (this.audioManager) {
      this.audioManager.play(startTime).catch(err => {
        if (isDebugEnabled()) {
          console.error('[Scene] Failed to play audio:', err);
        }
      });
    }

    // Start Camera animation if available
    this.startCameraAnimation();

    // Play entrance animations for each layer in order
    const sceneStartTime = performance.now();
    if (onStart) onStart();
    if (isDebugEnabled()) {
      console.log(`[Metrics] Scene ${this.config.id} animation started`);
    }

    const drawSpeed = this.config.timingConfig?.drawSpeed ?? 1.0;

    // Build the playback sequence (including OcclusionLayers)
    if (!this.cachedPlaybackSequence) {
      const playbackSequence: Layer[] = [];
      const layers = this.layerOrder.map(lid => this.layers.get(lid)!);

      // OPTIMIZATION: Use spatial index for overlap checks if there are many layers
      // to avoid O(N^2) complexity in sequence building
      let spatialIndex: any = null;
      if (this.config.occlusionCulling && layers.length > 20) {
        // @ts-ignore - Import SpatialLayerIndex from performance-utils
        const { SpatialLayerIndex } = await import("./utils/performance-utils");
        spatialIndex = new SpatialLayerIndex();
        spatialIndex.buildIndex(layers, (l: any) => TimingManager.getLayerBoundingBox(l));
      }

      for (let i = 0; i < this.layerOrder.length; i++) {
        const id = this.layerOrder[i];
        const layer = this.layers.get(id);
        if (!layer) continue;

        // Check if this layer needs occlusion
        if (this.config.occlusionCulling && i > 0) {
          let hasOverlap = false;

          if (spatialIndex) {
            const overlapping = spatialIndex.findOverlappingLayers(layer, i, (l: any) => TimingManager.getLayerBoundingBox(l));
            hasOverlap = overlapping.some((prevLayer: any) => prevLayer.getConfig().occlusionCulling !== false);
          } else {
            // Fallback to simple loop for small number of layers
            for (let j = 0; j < i; j++) {
              const prevLayer = layers[j];
              if (prevLayer.getConfig().occlusionCulling !== false && TimingManager.doLayersOverlap(layer, prevLayer)) {
                hasOverlap = true;
                break;
              }
            }
          }

          if (hasOverlap) {
            const occDur = TimingManager.getOcclusionDuration(this.config);
            const occlusionLayer = new OcclusionLayer(id, this.occlusionCullingManager, occDur);
            playbackSequence.push(occlusionLayer);
          }
        }
        playbackSequence.push(layer);
      }
      this.cachedPlaybackSequence = playbackSequence;
    }

    const playbackSequence = this.cachedPlaybackSequence;

    // Calculate target duration and expected progress per step
    const timing = this.getLiveTiming();
    const targetTotalDuration = this.config.duration || timing.totalDuration;
    const expectedContentDuration = targetTotalDuration - timing.hideTransitionDuration;

    // Build the PreciseAnimationEngine sequence
    const engine = new PreciseAnimationEngine({
      buffer: 100, // 100ms temporal buffer
      debug: isDebugEnabled(),
      adaptive: true, // Enable adaptive buffering for real-time drift compensation
      maxBufferOverhead: 0.1, // Allow up to 10% overhead for buffers
      progressMonitoring: true,
      onProgress: (_progress, _actual, logical) => {
        const absoluteTime = startTime + (logical / 1000);

        // Update current time for virtualization
        const oldRoundedTime = Math.floor(this.currentTime / 5);
        const newRoundedTime = Math.floor(absoluteTime / 5);
        this.currentTime = absoluteTime;

        // Trigger virtualization refresh every 5 seconds if scene is large
        if (this.layers.size > 200 && newRoundedTime !== oldRoundedTime) {
          this.refreshDOM();
        }

        if (onProgress) onProgress(absoluteTime);
      }
    });

    if (isDebugEnabled()) {
      console.log(`[Scene ${this.config.id}] Building animation sequence for ${playbackSequence.length} steps`);
    }

    // Track cumulative time for steps
    let currentStepStartTimeMs = 0;

    for (let i = 0; i < playbackSequence.length; i++) {
      const layer = playbackSequence[i];
      const layerConfig = layer.getConfig();
      const id = layerConfig.id;

      // Calculate logical duration for this step
      let logicalDurationMs = 0;
      if (layer instanceof OcclusionLayer) {
        logicalDurationMs = (layer.getConfig().entrance_animation?.duration || 0) * 1000;
      } else {
        logicalDurationMs = (layerConfig.entrance_animation?.duration || 0) * 1000;
        if (drawSpeed !== 1.0 && drawSpeed > 0) {
          logicalDurationMs /= drawSpeed;
        }
      }

      // Calculate pause duration
      let pauseDurationMs = 0;
      if (!(layer instanceof OcclusionLayer)) {
        let pauseDuration = layerConfig.timingConfig?.pauseTime ?? 0;

        // If we have an emphasis animation, ensure pause is at least long enough for it
        if (layerConfig.emphasis_animation && layerConfig.emphasis_animation.type !== 'none') {
          const totalEmphasisDur = getEmphasisDuration(layerConfig.emphasis_animation);

          // If pause time is less than emphasis duration, extend it
          pauseDuration = Math.max(pauseDuration, totalEmphasisDur);
        }

        if (drawSpeed !== 1.0 && drawSpeed > 0) {
          pauseDuration /= drawSpeed;
        }
        pauseDurationMs = pauseDuration * 1000;
      }

      // Calculate exit duration
      let exitDurationMs = 0;
      if (!(layer instanceof OcclusionLayer)) {
        const exit = layerConfig.exit_animation;
        if (exit && exit.type !== 'none') {
          let d = exit.duration || 1.0;
          if (drawSpeed !== 1.0 && drawSpeed > 0) d /= drawSpeed;
          exitDurationMs = d * 1000;
        }
      }

      // Total logical duration for this step in the sequencer
      logicalDurationMs += exitDurationMs;

      // Calculate target start time for this step
      let targetStartTimeMs = 0;
      if (layer instanceof OcclusionLayer) {
        const targetLayer = this.layers.get(layer.getTargetLayerId());
        if (targetLayer && (targetLayer as any).absoluteTiming) {
          targetStartTimeMs = (targetLayer as any).absoluteTiming.startTime * 1000;
        }
      } else if ((layer as any).absoluteTiming) {
        const timing = (layer as any).absoluteTiming;
        targetStartTimeMs = (timing.startTime + timing.occlusionDuration) * 1000;
      }

      // If there is a gap between current time and target start time, add a wait step
      if (targetStartTimeMs > currentStepStartTimeMs) {
        const gapMs = targetStartTimeMs - currentStepStartTimeMs;
        if (isDebugEnabled()) {
          console.log(`[Scene ${this.config.id}] Inserting camera transition gap: ${gapMs.toFixed(1)}ms (target: ${targetStartTimeMs}ms, current: ${currentStepStartTimeMs}ms)`);
        }
        engine.addLayer(gapMs, async () => {
          await this.wait(gapMs / 1000);
        });
        currentStepStartTimeMs = targetStartTimeMs;
      }

      const stepStartTimeMs = currentStepStartTimeMs;
      const stepEndTimeMs = stepStartTimeMs + logicalDurationMs + pauseDurationMs;
      const startTimeMs = startTime * 1000;

      // Update for next iteration
      currentStepStartTimeMs = stepEndTimeMs;

      // Skip if this step is already fully completed
      if (stepEndTimeMs <= startTimeMs) {
        // Ensure layer is in its final state
        layer.seek(1);
        if (layer instanceof OcclusionLayer && this.config.occlusionCulling) {
          this.occlusionCullingManager.markAsAutoErased(layer.getTargetLayerId());
        }
        continue;
      }

      // If we are starting in the middle of this step
      let initialProgress = 0;

      if (startTimeMs > stepStartTimeMs && startTimeMs < stepEndTimeMs) {
        // We are inside this step
        if (startTimeMs < stepStartTimeMs + logicalDurationMs) {
          // Inside the animation part
          initialProgress = (startTimeMs - stepStartTimeMs) / logicalDurationMs;
          // Reduce logical duration to only account for the remaining part
          logicalDurationMs -= (startTimeMs - stepStartTimeMs);
        } else {
          // Inside the pause part
          initialProgress = 1;
          // Reduce pause duration
          const elapsedPause = startTimeMs - (stepStartTimeMs + logicalDurationMs);
          pauseDurationMs -= elapsedPause;
          // Skip animation part
          logicalDurationMs = 0;
        }
      }


      engine.addLayer(logicalDurationMs, async () => {
        if (isDebugEnabled()) {
          console.log(`[Scene ${this.config.id}] Step ${i + 1}/${playbackSequence.length} (${id}): Starting. Duration: ${logicalDurationMs}ms, Target Start: ${targetStartTimeMs}ms`);
        }
        const stepStartTime = performance.now();

        await this.checkPlaybackState();

        // If we have initial progress, seek first
        if (initialProgress > 0) {
          layer.seek(initialProgress);
        }

        // Only play animation if we haven't finished it yet
        if (initialProgress < 1) {
          // Increase speed by ~11% (divide duration by 0.85) to create a 10% buffer
          // This ensures the animation finishes before the scheduled slot ends, absorbing timing errors
          // while minimizing the visual acceleration effect.
          // Pass initialProgress to playEntranceAnimation if supported, or just let it play from current state
          // assuming seek(initialProgress) set it up correctly.
          await layer.playEntranceAnimation(drawSpeed, false, initialProgress);
        }

        await this.checkPlaybackState();

        // Handle pause after layer animation completes (only for real layers)
        if (!(layer instanceof OcclusionLayer)) {

          // Handle Emphasis and Pause (only for real layers)
          if (pauseDurationMs > 0 || (layer.getConfig().emphasis_animation && layer.getConfig().emphasis_animation!.type !== 'none')) {
            const emphasisAnim = layer.getConfig().emphasis_animation;
            if (isDebugEnabled()) {
              console.log(`[Scene ${this.config.id}] Step ${id}: Pausing for ${(pauseDurationMs / 1000).toFixed(2)}s`);
              if (emphasisAnim && emphasisAnim.type !== 'none') {
                console.log(`[Scene ${this.config.id}] Starting emphasis animation for ${id}:`, emphasisAnim);
              }
            }

            // Start emphasis
            layer.startEmphasis();

            if (pauseDurationMs > 0) {
              await this.wait(pauseDurationMs / 1000);
            }

            if (isDebugEnabled() && emphasisAnim && emphasisAnim.type !== 'none') {
              console.log(`[Scene ${this.config.id}] Stopping emphasis animation for ${id}`);
            }

            // Stop emphasis
            layer.stopEmphasis();
          }

          // Play Exit Animation
          if (layer.getConfig().exit_animation && layer.getConfig().exit_animation!.type !== 'none') {
            await layer.playExitAnimation(drawSpeed);
          }
        }

        // Note: stepActualDuration will be short because we don't await the animation
        const stepActualDuration = (performance.now() - stepStartTime) / 1000;
        if (isDebugEnabled()) {
          console.log(`[Metrics] Step ${id}: Scheduled=${logicalDurationMs / 1000}s, Task=${stepActualDuration.toFixed(3)}s`);
        }
      }, { id, type: layer instanceof OcclusionLayer ? 'occlusion' : 'layer' });
    }

    // Execute the sequence with PreciseAnimationEngine
    this.activeEngine = engine;
    try {
      await engine.play(signal);
    } finally {
      this.activeEngine = null;
    }

    const sceneTotalDuration = (performance.now() - sceneStartTime) / 1000;
    if (isDebugEnabled()) {
      console.log(`[Metrics] Scene ${this.config.id} animation completed in ${sceneTotalDuration.toFixed(3)}s`);
    }

    // Camera animation will be stopped after the final compensation wait
    // to ensure it lasts until the very end of the scene content duration.

    // FINAL WAIT: Ensure the scene lasts for its full calculated content duration.
    // PreciseAnimationEngine already handles most of this, but we keep a final check
    // to align with the expectedContentDuration if needed.
    if (isDebugEnabled()) {
      if (isDebugEnabled()) {
        console.log(`[Scene ${this.config.id}] Expected content duration: ${expectedContentDuration.toFixed(3)}s (Total: ${timing.totalDuration.toFixed(3)}s, Exit: ${timing.hideTransitionDuration.toFixed(3)}s)`);
      }
    }

    const sceneElapsed = (performance.now() - sceneStartTime) / 1000;
    const finalError = (expectedContentDuration - startTime) - sceneElapsed;

    if (finalError > 0.01) {
      if (isDebugEnabled()) {
        if (isDebugEnabled()) {
          console.log(`[Scene ${this.config.id}] Final compensation: ${(finalError * 1000).toFixed(2)}ms`);
        }
      }
      await this.wait(finalError);
    }

    const finalSceneDuration = (performance.now() - sceneStartTime) / 1000;
    if (isDebugEnabled()) {
      console.log(`[Metrics] Scene ${this.config.id} content completed in ${finalSceneDuration.toFixed(3)}s (Expected: ${expectedContentDuration.toFixed(3)}s)`);
    }

    if (isDebugEnabled()) {
      engine.printPerformanceReport();
    }
  }

  /**
   * Start camera animation loop
   */
  /**
   * OPTIMIZED: Use unified animation scheduler instead of separate RAF loop
   * Reduces frame budget exhaustion from multiple concurrent RAF loops
   */
  private startCameraAnimation(): void {
    if (!this.cameraController || !this.cameraController.hasKeyframes()) return;

    const startTime = performance.now();
    const scheduler = AnimationScheduler.getInstance();
    const taskId = `scene-${this.id}-camera`;

    // Calculate total duration of camera animation
    let totalCameraDuration = 0;
    this.cameraController.getKeyframes().forEach((kf: any) => {
      totalCameraDuration += (kf.duration || 0) + (kf.transitionDuration || 0);
    });

    scheduler.schedule(
      taskId,
      (_deltaTime, _frameDeadline) => {
        if (this.isStopped) {
          this.cameraAnimationId = null;
          return false; // Stop animation
        }

        if (this.isPaused) {
          return true; // Continue but don't update
        }

        const elapsed = (performance.now() - startTime) / 1000;

        // Use the new getConfigAtTime logic which handles keyframes and follow modes
        const layersArray = Array.from(this.layers.values());
        const config = this.cameraController!.getConfigAtTime(elapsed, layersArray);

        this.applyCameraTransformToSvg(config.zoom ?? 1.0, config.position ?? { x: 0.5, y: 0.5 });
        return true; // Continue animation
      },
      5 // Medium priority (below user interactions)
    );

    // Store task ID for cleanup (the scheduler handles the actual animation loop)
    this.cameraAnimationId = 1; // Non-null value indicates animation is active
  }

  /**
   * Apply camera zoom and position to the SVG scene group.
   * IMPORTANT: This must match ServerCameraController.applyToCanvas() exactly.
   */
  private applyCameraTransformToSvg(zoom: number, position: { x: number, y: number }): void {
    const { width, height } = this.getSceneDimensions();

    // Guard against invalid dimensions
    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      if (isDebugEnabled()) {
        console.warn(`[Scene ${this.config.id}] applyCameraTransformToSvg: Invalid dimensions`, { width, height });
      }
      return;
    }

    // Guard against invalid camera parameters
    const safeZoom = (isNaN(zoom) || zoom <= 0) ? 1 : zoom;
    const safePosX = (isNaN(position?.x)) ? 0.5 : position.x;
    const safePosY = (isNaN(position?.y)) ? 0.5 : position.y;

    // Get virtual size from camera config (matches server logic)
    const virtualWidth = this.config.camera?.virtualSize?.width || width;
    const virtualHeight = this.config.camera?.virtualSize?.height || height;
    const virtualSize = { width: virtualWidth, height: virtualHeight };

    // Calculate transform - MUST match server formula exactly
    const centerX = virtualWidth * safePosX;
    const centerY = virtualHeight * safePosY;

    const scale = safeZoom;
    const translateX = width / 2 - centerX * scale;
    const translateY = height / 2 - centerY * scale;

    // Final check before applying to DOM
    if (isNaN(translateX) || isNaN(translateY) || isNaN(scale)) {
      if (isDebugEnabled()) {
        console.warn(`[Scene ${this.config.id}] applyCameraTransformToSvg: NaN transform detected`, {
          translateX, translateY, scale, width, height, centerX, centerY, safeZoom, safePosX, safePosY
        });
      }
      return;
    }

    this.group.setAttribute('transform', `translate(${translateX}, ${translateY}) scale(${scale})`);

    // Propagate camera transform to background manager
    if (this.backgroundManager) {
      this.backgroundManager.setCameraTransform(zoom, position, virtualSize);
    }

    // Propagate camera transform to all hand overlay managers
    // This ensures the hand tip aligns with the drawing point on the viewport canvas
    if (this.sceneHandOverlayManager) {
      this.sceneHandOverlayManager.setCameraTransform(zoom, position, virtualSize);
    }

    this.layers.forEach(layer => {
      // Call layer's setCameraTransform which caches the transform and applies it
      // to the hand overlay manager (if initialized) or when it's initialized later
      if (typeof layer.setCameraTransform === 'function') {
        layer.setCameraTransform(zoom, position, virtualSize);
      }
    });
  }

  /**
   * Stop the camera animation loop.
   */
  private stopCameraAnimation(): void {
    if (this.cameraAnimationId !== null) {
      const scheduler = AnimationScheduler.getInstance();
      scheduler.unschedule(`scene-${this.id}-camera`);
      this.cameraAnimationId = null;
    }
  }

  /**
   * Wait for a specified duration in seconds using requestAnimationFrame for better synchronization.
   * @param duration Duration to wait in seconds
   */
  /**
   * OPTIMIZED: Use unified animation scheduler instead of separate RAF loop
   * Reduces frame budget exhaustion from multiple concurrent RAF loops
   */
  private async wait(duration: number): Promise<void> {
    if (duration <= 0) return;

    const startTime = performance.now();
    const durationMs = duration * 1000;
    const scheduler = AnimationScheduler.getInstance();
    const taskId = `scene-${this.id}-wait-${startTime}`;

    return new Promise(resolve => {
      scheduler.schedule(
        taskId,
        (_deltaTime, _frameDeadline) => {
          if (this.isStopped) {
            resolve();
            return false; // Remove task
          }

          if (this.isPaused) {
            return true; // Continue task
          }

          const elapsed = performance.now() - startTime;
          if (elapsed >= durationMs) {
            resolve();
            return false; // Remove task
          }

          return true; // Continue task
        },
        10 // High priority (user-facing animation)
      );
    });
  }

  /**
   * Applique une fonction d'easing basée sur le nom de la transition.
   */
  private applyEasing(progress: number, easingName?: string): number {
    if (!easingName || easingName === "linear") {
      return AnimationTransition.linear(progress);
    }

    const easingMap: Record<string, string> = {
      ease_in: "inQuad",
      ease_out: "outQuad",
      ease_in_out: "inOutQuad",
      ease_in_cubic: "inCubic",
      ease_out_cubic: "outCubic",
      ease_in_out_cubic: "inOutCubic",
      ease_in_back: "inBack",
      ease_out_back: "outBack",
      ease_in_out_back: "inOutBack",
    };

    const mappedEasing = easingMap[easingName] || easingName;
    const easingFunction = (AnimationTransition as any)[mappedEasing];

    if (typeof easingFunction === "function") {
      return easingFunction(progress);
    }

    return AnimationTransition.linear(progress);
  }



  /**
   * Déplace le groupe de la scène au premier plan (fin du parent SVG).
   */
  public moveToFront(): void {
    if (this.parentSvg && this.sceneContainer) {
      this.parentSvg.appendChild(this.sceneContainer);
    }
  }

  /**
   * Affiche la scène avec une transition optionnelle.
   */
  async show(transition?: SceneTransitionConfig): Promise<void> {
    // NOTE: Static occlusion culling is disabled here to allow for visual erase effects
    // NOTE: Static occlusion culling is disabled here to allow for visual erase effects
    // during animation. The applyAutomaticPartialErase() method in playAnimations()
    // will handle erasing overlapping areas before drawing each layer.
    // If you need static pre-clipping without animation, re-enable this block.
    // if (this.config.occlusionCulling && !this.occlusionApplied) {
    //   await this.applyOcclusionCulling();
    // }

    if (!transition || transition.type === "none") {
      this.sceneContainer.setAttribute("opacity", "1");
      return;
    }

    // Avoid "replay" effect if scene is already visible and transition is fade
    const currentOpacity = parseFloat(this.sceneContainer.getAttribute("opacity") || "0");
    if (transition.type === "fade" && currentOpacity >= 0.99) {
      if (isDebugEnabled()) {
        if (isDebugEnabled()) {
          console.log(`[Scene ${this.config.id}] Skipping fade -in transition as scene is already visible`);
        }
      }
      this.sceneContainer.setAttribute("opacity", "1");
      return;
    }

    const duration = transition.duration || 0.5;
    const easing = transition.easing || "outCubic";
    const steps = 60;

    if (duration <= 0) {
      this.sceneContainer.setAttribute("opacity", "1");
      this.sceneContainer.setAttribute("transform", "translate(0, 0) scale(1) rotate(0)");
      return;
    }
    const stepDuration = (duration * 1000) / steps;

    return new Promise((resolve) => {
      let step = 0;

      const interval = setInterval(() => {
        const rawProgress = step / steps;
        const progress = this.applyEasing(rawProgress, easing);

        switch (transition.type) {
          case "fade":
            this.sceneContainer.setAttribute("opacity", progress.toString());
            break;

          case "slide_left":
            this.sceneContainer.setAttribute("opacity", "1");
            this.sceneContainer.setAttribute(
              "transform",
              `translate(${800 - progress * 800}, 0)`
            );
            break;

          case "slide_right":
            this.sceneContainer.setAttribute("opacity", "1");
            this.sceneContainer.setAttribute(
              "transform",
              `translate(${-800 + progress * 800}, 0)`
            );
            break;

          case "slide_top":
            this.sceneContainer.setAttribute(
              "transform",
              `translate(0, ${(1 - progress) * 450})`
            );
            this.sceneContainer.setAttribute("opacity", "1");
            break;

          case "slide_bottom":
            this.sceneContainer.setAttribute(
              "transform",
              `translate(0, ${(progress - 1) * 450})`
            );
            this.sceneContainer.setAttribute("opacity", "1");
            break;

          case "wipe":
            // Use a clipPath for wipe effect
            let clipPath = document.getElementById(`${this.config.id} -wipe - clip`) as unknown as SVGClipPathElement;
            if (!clipPath) {
              const defs = this.parentSvg?.querySelector('defs') || document.createElementNS('http://www.w3.org/2000/svg', 'defs');
              if (this.parentSvg && !this.parentSvg.querySelector('defs')) {
                this.parentSvg.appendChild(defs);
              }

              clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
              clipPath.setAttribute('id', `${this.config.id} -wipe - clip`);
              const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
              rect.setAttribute('width', '0');
              rect.setAttribute('height', '450');
              clipPath.appendChild(rect);
              defs.appendChild(clipPath);
              this.group.setAttribute('clip-path', `url(#${this.config.id} - wipe - clip)`);
            }
            const clipRect = clipPath.querySelector('rect') as SVGRectElement;
            if (clipRect) {
              clipRect.setAttribute('width', (progress * 800).toString());
            }
            this.group.setAttribute("opacity", "1");
            break;

          case "slide_up":
            this.sceneContainer.setAttribute("opacity", "1");
            this.sceneContainer.setAttribute(
              "transform",
              `translate(0, ${600 - progress * 600})`
            );
            break;

          case "slide_down":
            this.sceneContainer.setAttribute("opacity", "1");
            this.sceneContainer.setAttribute(
              "transform",
              `translate(0, ${-600 + progress * 600})`
            );
            break;

          case "zoom":
            this.sceneContainer.setAttribute("transform", `scale(${progress})`);
            this.sceneContainer.setAttribute("opacity", progress.toString());
            break;

          case "zoom_in":
            const scaleIn = 0.5 + progress * 0.5;
            this.sceneContainer.setAttribute("transform", `scale(${scaleIn})`);
            this.sceneContainer.setAttribute("opacity", progress.toString());
            break;

          case "zoom_out":
            const scaleOut = 1.5 - progress * 0.5;
            this.sceneContainer.setAttribute("transform", `scale(${scaleOut})`);
            this.sceneContainer.setAttribute("opacity", progress.toString());
            break;

          case "rotate":
            this.sceneContainer.setAttribute("transform", `rotate(${progress * 360})`);
            this.sceneContainer.setAttribute("opacity", progress.toString());
            break;
        }

        step++;
        if (step >= steps) {
          clearInterval(interval);
          this.sceneContainer.setAttribute("opacity", "1");
          this.sceneContainer.setAttribute(
            "transform",
            "translate(0, 0) scale(1) rotate(0)"
          );
          resolve();
        }
      }, stepDuration);
    });
  }

  /**
   * Apply occlusion culling to layers in this scene.
   * This method identifies overlapping layers and applies SVG masks to ensure
   * proper visual layering during animations.
   * 
   * Only applicable when config.occlusionCulling is true and layers have occlusionMode set.
   */
  async applyOcclusionCulling(): Promise<void> {
    // Skip if occlusion culling is not enabled or already applied
    if (!this.config.occlusionCulling || this.occlusionApplied || !this.parentSvg) {
      return;
    }

    if (isDebugEnabled()) {
      if (isDebugEnabled()) {
        console.log('[Occlusion] Starting geometric occlusion culling...');
      }
    }

    // Apply geometric static occlusion to all layers in the scene
    // This uses SVG masks based on geometric proxies (rects, circles)
    // which is much faster than rasterizing the entire scene.
    for (const layerId of this.layerOrder) {
      const layer = this.layers.get(layerId);
      if (!layer) continue;

      const layerConfig = layer.getConfig();
      const autoOnly = this.config.occlusionCullingConfig?.autoOnly !== false;
      const occlusionMode = layerConfig.occlusionMode || 'none';

      // Skip eraser and rubber layers
      if (isEraserOrRubberLayer(layer)) continue;

      // Skip if autoOnly is true and mode is not auto
      if (autoOnly && occlusionMode !== 'auto') continue;

      // Skip layers that don't participate in occlusion
      if (occlusionMode === 'none') continue;

      // Apply static occlusion (force=true to ignore performedAutoErase check)
      await this.occlusionCullingManager.applyStaticOcclusion(layerId, true);
    }

    if (isDebugEnabled()) {
      if (isDebugEnabled()) {
        console.log('[Occlusion] Geometric occlusion culling applied to all layers');
      }
    }

    this.occlusionApplied = true;
  }

  /**
   * Seek to a specific time in the scene.
   * This method calculates the state of all layers at the given time and applies it.
   * 
   * @param time - Time in seconds from the start of the scene
   */
  async seek(time: number): Promise<void> {
    if (!this.isPrepared) {
      if (isDebugEnabled()) {
        console.warn(`[Scene ${this.config.id}] Cannot seek: scene not prepared`);
      }
      return;
    }

    const timeMs = time * 1000;
    const drawSpeed = this.config.timingConfig?.drawSpeed ?? 1.0;

    // 0. Reset occlusion state to ensure clean slate
    if (this.config.occlusionCulling) {
      this.occlusionCullingManager.reset();
    }

    // PERFORMANCE: Clear hand overlay canvas once at the beginning of seek
    // This avoids flickering and ensures no "ghost" hands are left from previous states
    if (this.handOverlayCanvas) {
      const ctx = this.handOverlayCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, this.handOverlayCanvas.width, this.handOverlayCanvas.height);
      }
    }

    // 1. Handle camera seek first - use CameraController.getConfigAtTime() like the server does
    // Updating camera first allows hand overlay to be drawn once with the correct transform
    if (this.cameraController && this.cameraController.hasKeyframes()) {
      const layersArray = Array.from(this.layers.values());
      const cameraConfig = this.cameraController.getConfigAtTime(time, layersArray);
      this.applyCameraTransformToSvg(cameraConfig.zoom ?? 1.0, cameraConfig.position ?? { x: 0.5, y: 0.5 });
    }

    // Handle audio seek
    if (this.audioManager) {
      this.audioManager.seek(time).catch(err => {
        if (isDebugEnabled()) {
          console.warn('[Scene] Failed to seek audio:', err);
        }
      });
    }

    // 2. Reconstruct the playback sequence (including OcclusionLayers)
    if (!this.cachedPlaybackSequence) {
      const playbackSequence: Layer[] = [];
      const layers = this.layerOrder.map(lid => this.layers.get(lid)!);

      // OPTIMIZATION: Use spatial index for overlap checks if there are many layers
      let spatialIndex: any = null;
      if (this.config.occlusionCulling && layers.length > 20) {
        try {
          // @ts-ignore - Import SpatialLayerIndex from performance-utils
          const { SpatialLayerIndex } = await import("./utils/performance-utils");
          spatialIndex = new SpatialLayerIndex();
          spatialIndex.buildIndex(layers, (l: any) => TimingManager.getLayerBoundingBox(l));
        } catch (e) {
          console.warn('[Scene] Failed to load spatial index in seek, falling back to brute force');
        }
      }

      for (let i = 0; i < this.layerOrder.length; i++) {
        const id = this.layerOrder[i];
        const layer = this.layers.get(id);
        if (!layer) continue;

        if (this.config.occlusionCulling && i > 0) {
          let hasOverlap = false;

          if (spatialIndex) {
            const overlapping = spatialIndex.findOverlappingLayers(layer, i, (l: any) => TimingManager.getLayerBoundingBox(l));
            hasOverlap = overlapping.some((prevLayer: any) => prevLayer.getConfig().occlusionCulling !== false);
          } else {
            for (let j = 0; j < i; j++) {
              const prevLayer = layers[j];
              if (prevLayer.getConfig().occlusionCulling !== false && TimingManager.doLayersOverlap(layer, prevLayer)) {
                hasOverlap = true;
                break;
              }
            }
          }

          if (hasOverlap) {
            const occDur = TimingManager.getOcclusionDuration(this.config);
            const occlusionLayer = new OcclusionLayer(id, this.occlusionCullingManager, occDur);
            playbackSequence.push(occlusionLayer);
          }
        }
        playbackSequence.push(layer);
      }
      this.cachedPlaybackSequence = playbackSequence;
    }
    const playbackSequence = this.cachedPlaybackSequence;

    // 3. Calculate timing and seek each item
    // OPTIMIZATION: Single-pass approach with layer index cache for performance
    const layerIndexMap = new Map<string, number>();
    this.layerOrder.forEach((id, index) => layerIndexMap.set(id, index));

    let currentLogicalTimeMs = 0;
    let activeAnimatingItem: Layer | null = null; // Track which item is actively animating or most recently finished
    let activeAnimatingItemIndex = -1;

    // Single pass: determine active layer, set flags, and seek
    for (const item of playbackSequence) {
      const itemConfig = item.getConfig();
      let logicalDurationMs = 0;

      if (item instanceof OcclusionLayer) {
        logicalDurationMs = (itemConfig.entrance_animation?.duration || 0) * 1000;
      } else {
        logicalDurationMs = (itemConfig.entrance_animation?.duration || 0) * 1000;
        if (drawSpeed !== 1.0 && drawSpeed > 0) {
          logicalDurationMs /= drawSpeed;
        }
      }

      const itemStartTime = currentLogicalTimeMs;
      const itemEndTime = itemStartTime + logicalDurationMs;

      // Determine if this item is actively animating
      const isAnimating = timeMs >= itemStartTime && timeMs <= itemEndTime;

      // Track the active layer (the one currently animating or most recently finished)
      if (!(item instanceof OcclusionLayer)) {
        const itemIndex = layerIndexMap.get(item.getConfig().id) ?? -1;
        if (isAnimating) {
          activeAnimatingItem = item;
          activeAnimatingItemIndex = itemIndex;
        } else if (timeMs > itemEndTime) {
          // If no layer is currently animating, track the last finished layer
          if (activeAnimatingItem === null || itemIndex > activeAnimatingItemIndex) {
            activeAnimatingItem = item;
            activeAnimatingItemIndex = itemIndex;
          }
        }
      }

      currentLogicalTimeMs = itemEndTime;

      // Handle pause after layer animation (only for real layers)
      if (!(item instanceof OcclusionLayer)) {
        let pauseDuration = itemConfig.timingConfig?.pauseTime ?? 0;
        if (drawSpeed !== 1.0 && drawSpeed > 0) {
          pauseDuration /= drawSpeed;
        }
        currentLogicalTimeMs += pauseDuration * 1000;
      }
    }

    // Now seek all items with the active layer determined
    currentLogicalTimeMs = 0;
    for (const item of playbackSequence) {
      const itemConfig = item.getConfig();
      let logicalDurationMs = 0;

      if (item instanceof OcclusionLayer) {
        logicalDurationMs = (itemConfig.entrance_animation?.duration || 0) * 1000;
      } else {
        logicalDurationMs = (itemConfig.entrance_animation?.duration || 0) * 1000;
        if (drawSpeed !== 1.0 && drawSpeed > 0) {
          logicalDurationMs /= drawSpeed;
        }
      }

      const itemStartTime = currentLogicalTimeMs;
      const itemEndTime = itemStartTime + logicalDurationMs;

      // Set hand drawing flag: only the active layer should draw
      if (!(item instanceof OcclusionLayer)) {
        item.setShouldDrawHandDuringSeek(item === activeAnimatingItem);
      }

      if (timeMs < itemStartTime) {
        item.seek(0);
      } else if (timeMs > itemEndTime) {
        item.seek(1);
        // If this was an occlusion layer that finished, mark it as erased
        if (item instanceof OcclusionLayer && this.config.occlusionCulling) {
          this.occlusionCullingManager.markAsAutoErased(item.getTargetLayerId());
        }
      } else {
        const progress = logicalDurationMs > 0 ? (timeMs - itemStartTime) / logicalDurationMs : 1;
        item.seek(progress);

        // If we are partially through an occlusion layer, we should also mark it as erased
        // so that static occlusion is applied for the parts that are already revealed
        if (item instanceof OcclusionLayer && this.config.occlusionCulling && progress > 0) {
          this.occlusionCullingManager.markAsAutoErased(item.getTargetLayerId());
        }
      }

      currentLogicalTimeMs = itemEndTime;

      // Handle pause after layer animation (only for real layers)
      if (!(item instanceof OcclusionLayer)) {
        let pauseDuration = itemConfig.timingConfig?.pauseTime ?? 0;
        if (drawSpeed !== 1.0 && drawSpeed > 0) {
          pauseDuration /= drawSpeed;
        }
        currentLogicalTimeMs += pauseDuration * 1000;
      }
    }

    // 2.5. Hand overlay is already updated by the active layer's seek() call.
    // 3. Re-apply static occlusion for all layers based on the new state
    if (this.config.occlusionCulling) {
      for (const id of this.layerOrder) {
        // We don't force it here, so it respects the performedAutoErase state we just rebuilt
        await this.occlusionCullingManager.applyStaticOcclusion(id, false);
      }
    }
  }

  /**
   * Parse background color string to RGB tuple.
   * Supports hex colors (#ffffff, #fff) and rgb/rgba strings.
   */
  public parseBackgroundColor(color: any): [number, number, number] {
    // Default to white if not provided
    if (!color) return [255, 255, 255];

    // Handle background config object
    if (typeof color === 'object' && color !== null && !Array.isArray(color)) {
      if (color.color) {
        return this.parseBackgroundColor(color.color);
      }
      return [255, 255, 255];
    }

    // Handle non-string values (defensive programming)
    if (typeof color !== 'string') {
      // If it's an array, assume it's already RGB
      if (Array.isArray(color) && color.length >= 3) {
        return [Number(color[0]), Number(color[1]), Number(color[2])];
      }
      // Fallback to white
      return [255, 255, 255];
    }

    // Handle hex colors
    if (color.startsWith('#')) {
      const hex = color.substring(1);
      if (hex.length === 3) {
        // Short form: #fff
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        return [r, g, b];
      } else if (hex.length === 6) {
        // Long form: #ffffff
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return [r, g, b];
      }
    }

    // Handle rgb/rgba strings
    if (color.startsWith('rgb')) {
      const match = color.match(/\d+/g);
      if (match && match.length >= 3) {
        return [parseInt(match[0]), parseInt(match[1]), parseInt(match[2])];
      }
    }

    // Fallback to white
    if (isDebugEnabled()) {
      console.warn('[Occlusion] Could not parse background color:', color, 'using white');
    }
    return [255, 255, 255];
  }

  /**
   * Pre-calculate occlusion data for a layer.
   * This creates a temporary SVG with just this layer and converts it to canvas.
   * Results are cached to avoid expensive re-conversions.
   * 
   * Cache key includes both scene ID and layer ID to ensure uniqueness across scenes.
   * Note: Cache does not auto-invalidate on layer content changes. Call clearOcclusionCache()
   * manually if layer content is modified after initial conversion.
   */


  /**
   * Cache la scène avec une transition optionnelle.
   */
  async hide(transition?: SceneTransitionConfig, onProgress?: (p: number) => void): Promise<void> {
    if (!transition || transition.type === "none" || transition.type === "eraser") {
      this.sceneContainer.setAttribute("opacity", "0");
      this.stopCameraAnimation();
      return;
    }

    const duration = transition.duration || 0;
    const easing = transition.easing || "inCubic";
    const steps = 60;

    if (duration <= 0) {
      this.group.setAttribute("opacity", "0");
      return;
    }
    const stepDuration = (duration * 1000) / steps;

    return new Promise((resolve) => {
      let step = 0;

      const interval = setInterval(() => {
        const rawProgress = step / steps;
        const progress = this.applyEasing(rawProgress, easing);

        // Report progress back to whiteboard
        if (onProgress) onProgress(rawProgress);

        switch (transition.type) {
          case "fade":
            this.sceneContainer.setAttribute("opacity", (1 - progress).toString());
            break;

          case "slide_left":
            this.sceneContainer.setAttribute(
              "transform",
              `translate(${- progress * 800}, 0)`
            );
            break;

          case "slide_right":
            this.sceneContainer.setAttribute(
              "transform",
              `translate(${progress * 800}, 0)`
            );
            break;

          case "slide_up":
            this.sceneContainer.setAttribute(
              "transform",
              `translate(0, ${- progress * 600})`
            );
            break;

          case "slide_down":
            this.sceneContainer.setAttribute(
              "transform",
              `translate(0, ${progress * 600})`
            );
            break;

          case "zoom":
            this.sceneContainer.setAttribute("transform", `scale(${1 - progress})`);
            this.sceneContainer.setAttribute("opacity", (1 - progress).toString());
            break;

          case "zoom_in":
            const scaleIn = 1 - progress * 0.5;
            this.sceneContainer.setAttribute("transform", `scale(${scaleIn})`);
            this.sceneContainer.setAttribute("opacity", (1 - progress).toString());
            break;

          case "zoom_out":
            const scaleOut = 1 + progress * 0.5;
            this.sceneContainer.setAttribute("transform", `scale(${scaleOut})`);
            this.sceneContainer.setAttribute("opacity", (1 - progress).toString());
            break;

          case "rotate":
            this.sceneContainer.setAttribute("transform", `rotate(${progress * 360})`);
            this.sceneContainer.setAttribute("opacity", (1 - progress).toString());
            break;
        }

        step++;
        if (step >= steps) {
          clearInterval(interval);
          if (progress >= 1.0) {
            if (onProgress) onProgress(1.0);
          }
          this.sceneContainer.setAttribute('clip-path', 'none');
          this.sceneContainer.setAttribute("opacity", "0");
          this.stopCameraAnimation();
          resolve();
        }
      }, stepDuration);
    });
  }

  /**
   * Efface la scène avec un effet de gomme (whiteboard eraser).
   * Convertit le SVG en canvas, applique l'effet eraser, puis cache la scène.
   */
  async eraseWithEffect(config?: Partial<SlideEraserConfig>, onProgress?: (p: number) => void): Promise<void> {
    const eraserConfig = config || this.eraserConfig || this.config.eraser_config || this.config.eraser;

    if (!eraserConfig || !eraserConfig.enabled) {
      await this.hide({ type: "fade", duration: 0.5 }, onProgress);
      this.stopCameraAnimation();
      return;
    }
    if (!this.parentSvg) {
      if (isDebugEnabled()) {
        console.warn(`[Scene ${this.id}] Scene not attached to SVG.Use attachTo() first.`);
      }
      await this.hide({ type: "fade", duration: 0.5 }, onProgress);
      return;
    }

    const pattern = eraserConfig.pattern || "diagonal";

    // ALWAYS use SVG-based erasers for better performance and to avoid ImageData dependency
    if (pattern === "diagonal_svg" || pattern === "diagonal") {
      if (eraserConfig.delayAfterAnimations && eraserConfig.delayAfterAnimations > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, eraserConfig.delayAfterAnimations! * 1000)
        );
      }
      await this.eraseWithSvgDiagonal(eraserConfig, onProgress);
    } else {
      if (eraserConfig.delayAfterAnimations && eraserConfig.delayAfterAnimations > 0) {
        await new Promise((resolve) =>
          setTimeout(resolve, eraserConfig.delayAfterAnimations! * 1000)
        );
      }
      await this.eraseWithSvgOverlay(eraserConfig, onProgress);
    }
  }


  /**
   * Efface la scène diagonalement en utilisant un clipPath SVG.
   * Plus performant car évite la conversion en ImageData.
   */
  private async eraseWithSvgDiagonal(config: Partial<SlideEraserConfig>, onProgress?: (p: number) => void): Promise<void> {
    const { width, height } = this.getSceneDimensions();
    const duration = config.duration || 3.5;
    const showEraser = config.showEraser !== undefined ? config.showEraser : true;

    // 1. Initialize eraser hand if needed
    if (showEraser) {
      await this.initializeEraserHand(config.handImage, config.handOffset, config.handScale);
    }

    // 2. Créer le clipPath
    const clipPathId = `${this.id}-diagonal-clip`;
    let clipPath = document.getElementById(clipPathId) as unknown as SVGClipPathElement;

    if (!clipPath) {
      const defs = this.parentSvg?.querySelector('defs') || document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      if (this.parentSvg && !this.parentSvg.querySelector('defs')) {
        this.parentSvg.appendChild(defs);
      }

      clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
      clipPath.setAttribute('id', clipPathId);
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      // Initial state: full scene visible
      polygon.setAttribute('points', `0, 0 ${width}, 0 ${width},${height} 0, ${height} `);
      clipPath.appendChild(polygon);
      defs.appendChild(clipPath);
    }

    const polygon = clipPath.querySelector('polygon') as SVGPolygonElement;
    this.sceneContainer.setAttribute('clip-path', `url(#${clipPathId})`);

    // 2. Animation
    const startTime = performance.now();
    const totalDuration = duration * 1000;

    return new Promise((resolve) => {
      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / totalDuration, 1.0);
        const easedProgress = this.applyEasing(progress, 'linear'); // Or use config.easing

        // Report progress back
        if (onProgress) onProgress(progress);

        // Diagonal wipe from top-left to bottom-right
        // We want to keep the portion that is NOT yet erased.
        // The erased portion is a triangle growing from top-left.
        // Wait, it's easier to define the VISIBLE portion.
        // At progress 0: (0,0) (W,0) (W,H) (0,H)
        // At progress 1: (W,H) (W,H) (W,H) (W,H) (empty)

        // Let's use a simpler approach: a large rectangle that moves.
        // Or a polygon with 5 points to handle the diagonal cut.

        let points = '';
        let handX = 0;
        let handY = 0;
        let edgeStart: [number, number] = [0, 0];
        let edgeEnd: [number, number] = [0, 0];

        // Diagonal line: y = -x + constant
        // Constant goes from 0 to width + height
        const d = easedProgress * (width + height);

        if (d <= width && d <= height) {
          // Triangle at top-left is erased
          points = `${d}, 0 ${width}, 0 ${width},${height} 0, ${height} 0, ${d} `;
          edgeStart = [d, 0];
          edgeEnd = [0, d];
        } else if (d > width && d <= height) {
          // Trapezoid
          points = `${width},${d - width} ${width},${height} 0, ${height} 0, ${d} `;
          edgeStart = [width, d - width];
          edgeEnd = [0, d];
        } else if (d > height && d <= width) {
          // Trapezoid
          points = `${d}, 0 ${width}, 0 ${width},${height} ${d - height},${height} `;
          edgeStart = [d, 0];
          edgeEnd = [d - height, height];
        } else {
          // Triangle at bottom-right remains
          const offset = d - width;
          const offset2 = d - height;
          points = `${width},${offset} ${width},${height} ${offset2},${height} `;
          edgeStart = [width, offset];
          edgeEnd = [offset2, height];
        }

        // Calculate zigzag position along the erasing edge
        const scrubFreq = 10.0;
        const scrubT = (Math.sin(progress * Math.PI * 2 * scrubFreq) + 1) / 2;
        handX = edgeStart[0] + scrubT * (edgeEnd[0] - edgeStart[0]);
        handY = edgeStart[1] + scrubT * (edgeEnd[1] - edgeStart[1]);

        if (progress >= 1.0) {
          points = `${width},${height} ${width},${height} ${width},${height} `;
        }

        polygon.setAttribute('points', points);

        // 3. Update eraser hand position
        if (showEraser && this.sceneHandOverlayManager && this.handOverlayCanvas) {
          const ctx = this.handOverlayCanvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, this.handOverlayCanvas.width, this.handOverlayCanvas.height);
          }

          // Apply natural wiggle for a more "whiteboard erasing" feel
          const [wiggleX, wiggleY] = addWiggleToPosition(handX, handY, progress, 1.0, 25, 6.0);

          this.sceneHandOverlayManager.drawHandAt(
            wiggleX,
            wiggleY,
            this.handOverlayCanvas
          );
        }

        if (progress < 1.0) {
          requestAnimationFrame(animate);
        } else {
          if (this.sceneHandOverlayManager && this.handOverlayCanvas) {
            this.sceneHandOverlayManager.hideHand(this.handOverlayCanvas);
          }
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  /**
   * Efface la scène en affichant un overlay blanc progressif.
   * C'est l'approche la plus légère car elle ne nécessite ni capture ni clipping complexe.
   */
  private async eraseWithSvgOverlay(config: Partial<SlideEraserConfig>, onProgress?: (p: number) => void): Promise<void> {
    const { width, height } = this.getSceneDimensions();
    const duration = config.duration || 0;
    const showEraser = config.showEraser !== undefined ? config.showEraser : true;
    const bgColor = config.backgroundColor || [255, 255, 255];
    const colorStr = `rgb(${bgColor[0]}, ${bgColor[1]}, ${bgColor[2]})`;

    // 0. Initialize eraser hand if needed
    if (showEraser) {
      await this.initializeEraserHand(config.handImage, config.handOffset, config.handScale);
    }

    // 1. Créer le groupe d'overlay
    const overlayId = `${this.id}-erase-overlay`;
    let overlayGroup = document.getElementById(overlayId) as unknown as SVGGElement;

    if (!overlayGroup) {
      overlayGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      overlayGroup.setAttribute('id', overlayId);
      this.sceneContainer.appendChild(overlayGroup);
    } else {
      if (isDebugEnabled()) {
        console.error('[DEBUG] Found existing overlay, clearing innerHTML');
      }
      overlayGroup.innerHTML = '';
    }

    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('fill', colorStr);
    polygon.setAttribute('points', '');
    overlayGroup.appendChild(polygon);

    const pattern = config.pattern || "diagonal";

    // 2. Animation
    const startTime = performance.now();
    const totalDuration = duration * 1000;

    return new Promise((resolve) => {
      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / totalDuration, 1.0);
        const easedProgress = this.applyEasing(progress, 'linear');

        // Report progress back to whiteboard
        if (onProgress) onProgress(progress);

        let points = '';
        let handX = 0;
        let handY = 0;
        let edgeStart: [number, number] = [0, 0];
        let edgeEnd: [number, number] = [0, 0];

        if (pattern === "horizontal" || pattern === "horizontal_svg") {
          const x = easedProgress * width;
          points = `0, 0 ${x}, 0 ${x},${height} 0, ${height} `;
          edgeStart = [x, 0];
          edgeEnd = [x, height];
        } else if (pattern === "vertical" || pattern === "vertical_svg") {
          const y = easedProgress * height;
          points = `0, 0 ${width}, 0 ${width},${y} 0, ${y} `;
          edgeStart = [0, y];
          edgeEnd = [width, y];
        } else {
          // Default to diagonal (diagonal_overlay or diagonal_svg)
          const d = easedProgress * (width + height);

          if (d <= width && d <= height) {
            points = `0, 0 ${d}, 0 0, ${d} `;
            edgeStart = [d, 0];
            edgeEnd = [0, d];
          } else if (d > width && d <= height) {
            points = `0, 0 ${width}, 0 ${width},${d - width} 0, ${d} `;
            edgeStart = [width, d - width];
            edgeEnd = [0, d];
          } else if (d > height && d <= width) {
            points = `0, 0 ${d}, 0 ${d - height},${height} 0, ${height} `;
            edgeStart = [d, 0];
            edgeEnd = [d - height, height];
          } else {
            const offset = d - width;
            const offset2 = d - height;
            points = `0, 0 ${width}, 0 ${width},${offset} ${offset2},${height} 0, ${height} `;
            edgeStart = [width, offset];
            edgeEnd = [offset2, height];
          }
        }

        // Calculate zigzag position along the erasing edge
        const scrubFreq = 10.0;
        const scrubT = (Math.sin(progress * Math.PI * 2 * scrubFreq) + 1) / 2;
        handX = edgeStart[0] + scrubT * (edgeEnd[0] - edgeStart[0]);
        handY = edgeStart[1] + scrubT * (edgeEnd[1] - edgeStart[1]);

        if (progress >= 1.0) {
          points = `0, 0 ${width}, 0 ${width},${height} 0, ${height} `;
        }

        polygon.setAttribute('points', points);

        // 3. Update eraser hand position
        if (showEraser && this.sceneHandOverlayManager && this.handOverlayCanvas) {
          const ctx = this.handOverlayCanvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, this.handOverlayCanvas.width, this.handOverlayCanvas.height);
          }

          // Apply natural wiggle for a more "whiteboard erasing" feel
          // We increase frequency and amplitude for a more vigorous erasing motion
          const [wiggleX, wiggleY] = addWiggleToPosition(handX, handY, progress, 1.0, 25, 6.0);

          this.sceneHandOverlayManager.drawHandAt(
            wiggleX,
            wiggleY,
            this.handOverlayCanvas
          );
        }

        if (progress < 1.0) {
          requestAnimationFrame(animate);
        } else {
          if (this.sceneHandOverlayManager && this.handOverlayCanvas) {
            this.sceneHandOverlayManager.hideHand(this.handOverlayCanvas);
          }
          // Hide the entire scene group after overlay covers it
          this.group.setAttribute("opacity", "0");
          // Clean up overlay
          if (overlayGroup.parentNode) {
            overlayGroup.parentNode.removeChild(overlayGroup);
          }
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  /**
   * Erase a specific layer with an eraser effect, while preserving layers on top.
   * This method properly handles layer superposition by only erasing the target layer
   * and compositing upper layers back on top during the animation.
   * 
   * If the target layer cannot be erased with an effect, the layer will be hidden
   * immediately without animation as a fallback behavior.
   * 
   * @param layerId - ID of the layer to erase
   * @param config - Optional eraser configuration
   * @throws Will log warning if scene is not attached or layer is not found
   */
  async eraseLayerWithEffect(layerId: string, config?: Partial<SlideEraserConfig>): Promise<void> {
    const eraserConfig = config || this.eraserConfig;
    if (!eraserConfig || !eraserConfig.enabled) {
      // Just hide the layer
      const layer = this.layers.get(layerId);
      if (layer) {
        layer.setOpacity(0);
      }
      return;
    }

    if (!this.parentSvg) {
      if (isDebugEnabled()) {
        console.warn("Scene not attached to SVG. Use attachTo() first.");
      }
      return;
    }

    const targetLayer = this.layers.get(layerId);
    if (!targetLayer) {
      if (isDebugEnabled()) {
        console.warn(`Layer ${layerId} not found in scene`);
      }
      return;
    }

    // Wait for delay if specified
    if (eraserConfig.delayAfterAnimations && eraserConfig.delayAfterAnimations > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, eraserConfig.delayAfterAnimations! * 1000)
      );
    }

    // const eraserPattern = eraserConfig.pattern || "diagonal";

    // ALWAYS use SVG-based erasers for better performance and to avoid ImageData dependency
    await this.eraseLayerWithSvgPattern(layerId, eraserConfig);
  }





  /**
   * Apply automatic partial erase for a layer that is about to be animated.
   * This method checks if the layer has occlusionErase configured, and if so,
   * detects overlapping lower z-index layers and animates the erasing of
   * overlapping portions before the layer is drawn.
   * 
   * Performance optimization: This method can be disabled via setPartialEraseEnabled(false)
   * to make scene transitions instant at the cost of visual quality.
   * 
   * @param layerId - ID of the layer being animated
   */
  /**
   * Efface un calque spécifique en utilisant un clipPath SVG.
   * Très performant car évite la capture d'image et le compositing des calques supérieurs.
   */
  private async eraseLayerWithSvgPattern(layerId: string, config: Partial<SlideEraserConfig>): Promise<void> {
    const layer = this.layers.get(layerId);
    if (!layer) return;

    const element = layer.getElement();
    if (!element) return;

    const { width, height } = this.getSceneDimensions();
    const duration = config.duration || 0;
    const showEraser = config.showEraser !== undefined ? config.showEraser : true;
    const pattern = config.pattern || "diagonal";

    // 0. Initialize eraser hand if needed
    if (showEraser) {
      await this.initializeEraserHand(config.handImage, config.handOffset, config.handScale);
    }

    // 1. Créer le clipPath spécifique au calque
    const clipPathId = `${this.id} -${layerId} -pattern - clip`;
    let clipPath = document.getElementById(clipPathId) as unknown as SVGClipPathElement;
    if (!clipPath) {
      const defs = this.parentSvg?.querySelector('defs') || document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      if (this.parentSvg && !this.parentSvg.querySelector('defs')) {
        this.parentSvg.appendChild(defs);
      }

      clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
      clipPath.setAttribute('id', clipPathId);
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('points', `0, 0 ${width}, 0 ${width},${height} 0, ${height} `);
      clipPath.appendChild(polygon);
      defs.appendChild(clipPath);
    }

    const polygon = clipPath.querySelector('polygon') as SVGPolygonElement;
    element.setAttribute('clip-path', `url(#${clipPathId})`);

    // 2. Animation
    const startTime = performance.now();
    const totalDuration = duration * 1000;

    return new Promise((resolve) => {
      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / totalDuration, 1.0);
        const easedProgress = this.applyEasing(progress, 'linear');

        let points = '';
        let handX = 0;
        let handY = 0;

        let edgeStart: [number, number] = [0, 0];
        let edgeEnd: [number, number] = [0, 0];

        if (pattern === "horizontal" || pattern === "horizontal_svg") {
          const x = easedProgress * width;
          points = `${x}, 0 ${width}, 0 ${width},${height} ${x},${height} `;
          edgeStart = [x, 0];
          edgeEnd = [x, height];
        } else if (pattern === "vertical" || pattern === "vertical_svg") {
          const y = easedProgress * height;
          points = `0, ${y} ${width},${y} ${width},${height} 0, ${height} `;
          edgeStart = [0, y];
          edgeEnd = [width, y];
        } else {
          // Default to diagonal
          const d = easedProgress * (width + height);

          if (d <= width && d <= height) {
            points = `${d}, 0 ${width}, 0 ${width},${height} 0, ${height} 0, ${d} `;
            edgeStart = [d, 0];
            edgeEnd = [0, d];
          } else if (d > width && d <= height) {
            points = `${width},${d - width} ${width},${height} 0, ${height} 0, ${d} `;
            edgeStart = [width, d - width];
            edgeEnd = [0, d];
          } else if (d > height && d <= width) {
            points = `${d}, 0 ${width}, 0 ${width},${height} ${d - height},${height} `;
            edgeStart = [d, 0];
            edgeEnd = [d - height, height];
          } else {
            const offset = d - width;
            const offset2 = d - height;
            points = `${width},${offset} ${width},${height} ${offset2},${height} `;
            edgeStart = [width, offset];
            edgeEnd = [offset2, height];
          }
        }

        // Calculate zigzag position along the erasing edge
        // We use a high frequency oscillation to simulate scrubbing
        const scrubFreq = 10.0;
        const scrubT = (Math.sin(progress * Math.PI * 2 * scrubFreq) + 1) / 2;
        handX = edgeStart[0] + scrubT * (edgeEnd[0] - edgeStart[0]);
        handY = edgeStart[1] + scrubT * (edgeEnd[1] - edgeStart[1]);

        if (progress >= 1.0) {
          points = `${width},${height} ${width},${height} ${width},${height} `;
        }

        polygon.setAttribute('points', points);

        // 3. Update eraser hand position
        if (showEraser && this.sceneHandOverlayManager && this.handOverlayCanvas) {
          const ctx = this.handOverlayCanvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, this.handOverlayCanvas.width, this.handOverlayCanvas.height);
          }

          // Apply natural wiggle for a more "whiteboard erasing" feel
          // We increase frequency and amplitude for a more vigorous erasing motion
          const [wiggleX, wiggleY] = addWiggleToPosition(handX, handY, progress, 1.0, 25, 6.0);

          this.sceneHandOverlayManager.drawHandAt(
            wiggleX,
            wiggleY,
            this.handOverlayCanvas
          );
        }

        if (progress < 1.0) {
          requestAnimationFrame(animate);
        } else {
          if (this.sceneHandOverlayManager && this.handOverlayCanvas) {
            this.sceneHandOverlayManager.hideHand(this.handOverlayCanvas);
          }
          layer.setOpacity(0);
          element.removeAttribute('clip-path');
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  /**
   * Initialize the eraser hand overlay manager with correct configuration.
   * @param handImage Optional custom hand image URL
   * @param handOffset Optional custom hand offset [x, y]
   * @param handScale Optional custom hand scale
   */
  private async initializeEraserHand(
    handImage?: string,
    handOffset?: [number, number],
    handScale?: number
  ): Promise<void> {
    if (!this.sceneHandOverlayManager) {
      this.sceneHandOverlayManager = new HandOverlayManager();
    }

    // Determine the image URL to use
    // Determine the image URL to use
    const eraserPreset = getHandOverlayConfigFromPreset('eraser');
    const imageUrl = handImage || eraserPreset?.imageUrl;

    // Check if already initialized with the correct image
    const currentConfig = this.sceneHandOverlayManager.getConfig();
    if (this.sceneHandOverlayManager.isInitialized && currentConfig?.imageUrl === imageUrl) {
      // If same image but different offset/scale, update config
      if (handOffset || handScale) {
        const config = this.sceneHandOverlayManager.getConfig();
        if (config) {
          const updatedConfig = { ...config };
          if (handOffset) updatedConfig.offset = [handOffset[0], handOffset[1]];
          if (handScale) updatedConfig.scale = handScale;
          this.sceneHandOverlayManager.initialize(updatedConfig);
        }
      }
      return;
    }

    // Get base config from preset
    const eraserHandConfig = getHandOverlayConfigFromPreset('eraser');

    if (eraserHandConfig) {
      // Override with custom values if provided
      const customConfig = { ...eraserHandConfig };
      if (handImage) customConfig.imageUrl = handImage;
      if (handOffset) customConfig.offset = handOffset;
      if (handScale) customConfig.scale = handScale;

      await this.sceneHandOverlayManager.initialize(customConfig);
      const eraserStrategy = new EraserHandStrategy();
      this.sceneHandOverlayManager.setStrategy(eraserStrategy);
    }
  }


  /**
   * Cleanup scene resources including hand overlays and caches
   */
  cleanup(): void {
    // Cleanup all layer hand overlays
    this.layers.forEach(layer => {
      layer.cleanup();
    });

    // Cleanup scene-level hand overlay
    if (this.sceneHandOverlayManager) {
      this.sceneHandOverlayManager.cleanup();
      this.sceneHandOverlayManager = null;
    }

    // Clear occlusion cache to free memory
    this.clearOcclusionCache();
  }
}

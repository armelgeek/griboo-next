import { Scene } from './scene';
import { Layer } from './layer';
import { WhiteboardConfig, SceneConfig } from './types';
import { setDebugEnabled } from '../../shared/config/debug_config';
import { perfMonitor } from '../core/infra/performance-monitor';

import { HandOverlay } from '../rendering/hand_overlay';
import { HandOverlayConfig } from './managers/hand-overlay-manager';
import { isDebugEnabled } from '../../shared/config/debug_config';
import { globalHandConfig, updateHandPreset } from './utils/hand-config';
import { BackgroundManager } from './managers/background-manager';
import { MorphLayer } from './layers/morph-layer';
import { TimingManager } from './managers/timing-manager';
import { ShapeLayer } from './layers/shape-layer';
import { PushLayer } from './layers/push-layer';
import { CaptionLayer } from './layers/caption-layer';
import { TextLayer } from './layers/text-layer';
import { SvgLayer } from '../core/layers/svg-layer';
import { ImageLayer } from './layers/image-layer';
import { normalizeColor, rgbaToHex } from '../../shared/utils/color_utils';
import { EntranceAnimationType, EntranceAnimationTypeValue } from '../core/animations/entrance_animation';
import { TransitionType } from './types';
import { validateWhiteboardConfig } from '../../shared/validation/config_validator';
import { registerHandPresetsFromConfig } from '../../shared/config/hand_config';
import { SceneCanvas, SceneConfig as EditorSceneConfig } from '../../editor/canvas/scene-canvas';
import { EditorStore, EditorScene } from '../../editor/canvas/store';


// Placeholder types for Store integration - these will be replaced when integrated with a store
type StoreScene = any;
type StoreLayer = any;

export class Whiteboard {
  private svg: SVGSVGElement;
  private config?: WhiteboardConfig;
  private backgroundManager: BackgroundManager;
  private scenes: Scene[] = [];
  private currentSceneIndex: number = -1;
  private width: number;
  private height: number;
  private container: HTMLElement;
  private handOverlayCanvas: HTMLCanvasElement | null = null;
  // PERFORMANCE: Cache canvas context to avoid repeated getContext() calls
  private ctx: CanvasRenderingContext2D | null = null;
  // PERFORMANCE: Cache for HandOverlay instances to avoid recreation
  private handOverlayCache = new Map<string, HandOverlay>();
  // PERFORMANCE: AbortController for playback control
  private playbackController: AbortController | null = null;
  private status: 'idle' | 'preparing' | 'playing' | 'stopped' | 'completed' = 'idle';
  private onStatusChange?: (status: 'idle' | 'preparing' | 'playing' | 'stopped' | 'completed', progress?: number) => void;
  private onPrepared?: (sceneIndex: number) => void;
  private onTimeUpdate?: (time: number) => void;
  private onCompleted?: () => void;
  private currentTime: number = 0;
  private clockStartTime: number = 0;
  private clockPausedTime: number = 0;
  private clockFrameId: number | null = null;
  private lastPreloadedBackground: string | null = null;
  private currentSeekPromise: Promise<void> = Promise.resolve();
  private lastSeekId: number = 0;

  // Duration caching
  private cachedTotalDuration: number = 0;
  private lastDurationCalculation: number = 0;
  private cachedSceneStartTimes: Map<number, number> = new Map();


  // Progress Bar properties
  private progressBarCanvas: HTMLCanvasElement | null = null;
  private progressBarCtx: CanvasRenderingContext2D | null = null;
  private totalDuration: number = 0;
  private isProgressBarVisible: boolean = false;
  private isDraggingProgressBar: boolean = false;
  private seekAnimationFrameId: number | null = null;

  // Preparation Loader properties
  private preparationLoaderOverlay: HTMLDivElement | null = null;
  private preparationLoaderEnabled: boolean = true;

  // Global subtitle/caption system
  private subtitleGroup: SVGGElement | null = null;
  private currentSubtitleLayer: CaptionLayer | null = null;
  private subtitleUpdateInterval: number | null = null;

  // Event listener references for cleanup
  private windowMouseMoveListener: ((e: MouseEvent) => void) | null = null;
  private windowMouseUpListener: (() => void) | null = null;
  private windowTouchMoveListener: ((e: TouchEvent) => void) | null = null;
  private windowTouchEndListener: (() => void) | null = null;

  // Editor properties
  private editor: SceneCanvas | null = null;
  private editorContainer: HTMLDivElement | null = null;
  private mode: 'preview' | 'editor' = 'preview';

  constructor(configOrContainerId: string | WhiteboardConfig, width: number = 800, height: number = 450) {
    let containerId: string;
    let config: WhiteboardConfig | undefined;

    if (typeof configOrContainerId === 'string') {
      containerId = configOrContainerId;
      this.width = width;
      this.height = height;
    } else {
      // Validate configuration
      try {
        this.config = validateWhiteboardConfig(configOrContainerId) as WhiteboardConfig;
      } catch (error) {
        console.error('[Whiteboard] Configuration validation failed:', error);
        throw error;
      }
      config = this.config;
      containerId = this.config.containerId || 'whiteboard-container';
      this.width = this.config.width || width;
      this.height = this.config.height || height;
    }

    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container ${containerId} not found`);
    this.container = container;
    this.container.style.position = 'relative';
    this.container.style.width = `${this.width}px`;
    this.container.style.height = `${this.height}px`;
    this.container.style.overflow = 'hidden';
    this.container.style.display = 'flex';
    this.container.style.alignItems = 'center';
    this.container.style.justifyContent = 'center';

    // Create SVG and background rect
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', this.width.toString());
    this.svg.setAttribute('height', this.height.toString());
    this.svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    this.svg.style.display = 'block';

    // Initialize BackgroundManager
    this.backgroundManager = new BackgroundManager(this.svg, this.width, this.height);

    // Apply background
    const background = config?.background || '#ffffff';
    this.backgroundManager.apply(background);

    // PERFORMANCE: Create hand overlay and progress bar canvases before DOM insertion
    this.createHandOverlayCanvas();
    this.createPreparationLoaderOverlay();
    this.createProgressBarCanvas();

    // PERFORMANCE: Use DocumentFragment for batched DOM operations (single reflow)
    const fragment = document.createDocumentFragment();
    fragment.appendChild(this.svg);
    if (this.handOverlayCanvas) {
      fragment.appendChild(this.handOverlayCanvas);
    }
    if (this.preparationLoaderOverlay) {
      fragment.appendChild(this.preparationLoaderOverlay);
    }
    if (this.progressBarCanvas) {
      fragment.appendChild(this.progressBarCanvas);
    }
    this.container.appendChild(fragment);

    // Apply global settings if config is provided
    if (config) {
      if (config.debug !== undefined) {
        setDebugEnabled(config.debug);
      }
      if (config.perfMonitor) {
        perfMonitor.enable();
      }

      // Add scenes if provided
      if (config.scenes) {
        config.scenes.forEach((sceneConfig: SceneConfig) => {
          // Calculate viewport scale (matches server implementation)
          const virtualWidth = sceneConfig.camera?.virtualSize?.width || this.width;
          const virtualHeight = sceneConfig.camera?.virtualSize?.height || this.height;
          const viewportScale = Math.min(this.width / virtualWidth, this.height / virtualHeight);

          const scene = new Scene(sceneConfig, config.hands, viewportScale);
          this.addScene(scene);
        });
      }

      // Register hand presets from config (required - no defaults)
      // Register all presets upfront to ensure they're available for all layers
      if (config.hands) {

        try {
          registerHandPresetsFromConfig(config.hands, globalHandConfig);
        } catch (error) {
          console.error('Failed to register hand presets:', error);
          throw error;
        }
      }

      this.onStatusChange = config.onStatusChange;
      this.onPrepared = config.onPrepared;
      this.onTimeUpdate = config.onTimeUpdate;
      this.onCompleted = config.onCompleted;

      // Initialize global subtitle system if configured
      console.log('[Whiteboard] Checking subtitle config:', {
        hasSubtitles: !!config.subtitles,
        enabled: config.subtitles?.enabled
      });
      if (config.subtitles && config.subtitles.enabled) {
        console.log('[Whiteboard] Calling initializeSubtitleSystem');
        this.initializeSubtitleSystem();
      }

      // Initialize editor if enabled in config
      if (config.editor && config.editor.enabled) {
        this.initEditor();
      }
    }
  }

  private setStatus(status: 'idle' | 'preparing' | 'playing' | 'stopped' | 'completed', progress?: number): void {
    if (this.status === status && progress === undefined) return;
    this.status = status;

    // Manage preparation loader visibility
    if (status === 'preparing') {
      this.showPreparationLoader();
      if (progress !== undefined) {
        this.updatePreparationLoaderProgress(progress);
      }
    } else {
      this.hidePreparationLoader();
    }

    if (this.onStatusChange) {
      this.onStatusChange(status, progress);
    }
  }

  private startClock(startTime: number = 0): void {
    this.stopClock();
    this.currentTime = startTime;
    this.clockStartTime = Date.now() - startTime * 1000;
    this.clockPausedTime = 0; // Reset paused time when starting/resuming

    // PERFORMANCE: Immediate update to ensure UI reflects start time without waiting for next frame
    if (this.onTimeUpdate) {
      this.onTimeUpdate(this.currentTime);
    }
    this.drawProgressBar(); // Immediate progress bar update

    const tick = () => {
      if (this.isDraggingProgressBar) {
        this.clockFrameId = requestAnimationFrame(tick);
        return;
      }
      this.currentTime = (Date.now() - this.clockStartTime) / 1000;
      if (this.onTimeUpdate) {
        this.onTimeUpdate(this.currentTime);
      }

      // Update progress bar
      this.drawProgressBar();

      this.clockFrameId = requestAnimationFrame(tick);
    };
    this.clockFrameId = requestAnimationFrame(tick);
  }

  private stopClock(): void {
    if (this.clockFrameId !== null) {
      cancelAnimationFrame(this.clockFrameId);
      this.clockFrameId = null;
    }
  }

  private pauseClock(): void {
    this.stopClock();
    this.clockPausedTime = this.currentTime;
  }

  private resumeClock(): void {
    this.startClock(this.clockPausedTime);
  }

  private calculateTotalDuration(): number {
    // Check cache (valid for 2 seconds)
    const now = Date.now();
    if (this.cachedTotalDuration > 0 && (now - this.lastDurationCalculation < 2000)) {
      return this.cachedTotalDuration;
    }

    // If no scenes, return 0
    if (this.scenes.length === 0) {
      return 0;
    }

    let totalDuration = 0;
    this.cachedSceneStartTimes.clear();

    for (let i = 0; i < this.scenes.length; i++) {
      const scene = this.scenes[i];
      this.cachedSceneStartTimes.set(i, totalDuration);

      const timing = scene.getLiveTiming();
      const duration = scene.getConfig().duration || timing.totalDuration;
      totalDuration += duration;
    }

    this.cachedTotalDuration = totalDuration;
    this.lastDurationCalculation = now;
    return totalDuration;
  }

  private getSceneStartTime(index: number): number {
    // Ensure cache is fresh
    this.calculateTotalDuration();
    return this.cachedSceneStartTimes.get(index) || 0;
  }

  getStatus(): 'idle' | 'preparing' | 'playing' | 'stopped' | 'completed' {
    return this.status;
  }

  /**
   * Colorie le hand overlay canvas (zone main) avec une couleur de fond et/ou une couleur de debug.
   * @param color Couleur de remplissage (ex: 'rgba(255,0,0,0.2)' ou '#ff0000')
   * @param alpha Opacité (0-1), prioritaire si color est sans alpha
   * @param backgroundColor Couleur de fond (ex: 'rgba(0,255,0,0.1)')
   */
  colorHandOverlay(color: string = 'rgba(255,0,0,0.2)', alpha?: number, backgroundColor?: string): void {
    if (!this.ctx) return;

    // PERFORMANCE: Manual state management instead of save/restore
    // Remplit le fond si demandé
    if (backgroundColor) {
      this.ctx.globalAlpha = 1;
      this.ctx.fillStyle = backgroundColor;
      this.ctx.fillRect(0, 0, this.width, this.height);
    } else {
      // Efface le fond sinon
      this.ctx.clearRect(0, 0, this.width, this.height);
    }

    // Applique la couleur de debug/effet
    this.ctx.globalCompositeOperation = 'source-over';
    if (alpha !== undefined) {
      this.ctx.globalAlpha = alpha;
    } else {
      this.ctx.globalAlpha = 1;
    }
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Reset to defaults
    this.ctx.globalAlpha = 1;
  }

  /**
   * Affiche la main de manière statique à une position donnée.
   * Utile pour le debug ou pour positionner la main sans animation.
   * @param x Position X
   * @param y Position Y
   * @param config Configuration optionnelle de la main (image, échelle, offset...)
   */
  async drawStaticHand(x: number, y: number, config?: HandOverlayConfig): Promise<void> {
    if (!this.handOverlayCanvas || !this.ctx) return;

    // PERFORMANCE: Use caching to avoid recreating HandOverlay instances
    const cacheKey = JSON.stringify(config || {});

    if (!this.handOverlayCache.has(cacheKey)) {
      const overlayConfig = config || {
        enabled: true,
      };

      const overlay = new HandOverlay(
        overlayConfig.imageUrl,
        overlayConfig.scale,
        overlayConfig.offset,
        overlayConfig.anchorTopLeft,
        overlayConfig.anchorPoint
      );

      await overlay.waitForLoad();
      this.handOverlayCache.set(cacheKey, overlay);
    }

    const overlay = this.handOverlayCache.get(cacheKey)!;

    // Effacer le canvas avant de dessiner
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Dessiner la main
    overlay.render(this.ctx, x, y);
  }

  /**
   * Create and append the hand overlay canvas
   */
  private createHandOverlayCanvas(): void {
    this.handOverlayCanvas = document.createElement('canvas');
    this.handOverlayCanvas.width = this.width;
    this.handOverlayCanvas.height = this.height;
    this.handOverlayCanvas.style.position = 'absolute';
    this.handOverlayCanvas.style.top = '0';
    this.handOverlayCanvas.style.left = '0';
    this.handOverlayCanvas.style.pointerEvents = 'none';
    // PERFORMANCE: Use high z-index instead of DOM manipulation to keep on top
    this.handOverlayCanvas.style.zIndex = '999999';

    // PERFORMANCE: Get context once with performance options
    this.ctx = this.handOverlayCanvas.getContext('2d', {
      alpha: true,
      desynchronized: true, // Better animation performance
      willReadFrequently: false
    });
  }

  /**
   * Create and append the progress bar canvas
   */
  private createProgressBarCanvas(): void {
    this.progressBarCanvas = document.createElement('canvas');
    this.progressBarCanvas.width = this.width;
    this.progressBarCanvas.height = 60; // Fixed height for progress bar area
    this.progressBarCanvas.style.position = 'absolute';
    this.progressBarCanvas.style.bottom = '0';
    this.progressBarCanvas.style.left = '0';
    this.progressBarCanvas.style.width = `${this.width}px`;
    this.progressBarCanvas.style.height = '60px';
    this.progressBarCanvas.style.pointerEvents = 'auto'; // Enable interaction
    this.progressBarCanvas.style.cursor = 'pointer';
    this.progressBarCanvas.style.zIndex = '2147483647'; // Max z-index
    this.progressBarCanvas.style.display = 'none';
    // DEBUG: Add border to see the canvas
    //this.progressBarCanvas.style.border = '1px solid red';

    this.progressBarCtx = this.progressBarCanvas.getContext('2d', {
      alpha: true,
      desynchronized: true,
      willReadFrequently: false
    });

    this.initProgressBarListeners();
  }

  /**
   * Create and append the preparation loader overlay
   */
  private createPreparationLoaderOverlay(): void {
    this.preparationLoaderOverlay = document.createElement('div');
    this.preparationLoaderOverlay.style.position = 'absolute';
    this.preparationLoaderOverlay.style.top = '0';
    this.preparationLoaderOverlay.style.left = '0';
    this.preparationLoaderOverlay.style.width = '100%';
    this.preparationLoaderOverlay.style.height = '100%';
    this.preparationLoaderOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    this.preparationLoaderOverlay.style.display = 'none';
    this.preparationLoaderOverlay.style.zIndex = '2147483646';
    this.preparationLoaderOverlay.style.pointerEvents = 'none';

    this.preparationLoaderOverlay.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%;">
        <div class="loader-spinner" style="width: 48px; height: 48px; border: 4px solid rgba(255, 255, 255, 0.2); border-top-color: white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }

  /**
   * Show the preparation loader
   */
  private showPreparationLoader(): void {
    if (this.preparationLoaderOverlay && this.preparationLoaderEnabled) {
      this.preparationLoaderOverlay.style.display = 'block';
    }
  }

  /**
   * Hide the preparation loader
   */
  private hidePreparationLoader(): void {
    if (this.preparationLoaderOverlay) {
      this.preparationLoaderOverlay.style.display = 'none';
    }
  }

  /**
   * Update preparation loader progress
   */
  private updatePreparationLoaderProgress(progress: number): void {
    if (!this.preparationLoaderOverlay) return;

    const progressText = this.preparationLoaderOverlay.querySelector('.loader-progress-text');
    const progressFill = this.preparationLoaderOverlay.querySelector('.loader-progress-fill') as HTMLElement;

    if (progressText) {
      progressText.textContent = `${Math.round(progress * 100)}%`;
    }
    if (progressFill) {
      progressFill.style.width = `${progress * 100}%`;
    }
  }


  /**
   * Initialize event listeners for progress bar interaction
   */
  private initProgressBarListeners(): void {
    if (!this.progressBarCanvas) return;

    const handleSeek = (e: MouseEvent) => {
      if (!this.progressBarCanvas) return;

      // Ensure totalDuration is up to date
      if (this.totalDuration <= 0) {
        this.totalDuration = this.calculateTotalDuration();
      }
      if (this.totalDuration <= 0) return;

      const rect = this.progressBarCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;

      if (rect.width === 0) return;

      // Use requestAnimationFrame to throttle seek operations
      if (this.seekAnimationFrameId !== null) {
        cancelAnimationFrame(this.seekAnimationFrameId);
      }

      this.seekAnimationFrameId = requestAnimationFrame(() => {
        this.seekAnimationFrameId = null;

        // Calculate logical X position accounting for CSS scaling
        const xLogical = (x / rect.width) * this.width;

        // Layout constants must match drawProgressBar
        const horizontalPadding = 16;
        const showTime = true;
        const barX = horizontalPadding + (showTime ? 50 : 0);
        const barWidth = this.width - (2 * horizontalPadding) - (showTime ? 100 : 0);

        // Calculate progress based on bar position
        const relativeX = xLogical - barX;
        const progress = Math.max(0, Math.min(1, relativeX / barWidth));
        const seekTime = progress * this.totalDuration;

        if (isDebugEnabled()) {
          console.log(`[Whiteboard] handleSeek (throttled): seekTime=${seekTime.toFixed(2)}s`);
        }
        this.seek(seekTime).catch(err => {
          if (isDebugEnabled()) {
            console.error('[Whiteboard] handleSeek: seek failed', err);
          }
        });
      });
    };

    this.progressBarCanvas.addEventListener('mousedown', (e) => {
      if (isDebugEnabled()) {
        console.log('[Whiteboard] mousedown on progress bar. Current status:', this.status);
      }

      // Prevent event propagation to avoid closing the preview
      e.stopPropagation();
      e.preventDefault();

      // Pause playback when starting to seek to prevent race conditions
      if (this.status === 'playing') {
        if (isDebugEnabled()) {
          console.log('[Whiteboard] mousedown: was playing, calling pause()');
        }
        this.pause();
        // Store that we were playing so we can resume on mouseup
        (this as any).wasPlayingBeforeSeek = true;
      } else {
        if (isDebugEnabled()) {
          console.log('[Whiteboard] mousedown: was NOT playing');
        }
        this.pauseClock();
        (this as any).wasPlayingBeforeSeek = false;
      }

      this.isDraggingProgressBar = true;
      handleSeek(e);
    });

    this.windowMouseMoveListener = (e: MouseEvent) => {
      if (this.isDraggingProgressBar) {
        handleSeek(e);
      }
    };

    this.windowMouseUpListener = () => {
      if (this.isDraggingProgressBar) {
        if (isDebugEnabled()) {
          console.log('[Whiteboard] mouseup. wasPlayingBeforeSeek:', (this as any).wasPlayingBeforeSeek);
        }

        // Resume playback if we were playing before
        if ((this as any).wasPlayingBeforeSeek) {
          if (isDebugEnabled()) {
            console.log('[Whiteboard] mouseup: calling play() with startTime:', this.currentTime);
          }
          // Resume from the current time (which was updated by seek)
          this.play(this.currentTime).catch(err => {
            if (isDebugEnabled()) {
              console.error('[Whiteboard] Failed to resume after seek:', err);
            }
          });
          (this as any).wasPlayingBeforeSeek = false;
        }
      }
      this.isDraggingProgressBar = false;
    };

    window.addEventListener('mousemove', this.windowMouseMoveListener);
    window.addEventListener('mouseup', this.windowMouseUpListener);

    // Touch support for mobile devices
    this.progressBarCanvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (this.status === 'playing') {
        this.pause();
        (this as any).wasPlayingBeforeSeek = true;
      } else {
        this.pauseClock();
        (this as any).wasPlayingBeforeSeek = false;
      }
      this.isDraggingProgressBar = true;
      handleSeek({ clientX: touch.clientX } as MouseEvent);
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (this.isDraggingProgressBar && e.touches.length > 0) {
        handleSeek({ clientX: e.touches[0].clientX } as MouseEvent);
      }
    });

    window.addEventListener('touchend', () => {
      if (this.isDraggingProgressBar) {
        if ((this as any).wasPlayingBeforeSeek) {
          this.play(this.currentTime).catch(() => { });
          (this as any).wasPlayingBeforeSeek = false;
        }
      }
      this.isDraggingProgressBar = false;
    });
  }

  /**
   * Format time as MM:SS or HH:MM:SS
   */
  private formatTime(timeInSeconds: number): string {
    if (!isFinite(timeInSeconds) || timeInSeconds < 0) return '0:00';

    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = Math.floor(timeInSeconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Draw the progress bar on its dedicated canvas
   */
  private drawProgressBar(): void {
    // Safety check: ensure totalDuration is calculated if it's 0 but scenes exist
    if (this.totalDuration === 0 && this.scenes.length > 0) {
      this.totalDuration = this.calculateTotalDuration();
    }

    if (!this.progressBarCtx || !this.progressBarCanvas || !this.isProgressBarVisible) {
      if (isDebugEnabled()) {
        if (this.isProgressBarVisible) {
          console.warn('[Whiteboard] drawProgressBar skipped: ctx or canvas missing');
        }
      }
      return;
    }

    const ctx = this.progressBarCtx;
    const canvas = this.progressBarCanvas;
    const width = this.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (isDebugEnabled()) {
      console.log(`[Whiteboard] drawProgressBar: time=${this.currentTime.toFixed(2)}, total=${this.totalDuration.toFixed(2)}`);
    }

    const progress = this.totalDuration > 0 ? this.currentTime / this.totalDuration : 0;
    const progressClamped = Math.max(0, Math.min(1, progress));

    // Configuration
    const barHeight = 4;
    const bottomPadding = 12;
    const horizontalPadding = 16;
    const showTime = true;
    const fontSize = 12;

    // Calculate layout
    const barY = height - bottomPadding - barHeight;
    const barX = horizontalPadding + (showTime ? 50 : 0);
    const barWidth = width - (2 * horizontalPadding) - (showTime ? 100 : 0);

    // Draw overlay gradient background
    const overlayGradient = ctx.createLinearGradient(0, 0, 0, height);
    overlayGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    overlayGradient.addColorStop(0.3, 'rgba(0, 0, 0, 0.4)');
    overlayGradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
    ctx.fillStyle = overlayGradient;
    ctx.fillRect(0, 0, width, height);

    // Draw background bar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Draw progress fill
    if (progressClamped > 0) {
      const fillGradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
      fillGradient.addColorStop(0, '#9333ea'); // purple-600
      fillGradient.addColorStop(1, '#db2777'); // pink-600
      ctx.fillStyle = fillGradient;
      ctx.fillRect(barX, barY, barWidth * progressClamped, barHeight);
    }

    // Draw time labels
    if (showTime) {
      ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'white';

      // Current time (left)
      ctx.globalAlpha = 0.9;
      ctx.textAlign = 'right';
      ctx.fillText(this.formatTime(this.currentTime), barX - 8, barY + barHeight / 2);

      // Duration (right)
      ctx.globalAlpha = 0.7;
      ctx.textAlign = 'left';
      ctx.fillText(this.formatTime(this.totalDuration), barX + barWidth + 8, barY + barHeight / 2);

      ctx.globalAlpha = 1;
    }
  }

  /**
   * Synchronize the whiteboard time and update the progress bar.
   */
  private syncTime(sceneBaseTime: number, logicalTime: number): void {
    if (this.isDraggingProgressBar) return;

    // Sync whiteboard time with logical animation time
    this.currentTime = sceneBaseTime + logicalTime;

    // Ensure we don't exceed total duration
    if (this.totalDuration > 0 && this.currentTime > this.totalDuration) {
      this.currentTime = this.totalDuration;
    }

    if (this.onTimeUpdate) {
      this.onTimeUpdate(this.currentTime);
    }

    // Also update clock start time to prevent jump when clock resumes
    this.clockStartTime = Date.now() - this.currentTime * 1000;
    this.drawProgressBar(); // Sync progress bar with logical time
  }

  private showProgressBar(): void {
    if (isDebugEnabled()) {
      console.log('[Whiteboard] showProgressBar called');
    }
    this.isProgressBarVisible = true;
    if (this.progressBarCanvas) {
      this.progressBarCanvas.style.display = 'block';
    }
    this.drawProgressBar();
  }

  private hideProgressBar(): void {
    if (isDebugEnabled()) {
      console.log('[Whiteboard] hideProgressBar called');
    }
    this.isProgressBarVisible = false;
    if (this.progressBarCanvas) {
      this.progressBarCanvas.style.display = 'none';
    }
    if (this.progressBarCtx) {
      this.progressBarCtx.clearRect(0, 0, this.progressBarCanvas?.width || 0, this.progressBarCanvas?.height || 0);
    }
  }
  addScene(scene: Scene): this {
    this.scenes.push(scene);
    scene.attachTo(this.svg, this.width, this.height);
    scene.backgroundManager = this.backgroundManager;

    // Pass the hand overlay canvas to the scene
    if (this.handOverlayCanvas) {
      scene.setHandOverlayCanvas(this.handOverlayCanvas);
    }

    // Pass global hand configuration to the scene
    if (this.config?.hands) {
      scene.setGlobalHandsConfig(this.config.hands);
    }

    // Inherit hand overlay config from whiteboard if not specified in scene
    if (scene.getConfig().handOverlay === undefined && this.config?.handOverlay) {
      scene.setHandOverlayEnabled(this.config.handOverlay.enabled !== false);
    }

    // Apply scene background immediately if it's the first scene or if we want real-time updates
    const sceneBackground = scene.getConfig().background;
    if (sceneBackground && typeof sceneBackground !== 'string' && sceneBackground.template?.url) {
      if (this.lastPreloadedBackground !== sceneBackground.template.url) {
        this.backgroundManager.apply(sceneBackground);
        // Preload background image if present (non-blocking in addScene)
        this.backgroundManager.preload().then(() => {
          this.lastPreloadedBackground = sceneBackground.template?.url || null;
        }).catch(err => {
          if (isDebugEnabled()) {
            console.error('[Whiteboard] Failed to preload background:', err);
          }
        });
      }
    } else if (sceneBackground) {
      this.backgroundManager.apply(sceneBackground);
    }

    return this;
  }

  /**
   * Get a scene by ID.
   */
  getScene(sceneId: string): Scene | undefined {
    return this.scenes.find(s => s.id === sceneId);
  }

  /**
   * Preload a specific layer in a scene.
   */
  async preloadLayer(sceneId: string, layerId: string): Promise<void> {
    const scene = this.getScene(sceneId);
    if (scene) {
      await scene.preloadLayer(layerId);
    }
  }

  /**
   * Update a layer in a scene.
   */
  updateLayer(sceneId: string, layer: Layer): void {
    const scene = this.getScene(sceneId);
    if (scene) {
      scene.updateLayer(layer);
    }
  }

  /**
   * Add a layer to a scene.
   */
  addLayer(sceneId: string, layer: Layer): void {
    const scene = this.getScene(sceneId);
    if (scene) {
      scene.addLayer(layer);
    }
  }

  /**
   * Delete a layer from a scene.
   */
  deleteLayer(sceneId: string, layerId: string): void {
    const scene = this.getScene(sceneId);
    if (scene) {
      scene.deleteLayer(layerId);
    }
  }

  /**
   * Reorder layers in a scene.
   */
  reorderLayers(sceneId: string, layerIds: string[]): void {
    const scene = this.getScene(sceneId);
    if (scene) {
      scene.reorderLayers(layerIds);
    }
  }

  /**
   * Delete a scene by ID.
   */
  deleteScene(sceneId: string): void {
    const index = this.scenes.findIndex(s => s.id === sceneId);
    if (index !== -1) {
      const scene = this.scenes[index];
      scene.cleanup();
      this.scenes.splice(index, 1);
      this.recalculateTotalDuration();
    }
  }

  /**
   * Reorder scenes.
   */
  reorderScenes(sceneIds: string[]): void {
    const orderedScenes = sceneIds
      .map(id => this.scenes.find(s => s.id === id))
      .filter(Boolean) as Scene[];
    this.scenes = orderedScenes;
    this.recalculateTotalDuration();
  }

  /**
   * Add a new scene at a specific position.
   */
  addSceneAt(scene: Scene, afterIndex?: number): this {
    if (afterIndex !== undefined && afterIndex >= 0 && afterIndex < this.scenes.length) {
      this.scenes.splice(afterIndex + 1, 0, scene);
    } else {
      this.scenes.push(scene);
    }
    scene.attachTo(this.svg, this.width, this.height);
    if (this.handOverlayCanvas) {
      scene.setHandOverlayCanvas(this.handOverlayCanvas);
    }
    this.recalculateTotalDuration();
    return this;
  }

  /**
   * Recalculate total duration based on current scenes.
   */
  private recalculateTotalDuration(): void {
    this.totalDuration = this.scenes.reduce((acc, scene) => {
      const timing = scene.getLiveTiming();
      return acc + (scene.getConfig().duration || timing.totalDuration);
    }, 0);
  }


  async play(startTime: number = 0): Promise<'completed' | 'aborted'> {
    // Invalidate any pending seeks
    this.lastSeekId++;

    if (isDebugEnabled()) {
      console.log('startTime', startTime);
    }
    // Check if we have scenes to play - prevents errors when stop() clears scenes before play() is called
    if (this.scenes.length === 0) {
      if (isDebugEnabled()) {
        console.warn('[Whiteboard] No scenes to play');
      }
      return 'completed';
    }

    // Ensure we start from a clean state
    if (startTime === 0) {
      this.stop();
    } else {
      // If we are resuming from a seek, we don't want to call stop() 
      // because it resets all scenes and layers to their initial state.
      // We just want to abort any ongoing playback and stop the clock.
      this.playbackController?.abort();
      this.playbackController = null;
      this.stopClock();
    }

    // PERFORMANCE: AbortController for playback control
    this.playbackController = new AbortController();
    const signal = this.playbackController.signal;

    // Calculate total duration and show progress bar
    // Set initial currentTime to startTime (not always 0)
    this.currentTime = startTime;
    this.clockStartTime = Date.now() - (startTime * 1000); // Adjust clock start time based on startTime
    this.totalDuration = this.calculateTotalDuration();
    if (isDebugEnabled()) {
      console.log(`[Whiteboard] Playing. Total duration: ${this.totalDuration}s. Scenes: ${this.scenes.length}`);
    }
    if (this.totalDuration > 0) {
      if (isDebugEnabled()) {
        console.log(`[Whiteboard] Showing progress bar`);
      }
      this.showProgressBar();
    } else {
      if (isDebugEnabled()) {
        console.log(`[Whiteboard] Progress bar NOT shown. totalDuration: ${this.totalDuration}`);
      }
    }

    // 1. Determine starting scene index based on startTime
    let startSceneIndex = 0;
    let timeInStartScene = 0;
    let accumulatedTime = 0;

    if (startTime > 0) {
      // Use a small epsilon to avoid floating point issues at scene boundaries
      const epsilon = 0.001;
      const effectiveStartTime = Math.min(startTime, this.totalDuration - epsilon);

      for (let i = 0; i < this.scenes.length; i++) {
        const timing = this.scenes[i].getLiveTiming();
        const sceneDuration = this.scenes[i].getConfig().duration || timing.totalDuration;

        if (effectiveStartTime < accumulatedTime + sceneDuration) {
          startSceneIndex = i;
          timeInStartScene = effectiveStartTime - accumulatedTime;
          break;
        }
        accumulatedTime += sceneDuration;
      }

      // If we reached the end, start at the last scene's end
      if (effectiveStartTime >= this.totalDuration - epsilon && this.scenes.length > 0) {
        startSceneIndex = this.scenes.length - 1;
        const lastTiming = this.scenes[startSceneIndex].getLiveTiming();
        timeInStartScene = this.scenes[startSceneIndex].getConfig().duration || lastTiming.totalDuration;
      }
    }

    // 2. PERFORMANCE: Ensure the STARTING scene is prepared before starting playback
    // We don't need to wait for ALL scenes (background prepare the rest)
    const startScene = this.scenes[startSceneIndex];
    if (startScene && !startScene.isPreparedForPlayback) {
      if (isDebugEnabled()) {
        console.log(`[Whiteboard] Prioritizing preparation for start scene ${startSceneIndex + 1}`);
      }
      await startScene.prepare((progress) => this.setStatus('preparing', progress));

      // Recalculate total duration after preparation as it might have changed
      this.totalDuration = this.calculateTotalDuration();
    }

    // 3. Background prepare the rest of the scenes (don't await)
    if (startSceneIndex < this.scenes.length - 1) {
      this.prepareAllScenes({
        startIndex: startSceneIndex + 1,
        // Using a lower priority for background preparation
        maxConcurrent: 1
      }).catch(err => {
        if (isDebugEnabled()) {
          console.warn('[Whiteboard] Background preparation background task error:', err);
        }
      });
    }

    // Reset background tracking to ensure first scene applies its background
    this.lastPreloadedBackground = null;

    // Check if we are already at the end
    if (startTime >= this.totalDuration - 0.01) {
      if (isDebugEnabled()) {
        console.log('[Whiteboard] Seeked to end, completing immediately');
      }
      this.setStatus('completed');
      this.hideProgressBar();
      if (this.onCompleted) {
        this.onCompleted();
      }
      return 'completed';
    }

    // Set initial currentTime
    this.currentTime = startTime;

    // Track current scene start time for the loop
    let currentSceneBaseTime = 0;
    // Pre-calculate all scene start times to avoid O(N^2)
    const sceneStartTimes = this.scenes.map(scene => {
      const start = currentSceneBaseTime;
      const timing = scene.getLiveTiming();
      currentSceneBaseTime += scene.getConfig().duration || timing.totalDuration;
      return start;
    });

    for (let i = startSceneIndex; i < this.scenes.length; i++) {
      // PERFORMANCE: Check if playback was aborted
      if (signal.aborted) {
        console.log('[Whiteboard] Playback aborted loop');
        break;
      }

      // Pause clock before preparation for subsequent scenes
      if (i > 0) {
        this.pauseClock();
      }

      // PERFORMANCE: Yield control periodically to keep UI responsive
      if (i % 3 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      this.currentSceneIndex = i;
      const scene = this.scenes[i];
      const sceneConfig = scene.getConfig();

      // Apply scene background if defined, otherwise fallback to whiteboard background
      const sceneBackground = sceneConfig.background;
      if (sceneBackground && typeof sceneBackground !== 'string' && sceneBackground.template?.url) {
        if (this.lastPreloadedBackground !== sceneBackground.template.url) {
          this.backgroundManager.apply(sceneBackground);
          // Preload background image before starting animations
          await this.backgroundManager.preload();
          this.lastPreloadedBackground = sceneBackground.template.url;
        }
      } else if (sceneBackground) {
        // Solid color background - no preload needed
        this.backgroundManager.apply(sceneBackground);
      }

      // Start or resume clock after preparation is complete
      if (i === startSceneIndex) {
        this.startClock(startTime);
        // Start subtitle updates
        this.startSubtitleUpdates();
      } else {
        this.resumeClock();
      }

      // Show scene (if not already shown by previous scene's transition)
      await scene.show();

      const sceneBaseTime = sceneStartTimes[i];

      // Pass timeInStartScene only for the first scene we play
      const sceneStartTime = (i === startSceneIndex) ? timeInStartScene : 0;

      await scene.playAnimations(
        () => this.setStatus('playing'),
        (logicalTime) => {
          if (signal.aborted) return;
          this.syncTime(sceneBaseTime, logicalTime);
        },
        signal,
        sceneStartTime
      );

      // For transitions (eraser or hide), we want to show the NEXT scene behind this one
      // so that the exit effect reveals the next content instead of the background.
      if (i + 1 < this.scenes.length) {
        const nextScene = this.scenes[i + 1];
        // Move current scene to front so next scene shows up behind it
        scene.moveToFront();
        // Show next scene instantly (behind)
        await nextScene.show();
      }

      // Wait for camera to settle before starting transition
      const settleTime = scene.getCameraSettleTime(this.currentTime - sceneBaseTime);
      const timeUntilSettle = settleTime - (this.currentTime - sceneBaseTime);
      if (timeUntilSettle > 0) {
        if (isDebugEnabled()) {
          console.log(`[Whiteboard] Waiting ${timeUntilSettle.toFixed(2)}s for camera to settle`);
        }

        const settleStartTime = performance.now();
        const durationMs = timeUntilSettle * 1000;
        const animationTimeAtStart = this.currentTime - sceneBaseTime;

        await new Promise<void>((resolve, reject) => {
          const check = () => {
            if (signal.aborted) {
              reject(new Error('Playback aborted'));
              return;
            }
            const elapsed = performance.now() - settleStartTime;
            const progress = Math.min(elapsed / durationMs, 1.0);

            // Sync time during settle phase
            this.syncTime(sceneBaseTime, animationTimeAtStart + (progress * timeUntilSettle));

            if (progress < 1.0) {
              requestAnimationFrame(check);
            } else {
              resolve();
            }
          };
          requestAnimationFrame(check);
        }).catch(err => {
          if (err.message !== 'Playback aborted') throw err;
        });
      }

      // Use eraser effect if enabled OR if transition type is 'eraser'
      const currentAnimationTime = this.currentTime - sceneBaseTime;
      const timing = scene.getLiveTiming();
      const hideDuration = timing.hideTransitionDuration;
      const eraserConfig = sceneConfig.eraser_config || sceneConfig.eraser;

      if (eraserConfig?.enabled || sceneConfig.transition?.type === 'eraser') {
        await scene.eraseWithEffect(eraserConfig, (p) => {
          this.syncTime(sceneBaseTime, currentAnimationTime + (p * hideDuration));
        });
      } else {
        // Apply transition at the END of the scene (exit only)
        await scene.hide(sceneConfig.transition, (p) => {
          this.syncTime(sceneBaseTime, currentAnimationTime + (p * hideDuration));
        });
      }
    }

    this.stopClock();
    this.stopSubtitleUpdates();

    // Only reset status and hide progress bar if we finished naturally (not aborted)
    if (!signal.aborted) {
      console.log('[Whiteboard] Playback finished naturally, setting completed status');
      // Ensure progress bar reaches exactly 100%
      this.syncTime(0, this.totalDuration);
      this.setStatus('completed');
      this.hideProgressBar();
      if (this.onCompleted) {
        this.onCompleted();
      }
      return 'completed';
    } else {
      console.log('[Whiteboard] Playback aborted at end');
      return 'aborted';
    }
  }

  pause(): void {
    if (isDebugEnabled()) {
      console.log(`[Whiteboard] pause called`);
    }
    console.trace(`[Whiteboard] pause trace`);
    this.pauseClock();
    if (this.currentSceneIndex >= 0 && this.currentSceneIndex < this.scenes.length) {
      this.scenes[this.currentSceneIndex].pause();
    }
  }

  resume(): void {
    this.resumeClock();
    if (this.currentSceneIndex >= 0 && this.currentSceneIndex < this.scenes.length) {
      this.scenes[this.currentSceneIndex].resume();
    }
  }

  stop(): void {
    // Invalidate any pending seeks
    this.lastSeekId++;

    this.stopClock();
    this.stopSubtitleUpdates();
    // PERFORMANCE: Abort playback controller if active
    this.playbackController?.abort();
    this.playbackController = null;

    // Stop all scenes to ensure proper cleanup
    // This prevents animations from continuing after stop is called
    this.scenes.forEach(scene => scene.stop());

    this.currentSceneIndex = -1;
    this.setStatus('stopped');

    // Hide progress bar when stopped
    this.hideProgressBar();
  }

  reset(): void {
    this.stop();
    this.currentSceneIndex = -1;
  }

  getCurrentScene(): Scene | null {
    if (this.currentSceneIndex >= 0 && this.currentSceneIndex < this.scenes.length) {
      return this.scenes[this.currentSceneIndex];
    }
    return null;
  }

  getCurrentSceneIndex(): number {
    return this.currentSceneIndex;
  }

  getSceneCount(): number {
    return this.scenes.length;
  }

  async playScene(index: number): Promise<void> {
    if (index < 0 || index >= this.scenes.length) return;

    // Stop current scene if any
    if (this.currentSceneIndex !== -1 && this.currentSceneIndex < this.scenes.length) {
      this.scenes[this.currentSceneIndex].stop();
    }

    this.currentSceneIndex = index;
    const scene = this.scenes[index];

    // Only show preparing status if the scene isn't ready yet
    const needsPreparation = !scene.isPreparedForPlayback;
    if (needsPreparation) {
      this.setStatus('preparing');
    }

    // Apply scene background if defined
    const sceneBackground = scene.getConfig().background;
    if (sceneBackground && typeof sceneBackground !== 'string' && sceneBackground.template?.url) {
      if (this.lastPreloadedBackground !== sceneBackground.template.url) {
        this.backgroundManager.apply(sceneBackground);
        await this.backgroundManager.preload();
        this.lastPreloadedBackground = sceneBackground.template.url;
      }
    } else if (sceneBackground) {
      this.backgroundManager.apply(sceneBackground);
    }

    // Prepare scene content
    if (needsPreparation) {
      await scene.prepare((progress) => {
        this.setStatus('preparing', progress);
      });
    } else {
      await scene.prepare();
    }

    // Trigger onPrepared callback when preparation (including warm-up) is complete
    if (this.onPrepared) {
      this.onPrepared(index);
    }

    // Start clock from scene start time
    this.startClock(this.getSceneStartTime(index));

    await scene.show(scene.getConfig().transition);

    // Use existing playbackController signal if available, otherwise create a temporary one
    const signal = this.playbackController?.signal;
    await scene.playAnimations(() => this.setStatus('playing'), undefined, signal);

    this.stopClock();
  }

  async nextScene(): Promise<void> {
    if (this.currentSceneIndex < this.scenes.length - 1) {
      await this.playScene(this.currentSceneIndex + 1);
    }
  }

  async previousScene(): Promise<void> {
    if (this.currentSceneIndex > 0) {
      await this.playScene(this.currentSceneIndex - 1);
    }
  }

  async preloadScenes(options: { priority?: 'sequential' | 'all', maxConcurrent?: number } = {}): Promise<void> {
    const { priority = 'sequential', maxConcurrent = 2 } = options;

    // PERFORMANCE: Use requestIdleCallback for background preloading
    const preloadInIdle = (scene: Scene): Promise<void> => {
      return new Promise(resolve => {
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(() => {
            scene.preloadOcclusionData().then(resolve);
          });
        } else {
          // Fallback for browsers without requestIdleCallback
          setTimeout(() => scene.preloadOcclusionData().then(resolve), 0);
        }
      });
    };

    if (priority === 'sequential') {
      // Preload next 2 scenes
      const start = Math.max(0, this.currentSceneIndex + 1);
      const end = Math.min(this.scenes.length, start + 2);
      for (let i = start; i < end; i++) {
        await preloadInIdle(this.scenes[i]);
      }
    } else {
      // Preload all scenes with concurrency limit
      const chunks = [];
      for (let i = 0; i < this.scenes.length; i += maxConcurrent) {
        chunks.push(this.scenes.slice(i, i + maxConcurrent));
      }
      for (const chunk of chunks) {
        await Promise.all(chunk.map(scene => preloadInIdle(scene)));
      }
    }
  }

  /**
   * Prepare all scenes in parallel with concurrency limit.
   * Call this before play() for zero-latency scene transitions in full demo mode.
   * 
   * This method performs full scene preparation including:
   * - Layer preloading and occlusion data calculation
   * - Animation warm-up (JIT compilation, cache population)
   * - Background image preloading
   * 
   * @param options Configuration options
   * @param options.maxConcurrent Maximum number of scenes to prepare simultaneously (default: 2)
   * @param options.onProgress Callback for progress updates (0-1 overall, sceneIndex for current scene)
   * @returns Promise that resolves when all scenes are prepared
   * 
   * @example
   * // Prepare all scenes before playing
   * await whiteboard.prepareAllScenes({
   *   maxConcurrent: 3,
   *   onProgress: (progress, sceneIdx) => {
   *     console.log(`Preparing: ${(progress * 100).toFixed(0)}% (scene ${sceneIdx + 1})`);
   *   }
   * });
   * await whiteboard.play();
   */
  async prepareAllScenes(options?: {
    maxConcurrent?: number;
    startIndex?: number;
    onProgress?: (progress: number, sceneIndex: number) => void;
  }): Promise<void> {
    const { maxConcurrent = 5, startIndex = 0, onProgress } = options || {};
    const total = this.scenes.length;

    if (total === 0) {
      if (isDebugEnabled()) {
        console.warn('[Whiteboard] No scenes to prepare');
      }
      return;
    }

    if (isDebugEnabled()) {
      console.log(`[Whiteboard] Preparing ${total} scenes in parallel (max concurrent: ${maxConcurrent})`);
    }

    const startTime = performance.now();
    let completed = 0;

    // Process scenes in batches with concurrency limit
    // We start from startIndex and wrap around to include all scenes
    const indices = Array.from({ length: total }, (_, idx) => idx);
    const orderedIndices = [...indices.slice(startIndex), ...indices.slice(0, startIndex)];

    for (let i = 0; i < orderedIndices.length; i += maxConcurrent) {
      const batchIndices = orderedIndices.slice(i, i + maxConcurrent);
      const batch = batchIndices.map(idx => this.scenes[idx]);

      // Preload background images for scenes in this batch first
      await Promise.all(batch.map(async (scene) => {
        const sceneBackground = scene.getConfig().background;
        if (sceneBackground && typeof sceneBackground !== 'string' && sceneBackground.template?.url) {
          await this.backgroundManager.preloadUrl(sceneBackground.template.url);
        }
      }));

      // Prepare all scenes in batch in parallel
      await Promise.all(batch.map(async (scene, batchIdx) => {
        const sceneIdx = batchIndices[batchIdx];

        // Skip if already prepared
        if (scene.isPreparedForPlayback) {
          completed++;
          onProgress?.(completed / total, sceneIdx);
          return;
        }

        await scene.prepare((sceneProgress) => {
          // Calculate overall progress
          onProgress?.((completed + sceneProgress) / total, sceneIdx);
        });

        completed++;

        if (isDebugEnabled()) {
          console.log(`[Whiteboard] Scene ${sceneIdx + 1}/${total} prepared`);
        }
      }));
    }

    const duration = performance.now() - startTime;
    if (isDebugEnabled()) {
      console.log(`[Whiteboard] All ${total} scenes prepared in ${duration.toFixed(0)}ms`);
    }

    // Final progress callback
    onProgress?.(1.0, total - 1);
  }

  clear(): void {
    this.stop();

    // PERFORMANCE: Efficient scene cleanup
    this.scenes.forEach(scene => {
      if (typeof (scene as any).destroy === 'function') {
        (scene as any).destroy();
      }
    });
    // PERFORMANCE: Faster than this.scenes = []
    this.scenes.length = 0;

    if (this.svg) {
      // BackgroundManager handles its own group, so we don't need to manually preserve backgroundRect
      // We need to remove all children EXCEPT the background group, defs, and subtitle group
      // PERFORMANCE: Collect nodes to remove (reverse iteration avoids index issues)
      const toRemove: Node[] = [];
      for (let i = this.svg.childNodes.length - 1; i >= 0; i--) {
        const child = this.svg.childNodes[i];
        if (child instanceof SVGGElement && child.getAttribute('id') === 'whiteboard-background-group') {
          continue;
        }
        if (child instanceof SVGGElement && child.getAttribute('id') === 'global-subtitles') {
          continue;
        }
        if (child instanceof SVGDefsElement) {
          continue;
        }
        toRemove.push(child);
      }

      // PERFORMANCE: Batch removal to minimize reflows
      toRemove.forEach(node => this.svg.removeChild(node));
    }

    // Clear canvas efficiently
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  /**
   * Build and add scenes from store data
   */
  public async addStoreScenes(
    scenes: StoreScene[] | StoreScene,
    scope: 'single' | 'from-current' | 'full' = 'single',
    currentSceneId?: string
  ): Promise<void> {
    // scope is used in the logic below but not stored in currentScope anymore

    const scenesArray = Array.isArray(scenes) ? scenes : [scenes];
    let scenesToPlay: StoreScene[] = [];

    // Find current scene from scenes array if needed
    const currentScene = currentSceneId ? scenesArray.find(s => s.id === currentSceneId) : null;

    if (scope === 'single') {
      if (currentScene) {
        scenesToPlay = [currentScene];
      } else if (scenesArray.length > 0) {
        scenesToPlay = [scenesArray[0]];
      }
    } else if (scope === 'full') {
      scenesToPlay = scenesArray;
    } else if (scope === 'from-current') {
      if (currentSceneId) {
        const currentIndex = scenesArray.findIndex(s => s.id === currentSceneId);
        if (currentIndex !== -1) {
          scenesToPlay = scenesArray.slice(currentIndex);
        } else if (currentScene) {
          scenesToPlay = [currentScene];
        }
      } else if (scenesArray.length > 0) {
        scenesToPlay = scenesArray;
      }
    }

    if (scenesToPlay.length === 0 && scenesArray.length > 0 && scope === 'single') {
      scenesToPlay = [scenesArray[0]];
    }

    for (const scene of scenesToPlay) {
      const engineScene = this.buildEngineScene(scene);
      await this.addScene(engineScene);
    }

    // Update total duration after scenes are added
    this.totalDuration = this.calculateTotalDuration();
    if (this.totalDuration > 0) {
      this.showProgressBar();
    }
  }

  /**
   * Build an engine scene from a store scene
   */
  public buildEngineScene(sceneToBuild: StoreScene): Scene {
    if (isDebugEnabled()) {
      console.log('[Whiteboard] Building scene:', sceneToBuild.id, 'transition:', sceneToBuild.transition);
    }

    let transitionConfig;
    if (sceneToBuild.transition) {
      const transitionType = (sceneToBuild.transition.type as TransitionType) || 'none';
      transitionConfig = {
        type: transitionType,
        duration: sceneToBuild.transition.duration ?? 0.5
      };
    } else {
      transitionConfig = {
        type: 'none' as TransitionType,
        duration: 0.5
      };
    }

    const config = {
      id: sceneToBuild.id || 'preview-scene',
      background: sceneToBuild.background || sceneToBuild.backgroundColor || '#ffffff',
      duration: TimingManager.calculateSceneTiming(sceneToBuild).totalDuration,
      transition: transitionConfig,
      eraser: this.buildEraserConfig(sceneToBuild),
      occlusionCulling: sceneToBuild.occlusionCulling ?? false,
      occlusionCullingConfig: sceneToBuild.occlusionCullingConfig,
      camera: sceneToBuild.camera || this.buildCameraConfig(sceneToBuild)
    };
    console.log('config', config);

    // Calculate viewport scale (matches server implementation)
    // Use the computed camera config if available
    const cameraConfig = config.camera;
    const virtualWidth = cameraConfig?.virtualSize?.width || this.width;
    const virtualHeight = cameraConfig?.virtualSize?.height || this.height;
    const viewportScale = Math.min(this.width / virtualWidth, this.height / virtualHeight);
    const handsConfig = this.config?.hands;

    const engineScene = new Scene(config, handsConfig, viewportScale);

    if (sceneToBuild.layers && sceneToBuild.layers.length > 0) {
      const sortedLayers = [...sceneToBuild.layers].sort((a, b) => a.z_index - b.z_index);
      for (const layer of sortedLayers) {
        const engineLayer = this.createEngineLayer(layer);
        if (engineLayer) {
          engineScene.addLayer(engineLayer);
        }
      }
    }

    return engineScene;
  }

  /**
   * Build camera configuration from store data
   */
  private buildCameraConfig(sceneToBuild: any): any {
    const cameras = sceneToBuild.sceneCameras || sceneToBuild.cameras || [];


    if (cameras.length === 0) return undefined;

    // Check if we should use legacy sequence logic (no explicit start times)
    const startTimesDefined = cameras.some((c: any) => c.startTime !== undefined);

    let keyframes = [];

    if (!startTimesDefined) {
      // Legacy Sequence Logic
      let accTime = 0;
      for (const cam of cameras) {
        const transitionDuration = cam.transition_duration ?? 0;
        const pauseTime = cam.duration ?? 2.0;

        keyframes.push({
          startTime: accTime,
          transitionDuration: transitionDuration,
          pauseTime: pauseTime,
          position: cam.position,
          zoom: cam.zoom ?? 1,
          easing: cam.easing || cam.movementType || 'ease-in-out'
        });

        accTime += transitionDuration + pauseTime;
      }
    } else {
      // Modern Keyframe Logic (Explicit start times)
      keyframes = cameras.map((cam: any) => ({
        startTime: cam.startTime || 0,
        transitionDuration: cam.transition_duration,
        pauseTime: 0,
        position: cam.position,
        size: {
          width: cam?.width,
          height: cam?.height
        },
        easing: cam.easing
      }));
    }

    const width = sceneToBuild.sceneWidth || this.width;
    const height = sceneToBuild.sceneHeight || this.height;

    return {
      virtualSize: { width, height },
      followMode: 'manual', // Default to manual when using keyframes
      initial: {
        zoom: cameras[0]?.zoom ?? 1,
        position: cameras[0]?.position ?? { x: width / 2, y: height / 2 },
        size: {
          width: cameras[0]?.width,
          height: cameras[0]?.height
        }
      },
      keyframes: keyframes
    };


  }

  /**
   * Create appropriate engine layer based on layer type
   */
  public createEngineLayer(layer: StoreLayer): any {
    const position = layer.camera_position || layer.position;
    const handOverlayConfig = layer.hand_overlay_config || {};

    const isPush = layer.entrance_animation?.type && (
      layer.entrance_animation.type === EntranceAnimationType.PUSH_FROM_LEFT ||
      layer.entrance_animation.type === EntranceAnimationType.PUSH_FROM_RIGHT ||
      layer.entrance_animation.type === EntranceAnimationType.PUSH_FROM_TOP ||
      layer.entrance_animation.type === EntranceAnimationType.PUSH_FROM_BOTTOM ||
      layer.entrance_animation.type === EntranceAnimationType.PUSH
    );

    let entranceAnim = layer.entrance_animation;
    if (!entranceAnim) {
      let defaultType: EntranceAnimationTypeValue = EntranceAnimationType.FADE_IN;
      if (layer.type === 'text') {
        defaultType = EntranceAnimationType.TYPEWRITER;
      } else if (layer.type === 'shape') {
        defaultType = EntranceAnimationType.DRAW;
      }

      entranceAnim = {
        type: defaultType,
        duration: TimingManager.getLayerEntranceDuration(layer),
        delay: 0
      };
    }

    const entrance_animation = {
      ...entranceAnim,
      type: isPush ? EntranceAnimationType.PUSH : entranceAnim.type,
      duration: entranceAnim.duration ?? TimingManager.getLayerEntranceDuration(layer),
      delay: 0
    };

    const timingConfig = layer.timingConfig ? {
      pauseTime: layer.timingConfig.pauseTime
    } : undefined;

    const baseConfig = {
      id: layer.id,
      position: position,
      scale: layer.scale || 1,
      scaleX: layer.scaleX || 1,
      scaleY: layer.scaleY || 1,
      rotation: layer.rotation || 0,
      zIndex: layer.z_index,
      width: layer.width,
      height: layer.height,
      opacity: (entrance_animation && entrance_animation.type !== EntranceAnimationType.NONE) ? 0 : (layer.opacity || 1),
      handOverlay: {
        ...handOverlayConfig,
        enabled: handOverlayConfig.enabled ?? true,
      },
      entrance_animation: entrance_animation,
      emphasis_animation: layer.emphasis_animation,
      exit_animation: layer.exit_animation,
      occlusionMode: layer.occlusionMode || 'auto',
      occlusionErase: layer.occlusionErase,
      timingConfig: timingConfig,
    };

    if (isPush) {
      return this.createPushLayer(layer, baseConfig);
    }

    switch (layer.type) {
      case 'image':
        return this.createImageLayer(layer, baseConfig);
      case 'text':
        return this.createTextLayer(layer, baseConfig);
      case 'shape':
        return this.createShapeLayer(layer, baseConfig);
      case 'morph':
        return this.createMorphLayer(layer, baseConfig);
      case 'caption':
        return this.createCaptionLayer(layer, baseConfig);
      case 'svg':
        return this.createSvgLayer(layer, baseConfig);
      default:
        if (isDebugEnabled()) {
          console.warn(`[Whiteboard] Unknown layer type: ${layer.type}`);
        }
        return null;
    }
  }

  private createPushLayer(layer: StoreLayer, baseConfig: any): PushLayer | null {
    const animation = layer.entrance_animation!;
    let from: 'left' | 'right' | 'top' | 'bottom' = 'left';

    if (animation.type === EntranceAnimationType.PUSH_FROM_RIGHT) from = 'right';
    if (animation.type === EntranceAnimationType.PUSH_FROM_TOP) from = 'top';
    if (animation.type === EntranceAnimationType.PUSH_FROM_BOTTOM) from = 'bottom';

    return new PushLayer({
      ...baseConfig,
      scale: 1,
      handOverlay: {
        enabled: true,
      }
    }, {
      imageUrl: layer.push_shape_url || layer.image_path || '',
      width: layer.width,
      height: layer.height,
      from: from,
      pushDuration: animation.duration || 1.0,
      canvasWidth: this.width,
      canvasHeight: this.height
    });
  }

  private createSvgLayer(layer: StoreLayer, baseConfig: any): SvgLayer | null {
    const svgUrl = layer.image_path || layer.svg_path;
    if (!svgUrl) {
      if (isDebugEnabled()) {
        console.warn(`[Whiteboard] SVG layer ${layer.id} has no image_path or svg_path`);
      }
      return null;
    }

    return new SvgLayer(svgUrl, {
      ...baseConfig,
      duration: TimingManager.getLayerEntranceDuration(layer),
      handOverlay: {
        enabled: true
      }
    });
  }

  private createImageLayer(layer: StoreLayer, baseConfig: any): any {
    if (!layer.image_path) {
      if (isDebugEnabled()) {
        console.warn(`[Whiteboard] Image layer ${layer.id} has no image_path`);
      }
      return null;
    }

    const drawingConfig = layer.drawing_animation_config || {};
    const drawDuration = TimingManager.getLayerEntranceDuration(layer);

    return new ImageLayer(
      {
        ...baseConfig,
        scale: 1,
        scaleX: 1,
        scaleY: 1,
        handOverlay: {
          enabled: true,
        }
      },
      layer.image_path,
      {
        duration: drawDuration,
        strokeRatio: drawingConfig.strokeRatio ?? 0.5,
        colorTolerance: drawingConfig.colorTolerance ?? 10,
        minRegionSize: drawingConfig.minRegionSize ?? 50,
        fillDirection: drawingConfig.fillDirection ?? 'diagonal',
        sweepSpeed: drawingConfig.sweepSpeed ?? 1.0
      }
    );
  }

  private createTextLayer(layer: StoreLayer, baseConfig: any): TextLayer | null {
    if (!layer.text_config) {
      if (isDebugEnabled()) {
        console.warn(`[Whiteboard] Text layer ${layer.id} has no text_config`);
      }
      return null;
    }

    const textConfig = layer.text_config;
    const color = this.normalizeTextColor(textConfig.color);

    let fontVariant = 'regular';
    if (textConfig.style === 'bold') fontVariant = 'bold';
    else if (textConfig.style === 'italic') fontVariant = 'italic';
    else if (textConfig.style === 'bold_italic') fontVariant = 'bold';

    const drawDuration = TimingManager.getLayerEntranceDuration(layer);

    return new TextLayer({
      ...baseConfig,
      scale: 1,
      scaleX: 1,
      scaleY: 1,
      text: layer.text || textConfig.text || '',
      fontFamily: textConfig.font || 'sans-serif',
      fontVariant: fontVariant,
      fontSize: textConfig.size || 40,
      color: color,
      lineHeight: textConfig.line_height || 1.2,
      letterSpacing: textConfig.letter_spacing || 0,
      align: textConfig.align || 'left',
      strokeAnimation: {
        duration: drawDuration,
        mode: layer.text_animation_mode || 'typewriter'
      },
      handOverlay: {
        enabled: true
      }
    });
  }

  private createShapeLayer(layer: StoreLayer, baseConfig: any): any {
    if ((layer as any).shape_config) {
      const config = (layer as any).shape_config;
      return new ShapeLayer({
        ...baseConfig,
        scale: 1,
        scaleX: 1,
        scaleY: 1,
        handOverlay: {
          enabled: true,
        },
        shape: config.shape,
        strokeColor: config.strokeColor,
        fillColor: config.fillColor,
        strokeWidth: config.strokeWidth,
        radius: config.radius,
        width: config.width,
        height: config.height,
        innerRadius: config.innerRadius,
        outerRadius: config.outerRadius,
        numPoints: config.numPoints,
        points: config.points,
        cornerRadius: config.cornerRadius,
        lineCap: config.lineCap,
        lineJoin: config.lineJoin
      });
    }

    const svgPath = (layer as any).svg_path || layer.image_path;
    if (!svgPath) {
      if (isDebugEnabled()) {
        console.warn(`[Whiteboard] Shape layer ${layer.id} has no svg_path or image_path`);
      }
      return null;
    }

    return new SvgLayer(svgPath, {
      ...baseConfig,
      fill: true,
      lineColor: [0, 0, 0, 255],
      lineWidth: 2,
      handOverlay: {
        enabled: true
      },
      entrance_animation: {
        type: EntranceAnimationType.DRAW,
        duration: TimingManager.getLayerEntranceDuration(layer),
        delay: 0
      }
    });
  }

  private createMorphLayer(layer: StoreLayer, baseConfig: any): MorphLayer | null {
    return new MorphLayer({
      ...baseConfig,
      fromPath: layer.fromPath || [],
      toPath: layer.toPath || [],
      strokeColor: layer.strokeColor,
      fillColor: layer.fillColor,
      strokeWidth: layer.strokeWidth
    });
  }

  private createCaptionLayer(layer: StoreLayer, baseConfig: any): CaptionLayer | null {
    return new CaptionLayer({
      ...baseConfig,
      type: 'caption',
      text: layer.text || '',
      fontSize: layer.fontSize,
      fontFamily: layer.fontFamily,
      fontWeight: layer.fontWeight,
      color: layer.color,
      backgroundColor: layer.backgroundColor,
      backgroundOpacity: layer.backgroundOpacity,
      stroke: layer.stroke,
      shadow: layer.shadow,
      textAlign: layer.textAlign,
      maxWidth: layer.maxWidth,
      padding: layer.padding,
      borderRadius: layer.borderRadius,
      lineHeight: layer.lineHeight
    }, this.config?.hands);
  }

  private buildEraserConfig(sceneToBuild: StoreScene): any {
    const eraserConfig = sceneToBuild.eraser_config;
    const isEraserTransition = sceneToBuild.transition?.type === 'eraser';

    if (!isEraserTransition && (!eraserConfig || !eraserConfig.enabled)) {
      return undefined;
    }

    const config = (eraserConfig || {}) as any;
    const duration = isEraserTransition
      ? (sceneToBuild.transition?.duration ?? 1.0)
      : (config.duration ?? 1.5);

    const delayAfterAnimations = isEraserTransition
      ? 0
      : (config.delayAfterAnimations ?? 0.3);

    let pattern = config.pattern as any;
    if (pattern === 'circular') pattern = 'diagonal';

    return {
      enabled: true,
      duration: duration,
      delayAfterAnimations: delayAfterAnimations,
      pattern: pattern ?? 'diagonal',
      backgroundColor: config.backgroundColor ?? [255, 255, 255],
      showEraser: config.showEraser ?? true,
      radius: config.radius ?? 30,
      handImage: isEraserTransition ? sceneToBuild.transition?.handImage : config.handImage,
      handOffset: isEraserTransition ? sceneToBuild.transition?.handOffset : config.handOffset,
      handScale: isEraserTransition ? sceneToBuild.transition?.handScale : config.handScale,
    };
  }

  private normalizeTextColor(color: any): string {
    if (typeof color === 'string') {
      return color;
    }

    if (Array.isArray(color)) {
      return rgbaToHex(normalizeColor(color));
    }

    return '#000000';
  }


  /**
   * Seek to a specific time in the entire whiteboard timeline
   * 
   * @param time - Time in seconds from the start of the whiteboard
   */
  async seek(time: number): Promise<void> {
    const seekId = ++this.lastSeekId;

    if (isDebugEnabled()) {
      console.log(`[Whiteboard] seek called with time: ${time.toFixed(2)}s. Status: ${this.status} (ID: ${seekId})`);
    }

    // Update internal clock synchronously to avoid race conditions with tick()
    this.currentTime = time;

    // If playing or paused, adjust clock to maintain continuity
    if (this.clockStartTime !== 0) {
      const now = Date.now();
      if (this.clockPausedTime === 0) {
        // Playing
        this.clockStartTime = now - (time * 1000);
      } else {
        // Paused
        this.clockPausedTime = time;
        this.clockStartTime = now - (time * 1000);
      }
    }

    // Update progress bar immediately for UI responsiveness
    this.drawProgressBar();

    // If we are seeking to a different time/scene, we should abort any ongoing playback loop
    // to prevent race conditions between the play() loop and the seek state.
    if (this.status === 'playing' || this.status === 'preparing') {
      // Abort animations in the current scene to stop them promptly
      if (this.currentSceneIndex >= 0 && this.currentSceneIndex < this.scenes.length) {
        this.scenes[this.currentSceneIndex].abortAnimations();
      }

      this.playbackController?.abort();
      this.playbackController = null;
      this.stopClock();

      // Set status to idle since we've stopped the playback loop
      this.setStatus('idle');
    }

    // Serialize seek operations to avoid race conditions
    this.currentSeekPromise = this.currentSeekPromise.then(async () => {
      // If a newer seek has been requested, skip this one
      if (seekId !== this.lastSeekId) return;

      if (isDebugEnabled()) {
        console.log(`[Whiteboard] seek async part: ${time.toFixed(2)}s. (ID: ${seekId})`);
      }

      // Find which scene corresponds to this time
      let targetSceneIndex = -1;
      let sceneStartTime = 0;

      for (let i = 0; i < this.scenes.length; i++) {
        const startTime = this.getSceneStartTime(i);
        const scene = this.scenes[i];
        const timing = scene.getLiveTiming();
        const duration = scene.getConfig().duration || timing.totalDuration;

        if (time >= startTime && time < startTime + duration) {
          targetSceneIndex = i;
          sceneStartTime = startTime;
          break;
        }
      }

      // If time is beyond the last scene, use the last scene at its end
      if (targetSceneIndex === -1 && this.scenes.length > 0) {
        targetSceneIndex = this.scenes.length - 1;
        sceneStartTime = this.getSceneStartTime(targetSceneIndex);
      }

      if (targetSceneIndex !== -1) {
        // Switch to the target scene if not current
        if (this.currentSceneIndex !== targetSceneIndex) {
          // Cleanup current scene
          if (this.currentSceneIndex >= 0) {
            // this.scenes[this.currentSceneIndex].cleanup();
          }

          this.currentSceneIndex = targetSceneIndex;
          const targetScene = this.scenes[targetSceneIndex];

          // Ensure scene is attached and prepared
          if (targetScene.parentSvg !== this.svg) {
            targetScene.attachTo(this.svg);
          }
          if (!targetScene.isPreparedForPlayback) {
            if (isDebugEnabled()) {
              console.log(`[Whiteboard] seek: preparing target scene ${targetSceneIndex} (fast mode for seek)`);
            }
            const previousStatus = this.status;
            this.setStatus('preparing', 0);
            // PERFORMANCE FIX: Use fast preparation mode for seek operations
            // This skips the warm-up phase that causes lag during seeking
            await targetScene.prepareFast();
            this.setStatus(previousStatus === 'playing' ? 'playing' : 'idle');
          }

          // Show the scene (instant)
          targetScene.show();

          // Hide other scenes
          this.scenes.forEach((s, idx) => {
            if (idx !== targetSceneIndex) s.hide();
          });
        }

        // Seek within the scene
        const timeInScene = time - sceneStartTime;
        await this.scenes[targetSceneIndex].seek(timeInScene);

        // Update progress bar again after scene seek to be sure
        this.drawProgressBar();
      }
    });

    return this.currentSeekPromise;
  }

  // ==================== GLOBAL SUBTITLE SYSTEM ====================

  /**
   * Initialize the global subtitle system
   */
  private initializeSubtitleSystem(): void {
    console.log('[Whiteboard] Initializing subtitle system', {
      hasSvg: !!this.svg,
      svgHasParent: !!(this.svg && this.svg.parentElement)
    });

    // Create a group for subtitles that sits above all scenes
    this.subtitleGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.subtitleGroup.setAttribute('id', 'global-subtitles');
    this.svg.appendChild(this.subtitleGroup);

    console.log('[Whiteboard] Subtitle system initialized', {
      hasSvg: !!this.svg,
      hasGroup: !!this.subtitleGroup,
      parent: (this.subtitleGroup.parentElement as Node) === this.svg,
      groupInDom: document.getElementById('global-subtitles') !== null
    });
  }

  /**
   * Update subtitles based on current time
   */
  private updateSubtitles(time: number): void {
    if (!this.config?.subtitles || !this.config.subtitles.enabled) {
      return;
    }

    const subtitles = this.config.subtitles;
    const segments = subtitles.segments || [];

    // Find the active subtitle segment for current time (time in seconds, segments in milliseconds)
    const timeMs = time * 1000;
    const activeSegment = segments.find(seg =>
      timeMs >= seg.startTime && timeMs <= seg.endTime
    );

    console.log('[Whiteboard] updateSubtitles state:', {
      time,
      status: this.status,
      hasLayer: !!this.currentSubtitleLayer,
      layerId: this.currentSubtitleLayer?.getConfig().id,
      activeId: activeSegment?.id
    });

    if (activeSegment) {
      // If this is a new segment or first subtitle, create it
      if (!this.currentSubtitleLayer || this.currentSubtitleLayer.getConfig().id !== activeSegment.id) {
        console.log('[Whiteboard] Calling showSubtitle for:', activeSegment.id);
        this.showSubtitle(activeSegment, time);
      } else {
        // Update existing subtitle
        this.currentSubtitleLayer.updateForTime(time);
      }
    } else {
      // No active segment, hide subtitle if showing
      if (this.currentSubtitleLayer) {
        console.log('[Whiteboard] No active segment, calling hideSubtitle');
        this.hideSubtitle();
      }
    }
  }

  /**
   * Show a subtitle segment
   */
  private showSubtitle(segment: any, time: number): void {
    console.log('[Whiteboard] showSubtitle called', {
      hasGroup: !!this.subtitleGroup,
      hasConfig: !!this.config?.subtitles,
      segmentId: segment.id
    });
    if (!this.subtitleGroup || !this.config?.subtitles) return;

    // Remove existing subtitle
    if (this.currentSubtitleLayer) {
      this.hideSubtitle();
    }

    const subtitles = this.config.subtitles;
    const style = subtitles.style || {};
    const position = subtitles.position || 'bottom';
    const offset = subtitles.offset || { x: 0, y: 0 };

    // Calculate position based on configuration
    let yPos = this.height / 2;
    if (position === 'top') {
      yPos = this.height * 0.15;
    } else if (position === 'bottom') {
      yPos = this.height * 0.80;
    } else if (position === 'center') {
      yPos = this.height / 2;
    }

    // Create caption layer with segment text and style
    const captionConfig: any = {
      id: segment.id,
      type: 'caption',
      text: segment.text,
      position: { x: (this.width / 2) + offset.x, y: yPos + offset.y },
      fontSize: style.fontSize || 32,
      fontFamily: style.fontFamily || 'Arial',
      fontWeight: style.fontWeight || 'normal',
      color: style.color || '#ffffff',
      backgroundColor: style.backgroundColor || '#000000',
      backgroundOpacity: style.backgroundOpacity ?? 0.8,
      stroke: style.stroke,
      shadow: style.shadow,
      textAlign: style.alignment || 'center',
      maxWidth: style.maxWidth || (this.width * 0.8),
      padding: style.padding || 16,
      borderRadius: style.borderRadius || 8,
      lineHeight: 1.3,
      handOverlay: false, // Subtitles don't need hands
      entrance_animation: style.animation?.in ? {
        type: style.animation.in,
        duration: style.animation.duration || 0.3,
        delay: 0
      } : undefined,
      exit_animation: style.animation?.out ? {
        type: style.animation.out,
        duration: style.animation.duration || 0.3,
        delay: 0
      } : undefined
    };

    this.currentSubtitleLayer = new CaptionLayer(captionConfig, this.config.hands);
    console.log('[Whiteboard] Created CaptionLayer:', {
      id: this.currentSubtitleLayer.getConfig().id,
      hasLayer: !!this.currentSubtitleLayer
    });
    const svgElement = this.currentSubtitleLayer.render();
    this.subtitleGroup.appendChild(svgElement);
    console.log('[Whiteboard] Appended subtitle to group');

    // Prepare and update
    this.currentSubtitleLayer.prepare().then(() => {
      if (this.currentSubtitleLayer) {
        this.currentSubtitleLayer.updateForTime(time);
      }
    });

    if (isDebugEnabled()) {
      console.log('[Whiteboard] Showing subtitle:', segment.text);
    }
  }

  /**
   * Hide the current subtitle
   */
  private hideSubtitle(): void {
    console.log('[Whiteboard] hideSubtitle called', {
      hasLayer: !!this.currentSubtitleLayer
    });
    if (this.currentSubtitleLayer && this.subtitleGroup) {
      this.subtitleGroup.innerHTML = '';
      this.currentSubtitleLayer = null;
    }
  }

  /**
   * Start subtitle updates during playback
   */
  private startSubtitleUpdates(): void {
    console.log('[Whiteboard] startSubtitleUpdates called', {
      enabled: this.config?.subtitles?.enabled,
      status: this.status
    });
    if (!this.config?.subtitles || !this.config.subtitles.enabled) {
      return;
    }

    // Update subtitles every frame (about 60fps)
    this.subtitleUpdateInterval = window.setInterval(() => {
      this.updateSubtitles(this.currentTime);
    }, 16); // ~60fps
  }

  /**
   * Stop subtitle updates
   */
  private stopSubtitleUpdates(): void {
    if (this.subtitleUpdateInterval !== null) {
      window.clearInterval(this.subtitleUpdateInterval);
      this.subtitleUpdateInterval = null;
    }
    this.hideSubtitle();
  }

  /**
   * Complete cleanup of the whiteboard and all its resources.
   * Call this when the whiteboard is removed from the DOM.
   */
  public destroy(): void {
    if (isDebugEnabled()) {
      console.log('[Whiteboard] Destroying...');
    }

    this.stop();
    this.stopClock();

    // Abort any ongoing playback/preparation
    if (this.playbackController) {
      this.playbackController.abort();
      this.playbackController = null;
    }

    // Remove window event listeners
    if (this.windowMouseMoveListener) {
      window.removeEventListener('mousemove', this.windowMouseMoveListener);
      this.windowMouseMoveListener = null;
    }
    if (this.windowMouseUpListener) {
      window.removeEventListener('mouseup', this.windowMouseUpListener);
      this.windowMouseUpListener = null;
    }
    if (this.windowTouchMoveListener) {
      window.removeEventListener('touchmove', this.windowTouchMoveListener);
      this.windowTouchMoveListener = null;
    }
    if (this.windowTouchEndListener) {
      window.removeEventListener('touchend', this.windowTouchEndListener);
      this.windowTouchEndListener = null;
    }

    // Clean up all scenes
    this.scenes.forEach(scene => scene.destroy());
    this.scenes = [];

    // Clean up cached hand overlays
    this.handOverlayCache.forEach(hand => hand.dispose());
    this.handOverlayCache.clear();

    // Update background manager
    this.backgroundManager.cleanup();

    // Remove DOM elements if they are still attached
    if (this.subtitleGroup) this.subtitleGroup.remove();
    if (this.progressBarCanvas) this.progressBarCanvas.remove();
    if (this.preparationLoaderOverlay) this.preparationLoaderOverlay.remove();
    if (this.handOverlayCanvas) this.handOverlayCanvas.remove();
    if (this.svg) this.svg.remove();

    this.status = 'stopped';
    this.currentTime = 0;
  }

  /**
   * Set the mode of the whiteboard (preview or editor)
   */
  public setMode(mode: 'preview' | 'editor'): void {
    this.mode = mode;

    if (mode === 'editor') {
      this.pause();
      this.svg.style.display = 'none';
      if (this.handOverlayCanvas) {
        this.handOverlayCanvas.style.display = 'none';
      }

      if (!this.editor) {
        this.initEditor();
      }

      if (this.editorContainer) {
        this.editorContainer.style.display = 'block';
        // Force resize trigger if needed
        setTimeout(() => {
          this.editor?.fitToViewport();
        }, 0);
      }
    } else {
      this.svg.style.display = 'block';
      if (this.handOverlayCanvas) {
        this.handOverlayCanvas.style.display = 'block';
      }
      if (this.editorContainer) {
        this.editorContainer.style.display = 'none';
      }
    }
  }

  /**
   * Toggle between preview and editor modes
   */
  public toggleMode(): void {
    this.setMode(this.mode === 'preview' ? 'editor' : 'preview');
  }

  /**
   * Get the editor instance if initialized
   */
  public getEditor(): SceneCanvas | null {
    return this.editor;
  }

  /**
   * Initialize the editor instance
   */
  private initEditor(): void {
    if (this.editor) return;

    this.editorContainer = document.createElement('div');
    this.editorContainer.style.width = '100%';
    this.editorContainer.style.height = '100%';
    this.editorContainer.style.position = 'absolute';
    this.editorContainer.style.top = '0';
    this.editorContainer.style.left = '0';
    this.editorContainer.style.zIndex = '100'; // Above SVG
    this.editorContainer.style.display = this.mode === 'editor' ? 'block' : 'none';

    this.container.appendChild(this.editorContainer);

    // Initial Scene Config - Start empty, consumer should update via getEditor().updateScene()
    const initialConfig: EditorSceneConfig = {
      id: 'editor-scene',
      width: this.width,
      height: this.height,
      background: typeof this.config?.background === 'string'
        ? { color: this.config?.background }
        : (this.config?.background as any) || { color: '#ffffff' },
      cameras: [],
      layers: []
    };

    // --- Store Integration ---

    // 1. Populate Store with current scenes (Runtime -> Config)
    const storeScenes: EditorScene[] = this.scenes.map(scene => {
      // Convert Runtime Scene to Config
      // Note: We need a robust way to get the full config back from the runtime scene.
      // For now, we approximate based on accessible properties or stored config if available.
      // Ideally, Scene class should expose a 'getConfig()' or we use the original config passed to 'addScene'.
      // Assuming 'scene.config' exists or we reconstruct it.

      // Since Scene class (src/frontend/whiteboard/scene.ts) doesn't publicly expose full config easily,
      // and we want to edit valid data, we might need to rely on what was passed to 'addScenes' if stored,
      // or construct a best-effort config.

      // Let's assume for this MVP that strictly new projects or loaded projects populate the Store FIRST, 
      // and Whiteboard is driven BY the store in Editor mode.
      // BUT here we are entering Editor from Whiteboard.

      // Fallback: Create a basic scene config from runtime properties
      return {
        id: scene.id,
        width: this.width,
        height: this.height,
        duration: scene.duration,
        background: this.config?.background as any, // Simplify for now
        layers: [], // TODO: We need to serialize runtime layers back to config if we want to edit existing layers
        sceneCameras: [], // TODO: Serialize cameras
      } as EditorScene;
    });

    // If we have no scenes yet (e.g. empty whiteboard), add a default one
    if (storeScenes.length === 0) {
      // Cast via unknown to avoid overlap error since EditorScene has specific requirements
      const configWithDuration = { ...initialConfig, duration: 5 };
      storeScenes.push(configWithDuration as unknown as EditorScene);
    }

    EditorStore.getInstance().setScenes(storeScenes);

    // 2. Subscribe to Store updates to drive the Editor UI
    EditorStore.getInstance().subscribe(state => {
      const currentScene = state.scenes[state.selectedSceneIndex];
      if (currentScene && this.editor) {
        // Update the editor canvas with the current selected scene from store
        // We might need to diff key changes or just set config.
        // SceneCanvas doesn't have a 'setScene' method exposed in the interface?
        // checking scene-canvas.ts... it has 'setConfig' implicitly? No, constructor only.
        // We need to add 'setConfig' or 'updateScene' Method to SceneCanvas.

        // For now, let's assume we can update the config property or add a method.
        // Let's add 'updateConfig' to SceneCanvas in the next step.
        // this.editor.updateConfig(currentScene); 
      }
    });

    this.editor = new SceneCanvas(this.editorContainer, initialConfig);

    // Initial sync with store
    const state = EditorStore.getInstance().getState();
    if (state.scenes.length > 0) {
      // Logic to load initial scene would go here once updateConfig is implemented
    }

    // Wire callbacks from config
    const callbacks = this.config?.editor?.callbacks;
    if (callbacks) {
      this.editor.setCallbacks({
        onLayerSelect: (layerId) => {
          EditorStore.getInstance().setSelectedLayerId(layerId);
          callbacks.onLayerSelect?.(layerId);
        },
        onLayerChange: (layer) => {
          // Sync back to store
          const state = EditorStore.getInstance().getState();
          const sceneId = state.scenes[state.selectedSceneIndex]?.id;
          if (sceneId && layer.id) {
            EditorStore.getInstance().updateLayer(sceneId, layer as any);
          }
          callbacks.onLayerChange?.(layer);
        },
        onCameraSelect: callbacks.onCameraSelect,
        onCameraChange: callbacks.onCameraChange,
        onSceneChange: callbacks.onSceneChange,
        onZoomChange: callbacks.onZoomChange,
      });
    }
  }
}

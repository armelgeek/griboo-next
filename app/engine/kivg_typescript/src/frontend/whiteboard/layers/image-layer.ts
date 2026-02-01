import { Layer } from '../layer';
import { AnimationType, AnimationConfig as WBAnimationConfig, Point } from '../types';
import { generateCanvasId } from '../../core/infra/utils';
import { HandOverlayManager } from '../managers/hand-overlay-manager';
import { PathDrawingHandStrategy } from '../../../shared/core/hand_overlay_manager';
import { LoadingManager } from '../../core/infra/loading';
import { isDebugEnabled } from '../../../shared/config/debug_config';

import { ImageLayerConfig, PreloadedData } from './image-layer/types';
export type { ImageLayerConfig };

import { ImageProcessor } from './image-layer/processor';
import { Animator } from './image-layer/animator';
import { ImageSeeker } from './image-layer/seeker';
import { PixelPoint } from './image-layer/utils';

const SETTLE_RATIO = 0.2;

export { Animator };

export class ImageLayer extends Layer {
  private static readonly DEFAULT_WIDTH = 800;
  private static readonly DEFAULT_HEIGHT = 800;

  private imagePath: string;
  private animationConfig: ImageLayerConfig;
  private canvas: HTMLCanvasElement | null = null;
  private animator: Animator | null = null;
  private seeker: ImageSeeker | null = null;
  private processor: ImageProcessor | null = null;
  private img: HTMLImageElement | null = null;

  private preloadedData: PreloadedData | null = null;
  private isPreloaded: boolean = false;
  private cssScale: number = 1;

  constructor(config: any, imagePath: string, animConfig: ImageLayerConfig) {
    if (animConfig.handOverlayEnabled !== undefined && !config.handOverlay) {
      config.handOverlay = {
        enabled: animConfig.handOverlayEnabled,
        imageUrl: animConfig.handImageUrl,
        scale: animConfig.handScale,
        offset: animConfig.handOffset
      };
    }
    super(config);
    this.imagePath = imagePath;
    this.animationConfig = animConfig;
    this.seeker = new ImageSeeker();
    this.processor = new ImageProcessor();
  }

  public async prepare(): Promise<void> {
    if (this.isPrepared) return;
    await this.preload();
    this.isPrepared = true;
  }

  public async preload(): Promise<void> {
    if (this.isPreloaded && this.preloadedData) return;

    const loadingManager = LoadingManager.getInstance();
    const layerId = `image-layer-preload-${Date.now()}`;
    const loadingIds = {
      load: `${layerId}-load`,
      prepare: `${layerId}-prepare`,
      strokes: `${layerId}-strokes`,
      regions: `${layerId}-regions`,
      sort: `${layerId}-sort`
    };

    try {
      loadingManager.start(loadingIds.load, 'Chargement de l\'image...');
      if (!this.img || !this.img.complete) {
        this.img = new Image();
        this.img.crossOrigin = "anonymous";
        let finalPath = this.imagePath;
        if (this.imagePath.startsWith('http')) {
          const { getGlobalCache } = await import('../../utils/asset_cache');
          const { fetchImage } = await import('../../utils/http_loader');
          const cache = getGlobalCache();
          let blob = await cache.get(this.imagePath);
          if (!blob) {
            blob = await fetchImage(this.imagePath, { retries: 3, timeout: 30000 });
            await cache.set(this.imagePath, blob);
          }
          finalPath = URL.createObjectURL(blob);
        }
        this.img.src = finalPath;
        await new Promise<void>((resolve, reject) => {
          this.img!.onload = () => {
            if (finalPath.startsWith('blob:')) URL.revokeObjectURL(finalPath);
            resolve();
          };
          this.img!.onerror = () => {
            if (finalPath.startsWith('blob:')) URL.revokeObjectURL(finalPath);
            reject(new Error(`Failed to load image at ${this.imagePath}`));
          };
        });
      }
      loadingManager.complete(loadingIds.load);

      this.preloadedData = await this.processor!.process(
        this.imagePath,
        this.img!,
        this.animationConfig,
        1, // We'll handle pixelScale internally in processor now
        loadingIds
      );

      this.cssScale = this.preloadedData.cssScale;
      this.isPreloaded = true;

    } catch (error) {
      Object.values(loadingIds).forEach(id => loadingManager.complete(id));
      throw error;
    }
  }

  render(): SVGElement {
    const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    const width = this.animationConfig.width ?? this.config.width ?? ImageLayer.DEFAULT_WIDTH;
    const height = this.animationConfig.height ?? this.config.height ?? ImageLayer.DEFAULT_HEIGHT;

    foreignObject.setAttribute('width', width.toString());
    foreignObject.setAttribute('height', height.toString());

    this.canvas = document.createElement('canvas');
    this.canvas.id = generateCanvasId('image-layer');
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';

    foreignObject.appendChild(this.canvas);
    this.element = foreignObject;
    this.applyTransform();
    this.setOpacity(0);

    return foreignObject;
  }

  async animate(type: AnimationType, config: WBAnimationConfig, initialProgress: number = 0): Promise<void> {
    const delay = config.delay || 0;
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay * 1000));

    if (type === 'draw' && this.canvas) {
      if (!config.warmUp) this.setOpacity(this.config.opacity || 1);
      if (!this.isPreloaded) await this.preload();
      if (!config.warmUp) await this.startDrawingAnimation(config, initialProgress);
    } else if (this.canvas) {
      await this.loadAndDisplayImage();
      return super.animate(type, config, initialProgress);
    }
  }

  private async loadAndDisplayImage(): Promise<void> {
    if (!this.canvas) return;
    if (!this.img || !this.img.complete) await this.preload();
    if (!this.img) return;

    const ctx = this.canvas.getContext('2d')!;
    const width = this.config.width || this.img.width;
    const height = this.config.height || this.img.height;

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.canvas.style.width = width + 'px';
      this.canvas.style.height = height + 'px';
      if (this.element) {
        this.element.setAttribute('width', width.toString());
        this.element.setAttribute('height', height.toString());
      }
    }
    ctx.drawImage(this.img, 0, 0, width, height);
  }

  private async startDrawingAnimation(config: WBAnimationConfig, initialProgress: number = 0): Promise<void> {
    if (!this.canvas || !this.preloadedData) return;

    const { physWidth, physHeight, processingWidth, processingHeight, cssScale, pixelScale, src, strokes, sortedRegions } = this.preloadedData;

    this.canvas.width = physWidth;
    this.canvas.height = physHeight;
    this.canvas.style.width = processingWidth + 'px';
    this.canvas.style.height = processingHeight + 'px';
    this.canvas.style.transformOrigin = 'top left';
    this.canvas.style.transform = `scale(${cssScale})`;

    if (this.element) {
      this.element.setAttribute('width', Math.round(processingWidth * cssScale).toString());
      this.element.setAttribute('height', Math.round(processingHeight * cssScale).toString());
    }

    if (this.handOverlayManager && this.handOverlayManager.isEnabled()) {
      this.handOverlayManager.setStrategy(new PathDrawingHandStrategy());
    }

    const transformPoint = (p: PixelPoint): Point => {
      const dispX = (p.x / pixelScale) * cssScale;
      const dispY = (p.y / pixelScale) * cssScale;
      const globalPos = this.transformToGlobal({ x: dispX, y: dispY });
      return [globalPos.x, globalPos.y];
    };

    const totalDuration = (config.duration || this.animationConfig.duration * 1000) / 1000;
    const effectiveDuration = Math.max(0.1, totalDuration * (1 - SETTLE_RATIO));

    this.animator = new Animator(
      this.canvas,
      { ...this.animationConfig, duration: effectiveDuration },
      this.handOverlayManager,
      this.handOverlayCanvas,
      transformPoint
    );

    // Scale stroke radius
    const radiusScale = processingWidth / 800;
    (this.animator as any).animatorConfig.strokeRevealRadius *= radiusScale;

    await this.waitForHandOverlayReady();
    await this.animator.waitForHandOverlay();

    const revealMask = new Uint8Array(physWidth * physHeight);
    // Note: We could initialize mask from initialProgress here if needed, 
    // but startDrawingAnimation is usually for fresh playback.

    const strokeRatio = config.strokeRatio || 0.5;
    const strokeInitialProgress = Math.min(1, initialProgress / strokeRatio);

    const success = await this.animator.animateStrokes(strokes, src, revealMask, strokeInitialProgress);
    if (success && sortedRegions.length > 0) {
      const fillInitialProgress = Math.max(0, (initialProgress - strokeRatio) / (1 - strokeRatio));
      await this.animator.animateFill(sortedRegions, src, revealMask, fillInitialProgress);
    }

    this.canvas.getContext('2d')!.putImageData(src, 0, 0);
    if (this.handOverlayManager && this.handOverlayCanvas) {
      this.handOverlayManager.hideHand(this.handOverlayCanvas);
    }
  }

  public seek(progress: number): void {
    const previousProgress = this.lastSeekProgress || -1;
    super.seek(progress);
    if (!this.canvas || !this.isPreloaded || !this.preloadedData) return;

    const transformToGlobal = (p: PixelPoint): Point => {
      const dispX = (p.x / this.preloadedData!.pixelScale) * this.preloadedData!.cssScale;
      const dispY = (p.y / this.preloadedData!.pixelScale) * this.preloadedData!.cssScale;
      const globalPos = this.transformToGlobal({ x: dispX, y: dispY });
      return [globalPos.x, globalPos.y];
    };

    this.seeker!.seek(
      progress,
      previousProgress,
      this.preloadedData,
      this.animationConfig,
      this.canvas,
      this.handOverlayManager,
      this.handOverlayCanvas,
      transformToGlobal
    );
  }

  public dispose(): void {
    if (this.animator) this.animator.dispose();
    if (this.processor) this.processor.dispose();
    this.preloadedData = null;
    this.isPreloaded = false;
    this.img = null;
    this.canvas = null;
  }
}
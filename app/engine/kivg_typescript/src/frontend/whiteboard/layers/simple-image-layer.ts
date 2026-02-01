import { LoadableLayer } from './loadable-layer';
import { LayerConfig, AnimationType, AnimationConfig, WhiteboardConfig } from '../types';

/**
 * Image format for embedding ImageData as images.
 * Using PNG to avoid color space conversion issues that can occur with JPEG compression.
 * PNG ensures lossless encoding and proper color preservation.
 */
const IMAGE_LAYER_FORMAT = 'image/png';

export interface SimpleImageLayerConfig {
  imageUrl?: string;
  imageData?: ImageData;
  width?: number;
  height?: number;
  maintainAspectRatio?: boolean;
}

/**
 * SimpleImageLayer - Displays static or animated images
 * Wraps core image functionality and extends LoadableLayer for automatic loading indicators
 */
export class SimpleImageLayer extends LoadableLayer {
  private imageConfig: SimpleImageLayerConfig;
  private imageElement: SVGImageElement | null = null;

  constructor(config: LayerConfig, imageConfig: SimpleImageLayerConfig, handsConfig?: WhiteboardConfig['hands']) {
    super(config, handsConfig);
    this.imageConfig = imageConfig;
  }

  render(): SVGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    if (this.imageConfig.imageUrl) {
      // Create SVG image element - browser loads asynchronously
      const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', this.imageConfig.imageUrl);

      const width = this.imageConfig.width || 200;
      const height = this.imageConfig.height || 200;

      image.setAttribute('width', width.toString());
      image.setAttribute('height', height.toString());

      this.imageElement = image;
      g.appendChild(image);
    } else if (this.imageConfig.imageData) {
      // Create canvas to convert ImageData to data URL with loading indicator
      // This is a synchronous operation (PNG encoding)
      this.withLoadingSync(
        'process-image',
        'Traitement de l\'image...',
        () => {
          const canvas = document.createElement('canvas');
          canvas.width = this.imageConfig.imageData!.width;
          canvas.height = this.imageConfig.imageData!.height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });

          if (ctx) {
            ctx.putImageData(this.imageConfig.imageData!, 0, 0);
            // Use PNG format to avoid color space conversion issues
            // PNG preserves colors accurately without JPEG compression artifacts
            const dataUrl = canvas.toDataURL(IMAGE_LAYER_FORMAT);

            const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
            image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', dataUrl);
            image.setAttribute('width', canvas.width.toString());
            image.setAttribute('height', canvas.height.toString());

            this.imageElement = image;
            g.appendChild(image);
          }
        }
      ).catch(error => {
        console.error('Failed to process image:', error);
      });
    }

    this.element = g;
    this.applyTransform();
    return g;
  }

  async animate(type: AnimationType, config: AnimationConfig, initialProgress: number = 0): Promise<void> {
    if (!this.element || !this.imageElement) return;

    // Wait for hand overlay to be ready before starting animation
    await this.waitForHandOverlayReady();

    // For image layer, we use the generic LayerAnimator for all animations
    // Use the parent class implementation (LayerAnimator)
    return super.animate(type, config, initialProgress);
  }

  /**
   * Set image source dynamically
   */
  setImageUrl(url: string): void {
    this.imageConfig.imageUrl = url;
    if (this.imageElement) {
      this.imageElement.setAttributeNS('http://www.w3.org/1999/xlink', 'href', url);
    }
  }

  /**
   * Get image configuration
   */
  getImageConfig(): SimpleImageLayerConfig {
    return this.imageConfig;
  }

  /**
   * Prepare method called by Scene during preload phase.
   * Preloads the image if a URL is provided.
   */
  async prepare(): Promise<void> {
    if (this.isPrepared) return;

    const promises: Promise<any>[] = [this.waitForHandOverlayReady()];

    if (this.imageConfig.imageUrl) {
      const url = this.imageConfig.imageUrl;

      // Use HTTP loader for remote URLs
      if (url.startsWith('http://') || url.startsWith('https://')) {
        promises.push((async () => {
          const { getGlobalCache } = await import('../../utils/asset_cache');
          const { fetchImage } = await import('../../utils/http_loader');

          const cache = getGlobalCache();
          let blob = await cache.get(url);

          if (!blob) {
            blob = await fetchImage(url, { retries: 3, timeout: 30000 });
            await cache.set(url, blob);
          }

          // Convert blob to Image to trigger browser decode
          return new Promise<void>((resolve, reject) => {
            const img = new Image();
            const objectUrl = URL.createObjectURL(blob);
            img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(); };
            img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(); };
            img.src = objectUrl;
          });
        })());
      } else {
        // Local path - use standard Image API
        promises.push(new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = reject;
          img.src = url;
        }));
      }
    }

    await Promise.all(promises);
    this.isPrepared = true;
  }

  /**
   * Get layer type for hand overlay strategy selection
   * ImageLayer uses default strategy (static positioning)
   */
  protected getLayerType(): string {
    return 'default';
  }

  /**
   * Seek to a specific progress in the animation with Smart Seek optimization.
   * ImageLayer uses the generic LayerAnimator seek for all entrance animations.
   */
  seek(progress: number): void {
    // Call super to handle generic properties (opacity, transform, position, scale, etc.)
    // and track lastSeekProgress for incremental seek detection
    super.seek(progress);

    // ImageLayer doesn't have custom animation state beyond what the base Layer handles,
    // so we rely entirely on the parent seek implementation which calls LayerAnimator.seek
    // The parent handles fade_in, zoom_in, slide_in, and all other entrance animations
  }
}

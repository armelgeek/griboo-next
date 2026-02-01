import { LoadableLayer } from './loadable-layer';
import { LayerConfig, AnimationType, AnimationConfig, WhiteboardConfig } from '../types';


// Smart Seek thresholds for incremental updates
const SEEK_DASH_OFFSET_THRESHOLD = 0.5; // pixels

export interface SvgPathLayerConfig {
  svgContent?: string;
  svgUrl?: string;
  pathData?: string;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
}

/**
 * SvgPathLayer - Displays SVG/KIVG content with drawing animations
 * Extends LoadableLayer for automatic loading indicators during SVG loading
 */
export class SvgPathLayer extends LoadableLayer {
  private kivgConfig: SvgPathLayerConfig;
  private svgGroup: SVGGElement | null = null;
  private paths: SVGPathElement[] = [];

  // Smart Seek: Track last state for incremental updates
  private lastSeekState: {
    pathStates: Map<SVGPathElement, { dashOffset: number; opacity: number }>;
  } | null = null;

  constructor(config: LayerConfig, kivgConfig: SvgPathLayerConfig, handsConfig?: WhiteboardConfig['hands']) {
    super(config, handsConfig);
    this.kivgConfig = {
      strokeColor: '#000000',
      fillColor: 'none',
      strokeWidth: 2,
      ...kivgConfig
    };
  }

  /**
   * Parse SVG content and extract paths
   */
  private parseSVGContent(svgContent: string): SVGPathElement[] {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
    const paths: SVGPathElement[] = [];

    // Extract all path elements
    const pathElements = svgDoc.querySelectorAll('path');
    pathElements.forEach(path => {
      const newPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      newPath.setAttribute('d', path.getAttribute('d') || '');
      newPath.setAttribute('stroke', this.kivgConfig.strokeColor || '#000000');
      newPath.setAttribute('fill', this.kivgConfig.fillColor || 'none');
      newPath.setAttribute('stroke-width', (this.kivgConfig.strokeWidth || 2).toString());
      newPath.setAttribute('opacity', '0');
      paths.push(newPath);
    });

    return paths;
  }

  /**
   * Load SVG from URL with loading indicator
   */
  private async loadSVG(url: string): Promise<string> {
    return await this.withLoading(
      'load-svg',
      'Chargement du SVG...',
      async () => {
        // Use HTTP loader for remote URLs
        if (url.startsWith('http://') || url.startsWith('https://')) {
          const { getGlobalCache } = await import('../../utils/asset_cache');
          const { fetchText } = await import('../../utils/http_loader');

          const cache = getGlobalCache();
          const cachedBlob = await cache.get(url);

          if (cachedBlob) {
            return await cachedBlob.text();
          }

          const fetchedBlob = await fetchText(url, { retries: 3, timeout: 30000 });
          await cache.set(url, fetchedBlob);
          return await fetchedBlob.text();
        }

        // Local path - use standard fetch
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to load SVG: ${response.statusText}`);
        }
        return await response.text();
      }
    );
  }

  render(): SVGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.svgGroup = g;

    // If we have direct path data, create a single path
    if (this.kivgConfig.pathData) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', this.kivgConfig.pathData);
      path.setAttribute('stroke', this.kivgConfig.strokeColor || '#000000');
      path.setAttribute('fill', this.kivgConfig.fillColor || 'none');
      path.setAttribute('stroke-width', (this.kivgConfig.strokeWidth || 2).toString());
      path.setAttribute('opacity', '0');
      this.paths.push(path);
      g.appendChild(path);
    }
    // If we have SVG content, parse it
    else if (this.kivgConfig.svgContent) {
      this.paths = this.parseSVGContent(this.kivgConfig.svgContent);
      this.paths.forEach(path => g.appendChild(path));
    }

    this.element = g;
    this.applyTransform();
    return g;
  }

  async animate(type: AnimationType, config: AnimationConfig, initialProgress: number = 0): Promise<void> {
    if (!this.element || this.paths.length === 0) return;

    // Wait for hand overlay to be ready before starting animation
    await this.waitForHandOverlayReady();

    if (config.warmUp) {
      return;
    }

    // Load SVG from URL if needed
    if (this.kivgConfig.svgUrl && !this.kivgConfig.svgContent && this.paths.length === 0) {
      try {
        this.kivgConfig.svgContent = await this.loadSVG(this.kivgConfig.svgUrl);
        this.paths = this.parseSVGContent(this.kivgConfig.svgContent);
        this.paths.forEach(path => this.svgGroup!.appendChild(path));
      } catch (error) {
        console.error('Failed to load SVG:', error);
        return;
      }
    }

    return new Promise((resolve) => {
      const delay = config.delay || 0;

      setTimeout(() => {
        switch (type) {
          case 'draw':
            this.animateDraw(config.duration, resolve, initialProgress);
            break;
          case 'fade_in':
            this.animateFadeIn(config.duration, resolve, initialProgress);
            break;
          case 'zoom_in':
            this.animateZoomIn(config.duration, resolve, initialProgress);
            break;
          case 'reveal_horizontal':
          case 'reveal_vertical':
          case 'reveal_diagonal':
            super.animate(type, config, initialProgress).then(resolve);
            break;
          default:
            this.paths.forEach(path => path.setAttribute('opacity', '1'));
            resolve();
        }
      }, delay * 1000);
    });
  }

  private async animateDraw(duration: number, callback: () => void, initialProgress: number = 0): Promise<void> {
    const totalDurationMs = duration * 1000;
    const animationStartTime = performance.now() - (initialProgress * totalDurationMs);

    // Settle ratio (20%) to ensure last part of animation is fully visible before resolving
    const SETTLE_RATIO = 0.2;
    const settleTimeMs = totalDurationMs * SETTLE_RATIO;
    const drawingDurationMs = Math.max(100, totalDurationMs - settleTimeMs);
    const globalTargetTimeMs = initialProgress * totalDurationMs;
    let cumulativeTimeMs = 0;

    // Animate all paths sequentially
    for (let i = 0; i < this.paths.length; i++) {
      const path = this.paths[i];
      const pathLength = path.getTotalLength();
      const pathDurationMs = drawingDurationMs / this.paths.length;

      // Calculate initial progress for THIS path
      let pathInitialProgress = 0;
      if (globalTargetTimeMs > cumulativeTimeMs + pathDurationMs) {
        pathInitialProgress = 1;
      } else if (globalTargetTimeMs > cumulativeTimeMs) {
        pathInitialProgress = (globalTargetTimeMs - cumulativeTimeMs) / pathDurationMs;
      }

      if (pathInitialProgress < 1) {
        path.setAttribute('opacity', '1');
        path.setAttribute('stroke-dasharray', pathLength.toString());
        path.setAttribute('stroke-dashoffset', (pathLength * (1 - pathInitialProgress)).toString());

        await new Promise<void>((resolve) => {
          let startTime: number | null = null;
          let totalPausedTime = 0;

          const animate = async (currentTime: number) => {
            if (this.isStopped) {
              resolve();
              return;
            }

            const pauseStart = performance.now();
            await this.checkPlaybackState();
            const pauseDuration = performance.now() - pauseStart;
            totalPausedTime += pauseDuration;

            if (!startTime) {
              startTime = currentTime;
              if (pathInitialProgress > 0) {
                startTime -= (pathDurationMs * pathInitialProgress);
              }
            }
            const elapsed = currentTime - startTime - totalPausedTime;
            const progress = Math.min(1, elapsed / pathDurationMs);

            const offset = pathLength * (1 - progress);
            path.setAttribute('stroke-dashoffset', offset.toString());

            // Update hand overlay position
            // CRITICAL: Transform point from SVG viewBox coordinates to scene/virtual coordinates
            // The getPointAtLength returns coordinates in the SVG's viewBox space
            if (this.handOverlayManager && this.handOverlayManager.isEnabled()) {
              const currentLength = progress * pathLength;
              const point = path.getPointAtLength(currentLength);

              let nextPoint = point;
              if (progress < 1.0) {
                const nextLength = Math.min(currentLength + 5, pathLength);
                nextPoint = path.getPointAtLength(nextLength);
              }

              const overallProgress = (i + progress) / this.paths.length;
              // Pass transform callback to convert SVG coordinates to scene coordinates
              this.handOverlayManager.updateHandPosition(overallProgress, {
                currentPoint: point,
                nextPoint: nextPoint,
                pathElement: path
              }, this.handOverlayCanvas || undefined, (p) => this.transformToGlobal(p));
            }

            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              path.removeAttribute('stroke-dasharray');
              path.removeAttribute('stroke-dashoffset');
              resolve();
            }
          };
          requestAnimationFrame(animate);
        });
      } else {
        // Path is already fully drawn
        path.setAttribute('opacity', '1');
        path.removeAttribute('stroke-dasharray');
        path.removeAttribute('stroke-dashoffset');
      }

      cumulativeTimeMs += pathDurationMs;
    }

    // Final Micro-Adjustment & Settle Time
    const elapsedBeforeSettle = performance.now() - animationStartTime;
    const remainingTimeMs = totalDurationMs - elapsedBeforeSettle;

    if (!this.isStopped && remainingTimeMs > 0) {
      await this.wait(remainingTimeMs / 1000);

      // Busy-wait for absolute precision
      while (performance.now() - animationStartTime < totalDurationMs) {
        // Micro-adjustment
      }
    }

    // Hide hand overlay
    if (this.handOverlayManager && this.handOverlayCanvas) {
      this.handOverlayManager.hideHand(this.handOverlayCanvas);
    }

    callback();
  }

  private async animateFadeIn(duration: number, callback: () => void, initialProgress: number = 0): Promise<void> {
    const durationMs = duration * 1000;
    const animationStartTime = performance.now() - (initialProgress * durationMs);

    await new Promise<void>((resolve) => {
      let startTime: number | null = null;
      let totalPausedTime = 0;

      const animate = async (currentTime: number) => {
        if (this.isStopped) {
          resolve();
          return;
        }

        const pauseStart = performance.now();
        await this.checkPlaybackState();
        const pauseDuration = performance.now() - pauseStart;
        totalPausedTime += pauseDuration;

        if (!startTime) {
          startTime = currentTime;
          if (initialProgress > 0) {
            startTime -= (durationMs * initialProgress);
          }
        }
        const elapsed = currentTime - startTime - totalPausedTime;
        const progress = Math.min(1, elapsed / durationMs);

        const opacity = this.easeOutCubic(progress);
        this.paths.forEach(path => path.setAttribute('opacity', opacity.toString()));

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });

    // Busy-wait for absolute precision
    while (performance.now() - animationStartTime < durationMs) {
      // Micro-adjustment
    }

    callback();
  }

  private async animateZoomIn(duration: number, callback: () => void, initialProgress: number = 0): Promise<void> {
    const durationMs = duration * 1000;
    const animationStartTime = performance.now() - (initialProgress * durationMs);
    const startScale = 0;
    const targetScale = this.config.scale || 1;

    this.paths.forEach(path => path.setAttribute('opacity', '1'));

    await new Promise<void>((resolve) => {
      let startTime: number | null = null;
      let totalPausedTime = 0;

      const animate = async (currentTime: number) => {
        if (this.isStopped) {
          resolve();
          return;
        }

        const pauseStart = performance.now();
        await this.checkPlaybackState();
        const pauseDuration = performance.now() - pauseStart;
        totalPausedTime += pauseDuration;

        if (!startTime) {
          startTime = currentTime;
          if (initialProgress > 0) {
            startTime -= (durationMs * initialProgress);
          }
        }
        const elapsed = currentTime - startTime - totalPausedTime;
        const progress = Math.min(1, elapsed / durationMs);

        const currentScale = startScale + (targetScale - startScale) * this.easeOutBack(progress);
        this.setScale(currentScale);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });

    // Busy-wait for absolute precision
    while (performance.now() - animationStartTime < durationMs) {
      // Micro-adjustment
    }

    callback();
  }

  /**
   * Update SVG content dynamically
   */
  setSVGContent(content: string): void {
    this.kivgConfig.svgContent = content;

    // Clear existing paths
    if (this.svgGroup) {
      this.paths.forEach(path => this.svgGroup!.removeChild(path));
      this.paths = this.parseSVGContent(content);
      this.paths.forEach(path => this.svgGroup!.appendChild(path));
    }
  }

  /**
   * Get KIVG configuration
   */
  getKivgConfig(): SvgPathLayerConfig {
    return this.kivgConfig;
  }

  /**
   * Prepare method called by Scene during preload phase.
   * Preloads the SVG content if a URL is provided.
   */
  async prepare(): Promise<void> {
    if (this.isPrepared) return;

    const promises: Promise<any>[] = [this.waitForHandOverlayReady()];

    if (this.kivgConfig.svgUrl && !this.kivgConfig.svgContent && this.paths.length === 0) {
      promises.push(this.loadSVG(this.kivgConfig.svgUrl).then(content => {
        this.kivgConfig.svgContent = content;
        this.paths = this.parseSVGContent(content);
        if (this.svgGroup) {
          this.paths.forEach(path => this.svgGroup!.appendChild(path));
        }
      }));
    }

    await Promise.all(promises);
    this.isPrepared = true;
  }

  /**
   * Get layer type for hand overlay strategy selection
   * KivgLayer uses SVG stroke animation strategy
   */
  protected getLayerType(): string {
    return 'svg';
  }

  /**
   * Get SVG transform information for viewBox scaling.
   * Used to correctly transform hand positions from SVG local coordinates to scene coordinates.
   */
  private getSVGTransformInfo(): { scale: number; translateX: number; translateY: number } | null {
    if (!this.element) return null;

    const svgElement = this.element.closest('svg');
    if (!svgElement) return null;

    const viewBox = svgElement.getAttribute('viewBox');
    if (!viewBox) return null;

    const parts = viewBox.split(/[\s,]+/).map(Number);
    if (parts.length < 4) return null;

    const [vbX, vbY, vbWidth, vbHeight] = parts;
    const width = svgElement.clientWidth || parseFloat(svgElement.getAttribute('width') || '0');
    const height = svgElement.clientHeight || parseFloat(svgElement.getAttribute('height') || '0');

    if (vbWidth === 0 || vbHeight === 0 || width === 0 || height === 0) return null;

    const scaleX = width / vbWidth;
    const scaleY = height / vbHeight;
    const scale = Math.min(scaleX, scaleY);

    return { scale, translateX: -vbX, translateY: -vbY };
  }

  /**
   * Override transformToGlobal to account for SVG viewBox scaling.
   * This ensures hand positions from path.getPointAtLength() are correctly
   * transformed to scene/virtual coordinates.
   */
  public transformToGlobal(point: { x: number; y: number }): { x: number; y: number } {
    const svgTransform = this.getSVGTransformInfo();
    let { x, y } = point;

    // If we have viewBox transform, apply it first
    if (svgTransform) {
      x = (x + svgTransform.translateX) * svgTransform.scale;
      y = (y + svgTransform.translateY) * svgTransform.scale;
    }

    // Then apply layer transform (position, scale, rotation)
    return super.transformToGlobal({ x, y });
  }


  /**
   * Seek to a specific progress in the animation with Smart Seek optimization.
   * KivgLayer (now SvgPathLayer) supports draw animations with multiple paths.
   */
  seek(progress: number): void {
    const config = this.config.entrance_animation;
    if (!config || !this.paths || this.paths.length === 0) {
      super.seek(progress);
      return;
    }

    // IMPORTANT: Capture direction BEFORE super.seek updates lastSeekProgress
    const direction = this.getSeekDirection(progress);
    const isIncremental = this.isIncrementalSeek(progress, 0.05);

    // Call super to handle generic properties and track lastSeekProgress
    super.seek(progress);

    // Initialize state tracking if needed
    if (!this.lastSeekState) {
      this.lastSeekState = {
        pathStates: new Map()
      };
    }

    const type = config.type;

    if (type === 'draw') {
      this.seekDraw(progress, direction, isIncremental);
    } else {
      // For non-draw animations (fade_in, zoom_in, etc.), the base Layer.seek handles it
      // We just need to ensure paths are visible
      if (progress > 0) {
        this.paths.forEach(path => {
          path.setAttribute('opacity', '1');
          path.removeAttribute('stroke-dasharray');
          path.removeAttribute('stroke-dashoffset');
        });
      }
    }
  }

  /**
   * Seek implementation for draw animation with multiple paths
   */
  private seekDraw(progress: number, direction: 'forward' | 'rewind' | null, isIncremental: boolean): void {
    if (this.paths.length === 0) return;

    // Note: Hand canvas is cleared once at scene level, not per layer
    // This allows multiple layers to show hands simultaneously during seek

    // Calculate total path length
    const pathLengths = this.paths.map(p => {
      try { return p.getTotalLength(); } catch { return 0; }
    });
    const totalLength = pathLengths.reduce((sum, len) => sum + len, 0);

    if (totalLength === 0) return;

    // Calculate which path(s) should be drawing based on progress
    let accumulatedLength = 0;

    for (let i = 0; i < this.paths.length; i++) {
      const path = this.paths[i];
      const pathLen = pathLengths[i];
      const pathStartProgress = accumulatedLength / totalLength;
      const pathEndProgress = (accumulatedLength + pathLen) / totalLength;

      if (progress <= pathStartProgress) {
        // Path hasn't started yet
        const lastState = this.lastSeekState!.pathStates.get(path);
        if (!isIncremental || !lastState || lastState.opacity !== 0) {
          path.setAttribute('opacity', '0');
          path.setAttribute('stroke-dasharray', pathLen.toString());
          path.setAttribute('stroke-dashoffset', pathLen.toString());
          this.lastSeekState!.pathStates.set(path, { dashOffset: pathLen, opacity: 0 });
        }
      } else if (progress >= pathEndProgress) {
        // Path is complete
        const lastState = this.lastSeekState!.pathStates.get(path);
        if (!isIncremental || !lastState || lastState.dashOffset !== 0) {
          path.setAttribute('opacity', '1');
          path.setAttribute('stroke-dasharray', pathLen.toString());
          path.setAttribute('stroke-dashoffset', '0');
          this.lastSeekState!.pathStates.set(path, { dashOffset: 0, opacity: 1 });
        }
      } else {
        // Path is in progress
        const pathLocalProgress = (progress - pathStartProgress) / (pathEndProgress - pathStartProgress);
        const offset = pathLen * (1 - pathLocalProgress);

        // SMART SEEK: Only update if changed significantly
        const lastState = this.lastSeekState!.pathStates.get(path);
        if (!isIncremental || !lastState || Math.abs(lastState.dashOffset - offset) > SEEK_DASH_OFFSET_THRESHOLD) {
          path.setAttribute('opacity', '1');
          path.setAttribute('stroke-dasharray', pathLen.toString());
          path.setAttribute('stroke-dashoffset', offset.toString());
          this.lastSeekState!.pathStates.set(path, { dashOffset: offset, opacity: 1 });
        }

        // Update hand overlay position for the active path - only during animation
        if (this.handOverlayCanvas && progress > 0 && progress < 1) {
          try {
            const currentLength = pathLocalProgress * pathLen;
            const localPoint = path.getPointAtLength(currentLength);
            const point = this.transformToGlobal({ x: localPoint.x, y: localPoint.y });

            // Get next point for direction
            let nextPoint = point;
            if (pathLocalProgress < 1.0) {
              const nextLength = Math.min(currentLength + 5, pathLen);
              const localNextPoint = path.getPointAtLength(nextLength);
              nextPoint = this.transformToGlobal({ x: localNextPoint.x, y: localNextPoint.y });
            }

            // Calculate overall progress across all paths
            const overallProgress = (i + pathLocalProgress) / this.paths.length;

            // Use SeekHandManager for consistent hand positioning
            this.updateHandDuringSeek(overallProgress, {
              currentPoint: point,
              nextPoint: nextPoint,
              pathElement: path
            });
          } catch (e) {
            // Ignore errors from getPointAtLength
          }
        }
      }

      accumulatedLength += pathLen;
    }

    // Only show hand at end if not at boundary
    // (Dead code removed: progress >= 1 && progress < 1 is impossible)
  }
}
import { LoadableLayer } from './loadable-layer';
import { LayerConfig, AnimationType, AnimationConfig, ShapeLayerConfig, OcclusionProxy, WhiteboardConfig } from '../types';
import { completeTimingPrecision } from '../utils/timing-precision';


// Settle ratio (20%) to ensure last part of animation is fully visible before resolving
const SETTLE_RATIO = 0.2;

// Smart Seek thresholds for incremental updates
const SEEK_DASH_OFFSET_THRESHOLD = 0.5; // pixels
const SEEK_FILL_OPACITY_THRESHOLD = 0.01; // opacity units

export class ShapeLayer extends LoadableLayer {
  // Pre-calculated mathematical constants for performance
  private static readonly TWO_PI = Math.PI * 2;
  private static readonly HALF_PI = Math.PI / 2;

  private shapeType: 'circle' | 'rectangle' | 'square' | 'star' | 'line' | 'ellipse' | 'triangle' | 'polygon' | 'hexagon' | 'path' | 'svg';
  private strokeColor: string | number;
  private fillColor: string | number;
  private strokeWidth: number;
  private size: number;
  private radiusX: number = 0;
  private radiusY: number = 0;
  private sides: number = 5;
  private points: number[] = [];
  private cornerRadius: number = 0;

  // SVG path support
  private pathData?: string;

  // SVG image support (native SVG, no Kivg)
  private svgUrl?: string;
  private svgContent?: string;
  private svgPaths: SVGPathElement[] = [];
  private fillPaths: SVGPathElement[] = [];
  private svgViewBox: { x: number; y: number; width: number; height: number } | null = null;

  // Performance caches
  private pathLengthCache?: number;
  private radiusCache?: number;
  private readonly positionCache = { x: 0, y: 0 };

  // Smart Seek: Track last state for incremental updates
  private lastSeekState: {
    dashOffset: number;
    fillOpacity: number;
    // For SVG paths
    pathStates?: Map<SVGPathElement, { dashOffset: number; fillOpacity: number }>;
  } | null = null;

  constructor(
    configOrConfig: LayerConfig | ShapeLayerConfig,
    shapeType?: 'circle' | 'rectangle' | 'star' | 'line',
    size: number = 100,
    strokeColor: string | number = '#000000',
    fillColor: string | number = 'none',
    strokeWidth: number = 2,
    handsConfig?: WhiteboardConfig['hands']
  ) {
    super(configOrConfig, handsConfig);

    if (shapeType !== undefined) {
      // Old style: multiple arguments
      this.shapeType = shapeType;
      this.size = size;
      this.strokeColor = strokeColor;
      this.fillColor = fillColor;
      this.strokeWidth = strokeWidth;
      this.radiusX = this.size / 2;
      this.radiusY = this.size / 2;
      this.sides = 5;
    } else {
      // New style: single configuration object
      const config = configOrConfig as ShapeLayerConfig;
      this.shapeType = config.shape || 'circle';

      // Handle different size properties based on shape
      this.size = config.width || 100;
      this.radiusX = config.radius || (config.width ? config.width / 2 : 50);
      this.radiusY = config.height ? config.height / 2 : this.radiusX;
      this.sides = this.shapeType === 'triangle' ? 3 : (this.shapeType === 'hexagon' ? 6 : 5);

      if (this.shapeType === 'circle' || this.shapeType === 'star' || this.shapeType === 'ellipse' || this.shapeType === 'triangle' || this.shapeType === 'polygon' || this.shapeType === 'hexagon') {
        this.size = (config.radius || this.radiusX) * 2;
      }

      this.strokeColor = config.strokeColor || '#000000';
      this.fillColor = config.fillColor || 'none';
      this.strokeWidth = config.strokeWidth || 2;
      this.points = config.points || [];
      this.cornerRadius = config.cornerRadius || 0;

      // SVG path support
      if (this.shapeType === 'path' && config.pathData) {
        this.pathData = config.pathData;
      }

      // SVG image support (native SVG loading)
      if (this.shapeType === 'svg' && config.svgUrl) {
        this.svgUrl = config.svgUrl;
        // Load SVG content asynchronously
        this.loadSvgContent();
      }
    }
  }

  /**
   * Load SVG content from URL and parse paths
   */
  private async loadSvgContent(): Promise<void> {
    if (!this.svgUrl) return;

    try {
      // Use HTTP loader for remote URLs
      if (this.svgUrl.startsWith('http://') || this.svgUrl.startsWith('https://')) {
        const { getGlobalCache } = await import('../../utils/asset_cache');
        const { fetchText } = await import('../../utils/http_loader');

        const cache = getGlobalCache();
        const cachedBlob = await cache.get(this.svgUrl);

        if (cachedBlob) {
          this.svgContent = await cachedBlob.text();
        } else {
          const fetchedBlob = await fetchText(this.svgUrl, { retries: 3, timeout: 30000 });
          await cache.set(this.svgUrl, fetchedBlob);
          this.svgContent = await fetchedBlob.text();
        }
      } else {
        // Local path - use standard fetch
        const response = await fetch(this.svgUrl);
        if (!response.ok) {
          throw new Error(`Failed to load SVG: ${response.statusText}`);
        }
        this.svgContent = await response.text();
      }
    } catch (error) {
      console.error('[ShapeLayer] Failed to load SVG:', error);
    }
  }

  render(): SVGElement {
    let shape: SVGElement;

    switch (this.shapeType) {
      case 'path':
        // Custom SVG path rendering
        if (!this.pathData) {
          throw new Error('[ShapeLayer] pathData is required when shape is "path"');
        }
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        shape.setAttribute('d', this.pathData);
        break;

      case 'svg':
        // SVG image rendering - create a group to hold SVG content
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        shape.setAttribute('id', this.config.id || 'shape-svg-layer');
        // SVG content will be populated in preload()
        break;

      case 'circle':
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        shape.setAttribute('r', (this.size / 2).toString());
        shape.setAttribute('cx', '0');
        shape.setAttribute('cy', '0');
        // Rotate -90 degrees to start drawing from top (12 o'clock) to match hand animation
        shape.setAttribute('transform', 'rotate(-90)');
        break;
      case 'ellipse':
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        shape.setAttribute('rx', this.radiusX.toString());
        shape.setAttribute('ry', this.radiusY.toString());
        shape.setAttribute('cx', '0');
        shape.setAttribute('cy', '0');
        // Rotate -90 degrees to start drawing from top (12 o'clock) to match hand animation
        shape.setAttribute('transform', 'rotate(-90)');
        break;
      case 'rectangle':
      case 'square':
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        const width = this.size;
        const height = (this.config as ShapeLayerConfig).height || this.size;
        shape.setAttribute('width', width.toString());
        shape.setAttribute('height', height.toString());
        // Center the rectangle at (0,0) to match BaseLayer centering logic
        shape.setAttribute('x', (-width / 2).toString());
        shape.setAttribute('y', (-height / 2).toString());
        if (this.cornerRadius > 0) {
          shape.setAttribute('rx', this.cornerRadius.toString());
          shape.setAttribute('ry', this.cornerRadius.toString());
        }
        break;
      case 'star':
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        shape.setAttribute('d', this.getStarPathData(this.size / 2));
        break;
      case 'triangle':
      case 'polygon':
      case 'hexagon':
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        shape.setAttribute('d', this.getPolygonPathData(this.size / 2, this.sides));
        break;
      default:
        shape = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        if (this.points && this.points.length >= 4) {
          shape.setAttribute('x1', this.points[0].toString());
          shape.setAttribute('y1', this.points[1].toString());
          shape.setAttribute('x2', this.points[2].toString());
          shape.setAttribute('y2', this.points[3].toString());
        } else {
          shape.setAttribute('x1', '0');
          shape.setAttribute('y1', '0');
          shape.setAttribute('x2', this.size.toString());
          shape.setAttribute('y2', '0');
        }
    }

    // Apply stroke and fill (except for svg type which handles it in preload)
    if (this.shapeType !== 'svg') {
      shape.setAttribute('stroke', this.strokeColor.toString());
      shape.setAttribute('fill', this.fillColor.toString());
      shape.setAttribute('stroke-width', this.strokeWidth.toString());
    }

    this.element = shape;
    this.applyTransform();
    return shape;
  }


  /**
   * Preload resources needed for animation (hand overlay, etc.)
   * Call this before timing-sensitive operations to ensure initialization
   * overhead doesn't affect animation precision measurements.
   */
  async preload(): Promise<void> {
    await this.waitForHandOverlayReady();

    // Load and parse SVG content for svg type
    if (this.shapeType === 'svg' && this.svgUrl) {
      await this.loadAndParseSvg();
    }

    // Pre-calculate path length for path and svg types
    if ((this.shapeType === 'path' || this.shapeType === 'svg') && this.element && this.pathLengthCache == null) {
      this.calculateTotalPathLength();

      if (this.config.debug) {
        console.log(`[ShapeLayer ${this.config.id}] Preloaded path length: ${(this.pathLengthCache || 0).toFixed(2)}px`);
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

  /**
   * Load SVG from URL and parse its paths
   */
  private async loadAndParseSvg(): Promise<void> {
    if (!this.svgUrl || !this.element) return;

    try {
      // Load SVG content if not already loaded
      if (!this.svgContent) {
        const response = await fetch(this.svgUrl);
        if (!response.ok) {
          throw new Error(`Failed to load SVG: ${response.statusText}`);
        }
        this.svgContent = await response.text();
      }

      // Parse SVG content
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(this.svgContent, 'image/svg+xml');
      const svgElement = svgDoc.querySelector('svg');

      if (!svgElement) {
        throw new Error('No SVG element found in content');
      }

      // Extract viewBox
      const viewBox = svgElement.getAttribute('viewBox');
      if (viewBox) {
        const parts = viewBox.split(/[\s,]+/).map(Number);
        if (parts.length >= 4) {
          this.svgViewBox = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
        }
      } else {
        // Fallback to width/height if no viewBox
        const width = parseFloat(svgElement.getAttribute('width') || '0');
        const height = parseFloat(svgElement.getAttribute('height') || '0');
        if (width > 0 && height > 0) {
          this.svgViewBox = { x: 0, y: 0, width, height };
        }
      }

      // Extract all path elements from the SVG
      const paths = svgElement.querySelectorAll('path, line, polyline, polygon, circle, ellipse, rect');
      this.svgPaths = [];
      this.fillPaths = [];

      // Clone and add paths to our element
      paths.forEach((pathEl) => {
        const clonedPath = this.convertToPath(pathEl as SVGElement);
        if (clonedPath) {
          // Check if this path has a fill color (not 'none' or transparent)
          const fill = pathEl.getAttribute('fill') || 'none';
          const hasFill = fill !== 'none' && fill !== 'transparent' && fill !== '';

          // Clone for stroke animation
          const strokePath = clonedPath.cloneNode(true) as SVGPathElement;
          strokePath.setAttribute('fill', 'none');
          strokePath.setAttribute('stroke', this.strokeColor.toString());
          strokePath.setAttribute('stroke-width', this.strokeWidth.toString());
          this.element!.appendChild(strokePath);
          this.svgPaths.push(strokePath);

          // If has fill, create a separate path for fill reveal animation
          if (hasFill) {
            const fillPath = clonedPath.cloneNode(true) as SVGPathElement;
            fillPath.setAttribute('fill', fill);
            fillPath.setAttribute('stroke', 'none');
            fillPath.setAttribute('fill-opacity', '0');
            this.element!.appendChild(fillPath);
            this.fillPaths.push(fillPath);
          }
        }
      });

    } catch (error) {
      console.error('[ShapeLayer] Failed to parse SVG:', error);
    }
  }

  /**
   * Convert various SVG elements to path elements
   */
  private convertToPath(element: SVGElement): SVGPathElement | null {
    const tagName = element.tagName.toLowerCase();
    let pathData = '';

    if (tagName === 'path') {
      pathData = element.getAttribute('d') || '';
    } else if (tagName === 'line') {
      const x1 = parseFloat(element.getAttribute('x1') || '0');
      const y1 = parseFloat(element.getAttribute('y1') || '0');
      const x2 = parseFloat(element.getAttribute('x2') || '0');
      const y2 = parseFloat(element.getAttribute('y2') || '0');
      pathData = `M ${x1} ${y1} L ${x2} ${y2}`;
    } else if (tagName === 'circle') {
      const cx = parseFloat(element.getAttribute('cx') || '0');
      const cy = parseFloat(element.getAttribute('cy') || '0');
      const r = parseFloat(element.getAttribute('r') || '0');
      // Circle as path
      pathData = `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy}`;
    } else if (tagName === 'rect') {
      const x = parseFloat(element.getAttribute('x') || '0');
      const y = parseFloat(element.getAttribute('y') || '0');
      const width = parseFloat(element.getAttribute('width') || '0');
      const height = parseFloat(element.getAttribute('height') || '0');
      pathData = `M ${x} ${y} L ${x + width} ${y} L ${x + width} ${y + height} L ${x} ${y + height} Z`;
    }
    // Add more conversions as needed (ellipse, polygon, polyline)

    if (!pathData) return null;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    return path;
  }

  /**
   * Calculate total path length for all SVG paths
   */
  private calculateTotalPathLength(): void {
    let totalLength = 0;

    if (this.shapeType === 'svg' && this.svgPaths.length > 0) {
      // Sum all path lengths
      this.svgPaths.forEach(path => {
        try {
          totalLength += path.getTotalLength();
        } catch (e) {
          console.warn('[ShapeLayer] Failed to get path length:', e);
        }
      });
    } else if (this.shapeType === 'path' && this.element instanceof SVGPathElement) {
      totalLength = this.element.getTotalLength();
    }

    this.pathLengthCache = totalLength;
  }

  /**
   * Non-blocking wait using requestAnimationFrame for precise timing
   * Replaces busy-wait loops to prevent UI blocking
   */
  private async waitUntilExactTime(targetTime: number): Promise<void> {
    // 1. Bulk wait: Use requestAnimationFrame while we have more than one frame's worth of time.
    while (!this.isStopped && performance.now() < targetTime - 16) {
      await new Promise(resolve => requestAnimationFrame(resolve));
    }

    // 2. Precision wait: Busy-wait for the final few milliseconds to hit the exact target.
    while (!this.isStopped && performance.now() < targetTime) {
      // Micro-adjustment loop
    }
  }

  async animate(type: AnimationType, config: AnimationConfig, initialProgress: number = 0): Promise<void> {
    if (!this.element) return;

    if (config.warmUp) {
      return;
    }

    // Wait for hand overlay to be ready before starting animation
    await this.waitForHandOverlayReady();

    // For draw animation, we use the specific implementation in ShapeLayer
    if (type === 'draw') {
      // Normalize duration: config.duration is in MS, while internal methods expect seconds

      const duration = config.duration / 1000;

      const startTime = performance.now();

      return new Promise((resolve) => {
        this.animateDraw(duration, () => {
          const actualDuration = performance.now() - startTime;
          // config.duration is in milliseconds and includes settle time, so use it for expected
          console.log(`[ShapeLayer] Layer ${this.config.id} (draw): Expected ${config.duration}ms, Actual ${actualDuration.toFixed(2)}ms`);
          resolve();
        }, initialProgress);
      });
    }

    // For all other animations (fade_in, slide, zoom, etc.), use the generic LayerAnimator
    // via the parent class implementation
    // Ensure the shape is not hidden by stroke-dashoffset or fill-opacity
    this.element!.removeAttribute('stroke-dasharray');
    this.element!.removeAttribute('stroke-dashoffset');
    this.element!.setAttribute('fill-opacity', '1');

    return super.animate(type, config, initialProgress);
  }

  /**
   * Seek to a specific progress in the animation with Smart Seek optimization
   */
  protected onSeek(entranceProgress: number): void {
    const config = this.config.entrance_animation;
    if (!config || config.type !== 'draw') return;

    // Initialize state tracking if needed
    if (!this.lastSeekState) {
      this.lastSeekState = {
        dashOffset: -1,
        fillOpacity: -1,
        pathStates: new Map()
      };
    }

    // Get seek direction for potential optimizations
    // Note: super.seek already updated this.lastSeekProgress, so we can use it
    const progress = entranceProgress;
    const direction = this.getSeekDirection(this.lastSeekProgress!);
    const isIncremental = this.isIncrementalSeek(this.lastSeekProgress!, 0.05);

    // Handle draw animation state
    if (this.shapeType === 'svg' && this.svgPaths.length > 0) {
      this.seekSvgPaths(progress, direction, isIncremental);
    } else {
      this.seekSinglePath(progress, direction, isIncremental);
    }
  }

  private seekSvgPaths(progress: number, direction: 'forward' | 'rewind' | null, isIncremental: boolean): void {
    const pathLengths = this.svgPaths.map(p => {
      try { return p.getTotalLength(); } catch { return 0; }
    });
    const totalLength = pathLengths.reduce((sum, len) => sum + len, 0);

    if (totalLength === 0) return;

    // Note: Hand canvas is cleared once at scene level, not per layer
    // This allows multiple layers to show hands simultaneously during seek

    // Determine stroke vs fill phase
    const hasFillsToReveal = this.fillPaths.length > 0;
    const strokeRatio = hasFillsToReveal ? 0.7 : 1.0;

    if (progress <= strokeRatio) {
      // Stroke phase
      const strokeProgress = progress / strokeRatio;
      let accumulatedLength = 0;
      let currentHandPos: { x: number, y: number } | null = null;
      let activePathIndex = -1;

      for (let i = 0; i < this.svgPaths.length; i++) {
        const pathLen = pathLengths[i];
        const pathEndProgress = (accumulatedLength + pathLen) / totalLength;

        if (strokeProgress <= pathEndProgress) {
          activePathIndex = i;
          const pathStartProgress = accumulatedLength / totalLength;
          const pathLocalProgress = pathStartProgress === pathEndProgress ? 1 :
            (strokeProgress - pathStartProgress) / (pathEndProgress - pathStartProgress);

          const offset = pathLen * (1 - pathLocalProgress);

          // SMART SEEK: Only update if changed significantly
          const lastState = this.lastSeekState!.pathStates!.get(this.svgPaths[i]);
          if (!isIncremental || !lastState || Math.abs(lastState.dashOffset - offset) > SEEK_DASH_OFFSET_THRESHOLD) {
            this.svgPaths[i].setAttribute('stroke-dasharray', pathLen.toString());
            this.svgPaths[i].setAttribute('stroke-dashoffset', offset.toString());
            this.lastSeekState!.pathStates!.set(this.svgPaths[i], { dashOffset: offset, fillOpacity: 0 });
          }

          // Hand position - only during active animation
          if (this.handOverlayManager?.isEnabled() && progress > 0 && progress < 1) {
            try {
              const point = this.svgPaths[i].getPointAtLength(pathLen * pathLocalProgress);
              currentHandPos = this.transformToGlobal({ x: point.x, y: point.y });
            } catch (e) { }
          }
          break;
        }
        accumulatedLength += pathLen;
      }

      // Update other paths (only if not incremental or state changed)
      for (let i = 0; i < this.svgPaths.length; i++) {
        const targetOffset = activePathIndex === -1 ? 0 :
          i < activePathIndex ? 0 :
            i > activePathIndex ? pathLengths[i] : -1;

        if (targetOffset >= 0) {
          const lastState = this.lastSeekState!.pathStates!.get(this.svgPaths[i]);
          if (!isIncremental || !lastState || Math.abs(lastState.dashOffset - targetOffset) > 0.5) {
            this.svgPaths[i].setAttribute('stroke-dasharray', pathLengths[i].toString());
            this.svgPaths[i].setAttribute('stroke-dashoffset', targetOffset.toString());
            this.lastSeekState!.pathStates!.set(this.svgPaths[i], { dashOffset: targetOffset, fillOpacity: 0 });
          }
        }
      }

      // Reset fills
      this.fillPaths.forEach(p => {
        const lastFillOpacity = this.lastSeekState!.pathStates!.get(p)?.fillOpacity ?? -1;
        if (!isIncremental || lastFillOpacity !== 0) {
          p.setAttribute('fill-opacity', '0');
          this.lastSeekState!.pathStates!.set(p, { dashOffset: 0, fillOpacity: 0 });
        }
      });

      // Only show hand during active animation (not at boundaries)
      if (currentHandPos && this.handOverlayCanvas) {
        // Use SeekHandManager for consistent hand positioning
        this.updateHandDuringSeek(progress, {
          currentPoint: currentHandPos,
          pathElement: this.svgPaths[activePathIndex >= 0 ? activePathIndex : 0]
        });
      }

    } else {
      // Fill phase
      this.svgPaths.forEach((p, i) => {
        const lastState = this.lastSeekState!.pathStates!.get(p);
        if (!isIncremental || !lastState || lastState.dashOffset !== 0) {
          p.setAttribute('stroke-dashoffset', '0');
          this.lastSeekState!.pathStates!.set(p, { dashOffset: 0, fillOpacity: lastState?.fillOpacity ?? 0 });
        }
      });

      const fillProgress = (progress - strokeRatio) / (1 - strokeRatio);
      const easedFill = this.easeOutCubic(fillProgress);

      this.fillPaths.forEach(p => {
        const lastFillOpacity = this.lastSeekState!.pathStates!.get(p)?.fillOpacity ?? -1;
        if (!isIncremental || Math.abs(lastFillOpacity - easedFill) > 0.01) {
          p.setAttribute('fill-opacity', easedFill.toString());
          this.lastSeekState!.pathStates!.set(p, { dashOffset: 0, fillOpacity: easedFill });
        }
      });

      // Only show hand during active animation (not at end)
      if (this.handOverlayCanvas && progress < 1) {
        // Draw hand at the end of the last path
        const lastPath = this.svgPaths[this.svgPaths.length - 1];
        if (lastPath) {
          try {
            const pathLen = lastPath.getTotalLength();
            const point = lastPath.getPointAtLength(pathLen);
            const globalPoint = this.transformToGlobal({ x: point.x, y: point.y });

            // Use SeekHandManager for consistent hand positioning
            this.updateHandDuringSeek(progress, {
              currentPoint: globalPoint,
              pathElement: lastPath
            });
          } catch (e) {
            // Ignore error
          }
        }
      }
    }
  }

  private seekSinglePath(progress: number, direction: 'forward' | 'rewind' | null, isIncremental: boolean): void {
    const pathLength = this.getPathLength();
    const offset = pathLength * (1 - progress);

    // Note: Hand canvas is cleared once at scene level, not per layer
    // This allows multiple layers to show hands simultaneously during seek

    // SMART SEEK: Only update if changed significantly
    if (!isIncremental || Math.abs(this.lastSeekState!.dashOffset - offset) > 0.5) {
      this.element!.setAttribute('stroke-dasharray', pathLength.toString());
      this.element!.setAttribute('stroke-dashoffset', offset.toString());
      this.lastSeekState!.dashOffset = offset;
    }

    // Hand position - only during active animation (not at boundaries)
    if (this.handOverlayCanvas && progress > 0 && progress < 1) {
      const position = this.getPositionOnShape(progress);

      // Use SeekHandManager for consistent hand positioning
      this.updateHandDuringSeek(progress, {
        currentPoint: position
      });
    }
  }

  private animateDraw(duration: number, callback: () => void, initialProgress: number = 0): void {
    const animationStartTime = performance.now() - (initialProgress * duration * 1000);

    // Start with opacity 1
    this.setOpacity(1);

    // Use exact duration without compensation
    const compensatedDuration = Math.max(0.1, duration);

    // Calculate settle time based on compensated duration
    const settleTime = compensatedDuration * SETTLE_RATIO;
    // Effective duration for drawing is total duration minus settle time
    const drawingDuration = Math.max(0.1, compensatedDuration - settleTime);

    const hasFillsToReveal = this.fillPaths.length > 0;

    // For SVG type with fills, allocate time: 70% stroke, 30% fill reveal
    // For other types or SVG without fills, use all time for stroke
    const strokeRatio = hasFillsToReveal ? 0.7 : 1.0;
    const strokeInitialProgress = Math.min(1, initialProgress / strokeRatio);
    const fillInitialProgress = Math.max(0, (initialProgress - strokeRatio) / (1 - strokeRatio));

    const strokeDuration = hasFillsToReveal ? drawingDuration * 0.7 : drawingDuration;
    const fillDuration = hasFillsToReveal ? drawingDuration * 0.3 : 0;

    if (this.shapeType === 'svg' && this.svgPaths.length > 0) {
      // Animate multiple SVG paths
      this.animateSvgPaths(strokeDuration, () => {
        if (hasFillsToReveal) {
          // Reveal fills after stroke is complete
          this.animateFillReveal(fillDuration, async () => {
            await this.finishAnimation(animationStartTime, duration);
            callback();
          }, fillInitialProgress);
        } else {
          this.finishAnimation(animationStartTime, duration).then(callback);
        }
      }, strokeInitialProgress);
    } else {
      // Single path animation (standard shapes and path type)
      const pathLength = this.getPathLength();
      this.element!.setAttribute('fill-opacity', '0');
      this.element!.setAttribute('stroke-dasharray', pathLength.toString());
      this.element!.setAttribute('stroke-dashoffset', (pathLength * (1 - strokeInitialProgress)).toString());

      this.startStrokeAnimation(strokeDuration, pathLength, () => {
        // Fade in the fill after stroke is done (for standard shapes)
        this.animateFillFadeIn(fillDuration || 0, async () => {
          await this.finishAnimation(animationStartTime, duration);
          callback();
        }, fillInitialProgress);
      }, strokeInitialProgress);
    }
  }

  /**
   * Finish animation with precise timing
   */
  private async finishAnimation(animationStartTime: number, duration: number): Promise<void> {
    // Final Micro-Adjustment: Busy-wait for absolute precision
    await completeTimingPrecision(animationStartTime, duration * 1000, (s) => this.wait(s));

    // Hide hand after settle time
    if (this.handOverlayManager && this.handOverlayCanvas) {
      this.handOverlayManager.hideHand(this.handOverlayCanvas);
    }
  }

  /**
   * Animate multiple SVG paths sequentially
   */
  private animateSvgPaths(totalDuration: number, callback: () => void, initialProgress: number = 0): void {
    if (this.svgPaths.length === 0) {
      callback();
      return;
    }

    // Calculate total path length for time distribution
    const pathLengths = this.svgPaths.map(p => {
      try {
        return p.getTotalLength();
      } catch {
        return 0;
      }
    });
    const totalLength = pathLengths.reduce((sum, len) => sum + len, 0);

    if (totalLength === 0) {
      callback();
      return;
    }

    // Initialize all paths with dasharray
    this.svgPaths.forEach((path, i) => {
      const len = pathLengths[i];
      path.setAttribute('stroke-dasharray', len.toString());
      path.setAttribute('stroke-dashoffset', len.toString());
    });

    const startTime = performance.now() - (initialProgress * totalDuration * 1000);
    let totalPausedTime = 0;
    const durationMs = totalDuration * 1000;
    const shouldUpdateHand = this.handOverlayManager?.isEnabled() ?? false;

    const animate = async (currentTime: number) => {
      if (this.isStopped) return;

      const pauseStart = performance.now();
      await this.checkPlaybackState();
      const pauseDuration = performance.now() - pauseStart;
      totalPausedTime += pauseDuration;

      const elapsed = currentTime - startTime - totalPausedTime;
      const globalProgress = Math.min(elapsed / durationMs, 1);

      // Distribute progress across all paths
      let accumulatedLength = 0;


      for (let i = 0; i < this.svgPaths.length; i++) {
        const pathLen = pathLengths[i];
        const pathEndProgress = (accumulatedLength + pathLen) / totalLength;

        if (globalProgress <= pathEndProgress) {

          const pathStartProgress = accumulatedLength / totalLength;
          const pathLocalProgress = pathStartProgress === pathEndProgress ? 1 :
            (globalProgress - pathStartProgress) / (pathEndProgress - pathStartProgress);

          const offset = pathLen * (1 - pathLocalProgress);
          this.svgPaths[i].setAttribute('stroke-dashoffset', offset.toString());

          // Update hand position
          if (shouldUpdateHand && pathLocalProgress < 1) {
            try {
              const point = this.svgPaths[i].getPointAtLength(pathLen * pathLocalProgress);
              const globalPoint = this.transformToGlobal({ x: point.x, y: point.y });

              // Get next point for direction
              const nextProgress = Math.min(pathLocalProgress + 0.05, 1);
              const nextPoint = this.svgPaths[i].getPointAtLength(pathLen * nextProgress);
              const globalNextPoint = this.transformToGlobal({ x: nextPoint.x, y: nextPoint.y });

              this.handOverlayManager!.updateHandPosition(globalProgress, {
                currentPoint: globalPoint,
                nextPoint: globalNextPoint
              }, this.handOverlayCanvas || undefined);
            } catch (e) {
              // Ignore errors in getPointAtLength
            }
          }
          break;
        } else {
          // This path is complete
          this.svgPaths[i].setAttribute('stroke-dashoffset', '0');
        }

        accumulatedLength += pathLen;
      }

      if (globalProgress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Remove dasharray/dashoffset from all paths
        this.svgPaths.forEach(path => {
          path.removeAttribute('stroke-dasharray');
          path.removeAttribute('stroke-dashoffset');
        });
        callback();
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Animate fill reveal for colored SVG paths (after stroke is complete)
   */
  private animateFillReveal(duration: number, callback: () => void, initialProgress: number = 0): void {
    if (this.fillPaths.length === 0 || duration === 0) {
      callback();
      return;
    }

    const startTime = performance.now() - (initialProgress * duration * 1000);
    let totalPausedTime = 0;
    // Use exact duration without compensation
    const compensatedDuration = Math.max(0.05, duration);
    const durationMs = compensatedDuration * 1000;
    const invDurationMs = 1 / durationMs;

    const animate = async (currentTime: number) => {
      if (this.isStopped) return;

      const pauseStart = performance.now();
      await this.checkPlaybackState();
      const pauseDuration = performance.now() - pauseStart;
      totalPausedTime += pauseDuration;

      const elapsed = currentTime - startTime - totalPausedTime;
      const progress = Math.min(elapsed * invDurationMs, 1);
      const easedProgress = this.easeOutCubic(progress);

      // Fade in all fill paths
      this.fillPaths.forEach(path => {
        path.setAttribute('fill-opacity', easedProgress.toString());
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.fillPaths.forEach(path => {
          path.setAttribute('fill-opacity', '1');
        });
        callback();
      }
    };

    requestAnimationFrame(animate);
  }

  private startStrokeAnimation(duration: number, pathLength: number, callback: () => void, initialProgress: number = 0): void {
    const startTime = performance.now() - (initialProgress * duration * 1000);
    let totalPausedTime = 0;
    const durationMs = duration * 1000;
    // Pre-calculate inverse for multiplication instead of division (faster)
    const invDurationMs = 1 / durationMs;

    // Cache hand overlay state to avoid repeated method calls
    const shouldUpdateHand = this.handOverlayManager?.isEnabled() ?? false;

    const animate = async (currentTime: number) => {
      if (this.isStopped) return;

      const pauseStart = performance.now();
      await this.checkPlaybackState();
      const pauseDuration = performance.now() - pauseStart;
      totalPausedTime += pauseDuration;

      const elapsed = currentTime - startTime - totalPausedTime;
      // Use multiplication instead of division for better performance
      const progress = Math.min(elapsed * invDurationMs, 1);
      const easedProgress = progress; // Linear for stroke

      // Calculate offset using subtraction instead of multiplication
      const offset = pathLength - (pathLength * easedProgress);
      this.element!.setAttribute('stroke-dashoffset', offset.toString());

      // Update hand overlay position during animation (only if enabled)
      if (shouldUpdateHand) {
        // Calculate position on shape perimeter based on progress
        const position = this.getPositionOnShape(easedProgress);

        this.handOverlayManager!.updateHandPosition(easedProgress, {
          currentPoint: position,
          nextPoint: this.getPositionOnShape(Math.min(easedProgress + 0.05, 1.0))
        }, this.handOverlayCanvas || undefined);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.element!.removeAttribute('stroke-dasharray');
        this.element!.removeAttribute('stroke-dashoffset');
        callback();
      }
    };

    requestAnimationFrame(animate);
  }

  private animateFillFadeIn(duration: number, callback: () => void, initialProgress: number = 0): void {
    // If fill is 'none', we don't need to fade it in, just finish
    if (this.fillColor === 'none') {
      this.element!.setAttribute('fill-opacity', '1'); // Reset to default
      callback();
      return;
    }

    const startTime = performance.now() - (initialProgress * duration * 1000);
    // Use exact duration without compensation
    const compensatedDuration = Math.max(0.05, duration);
    const durationMs = compensatedDuration * 1000;
    // Pre-calculate inverse for multiplication instead of division
    const invDurationMs = 1 / durationMs;

    const animate = (currentTime: number) => {
      if (this.isStopped) return;

      const elapsed = currentTime - startTime;
      // Use multiplication instead of division
      const progress = Math.min(elapsed * invDurationMs, 1);
      const easedProgress = this.easeOutCubic(progress);

      this.element!.setAttribute('fill-opacity', easedProgress.toString());

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
   * Get SVG transform information for viewBox scaling.
   * Used to correctly transform hand positions from SVG local coordinates to scene coordinates.
   */
  private getSVGTransformInfo(): { scale: number; translateX: number; translateY: number } | null {
    if (this.shapeType !== 'svg' || !this.svgViewBox) return null;

    const width = this.size;
    const height = (this.config as ShapeLayerConfig).height || this.size;

    if (this.svgViewBox.width === 0 || this.svgViewBox.height === 0 || width === 0 || height === 0) return null;

    const scaleX = width / this.svgViewBox.width;
    const scaleY = height / this.svgViewBox.height;
    const scale = Math.min(scaleX, scaleY);

    // Center the SVG within the layer bounds
    const offsetX = (width - this.svgViewBox.width * scale) / 2 / scale;
    const offsetY = (height - this.svgViewBox.height * scale) / 2 / scale;

    return {
      scale,
      translateX: -this.svgViewBox.x + offsetX,
      translateY: -this.svgViewBox.y + offsetY
    };
  }

  /**
   * Override transformToGlobal to account for SVG viewBox scaling.
   * This ensures hand positions from path.getPointAtLength() are correctly
   * transformed to scene/virtual coordinates.
   */
  public override transformToGlobal(point: { x: number; y: number }): { x: number; y: number } {
    let { x, y } = point;
    if (this.shapeType === 'svg') {
      const svgTransform = this.getSVGTransformInfo();
      if (svgTransform) {
        x = (x + svgTransform.translateX) * svgTransform.scale;
        y = (y + svgTransform.translateY) * svgTransform.scale;
      }
    }

    // Apply base layer transform (position, scale, rotation, centering) via parent class
    return super.transformToGlobal({ x, y });
  }

  /**
   * Calculate position on shape perimeter for hand overlay
   * Returns position in global/scene coordinates (accounting for layer transform)
   * Optimized with caching and pre-calculated constants
   */
  private getPositionOnShape(progress: number): { x: number; y: number } {
    const angle = progress * ShapeLayer.TWO_PI;

    // Calculate position in local coordinates (relative to shape origin)
    let localX = 0;
    let localY = 0;

    if (this.shapeType === 'path') {
      // For custom SVG paths, use getPointAtLength()
      if (this.element && this.element instanceof SVGPathElement) {
        const pathLength = this.getPathLength();
        const currentLength = progress * pathLength;
        try {
          const point = this.element.getPointAtLength(currentLength);
          localX = point.x;
          localY = point.y;
        } catch (e) {
          // Fallback to center if getPointAtLength fails
          localX = 0;
          localY = 0;
        }
      }
    } else if (this.shapeType === 'svg') {
      // For SVG images, position is calculated in animateSvgPaths
      // This shouldn't be called during svg animation, but provide fallback
      localX = (this.config.width || 200) / 2;
      localY = (this.config.height || 200) / 2;
    } else if (this.shapeType === 'circle') {
      // Cache radius calculation
      if (this.radiusCache === undefined) {
        this.radiusCache = this.size / 2;
      }
      const adjustedAngle = angle - ShapeLayer.HALF_PI;
      localX = this.radiusCache * Math.cos(adjustedAngle);
      localY = this.radiusCache * Math.sin(adjustedAngle);
    } else if (this.shapeType === 'ellipse') {
      const adjustedAngle = angle - ShapeLayer.HALF_PI;
      localX = this.radiusX * Math.cos(adjustedAngle);
      localY = this.radiusY * Math.sin(adjustedAngle);
    } else if (this.shapeType === 'rectangle' || this.shapeType === 'square') {
      const width = this.size;
      const height = (this.config as ShapeLayerConfig).height || this.size;
      const perimeter = (width + height) * 2;
      const distance = progress * perimeter;

      if (distance < width) {
        localX = distance - width / 2;
        localY = -height / 2;
      } else if (distance < width + height) {
        localX = width / 2;
        localY = (distance - width) - height / 2;
      } else if (distance < width * 2 + height) {
        localX = width / 2 - (distance - (width + height));
        localY = height / 2;
      } else {
        localX = -width / 2;
        localY = height / 2 - (distance - (width * 2 + height));
      }
    } else if (this.shapeType === 'star') {
      // Cache radius for star
      if (this.radiusCache === undefined) {
        this.radiusCache = this.size / 2;
      }
      const innerRadius = this.radiusCache * 0.4;
      const totalPoints = 10;
      const segmentProgress = 1 / totalPoints;
      const segmentIndex = Math.min(Math.floor(progress / segmentProgress), totalPoints - 1);
      const segmentSubProgress = (progress - segmentIndex * segmentProgress) / segmentProgress;

      const r1 = segmentIndex % 2 === 0 ? this.radiusCache : innerRadius;
      const r2 = (segmentIndex + 1) % 2 === 0 ? this.radiusCache : innerRadius;

      const angle1 = (Math.PI / 5) * segmentIndex - ShapeLayer.HALF_PI;
      const angle2 = (Math.PI / 5) * (segmentIndex + 1) - ShapeLayer.HALF_PI;

      const x1 = r1 * Math.cos(angle1);
      const y1 = r1 * Math.sin(angle1);
      const x2 = r2 * Math.cos(angle2);
      const y2 = r2 * Math.sin(angle2);

      localX = x1 + (x2 - x1) * segmentSubProgress;
      localY = y1 + (y2 - y1) * segmentSubProgress;
    } else if (this.shapeType === 'triangle' || this.shapeType === 'polygon' || this.shapeType === 'hexagon') {
      // Cache radius for polygons
      if (this.radiusCache === undefined) {
        this.radiusCache = this.size / 2;
      }
      const sides = this.sides;
      const segmentProgress = 1 / sides;
      const segmentIndex = Math.min(Math.floor(progress / segmentProgress), sides - 1);
      const segmentSubProgress = (progress - segmentIndex * segmentProgress) / segmentProgress;

      const angle1 = (segmentIndex * ShapeLayer.TWO_PI) / sides - ShapeLayer.HALF_PI;
      const angle2 = ((segmentIndex + 1) * ShapeLayer.TWO_PI) / sides - ShapeLayer.HALF_PI;

      const x1 = this.radiusCache * Math.cos(angle1);
      const y1 = this.radiusCache * Math.sin(angle1);
      const x2 = this.radiusCache * Math.cos(angle2);
      const y2 = this.radiusCache * Math.sin(angle2);

      localX = x1 + (x2 - x1) * segmentSubProgress;
      localY = y1 + (y2 - y1) * segmentSubProgress;
    } else {
      // line - simple linear motion along the line
      if (this.points && this.points.length >= 4) {
        const x1 = this.points[0];
        const y1 = this.points[1];
        const x2 = this.points[2];
        const y2 = this.points[3];
        localX = x1 + (x2 - x1) * progress;
        localY = y1 + (y2 - y1) * progress;
      } else {
        localX = progress * this.size;
        localY = 0;
      }
    }

    // Reuse position cache object to reduce GC pressure
    this.positionCache.x = localX;
    this.positionCache.y = localY;

    // Transform from local coordinates to global/scene coordinates
    return this.transformToGlobal(this.positionCache);
  }

  private getPathLength(): number {
    // Return cached value if available
    if (this.pathLengthCache !== undefined) {
      return this.pathLengthCache;
    }

    // Calculate path length based on shape type
    let length = 0;

    if (this.shapeType === 'path') {
      // For custom SVG paths, use getTotalLength()
      if (this.element && this.element instanceof SVGPathElement) {
        length = this.element.getTotalLength();
      }
    } else if (this.shapeType === 'svg') {
      // For SVG images, sum all path lengths (already calculated in preload)
      // This should not be called during animation for svg type
      length = 0; // Will be calculated in calculateTotalPathLength
    } else if (this.shapeType === 'circle') {
      length = ShapeLayer.TWO_PI * (this.size / 2);
    } else if (this.shapeType === 'ellipse') {
      // Ramanujan approximation for ellipse perimeter
      const a = this.radiusX;
      const b = this.radiusY;
      const h = Math.pow(a - b, 2) / Math.pow(a + b, 2);
      length = Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
    } else if (this.shapeType === 'rectangle' || this.shapeType === 'square') {
      length = (this.size + (this.config.height || this.size)) * 2;
    } else if (this.shapeType === 'star') {
      length = this.size * 3.5;
    } else if (this.shapeType === 'triangle' || this.shapeType === 'polygon' || this.shapeType === 'hexagon') {
      const radius = this.size / 2;
      const sides = this.sides;
      const sideLength = 2 * radius * Math.sin(Math.PI / sides);
      length = sideLength * sides;
    } else {
      // line
      if (this.points && this.points.length >= 4) {
        const x1 = this.points[0];
        const y1 = this.points[1];
        const x2 = this.points[2];
        const y2 = this.points[3];
        length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      } else {
        length = this.size;
      }
    }

    // Cache the calculated value
    this.pathLengthCache = length;
    return length;
  }

  /**
   * Generate path data for a 5-pointed star
   */
  private getStarPathData(radius: number): string {
    const points = [];
    const innerRadius = radius * 0.4;

    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? radius : innerRadius;
      const angle = (Math.PI / 5) * i - Math.PI / 2;
      const x = r * Math.cos(angle);
      const y = r * Math.sin(angle);
      points.push(`${x},${y}`);
    }

    return `M ${points[0]} L ${points.slice(1).join(' ')} Z`;
  }

  /**
   * Generate path data for a regular polygon
   */
  private getPolygonPathData(radius: number, sides: number): string {
    const points = [];

    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      points.push(`${x},${y}`);
    }

    return `M ${points[0]} L ${points.slice(1).join(' ')} Z`;
  }


  /**
   * Override applyTransform to add internal rotation for circular shapes.
   * This ensures the shape starts drawing from the top (12 o'clock)
   * to match the hand animation's starting point.
   */
  protected applyTransform(): void {
    if (this.element && this.config.position) {
      const { x, y } = this.config.position;
      const scaleX = this.config.scaleX ?? this.config.scale ?? 1;
      const scaleY = this.config.scaleY ?? this.config.scale ?? 1;
      const rotation = this.config.rotation || 0;

      // DEBUG: Log scale values to debug zoom_in issue
      if (this.config.id === 'rect-shape') {
        console.log(`[ShapeLayer] applyTransform for ${this.config.id}:`, {
          configScale: this.config.scale,
          configScaleX: this.config.scaleX,
          finalScaleX: scaleX,
          finalScaleY: scaleY
        });
      }

      let transform = `translate(${x}, ${y}) scale(${scaleX}, ${scaleY}) rotate(${rotation})`;

      // Add internal rotation for circular shapes to start at 12 o'clock
      if (this.shapeType === 'circle' || this.shapeType === 'ellipse') {
        transform += ' rotate(-90)';
      }

      this.element.setAttribute('transform', transform);
      this.element.setAttribute('opacity', (this.config.opacity ?? 1).toString());
    }
  }

  /**
   * Get layer type for hand overlay strategy selection
   * ShapeLayer uses shape animation strategy for drawing shapes
   */
  protected override getLayerType(): string {
    return 'shape';
  }
  /**
   * Get the geometric proxy for occlusion culling.
   */
  public override getOcclusionProxy(): OcclusionProxy {
    const bbox = this.getGlobalBBox();
    if (!bbox) {
      return super.getOcclusionProxy();
    }

    if (this.shapeType === 'circle') {
      return {
        type: 'circle',
        x: bbox.x + bbox.width / 2,
        y: bbox.y + bbox.height / 2,
        width: bbox.width,
        height: bbox.height,
        radius: bbox.width / 2
      };
    }

    if (this.shapeType === 'ellipse') {
      return {
        type: 'ellipse',
        x: bbox.x + bbox.width / 2,
        y: bbox.y + bbox.height / 2,
        width: bbox.width,
        height: bbox.height,
        radiusX: bbox.width / 2,
        radiusY: bbox.height / 2
      };
    }

    return {
      type: 'rect',
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height
    };
  }
  /**
   * Check if the layer is "hollow" (no fill).
   */
  public isHollow(): boolean {
    return this.fillColor === 'none' || this.fillColor === 'transparent';
  }

  /**
   * Get a set of points representing the geometric path of the shape.
   * Used for precise occlusion erasing.
   */
  public getErasePath(resolution: number = 100): [number, number][] {
    const points: [number, number][] = [];
    for (let i = 0; i <= resolution; i++) {
      const progress = i / resolution;
      const pos = this.getPositionOnShape(progress);
      points.push([pos.x, pos.y]);
    }
    return points;
  }
}

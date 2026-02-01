/**
 * TextLayer - A layer that converts text to SVG paths and animates stroke writing
 *
 * This layer provides text-to-SVG conversion with stroke animation support for
 * creating handwriting-style text effects. The implementation supports:
 * - Multiple languages with proper writing direction (LTR, RTL, vertical)
 * - Progressive stroke animation (always left to right)
 * - Customizable animation speed and style
 * - Integration with existing layer system
 */

import { LoadableLayer } from './loadable-layer';
import { LayerConfig, AnimationType, AnimationConfig, WhiteboardConfig } from '../types';
import { TimingManager } from '../managers/timing-manager';
import { SVGGeneratorCore } from '../../text/text-to-svg';
import { isDebugEnabled } from '../../../shared/config/debug_config';
import {
  DEFAULT_SETTLE_RATIO,
  completeTimingPrecision,
  logTimingResult
} from '../utils/timing-precision';
// Removed missing imports

// Counter for generating unique layer IDs
let layerIdCounter = 0;

// Settle ratio to ensure last part of animation is fully visible before resolving
const SETTLE_RATIO = DEFAULT_SETTLE_RATIO;

export interface TextLayerConfig extends LayerConfig {
  /** Text content to render */
  text: string;
  /** Font family (default: 'Roboto') */
  fontFamily?: string;
  /** Font variant: 'regular', 'bold', 'italic' (default: 'regular') */
  fontVariant?: string;
  /** Font size in pixels (default: 100) */
  fontSize?: number;
  /** Text color in hex format (default: '#000000') */
  /** Text color in hex format (default: '#000000') */
  color?: string;
  /** Writing direction: 'ltr', 'rtl', 'ttb' (top-to-bottom) */
  direction?: 'ltr' | 'rtl' | 'ttb';
  /** Whether to reverse the path direction (e.g. for clockwise 'O') */
  reversePath?: boolean;
  /** Line height as a multiple of font size (default: 1.2) */
  lineHeight?: number;
  /** Letter spacing in pixels (default: 0) */
  letterSpacing?: number;
  /** Text alignment: 'left', 'center', 'right' (default: 'left') */
  align?: 'left' | 'center' | 'right';
  /** Animation configuration */
  strokeAnimation?: {
    /** Duration of stroke animation in seconds (default: 3.0) */
    duration?: number;
    /** Stroke width during animation (default: 2) */
    strokeWidth?: number;
    /** Stroke color during animation (default: '#000000') */
    strokeColor?: string;
    /** Delay between characters in seconds (default: 0.1) */
    charDelay?: number;
    /** @deprecated Use fillMode instead. Whether to fill after stroke completes (default: true) */
    fillAfterStroke?: boolean;
    /**
     * Animation mode:
     * - 'stroke': Animate stroke drawing (traditional path animation)
     * - 'typewriter': Reveal filled text character by character (typing effect)
     * Default: 'stroke'
     */
    mode?: 'stroke' | 'typewriter';
    /** When to fill the text: 'start' (filled immediately), 'end' (after animation), 'none' (outline only) */
    fillMode?: 'start' | 'end' | 'none';
  };
}

/**
 * TextLayer - Renders text as SVG paths with stroke animation
 * Extends LoadableLayer for automatic loading indicators during SVG generation
 */
export class TextLayer extends LoadableLayer {
  private textConfig: {
    text: string;
    fontFamily: string;
    fontVariant: string;
    fontSize: number;
    color: string;
    direction: 'ltr' | 'rtl' | 'ttb';
    reversePath: boolean;
    lineHeight: number;
    letterSpacing: number;
    align: 'left' | 'center' | 'right';
    strokeAnimation: {
      duration: number;
      strokeWidth: number;
      strokeColor: string;
      charDelay: number;
      fillAfterStroke: boolean;
      mode: 'stroke' | 'typewriter';
      fillMode: 'start' | 'end' | 'none';
    };
  };
  private svgGenerator: SVGGeneratorCore;
  private svgContent: string | null = null;
  private pathGroup: SVGGElement | null = null;
  private editingGroup: SVGGElement | null = null;
  private textElement: SVGTextElement | null = null;
  private pathElements: SVGPathElement[] = [];
  private isAnimating: boolean = false;
  private isEditing: boolean = false;
  private animationProgress: number = 0;
  private offsetX: number = 0;
  private offsetY: number = 0;
  protected svgViewBox: { x: number, y: number, width: number, height: number } | null = null;

  constructor(config: TextLayerConfig, handsConfig?: WhiteboardConfig['hands']) {
    super(config, handsConfig);

    // Set default configuration
    const anyConfig = config as any;

    // Calculate timing for the layer
    const timing = TimingManager.calculateLayerTiming(config);

    this.textConfig = {
      text: config.text,
      fontFamily: config.fontFamily || 'Roboto',
      fontVariant: config.fontVariant || 'regular',
      fontSize: config.fontSize || 100,
      color: config.color || '#000000',
      direction: config.direction || 'ltr',
      reversePath: !!config.reversePath,
      lineHeight: config.lineHeight || 1.2,
      letterSpacing: config.letterSpacing || 0,
      align: config.align || 'left',
      strokeAnimation: {
        duration: config.strokeAnimation?.duration || anyConfig.duration || timing.animationDuration,
        strokeWidth: config.strokeAnimation?.strokeWidth || anyConfig.strokeWidth || 2,
        strokeColor: config.strokeAnimation?.strokeColor || anyConfig.strokeColor || config.color || '#000000',
        charDelay: config.strokeAnimation?.charDelay || anyConfig.charDelay || 0.1,
        fillAfterStroke: config.strokeAnimation?.fillAfterStroke !== undefined ? config.strokeAnimation.fillAfterStroke : (anyConfig.fillAfterStroke !== false),
        mode: config.strokeAnimation?.mode || anyConfig.mode || 'stroke',
        fillMode: config.strokeAnimation?.fillMode || anyConfig.fillMode || (config.strokeAnimation?.fillAfterStroke === false || anyConfig.fillAfterStroke === false ? 'none' : 'end'),
      },
    };

    if (isDebugEnabled()) {
      console.debug(`[TextLayer] Creating layer with font: ${this.textConfig.fontFamily}, variant: ${this.textConfig.fontVariant}`);
    }

    // Initialize SVG generator
    this.svgGenerator = new SVGGeneratorCore({
      settings: {
        text: this.textConfig.text,
        size: this.textConfig.fontSize,
        fontUploadedFile: null,
        lineHeight: this.textConfig.lineHeight,
        letterSpacing: this.textConfig.letterSpacing,
        align: this.textConfig.align,
      },
      currentFontFamily: this.textConfig.fontFamily,
      currentVariant: this.textConfig.fontVariant,
      svg: null,
      initialized: true,
    });
  }

  /**
   * Render the layer - creates SVG paths from text
   * Note: SVG content is generated asynchronously. The layer is initially empty
   * and will be populated once font loading and SVG generation completes.
   */
  render(): SVGElement {
    if (!this.element) {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('id', this.config.id || 'text-svg-layer');
      this.element = group;

      // Create groups for different modes
      this.pathGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      this.pathGroup.setAttribute('class', 'path-group');

      this.editingGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      this.editingGroup.setAttribute('class', 'editing-group');
      this.editingGroup.style.display = 'none'; // Hidden by default

      this.textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      this.editingGroup.appendChild(this.textElement);

      this.element.appendChild(this.pathGroup);
      this.element.appendChild(this.editingGroup);

      this.applyTransform();

      // Generate SVG asynchronously and update the layer
      this.generateSVG().then(() => {
        this.updateSVGContent();
      }).catch(error => {
        if (isDebugEnabled()) {
          console.error('Failed to generate SVG:', error);
        }
        group.setAttribute('data-error', 'svg-generation-failed');
      });
    }

    return this.element;
  }

  /**
   * Preload the layer - ensures SVG generation is started and waits for completion
   * This is called by the scene during initialization to ensure all assets are ready.
   */
  public async preload(): Promise<void> {
    if (isDebugEnabled()) {
      console.debug(`[TextLayer] Preloading layer ${this.config.id}...`);
    }
    this.render();
    await this.waitForReady();
  }

  /**
   * Prepare method called by Scene during preload phase.
   * Delegates to preload() and marks layer as prepared.
   */
  public async prepare(): Promise<void> {
    if (this.isPrepared) return;
    await this.preload();
    this.isPrepared = true;
  }

  /**
   * Wait for SVG generation to complete
   * Should be called after render() and before animate()
   */
  async waitForReady(): Promise<boolean> {
    if (!this.element) {
      return false;
    }

    // If SVG content is already loaded and processed, return immediately
    if (this.svgContent && this.pathGroup && this.pathElements.length > 0) {
      return true;
    }

    // Check for error state
    if (this.element.getAttribute('data-error')) {
      return false;
    }

    // Wait for SVG generation with timeout
    const maxWaitTime = 5000; // 5 seconds
    const startTime = Date.now();

    while ((!this.svgContent || this.pathElements.length === 0) && Date.now() - startTime < maxWaitTime) {
      // Use shorter wait interval for faster warm-up (10ms)
      await this.wait(0.01);
    }

    return this.svgContent !== null;
  }

  /**
   * Generate SVG from text using the SVGGeneratorCore
   * Wrapped with loading indicator for heavy font loading and path generation
   * 
   * OPTIMIZATION: Uses SVG cache to avoid regenerating identical SVGs
   */
  private async generateSVG(): Promise<void> {
    return this.withLoading(
      'generate-svg',
      'Génération du SVG...',
      async () => {
        try {
          // Cache logic removed

          if (isDebugEnabled()) {
            console.debug(`[TextLayer] Generating SVG for "${this.textConfig.text}" with font "${this.textConfig.fontFamily}"...`);
          }

          this.svgContent = await this.svgGenerator.render({
            text: this.textConfig.text,
            size: this.textConfig.fontSize,
            fontFamily: this.textConfig.fontFamily,
            variant: this.textConfig.fontVariant,
            reversePath: this.textConfig.reversePath,
            lineHeight: this.textConfig.lineHeight,
            letterSpacing: this.textConfig.letterSpacing,
            align: this.textConfig.align,
          });

          if (isDebugEnabled()) {
            console.debug(`[TextLayer] SVG generated successfully for "${this.textConfig.fontFamily}"`);
          }

          // Cache storage logic removed
        } catch (error) {
          if (isDebugEnabled()) {
            console.error(`[TextLayer] Error generating SVG for "${this.textConfig.fontFamily}":`, error);
          }
          // Try fallback with simpler font if the error is related to OpenType features
          const errorMessage = error instanceof Error ? error.message : String(error);
          const originalError = (error as any)?.originalError;
          const originalErrorMessage = originalError instanceof Error ? originalError.message : '';

          // Check both wrapped and original error messages for OpenType features issues
          const hasOpenTypeIssue = errorMessage.includes('lookupType') ||
            errorMessage.includes('substFormat') ||
            originalErrorMessage.includes('lookupType') ||
            originalErrorMessage.includes('substFormat');

          if (hasOpenTypeIssue) {
            if (isDebugEnabled()) {
              console.warn('Font has unsupported OpenType features, trying fallback fonts...');
              console.warn('Original font:', this.textConfig.fontFamily);
            }

            // Try with simpler fallback fonts that have better OpenType support
            const fallbackFonts = ['Roboto', 'Open Sans', 'Lato'];

            for (const fallbackFont of fallbackFonts) {
              // Skip if we're already using this font
              if (fallbackFont === this.textConfig.fontFamily) {
                continue;
              }

              try {
                if (isDebugEnabled()) {
                  console.log(`Attempting fallback font: ${fallbackFont}`);
                }
                this.svgContent = await this.svgGenerator.render({
                  text: this.textConfig.text,
                  size: this.textConfig.fontSize,
                  fontFamily: fallbackFont,
                  variant: 'regular', // Use regular variant for fallback to avoid complexity
                  reversePath: this.textConfig.reversePath,
                });
                if (isDebugEnabled()) {
                  console.log(`✓ Successfully generated SVG with fallback font: ${fallbackFont}`);
                }
                this.textConfig.fontFamily = fallbackFont; // Update to reflect actual font used
                return;
              } catch (fallbackError) {
                if (isDebugEnabled()) {
                  console.warn(`✗ Fallback font ${fallbackFont} failed:`, fallbackError);
                }
                // Continue to next fallback
                continue;
              }
            }

            if (isDebugEnabled()) {
              console.error('All fallback fonts failed. The text cannot be rendered.');
            }
          }

          throw error;
        }
      }
    );
  }

  /**
   * Get SVG transform information for viewBox scaling
   * Matches ServerKivgLayer.getSVGTransformInfo() logic
   */
  private getSVGTransformInfo(): { scale: number, translateX: number, translateY: number } | null {
    if (!this.svgViewBox) return null;

    // Use actual SVG dimensions as defaults instead of hardcoded values
    // This ensures BaseLayer's centering logic uses the correct dimensions
    const layerWidth = this.config.width || this.svgViewBox.width;
    const layerHeight = this.config.height || this.svgViewBox.height;

    const scaleX = layerWidth / this.svgViewBox.width;
    const scaleY = layerHeight / this.svgViewBox.height;

    // Use uniform scaling to avoid stretching (matches ServerKivgLayer)
    const scale = Math.min(scaleX, scaleY);

    // Center the SVG within the layer bounds
    const offsetX = (layerWidth - this.svgViewBox.width * scale) / 2 / scale;
    const offsetY = (layerHeight - this.svgViewBox.height * scale) / 2 / scale;

    return {
      scale,
      translateX: -this.svgViewBox.x + offsetX,
      translateY: -this.svgViewBox.y + offsetY
    };
  }

  /**
   * Update SVG content in the layer element
   * OPTIMIZATION: Uses BBoxCalculator to eliminate DOM thrashing
   */
  private updateSVGContent(): void {
    if (!this.element || !this.svgContent) return;

    // Update editing text element (synchronous part)
    if (this.textElement) {
      this.textElement.textContent = this.textConfig.text;
      this.textElement.setAttribute('font-family', this.textConfig.fontFamily);
      this.textElement.setAttribute('font-size', this.textConfig.fontSize.toString());
      this.textElement.setAttribute('fill', this.textConfig.color);
      this.textElement.setAttribute('text-anchor', this.textConfig.align === 'center' ? 'middle' : (this.textConfig.align === 'right' ? 'end' : 'start'));

      // Handle multi-line text for the <text> element if needed
      // For now, simple single-line or basic multi-line support
      if (this.textConfig.text.includes('\n')) {
        this.textElement.textContent = '';
        const lines = this.textConfig.text.split('\n');
        lines.forEach((line, i) => {
          const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
          tspan.textContent = line;
          tspan.setAttribute('x', '0');
          tspan.setAttribute('dy', i === 0 ? '0' : `${this.textConfig.lineHeight}em`);
          this.textElement!.appendChild(tspan);
        });
      }
    }

    // Clear existing path content and release old references to prevent memory leaks
    if (this.pathGroup) {
      while (this.pathGroup.firstChild) {
        this.pathGroup.removeChild(this.pathGroup.firstChild);
      }
    }
    // Clear path elements array to release references
    this.pathElements.length = 0;

    // Parse SVG content
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(this.svgContent, 'image/svg+xml');
    const svgElement = svgDoc.documentElement;

    // Extract viewBox from SVG (matching ServerKivgLayer logic)
    const viewBox = svgElement.getAttribute('viewBox');
    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/).map(parseFloat);
      if (parts.length === 4) {
        this.svgViewBox = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
        if (isDebugEnabled()) {
          console.debug(`[TextLayer] Found viewBox:`, this.svgViewBox);
        }
      }
    }

    // Check animation mode
    const isTypewriter = this.textConfig.strokeAnimation.mode === 'typewriter';

    // Extract path elements and prepare them for animation
    // OPTIMIZATION: Use BBoxCalculator to reuse single temp SVG instead of creating/destroying many
    const paths = svgElement.querySelectorAll('path');
    paths.forEach((path, index) => {
      const newPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const pathData = path.getAttribute('d');
      if (!pathData) return; // Skip if no path data

      newPath.setAttribute('d', pathData);

      // Set common attributes BEFORE adding to DOM
      newPath.setAttribute('fill', this.textConfig.color || '#000000');
      newPath.setAttribute('fill-rule', 'evenodd');
      newPath.setAttribute('stroke-linecap', 'round');
      newPath.setAttribute('stroke-linejoin', 'round');

      if (isTypewriter) {
        // Typewriter mode: Set up filled paths with clipping
        newPath.setAttribute('stroke', 'none');
        newPath.style.opacity = '0';
      } else {
        // Stroke mode: Set initial stroke properties for animation
        const fillMode = this.textConfig.strokeAnimation.fillMode;
        const initialFillOpacity = fillMode === 'start' ? '1' : '0';

        newPath.setAttribute('stroke', this.textConfig.strokeAnimation.strokeColor || '#000000');
        newPath.setAttribute('stroke-width', (this.textConfig.strokeAnimation.strokeWidth || 2).toString());
        newPath.setAttribute('fill-opacity', initialFillOpacity);
        // We'll set stroke-dasharray and stroke-dashoffset after getting pathLength
      }

      newPath.dataset.charIndex = index.toString();
      newPath.dataset.originalIndex = index.toString();

      // CRITICAL: Add to DOM FIRST, then calculate bbox
      // getBBox() and getTotalLength() require the element to be in the DOM
      this.pathGroup!.appendChild(newPath);
      this.pathElements.push(newPath);

      // Now calculate bbox and pathLength
      let bbox = { x: 0, y: 0, width: 0, height: 0 };
      let pathLength = 0;
      try {
        if (typeof newPath.getBBox === 'function') bbox = newPath.getBBox();
        if (typeof newPath.getTotalLength === 'function') pathLength = newPath.getTotalLength();
      } catch (e) {
        if (isDebugEnabled()) {
          console.warn('[TextToSVGLayer] Failed to get bbox/length for path:', e);
        }
      }

      const centerX = bbox.x + bbox.width / 2;
      const centerY = bbox.y + bbox.height / 2;

      // Store position data
      newPath.dataset.centerX = centerX.toString();
      newPath.dataset.centerY = centerY.toString();
      newPath.dataset.pathLength = pathLength.toString();

      // Store bounding box for all modes (needed for hand positioning)
      newPath.dataset.bboxX = bbox.x.toString();
      newPath.dataset.bboxY = bbox.y.toString();
      newPath.dataset.bboxWidth = bbox.width.toString();
      newPath.dataset.bboxHeight = bbox.height.toString();

      // Now set stroke-dasharray for stroke mode (after we have pathLength)
      if (!isTypewriter) {
        newPath.setAttribute('stroke-dasharray', pathLength.toString());
        newPath.setAttribute('stroke-dashoffset', pathLength.toString());
      }
    });

    // Apply viewBox-based transforms (matching ServerKivgLayer logic)
    // This replaces the old manual centering calculation
    if (this.pathElements.length > 0) {
      // Update layer config dimensions if not explicitly provided
      // This ensures BaseLayer's centering logic uses the correct dimensions
      if (!this.config.width && this.svgViewBox) {
        this.config.width = this.svgViewBox.width;
      }
      if (!this.config.height && this.svgViewBox) {
        this.config.height = this.svgViewBox.height;
      }

      // CRITICAL: Force update of the layer's group transform now that we have dimensions.
      // This ensures BaseLayer's centering logic (which uses width/height) is applied correctly.
      if (this.config.position) {
        this.setPosition(this.config.position.x, this.config.position.y);
      }

      const transformInfo = this.getSVGTransformInfo();

      if (transformInfo) {
        // Use viewBox scaling like server does
        this.offsetX = transformInfo.translateX * transformInfo.scale;
        this.offsetY = transformInfo.translateY * transformInfo.scale;

        const transform = `scale(${transformInfo.scale}) translate(${transformInfo.translateX}, ${transformInfo.translateY})`;
        if (this.pathGroup) this.pathGroup.setAttribute('transform', transform);
        if (this.editingGroup) this.editingGroup.setAttribute('transform', transform);

        if (isDebugEnabled()) {
          console.debug(`[TextLayer] Applied viewBox transform: scale=${transformInfo.scale}, translate=(${transformInfo.translateX}, ${transformInfo.translateY})`);
          console.debug(`[TextLayer] Layer dimensions: width=${this.config.width}, height=${this.config.height}`);
        }
      } else {
        // Fallback: calculate from path bounding boxes if no viewBox
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        this.pathElements.forEach(path => {
          const bboxX = parseFloat(path.dataset.bboxX || '0');
          const bboxY = parseFloat(path.dataset.bboxY || '0');
          const bboxWidth = parseFloat(path.dataset.bboxWidth || '0');
          const bboxHeight = parseFloat(path.dataset.bboxHeight || '0');

          minX = Math.min(minX, bboxX);
          minY = Math.min(minY, bboxY);
          maxX = Math.max(maxX, bboxX + bboxWidth);
          maxY = Math.max(maxY, bboxY + bboxHeight);
        });

        if (minX !== Infinity) {
          // Store calculated viewBox for consistency
          this.svgViewBox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };

          // Apply viewBox transforms
          const newTransformInfo = this.getSVGTransformInfo();
          if (newTransformInfo) {
            this.offsetX = newTransformInfo.translateX * newTransformInfo.scale;
            this.offsetY = newTransformInfo.translateY * newTransformInfo.scale;

            const transform = `scale(${newTransformInfo.scale}) translate(${newTransformInfo.translateX}, ${newTransformInfo.translateY})`;
            if (this.pathGroup) this.pathGroup.setAttribute('transform', transform);
            if (this.editingGroup) this.editingGroup.setAttribute('transform', transform);
          }
        }
      }
    }

    if (this.pathGroup) this.pathGroup.dataset.finalColor = this.textConfig.color;
  }

  /**
   * Override transformToGlobal to account for viewBox scaling and translation
   * Matches ServerKivgLayer.transformToGlobalAnimated logic
   */
  public transformToGlobal(point: { x: number; y: number }): { x: number; y: number } {
    const transformInfo = this.getSVGTransformInfo();
    let { x, y } = point;

    if (transformInfo) {
      // Apply viewBox transforms: first translate, then scale
      // This matches the SVG transform order: scale(s) translate(tx, ty)
      x = (x + transformInfo.translateX) * transformInfo.scale;
      y = (y + transformInfo.translateY) * transformInfo.scale;

      // FIX: If layer is centered, BaseLayer will subtract width/2, height/2.
      // But transformInfo already centers the content in the layer's local space ([-w/2, w/2]).
      // We must compensate to avoid double-centering.
      if (this.isCentered()) {
        x += (this.config.width || 0) / 2;
        y += (this.config.height || 0) / 2;
      }
    } else {
      // Fallback to offset-based transform
      x += this.offsetX;
      y += this.offsetY;
    }

    // Apply base layer transform (position, scale, rotation, centering) via parent class
    return super.transformToGlobal({ x, y });
  }

  /**
   * Override transformToGlobalAnimated to account for viewBox scaling and translation
   * Matches ServerKivgLayer.transformToGlobalAnimated logic
   */
  public transformToGlobalAnimated(point: { x: number; y: number }, time: number): { x: number; y: number } {
    const transformInfo = this.getSVGTransformInfo();

    if (transformInfo) {
      // Apply viewBox transforms: first translate, then scale
      // This matches the SVG transform order: scale(s) translate(tx, ty)
      const transformed = {
        x: (point.x + transformInfo.translateX) * transformInfo.scale,
        y: (point.y + transformInfo.translateY) * transformInfo.scale
      };

      // FIX: If layer is centered, BaseLayer will subtract width/2, height/2.
      // But transformInfo already centers the content in the layer's local space ([-w/2, w/2]).
      // We must compensate to avoid double-centering.
      if (this.isCentered()) {
        transformed.x += (this.config.width || 0) / 2;
        transformed.y += (this.config.height || 0) / 2;
      }

      return super.transformToGlobalAnimated(transformed, time);
    }

    // Fallback to offset-based transform
    return super.transformToGlobalAnimated({
      x: point.x + this.offsetX,
      y: point.y + this.offsetY
    }, time);
  }

  /**
   * Animate the stroke writing effect or typewriter effect
   */
  async animate(type: AnimationType, config: AnimationConfig, initialProgress: number = 0): Promise<void> {
    // Disable editing mode before animation
    this.setEditing(false);

    if (config.warmUp) {
      // Wait for SVG to be ready (this is the actual warm-up part)
      await this.waitForReady();
      // Use shorter wait interval
      await this.wait(0.01);
      return;
    }

    // Wait for hand overlay to be ready before animating
    await this.waitForHandOverlayReady();

    // For draw animation, we use the specific implementation in TextLayer
    if (type === 'draw') {
      // Ensure visible when animation starts
      this.setOpacity(this.config.opacity || 1);

      // Choose animation mode
      if (this.textConfig.strokeAnimation.mode === 'typewriter') {
        return this.animateTypewriter(config, initialProgress);
      } else {
        return this.animateStrokeWriting(config, initialProgress);
      }
    }

    // Handle typewriter and char_fade as standalone animation types
    if (type === 'typewriter' || type === 'char_fade') {
      // Ensure visible when animation starts
      this.setOpacity(this.config.opacity || 1);
      if (type === 'char_fade') {
        return this.animateCharFade(config, initialProgress);
      }
      return this.animateTypewriter(config, initialProgress);
    }

    // For other animation types, use the parent class implementation
    // LayerAnimator will handle opacity/transform animations

    // Ensure paths are visible for non-draw animations
    if (this.textConfig.strokeAnimation.mode === 'typewriter') {
      this.pathElements.forEach(path => {
        path.style.opacity = '1';
      });
    } else {
      // Stroke mode: reset dash offset and ensure fill is visible if it should be
      this.pathElements.forEach(path => {
        path.removeAttribute('stroke-dasharray');
        path.removeAttribute('stroke-dashoffset');
        if (this.textConfig.strokeAnimation.fillMode !== 'none') {
          path.setAttribute('fill-opacity', '1');
        }
      });
    }

    return super.animate(type, config, initialProgress);
  }

  /**
   * Initialize the layer's state for entrance animation.
   * Ensures paths are correctly hidden or reset before animation starts.
   */
  initializeEntranceState(): void {
    super.initializeEntranceState();

    // Reset internal animation state
    this.isAnimating = false;
    this.animationProgress = 0;

    if (!this.pathGroup || this.pathElements.length === 0) return;

    const config = this.config.entrance_animation;
    if (!config) return;

    const { type } = config;
    const isTypewriter = type === 'typewriter' || (type === 'draw' && this.textConfig.strokeAnimation.mode === 'typewriter');
    const isCharFade = type === 'char_fade';

    if (isTypewriter || isCharFade) {
      this.pathElements.forEach(path => {
        path.style.opacity = '0';
        path.style.transition = 'none';
      });
    } else if (type === 'draw' || (type as any) === 'stroke') {
      this.pathElements.forEach(path => {
        const pathLength = parseFloat(path.dataset.pathLength || '0');

        // CRITICAL: Restore stroke properties if they were removed by fillPaths
        path.setAttribute('stroke', this.textConfig.strokeAnimation.strokeColor || '#000000');
        path.setAttribute('stroke-width', (this.textConfig.strokeAnimation.strokeWidth || 2).toString());

        path.setAttribute('stroke-dasharray', pathLength.toString());
        path.setAttribute('stroke-dashoffset', pathLength.toString());
        path.setAttribute('fill-opacity', this.textConfig.strokeAnimation.fillMode === 'start' ? '1' : '0');
        path.style.opacity = '1';
      });
    }
  }

  /**
   * Seek to a specific progress in the animation
   */
  seek(progress: number): void {
    // Prevent flickering by disabling transitions on the main element
    if (this.element) {
      this.element.style.transition = 'none';
    }

    // Call super to handle generic properties (opacity, transform)
    super.seek(progress);

    const config = this.config.entrance_animation;
    if (!config) return;

    // CRITICAL: For reveal-based animations (draw, typewriter, char_fade), 
    // we must ensure the layer itself is visible (opacity 1) during seek, 
    // as super.seek might set it to 'progress' (making it faint) or leave it at 0.
    // The actual reveal is handled by the specialized seek methods below.
    const type = config.type;
    const isReveal = type === 'draw' || type === 'typewriter' || type === 'char_fade' || (type as any) === 'stroke';
    if (isReveal && progress > 0) {
      this.setOpacity(this.config.opacity || 1);
    }

    // Ensure we have paths
    if (!this.pathGroup || this.pathElements.length === 0) return;

    const isTypewriter = type === 'typewriter' || (type === 'draw' && this.textConfig.strokeAnimation.mode === 'typewriter');
    const isStroke = type === 'draw' || (type as any) === 'stroke';
    const isCharFade = type === 'char_fade';

    if (isTypewriter) {
      this.seekTypewriter(progress);
    } else if (isStroke) {
      this.seekStroke(progress, config);
    } else if (isCharFade) {
      this.seekCharFade(progress);
    }
  }

  /**
   * Seek implementation for character fade animation
   */
  private seekCharFade(progress: number): void {
    const orderedPaths = this.pathElements;
    const totalPaths = orderedPaths.length;

    // Calculate current char index and partial progress
    const currentCharFloat = progress * totalPaths;
    const currentCharIndex = Math.floor(currentCharFloat);

    orderedPaths.forEach((path, index) => {
      path.style.transition = 'none';
      if (index < currentCharIndex) {
        path.style.opacity = '1';
      } else if (index === currentCharIndex) {
        const charProgress = currentCharFloat - currentCharIndex;
        path.style.opacity = charProgress.toString();
      } else {
        path.style.opacity = '0';
      }
    });
  }

  private seekTypewriter(progress: number): void {
    const orderedPaths = this.pathElements;
    const totalPaths = orderedPaths.length;

    // Calculate current char index
    const currentCharFloat = progress * totalPaths;
    const currentCharIndex = Math.min(Math.floor(currentCharFloat), totalPaths - 1);

    // Update opacities
    orderedPaths.forEach((path, index) => {
      if (index <= currentCharIndex) {
        path.style.opacity = '1';
        path.style.transition = 'none';
      } else {
        path.style.opacity = '0';
        path.style.transition = 'none';
      }
    });

    // Update hand position
    // Note: Hand canvas is cleared once at scene level, not per layer
    if (this.handOverlayManager && this.handOverlayManager.isEnabled() && this.handOverlayCanvas) {
      // Only draw hand if this layer is marked as the active layer during seek
      if (!this.getShouldDrawHandDuringSeek()) {
        return; // Skip hand drawing for non-active layers
      }

      // FIX: Show hand throughout seeking with relaxed boundaries
      // Only hide at the very edges (< 0.1% or > 99.9%)
      const HAND_SHOW_START = 0.001;
      const HAND_SHOW_END = 0.999;

      if (progress >= HAND_SHOW_START && progress <= HAND_SHOW_END) {
        const path = orderedPaths[currentCharIndex];
        if (path) {
          const bboxX = parseFloat(path.dataset.bboxX || '0');
          const bboxY = parseFloat(path.dataset.bboxY || '0');
          const bboxWidth = parseFloat(path.dataset.bboxWidth || '0');
          const bboxHeight = parseFloat(path.dataset.bboxHeight || '0');
          const centerY = bboxY + bboxHeight / 2;

          const startLocalX = bboxX;
          const startLocalY = centerY - bboxHeight * 0.15;
          const endLocalX = bboxX + bboxWidth;
          const endLocalY = centerY + bboxHeight * 0.15;

          const time = this.getTimeFromEntranceProgress(progress);
          const startGlobal = this.transformToGlobalAnimated({ x: startLocalX, y: startLocalY }, time);
          const endGlobal = this.transformToGlobalAnimated({ x: endLocalX, y: endLocalY }, time);

          const charProgress = currentCharFloat - Math.floor(currentCharFloat);
          const eased = this.easeOutQuad(charProgress);

          const handX = startGlobal.x + (endGlobal.x - startGlobal.x) * eased;
          const handY = startGlobal.y + (endGlobal.y - startGlobal.y) * eased;

          this.handOverlayManager.drawHandAt(handX, handY, this.handOverlayCanvas);
        }
      }
    }
  }

  private seekStroke(progress: number, config: AnimationConfig): void {
    // Replicate timing logic from animateStrokeWriting
    let totalDuration = config.duration !== undefined ? config.duration / 1000 : (this.textConfig.strokeAnimation.duration || 3.0);
    totalDuration = Math.max(0.3, totalDuration);
    const totalDurationMs = totalDuration * 1000;
    const settleTimeMs = totalDurationMs * SETTLE_RATIO;
    const drawingDurationMs = Math.max(100, totalDurationMs - settleTimeMs);

    const currentTimeMs = progress * totalDurationMs;

    // Note: Hand canvas is cleared once at scene level, not per layer

    // If in settle time or finished
    if (currentTimeMs >= drawingDurationMs) {
      this.pathElements.forEach(path => {
        path.style.strokeDashoffset = '0';
        path.style.opacity = '1';

        // Ensure stroke is restored if it was removed by fillPaths
        const pathLength = parseFloat(path.dataset.pathLength || '0');
        path.setAttribute('stroke', this.textConfig.strokeAnimation.strokeColor || '#000000');
        path.setAttribute('stroke-width', (this.textConfig.strokeAnimation.strokeWidth || 2).toString());
        path.setAttribute('stroke-dasharray', pathLength.toString());

        if (this.textConfig.strokeAnimation.fillMode === 'end') {
          path.setAttribute('fill-opacity', '1');
        }
      });
      // FIX: Show hand during settle time as well (not just during drawing)
      // The hand should remain visible until the very end (progress = 1.0)
      if (this.handOverlayManager && this.handOverlayCanvas && progress < 0.999) {
        // Only draw hand if this layer is marked as the active layer during seek
        if (!this.getShouldDrawHandDuringSeek()) {
          return; // Skip hand drawing for non-active layers
        }

        // Draw hand at the end of the last path
        const lastPath = this.pathElements[this.pathElements.length - 1];
        if (lastPath) {
          try {
            const pathLength = parseFloat(lastPath.dataset.pathLength || '0');
            const point = lastPath.getPointAtLength(pathLength);
            const time = this.getTimeFromEntranceProgress(progress);
            const globalPoint = this.transformToGlobalAnimated({ x: point.x, y: point.y }, time);
            this.handOverlayManager.drawHandAt(globalPoint.x, globalPoint.y, this.handOverlayCanvas);
          } catch (e) {
            // Ignore error
          }
        }
      }
      return;
    }

    // Reset fill opacity if not finished
    if (this.textConfig.strokeAnimation.fillMode === 'end') {
      this.pathElements.forEach(path => path.setAttribute('fill-opacity', '0'));
    } else if (this.textConfig.strokeAnimation.fillMode === 'start') {
      this.pathElements.forEach(path => path.setAttribute('fill-opacity', '1'));
    }

    // Calculate path timings
    const orderedPaths = this.pathElements;
    const totalPathLength = orderedPaths.reduce((sum, path) => sum + parseFloat(path.dataset.pathLength || '0'), 0);
    const drawingTimeMs = drawingDurationMs * 0.8;
    const delayTimeMs = drawingDurationMs * 0.2;
    const timePerUnit = totalPathLength > 0 ? drawingTimeMs / totalPathLength : drawingTimeMs / orderedPaths.length;
    const effectiveCharDelay = orderedPaths.length > 1 ? delayTimeMs / (orderedPaths.length - 1) : 0;

    let accumulatedTime = 0;
    let currentHandPos: { x: number, y: number } | null = null;

    let lastFinishedPath: SVGPathElement | null = null;

    for (let i = 0; i < orderedPaths.length; i++) {
      const path = orderedPaths[i];
      const pathLength = parseFloat(path.dataset.pathLength || '0');
      const pathDuration = totalPathLength > 0 ? (pathLength * timePerUnit) : (timePerUnit); // ms

      const startTime = accumulatedTime;
      const endTime = startTime + pathDuration;

      // CRITICAL: Ensure stroke is visible during seek if it was previously removed by fillPaths
      if (path.getAttribute('stroke') === 'none' || !path.getAttribute('stroke')) {
        path.setAttribute('stroke', this.textConfig.strokeAnimation.strokeColor || '#000000');
        path.setAttribute('stroke-width', (this.textConfig.strokeAnimation.strokeWidth || 2).toString());
        path.setAttribute('stroke-dasharray', pathLength.toString());
      }

      if (currentTimeMs >= endTime) {
        // Path finished
        path.style.strokeDashoffset = '0';
        path.style.opacity = '1';
        lastFinishedPath = path;

        // Update hand position to end of this path
        // This will be overwritten if a later path is active,
        // but persists if we are in a gap after this path.
        try {
          const point = path.getPointAtLength(pathLength);
          const time = this.getTimeFromEntranceProgress(progress);
          currentHandPos = this.transformToGlobalAnimated({ x: point.x, y: point.y }, time);
        } catch (e) {
          if (isDebugEnabled()) console.warn('[TextToSVGLayer] Error getting point at length:', e);
        }
      } else if (currentTimeMs < startTime) {
        // Path not started
        path.style.strokeDashoffset = pathLength.toString();
        path.style.opacity = '1';
      } else {
        // Path in progress
        const pathProgress = (currentTimeMs - startTime) / pathDuration;
        const currentDashOffset = pathLength * (1 - pathProgress);
        path.style.strokeDashoffset = currentDashOffset.toString();
        path.style.opacity = '1';

        // Hand position
        try {
          const point = path.getPointAtLength(pathLength * pathProgress);
          const time = this.getTimeFromEntranceProgress(progress);
          currentHandPos = this.transformToGlobalAnimated({ x: point.x, y: point.y }, time);
        } catch (e) {
          if (isDebugEnabled()) console.warn('[TextToSVGLayer] Error getting point at length:', e);
        }
      }

      accumulatedTime = endTime + effectiveCharDelay;
    }

    // Fallback: If we are in a gap (no active path) but have a finished path, ensure hand is at the end of it.
    // This is redundant with the loop logic above but adds safety.
    if (!currentHandPos && lastFinishedPath && progress > 0) {
      try {
        const pathLength = parseFloat(lastFinishedPath.dataset.pathLength || '0');
        const point = lastFinishedPath.getPointAtLength(pathLength);
        const time = this.getTimeFromEntranceProgress(progress);
        currentHandPos = this.transformToGlobalAnimated({ x: point.x, y: point.y }, time);
      } catch (e) {
        // Ignore
      }
    }

    // Only show hand during active animation
    // FIX: Relax boundary conditions to ensure hand is visible throughout seeking
    // Use small thresholds instead of strict 0/1 checks to account for floating point precision
    const HAND_SHOW_START = 0.001; // Show hand after 0.1% progress
    const HAND_SHOW_END = 0.999;   // Show hand until 99.9% progress

    if (currentHandPos && this.handOverlayManager && this.handOverlayCanvas && progress >= HAND_SHOW_START && progress <= HAND_SHOW_END) {
      // Only draw hand if this layer is marked as the active layer during seek
      if (!this.getShouldDrawHandDuringSeek()) {
        if (isDebugEnabled()) {
          console.log(`[TextToSVGLayer] Skipping hand draw - not active layer`);
        }
        return; // Skip hand drawing for non-active layers
      }

      if (isDebugEnabled()) {
        console.log(`[TextToSVGLayer] Drawing hand at ${currentHandPos.x.toFixed(2)}, ${currentHandPos.y.toFixed(2)} (progress: ${progress.toFixed(3)})`);
      }
      this.handOverlayManager.drawHandAt(currentHandPos.x, currentHandPos.y, this.handOverlayCanvas);
    } else {
      if (isDebugEnabled()) {
        console.log(`[TextToSVGLayer] NOT drawing hand. Pos: ${!!currentHandPos}, Manager: ${!!this.handOverlayManager}, Canvas: ${!!this.handOverlayCanvas}, Progress: ${progress.toFixed(3)}`);
      }
    }
  }



  /**
   * Animate typewriter effect - reveal filled text character by character
   * Improved for smooth, natural hand movement without lag or freezing
   */
  private async animateTypewriter(config: AnimationConfig, initialProgress: number = 0): Promise<void> {
    if (!this.pathGroup || this.pathElements.length === 0) {
      if (isDebugEnabled()) {
        console.warn('No SVG paths to animate');
      }
      return;
    }

    this.isAnimating = true;
    this.animationProgress = 0;
    const animationStartTime = performance.now();

    let totalDuration = config.duration !== undefined ? config.duration / 1000 : (this.textConfig.strokeAnimation.duration || 1.5);
    // Ensure totalDuration is at least 0.1s
    totalDuration = Math.max(0.1, totalDuration);

    if (isDebugEnabled()) {
      console.debug(`[TextToSVGLayer] animateTypewriter START: duration=${totalDuration}s, paths=${this.pathElements.length}`);
    }

    // Use exact duration without compensation
    const totalDurationMs = totalDuration * 1000;
    const settleTimeMs = totalDurationMs * SETTLE_RATIO;
    const animDurationMs = Math.max(100, totalDurationMs - settleTimeMs);

    // Use paths directly as they are already in correct order from SVG generation
    const orderedPaths = [...this.pathElements];

    // Hide all paths initially
    orderedPaths.forEach(path => {
      path.style.opacity = '0';
      path.style.transition = 'none'; // Disable transitions initially
    });

    // Pre-calculate character LOCAL positions (bounding boxes)
    // We'll transform these to global coordinates during animation using transformToGlobalAnimated
    const charPositions: Array<{ startLocalX: number; startLocalY: number; endLocalX: number; endLocalY: number; path: SVGPathElement }> = [];

    for (const path of orderedPaths) {
      const bboxX = parseFloat(path.dataset.bboxX || '0');
      const bboxY = parseFloat(path.dataset.bboxY || '0');
      const bboxWidth = parseFloat(path.dataset.bboxWidth || '0');
      const bboxHeight = parseFloat(path.dataset.bboxHeight || '0');

      if (isDebugEnabled() && charPositions.length === 0) {
        console.log('[TextToSVGLayer] First character bbox:', {
          bboxX, bboxY, bboxWidth, bboxHeight,
          datasets: path.dataset
        });
      }

      const centerY = bboxY + bboxHeight / 2;

      const startLocalX = bboxX;
      const startLocalY = centerY - bboxHeight * 0.15;
      const endLocalX = bboxX + bboxWidth;
      const endLocalY = centerY + bboxHeight * 0.15;

      charPositions.push({
        startLocalX,
        startLocalY,
        endLocalX,
        endLocalY,
        path
      });
    }

    // Use continuous animation for smooth, natural movement
    const handManager = this.handOverlayManager;

    let startTime: number | null = null;
    let totalPausedTime = 0;

    return new Promise<void>((resolve) => {
      const animate = async (currentTime: number) => {
        if (this.isStopped) {
          resolve();
          return;
        }

        const wasPaused = this.isPaused;
        const pauseStart = wasPaused ? performance.now() : 0;
        await this.checkPlaybackState();
        if (wasPaused) {
          const pauseDuration = performance.now() - pauseStart;
          totalPausedTime += pauseDuration;
        }

        if (startTime === null) {
          startTime = currentTime;
          if (initialProgress > 0) {
            startTime -= (animDurationMs * initialProgress);
          }
        }
        const elapsed = currentTime - startTime - totalPausedTime;
        const overallProgress = Math.min(elapsed / animDurationMs, 1);

        // Calculate which character we're currently on
        // We use orderedPaths.length - 0.0001 to ensure we don't exceed the last index at exactly progress=1
        const currentCharFloat = overallProgress * (orderedPaths.length);
        const currentCharIndex = Math.min(Math.floor(currentCharFloat), orderedPaths.length - 1);

        // charProgress should be 1.0 for the last character when overallProgress is 1.0
        let charProgress: number;
        if (overallProgress >= 1.0) {
          charProgress = 1.0;
        } else {
          charProgress = currentCharFloat - Math.floor(currentCharFloat);
        }

        // Reveal characters up to current index
        for (let i = 0; i <= currentCharIndex && i < orderedPaths.length; i++) {
          const path = orderedPaths[i];
          if (path.style.opacity === '0') {
            // Fade in smoothly
            path.style.transition = 'opacity 0.1s ease-out';
            path.style.opacity = '1';
          }
        }

        // Smooth hand movement with continuous interpolation
        if (handManager && handManager.isEnabled()) {
          if (isDebugEnabled()) {
            console.log(`[TextToSVGLayer] Hand manager enabled, currentCharIndex: ${currentCharIndex}/${charPositions.length}`);
          }
          let handX: number;
          let handY: number;

          if (currentCharIndex < charPositions.length) {
            const currentPos = charPositions[currentCharIndex];

            if (currentPos) {
              // Use ease-out for more natural writing motion
              const eased = this.easeOutQuad(charProgress);

              // Interpolate across the current character's width in LOCAL coordinates
              const localX = currentPos.startLocalX + (currentPos.endLocalX - currentPos.startLocalX) * eased;
              const localY = currentPos.startLocalY + (currentPos.endLocalY - currentPos.startLocalY) * eased;

              // Calculate the time parameter for animated transform (matches entrance animation time)
              const animTime = this.getTimeFromEntranceProgress(overallProgress);

              // Transform to GLOBAL coordinates using animated transform
              // This ensures hand follows layer position/scale/rotation animations
              const globalPos = this.transformToGlobalAnimated({ x: localX, y: localY }, animTime);
              handX = globalPos.x;
              handY = globalPos.y;

              // DEBUG: Log detailed position info for first character
              if (isDebugEnabled() && currentCharIndex === 0 && charProgress < 0.2) {
                console.log('[TextToSVGLayer] Hand position DEBUG:', {
                  layerPosition: this.config.position,
                  layerScale: this.config.scale,
                  layerDimensions: { width: this.config.width, height: this.config.height },
                  isCentered: this.isCentered(),
                  currentChar: currentCharIndex,
                  bboxData: {
                    x: currentPos.path.dataset.bboxX,
                    y: currentPos.path.dataset.bboxY,
                    width: currentPos.path.dataset.bboxWidth,
                    height: currentPos.path.dataset.bboxHeight
                  },
                  localPosBeforeOffset: {
                    x: (currentPos.startLocalX + (currentPos.endLocalX - currentPos.startLocalX) * eased).toFixed(2),
                    y: (currentPos.startLocalY + (currentPos.endLocalY - currentPos.startLocalY) * eased).toFixed(2)
                  },
                  localPosAfterOffset: { x: localX.toFixed(2), y: localY.toFixed(2) },
                  globalPos: { x: handX.toFixed(2), y: handY.toFixed(2) },
                  handOffset: typeof this.config.handOverlay === 'object' ? this.config.handOverlay.offset : undefined
                });
              }

              // Add subtle vertical bounce to simulate natural hand writing motion
              const bounceFrequency = Math.max(0.5, 3.0 * (3.0 / totalDuration));
              const bounceAmplitude = 2.0; // Vertical movement in pixels
              const bounceOffset = Math.sin(elapsed / 1000 * bounceFrequency * Math.PI * 2) * bounceAmplitude;
              handY += bounceOffset;

              if (isDebugEnabled() && Math.random() < 0.02) {
                console.log(`[TextToSVGLayer] Updating hand position: local(${localX.toFixed(1)}, ${localY.toFixed(1)}) -> global(${handX.toFixed(1)}, ${handY.toFixed(1)})`);
              }

              // Update hand with smooth position
              handManager.updateHandPosition(overallProgress, {
                currentCharPosition: { x: handX, y: handY }
              }, this.handOverlayCanvas || undefined);
            }
          }
        } else if (isDebugEnabled() && Math.random() < 0.1) {
          console.log(`[TextToSVGLayer] Hand not visible - manager: ${!!handManager}, enabled: ${handManager?.isEnabled()}, canvas: ${!!this.handOverlayCanvas}`);
        }

        this.animationProgress = overallProgress;

        if (overallProgress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Ensure ALL characters are visible at the end
          orderedPaths.forEach(path => path.style.opacity = '1');

          // Animation complete
          this.isAnimating = false;
          this.animationProgress = 1;

          // Final Micro-Adjustment: Busy-wait for absolute precision
          await completeTimingPrecision(animationStartTime, totalDurationMs, (s) => this.wait(s));

          const actualDuration = performance.now() - animationStartTime;

          if (isDebugEnabled()) {
            console.debug(`[TextToSVGLayer] animateTypewriter END: actualDuration=${actualDuration.toFixed(2)}ms`);
          }

          logTimingResult('TextToSVGLayer', this.config.id, 'typewriter', actualDuration, totalDurationMs);

          // Hide hand after settle time
          if (handManager && handManager.isEnabled() && this.handOverlayCanvas) {
            handManager.hideHand(this.handOverlayCanvas!);
          }
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  /**
   * Ease-out quadratic function for natural deceleration
   */
  private easeOutQuad(t: number): number {
    return t * (2 - t);
  }

  /**
   * Animate character fade effect - reveal filled text character by character with opacity
   */
  private async animateCharFade(config: AnimationConfig, initialProgress: number = 0): Promise<void> {
    if (!this.pathGroup || this.pathElements.length === 0) {
      return;
    }

    this.isAnimating = true;
    this.animationProgress = 0;

    let totalDuration = config.duration !== undefined ? config.duration / 1000 : (this.textConfig.strokeAnimation.duration || 1.5);
    totalDuration = Math.max(0.3, totalDuration);

    // Use exact duration without compensation
    const totalDurationMs = totalDuration * 1000;
    const settleTimeMs = totalDurationMs * SETTLE_RATIO;
    const animDurationMs = Math.max(100, totalDurationMs - settleTimeMs);

    // Use paths directly as they are already in correct order from SVG generation
    const orderedPaths = [...this.pathElements];

    // Hide all paths initially
    orderedPaths.forEach(path => {
      path.style.opacity = '0';
    });

    let startTime: number | null = null;
    let totalPausedTime = 0;

    return new Promise<void>((resolve) => {
      const animate = async (currentTime: number) => {
        if (this.isStopped) {
          resolve();
          return;
        }

        const wasPaused = this.isPaused;
        const pauseStart = wasPaused ? performance.now() : 0;
        await this.checkPlaybackState();
        if (wasPaused) {
          const pauseDuration = performance.now() - pauseStart;
          totalPausedTime += pauseDuration;
        }

        if (startTime === null) {
          startTime = currentTime;
          if (initialProgress > 0) {
            startTime -= (animDurationMs * initialProgress);
          }
        }
        const elapsed = currentTime - startTime - totalPausedTime;
        const overallProgress = Math.min(elapsed / animDurationMs, 1);

        // Calculate which character we're currently on
        const currentCharFloat = overallProgress * orderedPaths.length;
        const currentCharIndex = Math.floor(currentCharFloat);

        // Reveal all characters up to the current index
        for (let i = 0; i < orderedPaths.length; i++) {
          if (i < currentCharIndex) {
            orderedPaths[i].style.opacity = '1';
          } else if (i === currentCharIndex) {
            // Fade in the current character
            const charProgress = currentCharFloat - currentCharIndex;
            orderedPaths[i].style.opacity = charProgress.toString();
          } else {
            orderedPaths[i].style.opacity = '0';
          }
        }

        this.animationProgress = overallProgress;

        if (overallProgress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Ensure all are visible at the end
          orderedPaths.forEach(p => p.style.opacity = '1');

          // Final Micro-Adjustment: Busy-wait for absolute precision
          await completeTimingPrecision(startTime!, totalDurationMs, (s) => this.wait(s));

          this.isAnimating = false;
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  /**
   * Animate stroke writing from left to right with smooth transitions
   */
  private async animateStrokeWriting(config: AnimationConfig, initialProgress: number = 0): Promise<void> {
    if (!this.pathGroup || this.pathElements.length === 0) {
      if (isDebugEnabled()) {
        console.warn('No SVG paths to animate');
      }
      return;
    }

    this.isAnimating = true;
    this.animationProgress = initialProgress;

    // Normalize duration: config.duration is in MS, while internal config is in seconds.
    let totalDuration = config.duration !== undefined ? config.duration / 1000 : (this.textConfig.strokeAnimation.duration || 3.0);
    totalDuration = Math.max(0.3, totalDuration); // Ensure enough time for settle

    // Use exact duration without compensation
    const totalDurationMs = totalDuration * 1000;
    const settleTimeMs = totalDurationMs * SETTLE_RATIO;
    const drawingDurationMs = Math.max(100, totalDurationMs - settleTimeMs);

    // CRITICAL: Adjust animationStartTime if we are resuming from a specific progress
    // This ensures completeTimingPrecision and other timing calculations are correct.
    const animationStartTime = performance.now() - (initialProgress * totalDurationMs);

    // Use paths directly as they are already in correct order from SVG generation
    const orderedPaths = [...this.pathElements];

    // OPTIMIZATION: Adaptive timing based on path complexity
    // Calculate total path length to distribute time proportionally
    // This ensures custom fonts with complex paths get appropriate time
    const totalPathLength = orderedPaths.reduce((sum, path) => {
      const pathLength = parseFloat(path.dataset.pathLength || '0');
      // Reset path state for replay
      path.setAttribute('stroke-dasharray', pathLength.toString());
      path.setAttribute('stroke-dashoffset', pathLength.toString());
      path.setAttribute('fill-opacity', this.textConfig.strokeAnimation.fillMode === 'start' ? '1' : '0');
      path.style.opacity = '1';
      return sum + pathLength;
    }, 0);

    // Allocate 80% of time for drawing, 20% for character delays
    const drawingTimeMs = drawingDurationMs * 0.8;
    const delayTimeMs = drawingDurationMs * 0.2;

    // Calculate per-path duration based on its complexity (path length)
    // Each path gets time proportional to its length
    const timePerUnit = totalPathLength > 0 ? drawingTimeMs / totalPathLength : drawingTimeMs / orderedPaths.length;

    // Character delay time distributed among transitions
    const effectiveCharDelay = orderedPaths.length > 1
      ? (delayTimeMs / (orderedPaths.length - 1)) / 1000
      : 0;

    if (isDebugEnabled()) {
      console.debug(`[TextToSVGLayer] Adaptive timing: totalPathLength=${totalPathLength.toFixed(2)}, ` +
        `paths=${orderedPaths.length}, timePerUnit=${timePerUnit.toFixed(2)}ms, ` +
        `charDelay=${(effectiveCharDelay * 1000).toFixed(2)}ms`);
    }

    const easingFunc = config.easing || 'linear';
    const globalTargetTimeMs = initialProgress * totalDurationMs;
    let cumulativeTimeMs = 0;

    try {
      for (let i = 0; i < orderedPaths.length; i++) {
        const path = orderedPaths[i];
        const pathLength = parseFloat(path.dataset.pathLength || '0');

        if (pathLength === 0) continue;

        // Calculate adaptive duration for this specific path based on its complexity
        const pathDurationMs = totalPathLength > 0
          ? (pathLength * timePerUnit)
          : timePerUnit;
        const pathDuration = pathDurationMs / 1000;

        // Calculate initial progress for THIS path
        let pathInitialProgress = 0;
        if (globalTargetTimeMs > cumulativeTimeMs + pathDurationMs) {
          pathInitialProgress = 1;
        } else if (globalTargetTimeMs > cumulativeTimeMs) {
          pathInitialProgress = (globalTargetTimeMs - cumulativeTimeMs) / pathDurationMs;
        }

        // Animate this path if not fully drawn
        if (pathInitialProgress < 1) {
          await this.animatePath(path, pathLength, pathDuration, easingFunc, i, orderedPaths.length, pathInitialProgress);
        } else {
          // Ensure it's fully drawn
          path.setAttribute('stroke-dashoffset', '0');
          path.style.opacity = '1';
        }

        cumulativeTimeMs += pathDurationMs;

        // Smooth transition delay before starting next character
        if (i < orderedPaths.length - 1 && effectiveCharDelay > 0) {
          const delayMs = effectiveCharDelay * 1000;

          // Check if we should skip or shorten the delay
          if (globalTargetTimeMs > cumulativeTimeMs + delayMs) {
            // Skip delay
          } else if (globalTargetTimeMs > cumulativeTimeMs) {
            // Shorten delay
            const remainingDelay = (cumulativeTimeMs + delayMs - globalTargetTimeMs) / 1000;
            await this.wait(remainingDelay);
          } else {
            // Normal delay
            await this.wait(effectiveCharDelay);
          }

          cumulativeTimeMs += delayMs;
        }
      }
    } finally {
      // Fill the paths with final color if configured to fill at end
      if (!this.isStopped && this.textConfig.strokeAnimation.fillMode === 'end') {
        this.fillPaths();
      }

      // Final Micro-Adjustment: Busy-wait for absolute precision
      await completeTimingPrecision(animationStartTime, totalDurationMs, (s) => this.wait(s));
    }

    // Hide hand after animation completes
    if (this.handOverlayManager && this.handOverlayManager.isEnabled() && this.handOverlayCanvas) {
      this.handOverlayManager.hideHand(this.handOverlayCanvas);
    }

    this.isAnimating = false;
    this.animationProgress = 1;

    const actualDuration = performance.now() - animationStartTime;
    logTimingResult('TextToSVGLayer', this.config.id, 'stroke', actualDuration, totalDurationMs);
  }


  /**
   * Animate a single path's stroke with smooth hand movement
   * OPTIMIZATION: Uses adaptive smoothing based on velocity
   */
  private async animatePath(
    path: SVGPathElement,
    pathLength: number,
    duration: number,
    easing: string,
    pathIndex: number = 0,
    totalPaths: number = 1,
    initialProgress: number = 0
  ): Promise<void> {
    return new Promise((resolve) => {
      let startTime: number | null = null;
      let totalPausedTime = 0;
      // const smoother = new AdaptiveSmoother(0.3, 0.01); // base smoothing, velocity sensitivity

      const animate = async (currentTime: number) => {
        if (this.isStopped) {
          resolve(); // Resolve even if stopped to allow cleanup
          return;
        }

        const wasPaused = this.isPaused;
        const pauseStart = wasPaused ? performance.now() : 0;
        await this.checkPlaybackState();
        if (wasPaused) {
          const pauseDuration = performance.now() - pauseStart;
          totalPausedTime += pauseDuration;
        }

        if (startTime === null) {
          startTime = currentTime;
          if (initialProgress > 0) {
            startTime -= (duration * 1000 * initialProgress);
          }
        }
        const elapsed = (currentTime - startTime - totalPausedTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = this.applyEasing(progress, easing);

        // Update stroke dash offset to reveal path progressively
        const offset = pathLength * (1 - easedProgress);
        path.setAttribute('stroke-dashoffset', offset.toString());

        // Update hand overlay position during stroke animation with adaptive smoothing
        if (this.handOverlayManager && this.handOverlayManager.isEnabled()) {
          const currentLength = easedProgress * pathLength;
          const point = path.getPointAtLength(currentLength);

          // Get next point for direction calculation
          let nextPoint = point;
          if (easedProgress < 1.0) {
            const nextLength = Math.min(currentLength + 5, pathLength);
            nextPoint = path.getPointAtLength(nextLength);
          }

          // Transform to global coordinates using the centralized transformToGlobal
          const globalPoint = this.transformToGlobal({ x: point.x, y: point.y });
          const globalNextPoint = this.transformToGlobal({ x: nextPoint.x, y: nextPoint.y });

          // OPTIMIZATION: Apply adaptive smoothing based on velocity
          // const smoothed = smoother.smooth(globalPoint, currentTime);
          const smoothed = globalPoint;

          // Add subtle vertical bounce to simulate natural hand writing motion
          const bounceFrequency = Math.max(0.5, 4.0 * (3.0 / duration));
          const bounceAmplitude = 1.5;
          const timeInSeconds = (currentTime - startTime) / 1000;
          const bounceOffset = Math.sin(timeInSeconds * bounceFrequency * Math.PI * 2) * bounceAmplitude;

          // Calculate overall progress across all paths
          const overallProgress = (pathIndex + easedProgress) / totalPaths;

          this.handOverlayManager.updateHandPosition(overallProgress, {
            currentPoint: { x: smoothed.x, y: smoothed.y + bounceOffset },
            nextPoint: globalNextPoint,
            pathElement: path
          }, this.handOverlayCanvas || undefined);
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  /**
   * Fill all paths with final color
   */
  private fillPaths(): void {
    if (!this.pathGroup) return;

    this.pathElements.forEach(path => {
      path.setAttribute('fill-opacity', '1');
      path.setAttribute('stroke', 'none');
      path.removeAttribute('stroke-dasharray');
      path.removeAttribute('stroke-dashoffset');
    });
  }


  /**
   * Update text content and regenerate SVG
   */
  async setText(text: string): Promise<void> {
    this.textConfig.text = text;

    // Update text element synchronously for immediate feedback in editing mode
    if (this.textElement) {
      this.textElement.textContent = text;
      // Handle multi-line
      if (text.includes('\n')) {
        this.textElement.textContent = '';
        const lines = text.split('\n');
        lines.forEach((line, i) => {
          const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
          tspan.textContent = line;
          tspan.setAttribute('x', '0');
          tspan.setAttribute('dy', i === 0 ? '0' : `${this.textConfig.lineHeight}em`);
          this.textElement!.appendChild(tspan);
        });
      }
    }

    // Regenerate paths asynchronously
    await this.generateSVG();

    // Hide hand instantly
    if (this.handOverlayManager && this.handOverlayManager.isEnabled() && this.handOverlayCanvas) {
      this.handOverlayManager.hideHand(this.handOverlayCanvas);
    }
    this.updateSVGContent();
  }

  /**
   * Set editing mode
   * @param editing Whether to enable editing mode (shows standard text, hides paths)
   */
  setEditing(editing: boolean): void {
    this.isEditing = editing;
    if (this.pathGroup && this.editingGroup) {
      this.pathGroup.style.display = editing ? 'none' : 'block';
      this.editingGroup.style.display = editing ? 'block' : 'none';

      if (editing) {
        // Ensure text is visible when editing starts
        this.setOpacity(this.config.opacity || 1);
      }
    }
  }

  /**
   * Check if currently in editing mode
   */
  getIsEditing(): boolean {
    return this.isEditing;
  }

  /**
   * Update font size and regenerate SVG
   */
  async setFontSize(size: number): Promise<void> {
    this.textConfig.fontSize = size;
    await this.generateSVG();
    this.updateSVGContent();
  }

  /**
   * Update font family/variant and regenerate SVG
   */
  async setFontFamily(family: string, variant: string = 'regular'): Promise<void> {
    this.textConfig.fontFamily = family;
    this.textConfig.fontVariant = variant;
    await this.generateSVG();
    this.updateSVGContent();
  }

  /**
   * Update text color
   * Optimized to update existing paths directly if possible
   */
  setColor(color: string): void {
    this.textConfig.color = color;
    if (this.pathGroup) {
      this.pathGroup.dataset.finalColor = color;
      this.pathElements.forEach(path => {
        path.setAttribute('fill', color);
      });
    }
    if (this.textElement) {
      this.textElement.setAttribute('fill', color);
    }
  }

  /**
   * Update text alignment and regenerate SVG
   */
  async setAlign(align: 'left' | 'center' | 'right'): Promise<void> {
    this.textConfig.align = align;
    await this.generateSVG();
    this.updateSVGContent();
  }

  /**
   * Update multiple text configuration properties at once
   */
  async updateTextConfig(config: Partial<TextLayerConfig>): Promise<void> {
    let needsRegeneration = false;

    if (config.text !== undefined) {
      this.textConfig.text = config.text;
      needsRegeneration = true;
    }
    if (config.fontSize !== undefined) {
      this.textConfig.fontSize = config.fontSize;
      needsRegeneration = true;
    }
    if (config.fontFamily !== undefined) {
      this.textConfig.fontFamily = config.fontFamily;
      needsRegeneration = true;
    }
    if (config.fontVariant !== undefined) {
      this.textConfig.fontVariant = config.fontVariant;
      needsRegeneration = true;
    }
    if (config.align !== undefined) {
      this.textConfig.align = config.align;
      needsRegeneration = true;
    }
    if (config.direction !== undefined) {
      this.textConfig.direction = config.direction;
      needsRegeneration = true;
    }
    if (config.lineHeight !== undefined) {
      this.textConfig.lineHeight = config.lineHeight;
      needsRegeneration = true;
    }
    if (config.letterSpacing !== undefined) {
      this.textConfig.letterSpacing = config.letterSpacing;
      needsRegeneration = true;
    }

    if (config.color !== undefined) {
      this.setColor(config.color);
    }

    if (needsRegeneration) {
      await this.generateSVG();
      this.updateSVGContent();
    }
  }

  /**
   * Get animation state
   */
  getAnimationState(): { isAnimating: boolean; progress: number } {
    return {
      isAnimating: this.isAnimating,
      progress: this.animationProgress,
    };
  }

  /**
   * Get the hand position at a specific animation progress (0-1).
   * Useful for static debugging or manual positioning.
   * @param progress Animation progress (0-1)
   * @param global If true (default), returns coordinates relative to the SVG root (using CTM). If false, returns coordinates relative to the layer.
   */
  getHandPositionAtProgress(progress: number, global: boolean = true): { x: number; y: number; rotation: number } | null {
    if (!this.pathGroup || this.pathElements.length === 0) {
      return null;
    }

    // Ensure progress is within bounds
    const clampedProgress = Math.max(0, Math.min(1, progress));

    // Use paths directly as they are already in correct order from SVG generation
    const orderedPaths = [...this.pathElements];

    const numPaths = orderedPaths.length;
    const configDuration = this.textConfig.strokeAnimation.duration || 3.0;
    const charDelay = configDuration / numPaths;

    const effectiveCharDelay = charDelay * 0.2;
    const pathDuration = charDelay * 0.8;

    const actualTotalDuration = (numPaths * pathDuration) + ((numPaths - 1) * effectiveCharDelay);
    const currentTime = clampedProgress * actualTotalDuration;

    let activePathIndex = -1;
    let localPathProgress = 0;

    for (let i = 0; i < numPaths; i++) {
      const pathStartTime = i * (pathDuration + effectiveCharDelay);
      const pathEndTime = pathStartTime + pathDuration;

      if (currentTime >= pathStartTime && currentTime <= pathEndTime) {
        activePathIndex = i;
        localPathProgress = (currentTime - pathStartTime) / pathDuration;
        break;
      } else if (currentTime < pathStartTime) {
        if (i > 0) {
          activePathIndex = i - 1;
          localPathProgress = 1.0;
        } else {
          activePathIndex = 0;
          localPathProgress = 0.0;
        }
        break;
      }
    }

    if (activePathIndex === -1) {
      activePathIndex = numPaths - 1;
      localPathProgress = 1.0;
    }

    const path = orderedPaths[activePathIndex];

    // Check animation mode
    if (this.textConfig.strokeAnimation.mode === 'typewriter') {
      // Typewriter mode: position at the right edge of the character
      const bboxX = parseFloat(path.dataset.bboxX || '0');
      const bboxWidth = parseFloat(path.dataset.bboxWidth || '0');
      const centerY = parseFloat(path.dataset.centerY || '0');

      // We could interpolate from left to right of the char based on localPathProgress
      // But animateTypewriter jumps to the end.
      // Let's interpolate to make it smoother for the slider
      const targetX = bboxX + (bboxWidth * localPathProgress);
      const targetY = centerY;

      const point = { x: targetX, y: targetY };
      const rotation = 0;

      if (!global) {
        return { x: point.x, y: point.y, rotation };
      }

      // Apply CTM
      try {
        const ctm = path.getCTM();
        if (ctm) {
          const x = point.x * ctm.a + point.y * ctm.c + ctm.e;
          const y = point.x * ctm.b + point.y * ctm.d + ctm.f;
          return { x, y, rotation };
        }
      } catch (e) {
        // Fallback below
      }

      // Fallback manual transform
      const layerX = this.config.position?.x || 0;
      const layerY = this.config.position?.y || 0;
      const layerScale = this.config.scale || 1;
      const layerRotation = this.config.rotation || 0;

      const transformInfo = this.getSVGTransformInfo();
      let { x, y } = point;

      if (transformInfo) {
        x = (x + transformInfo.translateX) * transformInfo.scale;
        y = (y + transformInfo.translateY) * transformInfo.scale;
      } else {
        x += this.offsetX;
        y += this.offsetY;
      }

      // Account for centering
      if (this.isCentered()) {
        x -= (this.config.width || 0) / 2;
        y -= (this.config.height || 0) / 2;
      }

      let tx = x * layerScale;
      let ty = y * layerScale;

      if (layerRotation !== 0) {
        const rad = layerRotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rx = tx * cos - ty * sin;
        const ry = tx * sin + ty * cos;
        tx = rx;
        ty = ry;
      }

      tx += layerX;
      ty += layerY;
      return { x: tx, y: ty, rotation };
    }

    // Stroke mode
    const pathLength = parseFloat(path.dataset.pathLength || '0');

    if (pathLength === 0) return null;

    const currentLength = localPathProgress * pathLength;
    const point = path.getPointAtLength(currentLength);

    let rotation = 0;
    let p1 = point;
    let p2: DOMPoint;

    if (localPathProgress < 1.0) {
      const nextLength = Math.min(currentLength + 1, pathLength);
      p2 = path.getPointAtLength(nextLength);
    } else {
      p2 = p1;
      const prevLength = Math.max(0, currentLength - 1);
      p1 = path.getPointAtLength(prevLength);
    }

    // If local coordinates are requested
    if (!global) {
      rotation = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      return { x: point.x, y: point.y, rotation };
    }

    // Apply layer transform to the point using getCTM()
    // This handles all nested transforms (layer, scene, etc.) up to the SVG root
    try {
      const ctm = path.getCTM();
      if (ctm) {
        // Transform point
        const x = point.x * ctm.a + point.y * ctm.c + ctm.e;
        const y = point.x * ctm.b + point.y * ctm.d + ctm.f;

        // Transform rotation
        // We need to transform the vector (nextPoint - point) to get the new rotation
        // Vectors are transformed by the linear part of the matrix (ignoring translation e, f)
        // But simpler is to transform both points and calculate angle

        // We already have transformed current point (x, y)
        // Let's transform a slightly ahead point to get rotation
        // We need a point ahead in the path direction
        // If we are at the end, we look back

        let p1 = point;
        let p2: DOMPoint;

        if (localPathProgress < 1.0) {
          const nextLength = Math.min(currentLength + 1, pathLength);
          p2 = path.getPointAtLength(nextLength);
        } else {
          // At end, look back
          p2 = p1;
          const prevLength = Math.max(0, currentLength - 1);
          p1 = path.getPointAtLength(prevLength);
        }

        const p1x = p1.x * ctm.a + p1.y * ctm.c + ctm.e;
        const p1y = p1.x * ctm.b + p1.y * ctm.d + ctm.f;

        const p2x = p2.x * ctm.a + p2.y * ctm.c + ctm.e;
        const p2y = p2.x * ctm.b + p2.y * ctm.d + ctm.f;

        rotation = Math.atan2(p2y - p1y, p2x - p1x);

        // If we looked back, the vector p1->p2 is correct (prev -> current)
        // If we looked forward, p1->p2 is correct (current -> next)

        return { x, y, rotation };
      }
    } catch (e) {
      console.warn('Failed to get CTM for path, falling back to simple calculation', e);
    }

    // Fallback if CTM fails (e.g. not in DOM)
    // Apply layer transform manually (simplified)
    const layerX = this.config.position?.x || 0;
    const layerY = this.config.position?.y || 0;
    const layerScale = this.config.scale || 1;
    const layerRotation = this.config.rotation || 0;

    const transformInfo = this.getSVGTransformInfo();
    let { x, y } = point;

    if (transformInfo) {
      x = (x + transformInfo.translateX) * transformInfo.scale;
      y = (y + transformInfo.translateY) * transformInfo.scale;
    } else {
      x += this.offsetX;
      y += this.offsetY;
    }

    // Account for centering
    if (this.isCentered()) {
      x -= (this.config.width || 0) / 2;
      y -= (this.config.height || 0) / 2;
    }

    let tx = x * layerScale;
    let ty = y * layerScale;

    if (layerRotation !== 0) {
      const rad = layerRotation * Math.PI / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const rx = tx * cos - ty * sin;
      const ry = tx * sin + ty * cos;
      tx = rx;
      ty = ry;
    }

    tx += layerX;
    ty += layerY;

    return { x: tx, y: ty, rotation };
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Clear path elements array to release references
    this.pathElements.length = 0;
    this.pathGroup = null;
    this.editingGroup = null;
    this.textElement = null;
    this.element = null;

    // Note: BBoxCalculator cleanup is handled globally, not per-layer
    // since it's a shared singleton resource
  }

  /**
   * Get layer type for hand overlay strategy selection
   * Note: This method may be called during parent constructor before textConfig is initialized,
   * so we use the original config directly which is available in Layer.config.
   */
  protected getLayerType(): string {
    // Check textConfig if available, otherwise fall back to original config
    // This is needed because getLayerType() is called during parent constructor
    // before textConfig is initialized in the child constructor
    const mode = this.textConfig?.strokeAnimation?.mode ||
      (this.config as TextLayerConfig)?.strokeAnimation?.mode;

    if (mode === 'typewriter') {
      return 'text';
    }
    // Return 'writing' to use PathDrawingHandStrategy which respects currentPoint
    return 'writing';
  }
}

/**
 * Factory function to create a TextToSVGLayer easily
 */
export function createTextLayer(config: {
  text: string;
  position?: { x: number; y: number };
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  direction?: 'ltr' | 'rtl' | 'ttb';
  strokeAnimation?: TextLayerConfig['strokeAnimation'];
  entrance_animation?: LayerConfig['entrance_animation'];
}): TextLayer {
  const layerId = `text_svg_layer_${++layerIdCounter}`;

  const layerConfig: TextLayerConfig = {
    id: layerId,
    position: config.position || { x: 0, y: 0 },
    text: config.text,
    fontFamily: config.fontFamily,
    fontSize: config.fontSize,
    color: config.color,
    direction: config.direction,
    strokeAnimation: config.strokeAnimation,
    entrance_animation: config.entrance_animation,
  };

  return new TextLayer(layerConfig);
}

export default TextLayer;
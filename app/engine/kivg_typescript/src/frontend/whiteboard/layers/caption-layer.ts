/**
 * CaptionLayer - A layer for displaying subtitle/caption text
 * 
 * This layer provides caption rendering with customizable styling including:
 * - Font configuration (family, size, weight, color)
 * - Background with opacity and border radius
 * - Text stroke and shadow effects
 * - Text alignment and wrapping
 * - Integration with entrance/exit animations
 */

import { LoadableLayer } from './loadable-layer';
import { LayerConfig, WhiteboardConfig, CaptionLayerConfig } from '../types';

/**
 * Default configuration values for captions
 */
const DEFAULT_FONT_SIZE = 32;
const DEFAULT_FONT_FAMILY = 'Arial, sans-serif';
const DEFAULT_COLOR = '#ffffff';
const DEFAULT_BACKGROUND_COLOR = '#000000';
const DEFAULT_BACKGROUND_OPACITY = 0.8;
const DEFAULT_PADDING = 16;
const DEFAULT_MAX_WIDTH = 800;
const DEFAULT_LINE_HEIGHT = 1.3;
const DEFAULT_TEXT_ALIGN = 'center';

/**
 * CaptionLayer - Renders caption text with customizable styling
 * Extends LoadableLayer for automatic loading indicators
 */
export class CaptionLayer extends LoadableLayer {
  private captionConfig: CaptionLayerConfig;
  private textElement: SVGTextElement | null = null;
  private backgroundRect: SVGRectElement | null = null;
  private containerGroup: SVGGElement | null = null;

  constructor(config: CaptionLayerConfig, handsConfig?: WhiteboardConfig['hands']) {
    super(config, handsConfig);
    this.captionConfig = config;
  }

  render(): SVGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // Extract configuration with defaults
    const text = this.captionConfig.text || '';
    const fontSize = this.captionConfig.fontSize || DEFAULT_FONT_SIZE;
    const fontFamily = this.captionConfig.fontFamily || DEFAULT_FONT_FAMILY;
    const fontWeight = this.captionConfig.fontWeight || 'normal';
    const color = this.captionConfig.color || DEFAULT_COLOR;
    const backgroundColor = this.captionConfig.backgroundColor;
    const backgroundOpacity = this.captionConfig.backgroundOpacity ?? DEFAULT_BACKGROUND_OPACITY;
    const padding = this.captionConfig.padding ?? DEFAULT_PADDING;
    const maxWidth = this.captionConfig.maxWidth || DEFAULT_MAX_WIDTH;
    const lineHeight = this.captionConfig.lineHeight || DEFAULT_LINE_HEIGHT;
    const textAlign = this.captionConfig.textAlign || DEFAULT_TEXT_ALIGN;
    const borderRadius = this.captionConfig.borderRadius || 0;
    const stroke = this.captionConfig.stroke;
    const shadow = this.captionConfig.shadow;

    // Create container group for background and text
    this.containerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    // Split text into lines based on maxWidth (simple word wrapping)
    const lines = this.wrapText(text, maxWidth, fontSize, fontFamily);
    const lineHeightPx = fontSize * lineHeight;
    const totalHeight = lines.length * lineHeightPx;

    // Create background rectangle if backgroundColor is specified
    if (backgroundColor) {
      this.backgroundRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');

      // Calculate background dimensions
      const bgWidth = maxWidth + (padding * 2);
      const bgHeight = totalHeight + (padding * 2);

      this.backgroundRect.setAttribute('x', (-bgWidth / 2).toString());
      this.backgroundRect.setAttribute('y', (-bgHeight / 2).toString());
      this.backgroundRect.setAttribute('width', bgWidth.toString());
      this.backgroundRect.setAttribute('height', bgHeight.toString());
      this.backgroundRect.setAttribute('fill', backgroundColor);
      this.backgroundRect.setAttribute('opacity', backgroundOpacity.toString());

      if (borderRadius > 0) {
        this.backgroundRect.setAttribute('rx', borderRadius.toString());
        this.backgroundRect.setAttribute('ry', borderRadius.toString());
      }

      this.containerGroup.appendChild(this.backgroundRect);
    }

    // Create text element with multiple tspan elements for each line
    this.textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    this.textElement.setAttribute('font-family', fontFamily);
    this.textElement.setAttribute('font-size', fontSize.toString());
    this.textElement.setAttribute('font-weight', fontWeight);
    this.textElement.setAttribute('fill', color);
    this.textElement.setAttribute('text-anchor', this.getTextAnchor(textAlign));

    // Apply stroke if configured
    if (stroke) {
      this.textElement.setAttribute('stroke', stroke.color);
      this.textElement.setAttribute('stroke-width', stroke.width.toString());
      this.textElement.setAttribute('paint-order', 'stroke fill');
    }

    // Apply shadow if configured
    if (shadow) {
      const filterId = `caption-shadow-${this.config.id}`;
      const filter = this.createShadowFilter(filterId, shadow);
      g.appendChild(filter);
      this.textElement.setAttribute('filter', `url(#${filterId})`);
    }

    // Add each line as a tspan
    const startY = -(totalHeight / 2) + (fontSize * 0.8); // Adjust for text baseline
    lines.forEach((line, index) => {
      const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      tspan.textContent = line;
      tspan.setAttribute('x', '0');
      tspan.setAttribute('y', (startY + index * lineHeightPx).toString());
      this.textElement!.appendChild(tspan);
    });

    this.containerGroup.appendChild(this.textElement);
    g.appendChild(this.containerGroup);

    this.element = g;
    this.applyTransform();
    return g;
  }

  /**
   * Prepare the caption layer (load any resources if needed)
   */
  async prepare(): Promise<void> {
    if ((this as any).isPrepared) return;
    await this.waitForHandOverlayReady();
    (this as any).isPrepared = true;
  }

  /**
   * Update the caption for a specific time
   */
  updateForTime(time: number): void {
    if (!this.element) return;

    // Calculate animation progress
    const progress = this.getAnimationProgress(time);
    const exitProgress = this.getExitProgress(time);

    // Determine opacity based on entrance and exit progress
    let opacity = progress * (1 - exitProgress);

    // Apply layer's configured opacity
    if (this.config.opacity !== undefined) {
      opacity *= this.config.opacity;
    }

    console.log(`[CaptionLayer ${this.config.id}] updateForTime:`, {
      time,
      progress,
      exitProgress,
      opacity,
      text: (this.config as any).text
    });

    // Update element opacity
    if (this.containerGroup) {
      this.containerGroup.setAttribute('opacity', opacity.toString());
    }

    this.applyTransform();
  }

  /**
   * Simple word wrapping implementation
   * Splits text into lines that fit within maxWidth
   */
  private wrapText(text: string, maxWidth: number, fontSize: number, fontFamily: string): string[] {
    // Create temporary canvas to measure text
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return [text];

    ctx.font = `${fontSize}px ${fontFamily}`;

    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.length > 0 ? lines : [text];
  }

  /**
   * Convert text alignment to SVG text-anchor attribute
   */
  private getTextAnchor(align: string): string {
    switch (align) {
      case 'left': return 'start';
      case 'right': return 'end';
      case 'center':
      default: return 'middle';
    }
  }

  /**
   * Create SVG filter for text shadow
   */
  private createShadowFilter(filterId: string, shadow: NonNullable<CaptionLayerConfig['shadow']>): SVGFilterElement {
    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', filterId);
    filter.setAttribute('x', '-50%');
    filter.setAttribute('y', '-50%');
    filter.setAttribute('width', '200%');
    filter.setAttribute('height', '200%');

    // Create drop shadow
    const feGaussianBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
    feGaussianBlur.setAttribute('in', 'SourceAlpha');
    feGaussianBlur.setAttribute('stdDeviation', shadow.blur.toString());

    const feOffset = document.createElementNS('http://www.w3.org/2000/svg', 'feOffset');
    feOffset.setAttribute('dx', shadow.offsetX.toString());
    feOffset.setAttribute('dy', shadow.offsetY.toString());

    const feFlood = document.createElementNS('http://www.w3.org/2000/svg', 'feFlood');
    feFlood.setAttribute('flood-color', shadow.color);

    const feComposite = document.createElementNS('http://www.w3.org/2000/svg', 'feComposite');
    feComposite.setAttribute('in2', 'SourceAlpha');
    feComposite.setAttribute('operator', 'in');

    const feMerge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
    const feMergeNode1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    const feMergeNode2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    feMergeNode2.setAttribute('in', 'SourceGraphic');

    feMerge.appendChild(feMergeNode1);
    feMerge.appendChild(feMergeNode2);

    filter.appendChild(feGaussianBlur);
    filter.appendChild(feOffset);
    filter.appendChild(feFlood);
    filter.appendChild(feComposite);
    filter.appendChild(feMerge);

    return filter;
  }
}

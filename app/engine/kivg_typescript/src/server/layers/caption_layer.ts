/**
 * ServerCaptionLayer - Server-side caption/subtitle rendering
 * 
 * Renders caption text on canvas for video export with:
 * - Font configuration (family, size, weight, color)
 * - Background with opacity and border radius
 * - Text stroke and shadow effects
 * - Text alignment and wrapping
 * - Support for entrance/exit animations
 */

import { ServerLayer } from '../core/layer';
import { CanvasRenderingContext2D } from 'canvas';
import { LayerConfig, WhiteboardConfig, CaptionLayerConfig } from '../../shared/types';

/**
 * Default configuration values for captions
 */
const DEFAULT_FONT_SIZE = 32;
const DEFAULT_FONT_FAMILY = 'Arial';
const DEFAULT_COLOR = '#ffffff';
const DEFAULT_BACKGROUND_COLOR = '#000000';
const DEFAULT_BACKGROUND_OPACITY = 0.8;
const DEFAULT_PADDING = 16;
const DEFAULT_MAX_WIDTH = 800;
const DEFAULT_LINE_HEIGHT = 1.3;
const DEFAULT_TEXT_ALIGN = 'center';

/**
 * ServerCaptionLayer - Renders caption text on canvas for video export
 */
export class ServerCaptionLayer extends ServerLayer {
  private captionConfig: CaptionLayerConfig;
  private wrappedLines: string[] = [];
  private textMetrics: { width: number; height: number } | null = null;

  constructor(config: CaptionLayerConfig, handsConfig?: WhiteboardConfig['hands']) {
    super(config, handsConfig);
    this.captionConfig = config;
  }

  protected async doPrepare(): Promise<void> {
    await super.doPrepare();
    
    // Pre-calculate text wrapping for efficiency
    const text = this.captionConfig.text || '';
    const fontSize = this.captionConfig.fontSize || DEFAULT_FONT_SIZE;
    const fontFamily = this.captionConfig.fontFamily || DEFAULT_FONT_FAMILY;
    const fontWeight = this.captionConfig.fontWeight || 'normal';
    const maxWidth = this.captionConfig.maxWidth || DEFAULT_MAX_WIDTH;
    
    // Create a temporary canvas context for text measurement
    const { createCanvas } = require('canvas');
    const tempCanvas = createCanvas(1, 1);
    const ctx = tempCanvas.getContext('2d');
    
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    this.wrappedLines = this.wrapText(ctx, text, maxWidth);
    
    // Calculate total text dimensions
    const lineHeight = this.captionConfig.lineHeight || DEFAULT_LINE_HEIGHT;
    const lineHeightPx = fontSize * lineHeight;
    this.textMetrics = {
      width: maxWidth,
      height: this.wrappedLines.length * lineHeightPx
    };
  }

  /**
   * Render the caption on the canvas
   */
  async doRender(ctx: CanvasRenderingContext2D, time: number): Promise<void> {
    if (!this.isVisible(time)) return;

    const progress = this.getAnimationProgress(time);
    const exitProgress = this.getExitProgress(time);
    
    // Calculate overall opacity
    let opacity = progress * (1 - exitProgress);
    if (this.config.opacity !== undefined) {
      opacity *= this.config.opacity;
    }

    if (opacity <= 0) return;

    // Extract configuration
    const fontSize = this.captionConfig.fontSize || DEFAULT_FONT_SIZE;
    const fontFamily = this.captionConfig.fontFamily || DEFAULT_FONT_FAMILY;
    const fontWeight = this.captionConfig.fontWeight || 'normal';
    const color = this.captionConfig.color || DEFAULT_COLOR;
    const backgroundColor = this.captionConfig.backgroundColor;
    const backgroundOpacity = this.captionConfig.backgroundOpacity ?? DEFAULT_BACKGROUND_OPACITY;
    const padding = this.captionConfig.padding ?? DEFAULT_PADDING;
    const textAlign = this.captionConfig.textAlign || DEFAULT_TEXT_ALIGN;
    const borderRadius = this.captionConfig.borderRadius || 0;
    const lineHeight = this.captionConfig.lineHeight || DEFAULT_LINE_HEIGHT;
    const stroke = this.captionConfig.stroke;
    const shadow = this.captionConfig.shadow;

    ctx.save();
    
    // Apply layer transform
    this.applyTransform(ctx, progress, time);
    
    // Apply global opacity
    ctx.globalAlpha *= opacity;

    const lineHeightPx = fontSize * lineHeight;
    const totalHeight = this.wrappedLines.length * lineHeightPx;
    
    // Draw background if configured
    if (backgroundColor) {
      const bgWidth = (this.captionConfig.maxWidth || DEFAULT_MAX_WIDTH) + (padding * 2);
      const bgHeight = totalHeight + (padding * 2);
      
      ctx.globalAlpha *= backgroundOpacity;
      ctx.fillStyle = backgroundColor;
      
      if (borderRadius > 0) {
        this.drawRoundedRect(ctx, -bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, borderRadius);
      } else {
        ctx.fillRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight);
      }
      
      // Restore opacity for text
      ctx.globalAlpha /= backgroundOpacity;
    }

    // Configure text rendering
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    
    // Set text alignment
    switch (textAlign) {
      case 'left':
        ctx.textAlign = 'left';
        break;
      case 'right':
        ctx.textAlign = 'right';
        break;
      case 'center':
      default:
        ctx.textAlign = 'center';
        break;
    }

    // Apply shadow if configured
    if (shadow) {
      ctx.shadowColor = shadow.color;
      ctx.shadowBlur = shadow.blur;
      ctx.shadowOffsetX = shadow.offsetX;
      ctx.shadowOffsetY = shadow.offsetY;
    }

    // Apply stroke if configured
    if (stroke) {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
    }

    // Draw each line
    const startY = -(totalHeight / 2);
    this.wrappedLines.forEach((line, index) => {
      const y = startY + (index * lineHeightPx);
      
      // Draw stroke first (behind fill)
      if (stroke) {
        ctx.strokeText(line, 0, y);
      }
      
      // Draw filled text
      ctx.fillText(line, 0, y);
    });

    ctx.restore();
  }

  /**
   * Wrap text into multiple lines based on maxWidth
   */
  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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
   * Draw a rounded rectangle on canvas
   */
  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Get default hand preset for this layer type
   */
  protected getDefaultHandPreset(): string | undefined {
    // Captions typically don't need hand overlay
    return undefined;
  }
}

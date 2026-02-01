/**
 * Text Writing Animation Module
 * 
 * Provides handwriting-style text animation for whiteboard rendering.
 * Characters are revealed progressively with a typewriter effect.
 */

import type { RGBA } from '../../shared/utils/color_utils';
import { HandOverlay } from '../rendering/hand_overlay';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface TextWritingConfig {
  text: string;
  x: number;
  y: number;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  color?: RGBA;
  letterSpacing?: number;
  lineHeight?: number;
}

export interface TextWritingAnimationOptions {
  /** Duration per character in seconds */
  charDuration?: number;
  /** Total animation duration in seconds (overrides charDuration) */
  totalDuration?: number;
  /** Frames per second */
  fps?: number;
  /** Cursor character to show at the end */
  cursor?: string;
  /** Whether to show cursor during animation */
  showCursor?: boolean;
  /** Cursor blink interval in frames (0 = no blink) */
  cursorBlinkInterval?: number;
  /** 
   * Animation mode: 
   * - 'typewriter': Draw characters one by one (current behavior)
   * - 'reveal': Pre-render text, then reveal using progressive alpha mask
   */
  mode?: 'typewriter' | 'reveal';
  /** Whether to show hand overlay during animation */
  showHandOverlay?: boolean;
  /** URL to hand image (PNG with transparency) */
  handImageUrl?: string;
  /** Scale factor for the hand image (0.0-2.0) */
  handScale?: number;
  /** Offset [x, y] from the drawing point to position the hand tip */
  handOffset?: [number, number];
}

// ============================================================================
// Font Loading Utility
// ============================================================================

// Cache for loaded fonts
const loadedFonts = new Set<string>();

/**
 * Load a font from a URL using the FontFace API.
 */
async function loadFontFromUrl(fontFamily: string, url: string): Promise<boolean> {
  if (loadedFonts.has(fontFamily)) {
    return true;
  }

  try {
    const font = new FontFace(fontFamily, `url(${url})`);
    const loadedFont = await font.load();
    document.fonts.add(loadedFont);
    loadedFonts.add(fontFamily);
    return true;
  } catch (error) {
    console.warn(`Failed to load font ${fontFamily} from ${url}:`, error);
    return false;
  }
}

/**
 * Load a font and wait for it to be available.
 */
async function ensureFontLoaded(fontFamily: string): Promise<boolean> {
  // Extract the primary font name (before any fallbacks)
  const primaryFont = fontFamily.split(',')[0].trim().replace(/['"]/g, '');

  // Known font URL mappings
  const fontUrls: Record<string, string> = {
    'Pacifico': '/fonts/Pacifico/Pacifico-Regular.ttf'
  };

  // If we have a known URL for this font, load it explicitly
  if (fontUrls[primaryFont]) {
    const loaded = await loadFontFromUrl(primaryFont, fontUrls[primaryFont]);
    if (loaded) {
      return true;
    }
  }

  // Try to load the font using the Font Loading API
  if ('fonts' in document) {
    try {
      // Wait for fonts to be ready
      await document.fonts.ready;

      // Check if font is available
      if (document.fonts.check(`48px ${primaryFont}`)) {
        return true;
      }

      // Font not found after waiting - return false
      return false;
    } catch {
      return false;
    }
  }
  return false;
}

// ============================================================================
// Text Writing Animation Class
// ============================================================================

/**
 * Handles animated text writing/typewriter effect on canvas.
 */
export class TextWritingAnimation {
  private config: TextWritingConfig;
  private options: TextWritingAnimationOptions;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private fontLoaded: boolean = false;
  /** Pre-rendered full text image for reveal mode */
  private preRenderedText: ImageData | null = null;
  /** Offscreen canvas used to pre-render the full text with transparent background */
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;
  /** Character metadata for reveal mode (includes pixel bounds) */
  private charMetadata: Array<{
    char: string;
    startX: number;
    endX: number;
    y: number;
    lineIdx: number;
    width: number;
  }> = [];
  /** Hand overlay for writing animation */
  private handOverlay: HandOverlay | null = null;

  constructor(
    width: number,
    height: number,
    config: TextWritingConfig,
    options: TextWritingAnimationOptions = {}
  ) {
    this.config = {
      fontFamily: 'Pacifico, cursive',
      fontSize: 48,
      fontWeight: 'normal',
      fontStyle: 'normal',
      color: [0, 0, 0, 255],
      letterSpacing: 0,
      lineHeight: 1.5,
      ...config
    };

    this.options = {
      charDuration: 0.05,
      fps: 30,
      cursor: '|',
      showCursor: true,
      cursorBlinkInterval: 15,
      mode: 'reveal',
      showHandOverlay: false,
      handScale: 0.30,
      // Note: handOffset default is different from HandOverlay's general default (-20)
      // because text baseline positioning requires more Y offset for natural appearance
      handOffset: [-18, -60],
      ...options
    };

    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = ctx;

    // Initialize hand overlay if enabled
    if (this.options.showHandOverlay) {
      this.handOverlay = new HandOverlay(
        this.options.handImageUrl,
        this.options.handScale,
        this.options.handOffset
      );
    }
  }

  /**
   * Ensure the font is loaded before rendering.
   */
  async loadFont(): Promise<void> {
    if (!this.fontLoaded) {
      const fontFamily = this.config.fontFamily || 'Pacifico';
      this.fontLoaded = await ensureFontLoaded(fontFamily);
    }
  }

  /**
   * Get the canvas element.
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Build the CSS font string.
   */
  private buildFont(): string {
    const { fontStyle, fontWeight, fontSize, fontFamily } = this.config;
    return `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  }

  /**
   * Convert RGBA to CSS color string.
   */
  private rgbaToStyle(color: RGBA): string {
    return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`;
  }

  /**
   * Clear the canvas with a white background (whiteboard style).
   */
  clear(): void {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Draw text with only the first n characters visible.
   * Counts visible characters only (not newlines).
   */
  private drawPartialText(charCount: number, showCursor: boolean = false): void {
    this.clear();

    const { text, x, y, color, letterSpacing, lineHeight, fontSize } = this.config;
    const lines = text.split('\n');
    const lineHeightPx = (fontSize || 48) * (lineHeight || 1.5);

    this.ctx.font = this.buildFont();
    this.ctx.fillStyle = this.rgbaToStyle(color || [0, 0, 0, 255]);
    this.ctx.textBaseline = 'top';

    let charsDrawn = 0;
    let cursorX = x;
    let cursorY = y;
    let reachedLimit = false;

    for (let lineIdx = 0; lineIdx < lines.length && !reachedLimit; lineIdx++) {
      const line = lines[lineIdx];
      let currentX = x;
      const currentY = y + lineIdx * lineHeightPx;

      cursorX = currentX;
      cursorY = currentY;

      for (let charIdx = 0; charIdx < line.length; charIdx++) {
        if (charsDrawn >= charCount) {
          reachedLimit = true;
          break;
        }

        const char = line[charIdx];

        if (letterSpacing && letterSpacing > 0) {
          this.ctx.fillText(char, currentX, currentY);
          const charWidth = this.ctx.measureText(char).width;
          currentX += charWidth + letterSpacing;
        } else {
          this.ctx.fillText(char, currentX, currentY);
          currentX += this.ctx.measureText(char).width;
        }

        charsDrawn++;
        cursorX = currentX;
        cursorY = currentY;
      }
    }

    // Draw cursor if enabled
    if (showCursor && this.options.showCursor) {
      this.ctx.fillText(this.options.cursor || '|', cursorX, cursorY);
    }

    // Draw hand overlay if enabled and there's text being written
    if (this.options.showHandOverlay && this.handOverlay && this.handOverlay.isLoaded && charCount < this.getTotalChars()) {
      const fontSize = this.config.fontSize || 48;
      const handX = cursorX;
      const handY = cursorY + fontSize / 2;

      this.handOverlay.render(this.ctx, handX, handY);
    }
  }

  /**
   * Get the total number of visible characters (excluding newlines).
   */
  private getTotalChars(): number {
    return this.config.text.replace(/\n/g, '').length;
  }

  /**
   * Pre-render the full text and calculate character metadata.
   * Used for reveal mode animation with pixel-perfect masking.
   */
  private preRenderText(): void {
    // Prepare an offscreen canvas to render text onto a transparent background
    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCanvas.width = this.canvas.width;
      this.offscreenCanvas.height = this.canvas.height;
      this.offscreenCtx = this.offscreenCanvas.getContext('2d');
      if (!this.offscreenCtx) {
        // Fall back to using a temporary canvas created for measurement/rendering
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          this.offscreenCanvas = tempCanvas;
          this.offscreenCtx = tempCtx;
        } else {
          this.offscreenCanvas = null;
          this.offscreenCtx = null;
        }
      }
    }

    // Use the offscreen context if available so we don't draw the full text on the visible canvas.
    const targetCtx = this.offscreenCtx || this.ctx;
    // Clear to transparent on the offscreen canvas, or white on the main canvas.
    if (this.offscreenCtx && this.offscreenCanvas) {
      this.offscreenCtx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
    } else {
      this.clear();
    }
    const { text, x, y, color, letterSpacing, lineHeight, fontSize } = this.config;
    const lines = text.split('\n');
    const lineHeightPx = (fontSize || 48) * (lineHeight || 1.5);

    targetCtx.font = this.buildFont();
    targetCtx.fillStyle = this.rgbaToStyle(color || [0, 0, 0, 255]);
    targetCtx.textBaseline = 'top';

    this.charMetadata = [];

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const baseX = x;
      const currentY = y + lineIdx * lineHeightPx;

      // Draw the entire line in one call to keep ligatures/kerning intact
      targetCtx.fillText(line, baseX, currentY);

      // Compute per-character bounds by measuring substrings. This is the most accurate
      // way to get glyph boundaries that match the pre-rendered text.
      let prevWidth = 0;

      for (let charIdx = 0; charIdx < line.length; charIdx++) {
        const substr = line.substring(0, charIdx + 1);
        const substrWidth = targetCtx.measureText(substr).width;
        const startX = Math.floor(baseX + prevWidth);
        const endX = Math.ceil(baseX + substrWidth);

        const char = line[charIdx];
        const spacing = (letterSpacing && letterSpacing > 0) ? letterSpacing : 0;
        const width = endX - startX + spacing;

        this.charMetadata.push({
          char,
          startX,
          endX,
          y: currentY,
          lineIdx,
          width
        });

        prevWidth = substrWidth;
      }
    }

    // Store the pre-rendered full text as ImageData from the offscreen canvas (transparent background)
    this.preRenderedText = (this.offscreenCtx || this.ctx).getImageData(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Draw text with reveal effect using progressive pixel copying.
   * This copies pixels from the pre-rendered text progressively, character by character.
   */
  private drawRevealText(charCount: number, charPartial: number = 0, showCursor: boolean = false): void {
    this.clear();

    if (!this.preRenderedText || this.charMetadata.length === 0) {
      this.preRenderText();
    }

    if (!this.preRenderedText) return;

    const { x, y, fontSize, lineHeight } = this.config;
    const lineHeightPx = (fontSize || 48) * (lineHeight || 1.5);

    // Create a working ImageData to build the revealed text
    const revealedImage = this.ctx.createImageData(this.canvas.width, this.canvas.height);

    // Copy white background
    for (let i = 0; i < revealedImage.data.length; i += 4) {
      revealedImage.data[i] = 255;     // R
      revealedImage.data[i + 1] = 255; // G
      revealedImage.data[i + 2] = 255; // B
      revealedImage.data[i + 3] = 255; // A
    }

    // Copy pixels for each revealed character
    const charsToReveal = Math.min(charCount, this.charMetadata.length);

    for (let i = 0; i < charsToReveal; i++) {
      const meta = this.charMetadata[i];
      const lineY = Math.floor(meta.y);

      // Calculate bounding box for this character with padding for cursive overlap
      const padding = Math.ceil((fontSize || 48) * 0.3); // 30% padding for cursive
      const startX = Math.max(0, Math.floor(meta.startX - padding));
      const endX = Math.min(this.canvas.width, Math.ceil(meta.endX + padding));
      const startY = Math.max(0, lineY - padding);
      const endY = Math.min(this.canvas.height, lineY + Math.ceil(lineHeightPx) + padding);

      // Copy pixels from pre-rendered text to revealed image
      for (let py = startY; py < endY; py++) {
        for (let px = startX; px < endX; px++) {
          const idx = (py * this.canvas.width + px) * 4;

          // Only copy non-transparent pixels (the text)
          const r = this.preRenderedText.data[idx];
          const g = this.preRenderedText.data[idx + 1];
          const b = this.preRenderedText.data[idx + 2];
          const a = this.preRenderedText.data[idx + 3];

          if (a !== 0) {
            revealedImage.data[idx] = r;
            revealedImage.data[idx + 1] = g;
            revealedImage.data[idx + 2] = b;
            revealedImage.data[idx + 3] = a;
          } else if (!(r === 255 && g === 255 && b === 255)) {
            // Fallback for main canvas: copy pixels that aren't pure white
            revealedImage.data[idx] = r;
            revealedImage.data[idx + 1] = g;
            revealedImage.data[idx + 2] = b;
            revealedImage.data[idx + 3] = a;
          }
        }
      }
    }

    // If there is a partial reveal of the next character, copy only a portion of its bounding box horizontally
    if (charPartial > 0 && charsToReveal < this.charMetadata.length) {
      const nextMeta = this.charMetadata[charsToReveal];
      const lineY = Math.floor(nextMeta.y);

      const padding = Math.ceil((fontSize || 48) * 0.3);
      const startX = Math.max(0, Math.floor(nextMeta.startX - padding));
      const endX = Math.min(this.canvas.width, Math.ceil(nextMeta.endX + padding));
      const startY = Math.max(0, lineY - padding);
      const endY = Math.min(this.canvas.height, lineY + Math.ceil(lineHeightPx) + padding);

      // horizontal partial width
      const totalWidth = endX - startX;
      const partialWidth = Math.max(1, Math.floor(totalWidth * Math.min(Math.max(charPartial, 0), 1)));
      const partialEndX = startX + partialWidth;

      for (let py = startY; py < endY; py++) {
        for (let px = startX; px < partialEndX; px++) {
          const idx = (py * this.canvas.width + px) * 4;
          const r = this.preRenderedText.data[idx];
          const g = this.preRenderedText.data[idx + 1];
          const b = this.preRenderedText.data[idx + 2];
          const a = this.preRenderedText.data[idx + 3];

          if (a !== 0) {
            revealedImage.data[idx] = r;
            revealedImage.data[idx + 1] = g;
            revealedImage.data[idx + 2] = b;
            revealedImage.data[idx + 3] = a;
          } else if (!(r === 255 && g === 255 && b === 255)) {
            revealedImage.data[idx] = r;
            revealedImage.data[idx + 1] = g;
            revealedImage.data[idx + 2] = b;
            revealedImage.data[idx + 3] = a;
          }
        }
      }
    }

    // Put the revealed image on canvas
    this.ctx.putImageData(revealedImage, 0, 0);

    // Draw cursor if enabled
    if (showCursor && this.options.showCursor) {
      this.ctx.font = this.buildFont();
      this.ctx.fillStyle = this.rgbaToStyle(this.config.color || [0, 0, 0, 255]);
      this.ctx.textBaseline = 'top';

      if (charCount > 0 && charCount <= this.charMetadata.length) {
        const cursorPos = this.charMetadata[charCount - 1];
        this.ctx.fillText(this.options.cursor || '|', cursorPos.endX, cursorPos.y);
      } else if (charCount === 0) {
        this.ctx.fillText(this.options.cursor || '|', x, y);
      }
    }

    // Draw hand overlay if enabled and animation is in progress
    if (this.options.showHandOverlay && this.handOverlay && this.handOverlay.isLoaded && charCount < this.getTotalChars()) {
      const fontSize = this.config.fontSize || 48;

      // Position hand at the current writing position
      let handX = x;
      let handY = y + fontSize / 2;

      if (charCount > 0 && charCount <= this.charMetadata.length) {
        const currentChar = this.charMetadata[charCount - 1];
        // Add partial character progress for smoother hand movement
        handX = currentChar.endX + (charPartial * currentChar.width);
        handY = currentChar.y + fontSize / 2;
      }

      this.handOverlay.render(this.ctx, handX, handY);
    }
  }

  /**
   * Generate animation frames for the text writing effect.
   */
  async generateFrames(): Promise<ImageData[]> {
    // Ensure font is loaded before generating frames
    await this.loadFont();

    // Wait for hand overlay to load if enabled
    if (this.options.showHandOverlay && this.handOverlay) {
      await this.handOverlay.waitForLoad();
    }

    const frames: ImageData[] = [];
    const totalChars = this.getTotalChars();
    const fps = this.options.fps || 30;
    const charDuration = this.options.charDuration || 0.05;
    const useRevealMode = this.options.mode === 'reveal';

    // For reveal mode, pre-render the text first
    if (useRevealMode) {
      this.preRenderText();
    }

    // Calculate total duration
    const totalDuration = this.options.totalDuration || (totalChars * charDuration);
    const numFrames = Math.max(1, Math.floor(totalDuration * fps));

    for (let frameIdx = 0; frameIdx <= numFrames; frameIdx++) {
      const progress = numFrames > 0 ? frameIdx / numFrames : 1.0;
      const charCount = Math.floor(progress * totalChars);

      // Cursor blink effect
      let showCursor = true;
      if (this.options.cursorBlinkInterval && this.options.cursorBlinkInterval > 0) {
        showCursor = Math.floor(frameIdx / this.options.cursorBlinkInterval) % 2 === 0;
      }

      if (useRevealMode) {
        // Calculate partial reveal progress for the current character
        let charPartial = 0;
        if (charCount < totalChars) {
          // Estimate partial reveal based on normalized progress within the current character
          const progressInChar = (progress * totalChars) % 1;
          charPartial = Math.min(1, Math.max(0, progressInChar));
        }

        this.drawRevealText(charCount, charPartial, showCursor && charCount < totalChars);
      } else {
        this.drawPartialText(charCount, showCursor && charCount < totalChars);
      }
      frames.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));
    }

    // Add final frame without cursor
    if (useRevealMode) {
      this.drawRevealText(totalChars, 0 /* charPartial */, false);
    } else {
      this.drawPartialText(totalChars, false);
    }
    frames.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));

    return frames;
  }

  /**
   * Draw the final text (all characters visible).
   */
  drawFinal(): void {
    const useRevealMode = this.options.mode === 'reveal';
    if (useRevealMode) {
      if (!this.preRenderedText || this.charMetadata.length === 0) {
        this.preRenderText();
      }
      this.drawRevealText(this.getTotalChars(), 0 /* charPartial */, false);
    } else {
      this.drawPartialText(this.getTotalChars(), false);
    }
  }

  /**
   * Get the current canvas as ImageData.
   */
  getImageData(): ImageData {
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a text writing animation with common defaults.
 */
export function createTextWritingAnimation(
  width: number,
  height: number,
  text: string,
  options: Partial<TextWritingConfig & TextWritingAnimationOptions> = {}
): TextWritingAnimation {
  const {
    x = 50,
    y = 50,
    fontFamily,
    fontSize,
    fontWeight,
    fontStyle,
    color,
    letterSpacing,
    lineHeight,
    ...animOptions
  } = options;

  const config: TextWritingConfig = {
    text,
    x,
    y,
    fontFamily,
    fontSize,
    fontWeight,
    fontStyle,
    color: color as RGBA | undefined,
    letterSpacing,
    lineHeight
  };

  return new TextWritingAnimation(width, height, config, animOptions);
}
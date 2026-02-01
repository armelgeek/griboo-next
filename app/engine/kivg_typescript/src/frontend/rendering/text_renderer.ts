/**
 * Text rendering functionality for canvas-based SVG rendering.
 * Handles drawing text elements with animation support.
 */

import type { CanvasRenderer } from '../core/rendering/canvas';
import type { RGBA } from '../../shared/utils/color_utils';

interface TextData {
    text: string;
    x: number;
    y: number;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string;
    fontStyle?: string;
    fill?: number[];
    stroke?: number[] | null;
    strokeWidth?: number;
    textAnchor?: string;
    dominantBaseline?: string;
    letterSpacing?: number;
    textDecoration?: string;
    opacity?: number;
}

/**
 * Handles rendering of SVG text elements to canvas.
 */
export class TextRenderer {
    // Map SVG font weights to canvas font weight strings
    private static readonly FONT_WEIGHT_MAP: Record<string, string> = {
        'normal': '400',
        'bold': '700',
        '100': '100',
        '200': '200',
        '300': '300',
        '400': '400',
        '500': '500',
        '600': '600',
        '700': '700',
        '800': '800',
        '900': '900'
    };

    /**
     * Get canvas font string from SVG font properties.
     * 
     * @param fontFamily - SVG font family name
     * @param fontSize - Font size in pixels
     * @param fontStyle - Font style (normal, italic)
     * @param fontWeight - Font weight
     * @returns Canvas font string
     */
    static getCanvasFont(
        fontFamily: string = 'sans-serif',
        fontSize: number = 16,
        fontStyle: string = 'normal',
        fontWeight: string = 'normal'
    ): string {
        const weight = this.FONT_WEIGHT_MAP[fontWeight] || fontWeight;
        const style = fontStyle === 'oblique' ? 'italic' : fontStyle;

        return `${style} ${weight} ${fontSize}px ${fontFamily}`;
    }

    /**
     * Draw text element on the canvas.
     * 
     * @param renderer - CanvasRenderer to draw on
     * @param textData - Dictionary with text properties
     * @param scaleX - X scale factor for coordinate transformation
     * @param scaleY - Y scale factor for coordinate transformation
     * @param offsetX - X offset for positioning
     * @param offsetY - Y offset for positioning
     * @param opacity - Opacity multiplier (0-1)
     * @param charReveal - Number of characters to reveal (-1 for all)
     */
    static drawText(
        renderer: CanvasRenderer,
        textData: TextData,
        scaleX: number = 1.0,
        scaleY: number = 1.0,
        offsetX: number = 0,
        offsetY: number = 0,
        opacity: number = 1.0,
        charReveal: number = -1
    ): void {
        let text = textData.text;
        if (charReveal >= 0) {
            text = text.substring(0, charReveal);
        }

        if (!text) return;

        const ctx = renderer.getContext();
        ctx.save();

        // Transform coordinates
        const x = textData.x * scaleX + offsetX;
        const y = textData.y * scaleY + offsetY;

        // Set font
        const fontFamily = textData.fontFamily || 'sans-serif';
        const fontSize = (textData.fontSize || 16) * Math.min(scaleX, scaleY);
        const fontStyle = textData.fontStyle || 'normal';
        const fontWeight = textData.fontWeight || 'normal';

        ctx.font = this.getCanvasFont(fontFamily, fontSize, fontStyle, fontWeight);

        // Get text metrics for alignment
        const metrics = ctx.measureText(text);
        const textWidth = metrics.width;
        const textHeight = fontSize; // Approximate height

        // Adjust position based on text-anchor
        let adjustedX = x;
        const textAnchor = textData.textAnchor || 'start';
        if (textAnchor === 'middle') {
            adjustedX -= textWidth / 2;
        } else if (textAnchor === 'end') {
            adjustedX -= textWidth;
        }

        // Adjust baseline
        let adjustedY = y;
        const dominantBaseline = textData.dominantBaseline || 'auto';

        if (dominantBaseline === 'middle' || dominantBaseline === 'central') {
            ctx.textBaseline = 'middle';
        } else if (dominantBaseline === 'hanging' || dominantBaseline === 'text-before-edge') {
            ctx.textBaseline = 'top';
        } else if (dominantBaseline === 'alphabetic') {
            ctx.textBaseline = 'alphabetic';
        } else {
            ctx.textBaseline = 'alphabetic'; // Default
        }

        // Get colors
        const fillColor = textData.fill || [0, 0, 0, 1];
        const strokeColor = textData.stroke;
        const strokeWidth = textData.strokeWidth || 1;
        const textOpacity = (textData.opacity || 1.0) * opacity;

        // Convert colors to RGBA
        const fillRgba: RGBA = [
            Math.floor(fillColor[0] * 255),
            Math.floor(fillColor[1] * 255),
            Math.floor(fillColor[2] * 255),
            Math.floor((fillColor[3] || 1) * 255 * textOpacity)
        ];

        let strokeRgba: RGBA | null = null;
        if (strokeColor) {
            strokeRgba = [
                Math.floor(strokeColor[0] * 255),
                Math.floor(strokeColor[1] * 255),
                Math.floor(strokeColor[2] * 255),
                Math.floor((strokeColor[3] || 1) * 255 * textOpacity)
            ];
        }

        // Letter spacing
        const letterSpacing = (textData.letterSpacing || 0) * scaleX;

        if (letterSpacing > 0) {
            this._drawTextWithSpacing(
                ctx, text, adjustedX, adjustedY, letterSpacing,
                fillRgba, strokeRgba, strokeWidth,
                textData.textDecoration || 'none', textHeight
            );
        } else {
            this._drawTextSimple(
                ctx, text, adjustedX, adjustedY,
                fillRgba, strokeRgba, strokeWidth,
                textData.textDecoration || 'none', textWidth, textHeight
            );
        }

        ctx.restore();
    }

    /**
     * Draw text without letter spacing.
     */
    private static _drawTextSimple(
        ctx: CanvasRenderingContext2D,
        text: string,
        x: number,
        y: number,
        fillRgba: RGBA,
        strokeRgba: RGBA | null,
        strokeWidth: number,
        textDecoration: string,
        textWidth: number,
        textHeight: number
    ): void {
        // Draw stroke first (if any)
        if (strokeRgba && strokeWidth && strokeRgba[3] > 0) {
            ctx.strokeStyle = `rgba(${strokeRgba[0]}, ${strokeRgba[1]}, ${strokeRgba[2]}, ${strokeRgba[3] / 255})`;
            ctx.lineWidth = strokeWidth;
            ctx.strokeText(text, x, y);
        }

        // Draw fill
        if (fillRgba && fillRgba[3] > 0) {
            ctx.fillStyle = `rgba(${fillRgba[0]}, ${fillRgba[1]}, ${fillRgba[2]}, ${fillRgba[3] / 255})`;
            ctx.fillText(text, x, y);
        }

        // Draw text decoration
        this._drawDecoration(ctx, textDecoration, x, y, textWidth, textHeight, fillRgba);
    }

    /**
     * Draw text with custom letter spacing.
     */
    private static _drawTextWithSpacing(
        ctx: CanvasRenderingContext2D,
        text: string,
        x: number,
        y: number,
        letterSpacing: number,
        fillRgba: RGBA,
        strokeRgba: RGBA | null,
        strokeWidth: number,
        textDecoration: string,
        textHeight: number
    ): void {
        let currentX = x;
        let totalWidth = 0;

        for (const char of text) {
            const charWidth = ctx.measureText(char).width;

            // Draw stroke
            if (strokeRgba && strokeWidth && strokeRgba[3] > 0) {
                ctx.strokeStyle = `rgba(${strokeRgba[0]}, ${strokeRgba[1]}, ${strokeRgba[2]}, ${strokeRgba[3] / 255})`;
                ctx.lineWidth = strokeWidth;
                ctx.strokeText(char, currentX, y);
            }

            // Draw fill
            if (fillRgba && fillRgba[3] > 0) {
                ctx.fillStyle = `rgba(${fillRgba[0]}, ${fillRgba[1]}, ${fillRgba[2]}, ${fillRgba[3] / 255})`;
                ctx.fillText(char, currentX, y);
            }

            currentX += charWidth + letterSpacing;
            totalWidth += charWidth + letterSpacing;
        }

        // Draw text decoration
        this._drawDecoration(
            ctx, textDecoration, x, y,
            totalWidth - letterSpacing, textHeight, fillRgba
        );
    }

    /**
     * Draw text decoration (underline, strikethrough, etc.).
     */
    private static _drawDecoration(
        ctx: CanvasRenderingContext2D,
        decoration: string,
        x: number,
        y: number,
        textWidth: number,
        textHeight: number,
        color: RGBA
    ): void {
        if (!color || color[3] === 0 || decoration === 'none') {
            return;
        }

        ctx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`;
        ctx.lineWidth = Math.max(1, textHeight / 20);

        if (decoration.includes('underline')) {
            const lineY = y + textHeight / 4;
            ctx.beginPath();
            ctx.moveTo(x, lineY);
            ctx.lineTo(x + textWidth, lineY);
            ctx.stroke();
        }

        if (decoration.includes('line-through') || decoration.includes('strikethrough')) {
            const lineY = y - textHeight / 3;
            ctx.beginPath();
            ctx.moveTo(x, lineY);
            ctx.lineTo(x + textWidth, lineY);
            ctx.stroke();
        }

        if (decoration.includes('overline')) {
            const lineY = y - textHeight;
            ctx.beginPath();
            ctx.moveTo(x, lineY);
            ctx.lineTo(x + textWidth, lineY);
            ctx.stroke();
        }
    }

    /**
     * Calculate bounding box for text element.
     * 
     * @param textData - Dictionary with text properties
     * @param scaleX - X scale factor
     * @param scaleY - Y scale factor
     * @returns Object with x, y, width, height
     */
    static getTextBounds(
        textData: TextData,
        scaleX: number = 1.0,
        scaleY: number = 1.0
    ): { x: number; y: number; width: number; height: number } {
        // Create temporary canvas for measurement
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) {
            return { x: 0, y: 0, width: 0, height: 0 };
        }

        const fontFamily = textData.fontFamily || 'sans-serif';
        const fontSize = (textData.fontSize || 16) * Math.min(scaleX, scaleY);
        const fontStyle = textData.fontStyle || 'normal';
        const fontWeight = textData.fontWeight || 'normal';

        ctx.font = this.getCanvasFont(fontFamily, fontSize, fontStyle, fontWeight);

        const metrics = ctx.measureText(textData.text);
        const textWidth = metrics.width;
        const textHeight = fontSize;

        const x = textData.x * scaleX;
        const y = textData.y * scaleY;

        return {
            x: Math.floor(x),
            y: Math.floor(y - textHeight),
            width: Math.ceil(textWidth),
            height: Math.ceil(textHeight)
        };
    }

    /**
     * Get the position (x, y) of a specific character in the text.
     * 
     * @param textData - Dictionary with text properties
     * @param charIndex - Index of the character (0-based)
     * @param scaleX - X scale factor
     * @param scaleY - Y scale factor
     * @param offsetX - X offset for positioning
     * @param offsetY - Y offset for positioning
     * @returns Point [x, y] of the character position, or null if invalid
     */
    static getCharPosition(
        textData: TextData,
        charIndex: number,
        scaleX: number = 1.0,
        scaleY: number = 1.0,
        offsetX: number = 0,
        offsetY: number = 0
    ): [number, number] | null {
        const text = textData.text;
        if (charIndex < 0 || charIndex > text.length) {
            return null;
        }

        // Create temporary canvas for measurement
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) return null;

        const fontFamily = textData.fontFamily || 'sans-serif';
        const fontSize = (textData.fontSize || 16) * Math.min(scaleX, scaleY);
        const fontStyle = textData.fontStyle || 'normal';
        const fontWeight = textData.fontWeight || 'normal';

        ctx.font = this.getCanvasFont(fontFamily, fontSize, fontStyle, fontWeight);

        // Calculate base position
        let x = textData.x * scaleX + offsetX;
        const y = textData.y * scaleY + offsetY;

        if (charIndex === 0) {
            return [Math.floor(x), Math.floor(y)];
        }

        // Calculate full text width for alignment
        const fullWidth = ctx.measureText(text).width;

        // Adjust position based on text-anchor
        const textAnchor = textData.textAnchor || 'start';
        if (textAnchor === 'middle') {
            x -= fullWidth / 2;
        } else if (textAnchor === 'end') {
            x -= fullWidth;
        }

        // Calculate width of text up to charIndex
        const letterSpacing = (textData.letterSpacing || 0) * scaleX;

        if (letterSpacing > 0) {
            // Calculate width character by character
            for (let i = 0; i < Math.min(charIndex, text.length); i++) {
                const char = text[i];
                const charWidth = ctx.measureText(char).width;
                x += charWidth + letterSpacing;
            }
        } else {
            // Calculate width of substring
            const substring = text.substring(0, charIndex);
            const subWidth = ctx.measureText(substring).width;
            x += subWidth;
        }

        return [Math.floor(x), Math.floor(y)];
    }

    /**
     * Create a typewriter animation effect.
     * 
     * @param renderer - CanvasRenderer to draw on
     * @param textData - Text properties
     * @param progress - Animation progress (0.0 to 1.0)
     * @param scaleX - X scale factor
     * @param scaleY - Y scale factor
     */
    static drawTypewriterEffect(
        renderer: CanvasRenderer,
        textData: TextData,
        progress: number,
        scaleX: number = 1.0,
        scaleY: number = 1.0
    ): void {
        const charCount = Math.floor(textData.text.length * progress);
        this.drawText(renderer, textData, scaleX, scaleY, 0, 0, 1.0, charCount);
    }
}
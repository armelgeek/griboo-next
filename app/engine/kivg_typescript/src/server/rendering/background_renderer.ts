import { CanvasRenderingContext2D, loadImage } from 'canvas';
import { BackgroundConfig, GridConfig, TemplateConfig } from '../../shared/types';
import { resolveAssetPath, loadAssetFromPath } from '../utils/path_utils';

/**
 * Background Renderer for Server-side scenes
 * Handles rendering of different background types: colors, grids, templates, gradients, and animations
 */
export class BackgroundRenderer {
    private config: BackgroundConfig | string;
    private templateImage: any = null;

    constructor(config: BackgroundConfig | string) {
        this.config = config;
    }

    /**
     * Prepare the background (load images if needed)
     */
    async prepare(): Promise<void> {
        if (typeof this.config === 'string') {
            // Simple color string
            return;
        }

        if (this.config.template?.url) {
            try {
                const resolvedPath = resolveAssetPath(this.config.template.url);
                const buffer = await loadAssetFromPath(resolvedPath, 'image');
                this.templateImage = await loadImage(buffer);
            } catch (error) {
                console.warn('Failed to load template image:', error);
            }
        }
    }

    /**
     * Render the background to the canvas context
     */
    render(ctx: CanvasRenderingContext2D, width: number, height: number, time: number = 0): void {
        const config: BackgroundConfig = typeof this.config === 'string' ? { color: this.config } : this.config;

        ctx.save();

        // Apply animations if present
        if (config.animation) {
            this.applyAnimationTransform(ctx, config.animation, time, width, height);
        }

        // Render base color or gradient
        if (config.gradient) {
            this.renderGradient(ctx, width, height, config.gradient);
        } else if (config.color) {
            this.renderColor(ctx, width, height, config.color);
        } else {
            // Default white background
            this.renderColor(ctx, width, height, '#ffffff');
        }

        // Apply filters if present
        if (config.effects) {
            this.applyEffects(ctx, config.effects);
        }

        // Render template if specified
        if (config.template) {
            this.renderTemplate(ctx, width, height, config.template);
        }

        // Render grid if specified
        if (config.grid) {
            this.renderGrid(ctx, width, height, config.grid);
        }

        ctx.restore();
    }

    private applyAnimationTransform(ctx: CanvasRenderingContext2D, anim: any, time: number, width: number, height: number) {
        if (anim.type === 'scroll') {
            ctx.translate((anim.speedX || 0) * time, (anim.speedY || 0) * time);
        } else if (anim.type === 'rotate') {
            ctx.translate(width / 2, height / 2);
            ctx.rotate((anim.rotationSpeed || 0) * time);
            ctx.translate(-width / 2, -height / 2);
        } else if (anim.type === 'pulse') {
            const pulse = 1 + Math.sin(time * (anim.pulseFrequency || 1) * Math.PI * 2) * (anim.pulseIntensity || 0.1);
            ctx.translate(width / 2, height / 2);
            ctx.scale(pulse, pulse);
            ctx.translate(-width / 2, -height / 2);
        }
    }

    private applyEffects(ctx: CanvasRenderingContext2D, effects: any) {
        let filterStr = '';
        if (effects.blur) filterStr += `blur(${effects.blur}px) `;
        if (effects.grayscale) filterStr += `grayscale(${effects.grayscale * 100}%) `;
        if (effects.sepia) filterStr += `sepia(${effects.sepia * 100}%) `;
        if (effects.brightness) filterStr += `brightness(${effects.brightness * 100}%) `;
        if (effects.contrast) filterStr += `contrast(${effects.contrast * 100}%) `;
        if (effects.hueRotate) filterStr += `hue-rotate(${effects.hueRotate}deg) `;
        if (effects.invert) filterStr += `invert(${effects.invert * 100}%) `;

        if (filterStr) {
            (ctx as any).filter = filterStr.trim();
        }
    }

    private renderGradient(ctx: CanvasRenderingContext2D, width: number, height: number, config: any) {
        let gradient: CanvasGradient;
        if (config.type === 'linear') {
            const angle = (config.angle || 0) * Math.PI / 180;
            const x1 = width / 2 + Math.sin(angle) * width / 2;
            const y1 = height / 2 + Math.cos(angle) * height / 2;
            const x2 = width / 2 - Math.sin(angle) * width / 2;
            const y2 = height / 2 - Math.cos(angle) * height / 2;
            gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        } else {
            const cx = (config.cx ?? 50) / 100 * width;
            const cy = (config.cy ?? 50) / 100 * height;
            const r = (config.r ?? 50) / 100 * Math.max(width, height);
            gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        }

        config.stops.forEach((stop: any) => {
            gradient.addColorStop(stop.offset, stop.color);
        });

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    /**
     * Render a solid color background
     */
    private renderColor(ctx: CanvasRenderingContext2D, width: number, height: number, color: string): void {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, width, height);
    }

    /**
     * Render a grid pattern
     */
    private renderGrid(ctx: CanvasRenderingContext2D, width: number, height: number, config: GridConfig): void {
        const size = config.size || 20;
        const color = config.color || '#e0e0e0';
        const opacity = config.opacity ?? 1.0;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = config.lineWidth || 1;

        switch (config.type) {
            case 'dots':
                this.renderDotGrid(ctx, width, height, size, config.lineWidth || 1);
                break;
            case 'lines':
                this.renderLineGrid(ctx, width, height, size);
                break;
            case 'squares':
                this.renderSquareGrid(ctx, width, height, size);
                break;
            case 'hexagonal':
                this.renderHexGrid(ctx, width, height, size);
                break;
            case 'isometric':
                this.renderIsoGrid(ctx, width, height, size);
                break;
        }

        ctx.restore();
    }

    /**
     * Render a dot grid pattern
     */
    private renderDotGrid(ctx: CanvasRenderingContext2D, width: number, height: number, size: number, radius: number): void {
        const dotRadius = radius;

        for (let x = 0; x < width; x += size) {
            for (let y = 0; y < height; y += size) {
                ctx.beginPath();
                ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    /**
     * Render a line grid pattern
     */
    private renderLineGrid(ctx: CanvasRenderingContext2D, width: number, height: number, size: number): void {
        ctx.beginPath();

        // Vertical lines
        for (let x = 0; x <= width; x += size) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }

        // Horizontal lines
        for (let y = 0; y <= height; y += size) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }

        ctx.stroke();
    }

    /**
     * Render a square grid pattern
     */
    private renderSquareGrid(ctx: CanvasRenderingContext2D, width: number, height: number, size: number): void {
        // Same as line grid for now, can be enhanced to have filled squares, alternating colors, etc.
        this.renderLineGrid(ctx, width, height, size);
    }

    private renderHexGrid(ctx: CanvasRenderingContext2D, width: number, height: number, size: number): void {
        const hexWidth = size * Math.sqrt(3);
        const vertDist = size * 1.5;
        const horizDist = hexWidth;

        for (let y = -size; y < height + size; y += vertDist) {
            const offset = (Math.round(y / vertDist) % 2) * (horizDist / 2);
            for (let x = -hexWidth + offset; x < width + hexWidth; x += horizDist) {
                this.drawHexagon(ctx, x, y, size);
            }
        }
        ctx.stroke();
    }

    private drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 180) * (i * 60 - 30);
            const px = x + size * Math.cos(angle);
            const py = y + size * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
    }

    private renderIsoGrid(ctx: CanvasRenderingContext2D, width: number, height: number, size: number): void {
        const isoWidth = size * Math.sqrt(3);

        ctx.beginPath();
        // 30 degree lines
        for (let x = -width * 2; x < width * 2; x += isoWidth) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x + height * Math.sqrt(3), height);
        }
        // 150 degree lines
        for (let x = -width * 2; x < width * 3; x += isoWidth) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x - height * Math.sqrt(3), height);
        }
        ctx.stroke();
    }

    /**
     * Render a template image
     */
    private renderTemplate(ctx: CanvasRenderingContext2D, width: number, height: number, config: TemplateConfig): void {
        if (!this.templateImage) {
            return;
        }

        const opacity = config.opacity ?? 1.0;
        ctx.save();
        ctx.globalAlpha = opacity;

        // Scale template to fit canvas
        ctx.drawImage(this.templateImage, 0, 0, width, height);

        ctx.restore();
    }
}

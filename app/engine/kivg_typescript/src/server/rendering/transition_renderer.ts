import { Canvas, createCanvas, CanvasRenderingContext2D } from 'canvas';
import { TransitionType } from '../../shared/types';

/**
 * Transition Renderer for Server-side scenes
 * Handles visual transitions between two frames
 */
export class TransitionRenderer {
    /**
     * Render a transition frame between two source canvases
     * @param fromCanvas - The source canvas (outgoing scene)
     * @param toCanvas - The target canvas (incoming scene)
     * @param type - Type of transition
     * @param progress - Progress of the transition (0.0 to 1.0)
     * @returns A new canvas containing the transition frame
     */
    static renderTransition(
        fromCanvas: Canvas,
        toCanvas: Canvas,
        type: TransitionType,
        progress: number,
        handImage?: any,
        pattern?: 'diagonal' | 'horizontal' | 'vertical',
        handOffset?: [number, number],
        handScale?: number,
        resScale?: number,
        eraserScale?: number
    ): Canvas {

        const width = fromCanvas.width;
        const height = fromCanvas.height;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        switch (type) {
            case 'eraser':
                this.renderEraser(ctx, fromCanvas, toCanvas, progress, handImage, pattern, handOffset, handScale, resScale, eraserScale);
                break;

            case 'fade':
                this.renderFade(ctx, fromCanvas, toCanvas, progress);
                break;
            case 'slide_left':
                this.renderSlide(ctx, fromCanvas, toCanvas, progress, 'left');
                break;
            case 'slide_right':
                this.renderSlide(ctx, fromCanvas, toCanvas, progress, 'right');
                break;
            case 'slide_up':
            case 'slide_top':
                this.renderSlide(ctx, fromCanvas, toCanvas, progress, 'up');
                break;
            case 'slide_down':
            case 'slide_bottom':
                this.renderSlide(ctx, fromCanvas, toCanvas, progress, 'down');
                break;
            case 'wipe':
            case 'wipe_right':
                this.renderWipe(ctx, fromCanvas, toCanvas, progress, 'right');
                break;
            case 'wipe_left':
                this.renderWipe(ctx, fromCanvas, toCanvas, progress, 'left');
                break;
            case 'wipe_up':
                this.renderWipe(ctx, fromCanvas, toCanvas, progress, 'up');
                break;
            case 'wipe_down':
                this.renderWipe(ctx, fromCanvas, toCanvas, progress, 'down');
                break;
            case 'iris':
                this.renderIris(ctx, fromCanvas, toCanvas, progress);
                break;
            case 'fade_to_black':
                this.renderFadeThrough(ctx, fromCanvas, toCanvas, progress, '#000000');
                break;
            case 'fade_to_white':
                this.renderFadeThrough(ctx, fromCanvas, toCanvas, progress, '#ffffff');
                break;
            case 'zoom':
            case 'zoom_in':
                this.renderZoom(ctx, fromCanvas, toCanvas, progress, 'in');
                break;
            case 'zoom_out':
                this.renderZoom(ctx, fromCanvas, toCanvas, progress, 'out');
                break;
            case 'rotate':
                this.renderRotate(ctx, fromCanvas, toCanvas, progress);
                break;
            case 'none':
            default:
                // Just show the 'to' canvas if progress > 0.5, else 'from'
                ctx.drawImage(progress < 0.5 ? fromCanvas : toCanvas, 0, 0);
                break;
        }

        return canvas;
    }

    /**
     * Cross-fade transition
     */
    private static renderFade(
        ctx: CanvasRenderingContext2D,
        from: Canvas,
        to: Canvas,
        progress: number
    ): void {
        // Draw 'from' canvas
        ctx.globalAlpha = 1 - progress;
        ctx.drawImage(from, 0, 0);

        // Draw 'to' canvas on top
        ctx.globalAlpha = progress;
        ctx.drawImage(to, 0, 0);
        ctx.globalAlpha = 1.0;
    }

    /**
     * Slide transition
     */
    private static renderSlide(
        ctx: CanvasRenderingContext2D,
        from: Canvas,
        to: Canvas,
        progress: number,
        direction: 'left' | 'right' | 'up' | 'down'
    ): void {
        const width = from.width;
        const height = from.height;

        let fromX = 0, fromY = 0;
        let toX = 0, toY = 0;

        switch (direction) {
            case 'left':
                fromX = -progress * width;
                toX = width - progress * width;
                break;
            case 'right':
                fromX = progress * width;
                toX = -width + progress * width;
                break;
            case 'up':
                fromY = -progress * height;
                toY = height - progress * height;
                break;
            case 'down':
                fromY = progress * height;
                toY = -height + progress * height;
                break;
        }

        ctx.drawImage(from, fromX, fromY);
        ctx.drawImage(to, toX, toY);
    }

    /**
     * Wipe transition
     */
    private static renderWipe(
        ctx: CanvasRenderingContext2D,
        from: Canvas,
        to: Canvas,
        progress: number,
        direction: 'left' | 'right' | 'up' | 'down' = 'right'
    ): void {
        const width = from.width;
        const height = from.height;

        // Draw 'from' canvas
        ctx.drawImage(from, 0, 0);

        // Draw 'to' canvas with clipping
        ctx.save();
        ctx.beginPath();

        switch (direction) {
            case 'right':
                ctx.rect(0, 0, progress * width, height);
                break;
            case 'left':
                ctx.rect(width - progress * width, 0, progress * width, height);
                break;
            case 'up':
                ctx.rect(0, height - progress * height, width, progress * height);
                break;
            case 'down':
                ctx.rect(0, 0, width, progress * height);
                break;
        }

        ctx.clip();
        ctx.drawImage(to, 0, 0);
        ctx.restore();
    }

    /**
     * Iris transition (circle expanding from center)
     */
    private static renderIris(
        ctx: CanvasRenderingContext2D,
        from: Canvas,
        to: Canvas,
        progress: number
    ): void {
        const width = from.width;
        const height = from.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);
        const radius = progress * maxRadius;

        ctx.drawImage(from, 0, 0);

        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(to, 0, 0);
        ctx.restore();
    }

    /**
     * Fade through a color (e.g., black or white)
     */
    private static renderFadeThrough(
        ctx: CanvasRenderingContext2D,
        from: Canvas,
        to: Canvas,
        progress: number,
        color: string
    ): void {
        const width = from.width;
        const height = from.height;

        if (progress < 0.5) {
            // Fade from 'from' to color
            const localProgress = progress * 2;
            ctx.drawImage(from, 0, 0);
            ctx.globalAlpha = localProgress;
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, width, height);
        } else {
            // Fade from color to 'to'
            const localProgress = (progress - 0.5) * 2;
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, width, height);
            ctx.globalAlpha = localProgress;
            ctx.drawImage(to, 0, 0);
        }
        ctx.globalAlpha = 1.0;
    }

    /**
     * Zoom transition
     */
    private static renderZoom(
        ctx: CanvasRenderingContext2D,
        from: Canvas,
        to: Canvas,
        progress: number,
        direction: 'in' | 'out'
    ): void {
        const width = from.width;
        const height = from.height;

        if (direction === 'in') {
            // Zoom into 'to' canvas
            ctx.drawImage(from, 0, 0);
            ctx.globalAlpha = progress;
            const scale = 0.5 + 0.5 * progress;
            const w = width * scale;
            const h = height * scale;
            const x = (width - w) / 2;
            const y = (height - h) / 2;
            ctx.drawImage(to, x, y, w, h);
        } else {
            // Zoom out of 'from' canvas
            const scale = 1.0 + progress;
            const w = width * scale;
            const h = height * scale;
            const x = (width - w) / 2;
            const y = (height - h) / 2;
            ctx.drawImage(from, x, y, w, h);
            ctx.globalAlpha = progress;
            ctx.drawImage(to, 0, 0);
        }
        ctx.globalAlpha = 1.0;
    }

    /**
     * Rotate transition
     */
    private static renderRotate(
        ctx: CanvasRenderingContext2D,
        from: Canvas,
        to: Canvas,
        progress: number
    ): void {
        const width = from.width;
        const height = from.height;
        const centerX = width / 2;
        const centerY = height / 2;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(progress * Math.PI * 2);
        ctx.translate(-centerX, -centerY);
        ctx.globalAlpha = 1 - progress;
        ctx.drawImage(from, 0, 0);
        ctx.restore();

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate((progress - 1) * Math.PI * 2);
        ctx.translate(-centerX, -centerY);
        ctx.globalAlpha = progress;
        ctx.drawImage(to, 0, 0);
        ctx.restore();

        ctx.globalAlpha = 1.0;
    }

    /**
     * Eraser transition
     * Simulates a hand erasing the 'from' canvas to reveal the 'to' canvas
     */
    private static renderEraser(
        ctx: CanvasRenderingContext2D,
        from: Canvas,
        to: Canvas,
        progress: number,
        handImage?: any, // Using 'any' for Image type compatibility
        pattern: 'diagonal' | 'horizontal' | 'vertical' = 'diagonal',
        handOffset?: [number, number],
        handScale?: number,
        resScale?: number,
        eraserScale?: number
    ): void {
        const width = from.width;
        const height = from.height;

        // 1. Draw the 'to' canvas (background/next scene)
        ctx.drawImage(to, 0, 0);

        // 2. Draw the 'from' canvas (current scene) on top
        // We will erase parts of it using destination-out
        const layerCanvas = createCanvas(width, height);
        const layerCtx = layerCanvas.getContext('2d');
        layerCtx.drawImage(from, 0, 0);

        // Calculate resolution scale
        // resScale: scale for hand/UI elements (based on output target vs 800px design)
        // eraserScale: scale for content-related eraser radius/path (based on viewportScale * zoom)
        const finalResScale = resScale ?? (width / 800);
        const finalEraserScale = eraserScale ?? finalResScale;

        // 3. Generate eraser path based on pattern
        const radius = 50 * finalEraserScale; // Scaled radius/spacing

        let path: { x: number, y: number }[];

        switch (pattern) {
            case 'horizontal':
                path = this.generateHorizontalPath(width, height, radius);
                break;
            case 'vertical':
                path = this.generateVerticalPath(width, height, radius);
                break;
            case 'diagonal':
            default:
                path = this.generateDiagonalPath(width, height, radius);
                break;
        }

        // 4. Erase along the path based on progress
        layerCtx.globalCompositeOperation = 'destination-out';
        layerCtx.lineCap = 'round';
        layerCtx.lineJoin = 'round';
        layerCtx.lineWidth = 100 * finalEraserScale; // Scaled eraser size


        const totalLength = this.getPathLength(path);
        const targetLength = totalLength * progress;

        let currentLength = 0;
        layerCtx.beginPath();
        if (path.length > 0) {
            layerCtx.moveTo(path[0].x, path[0].y);

            for (let i = 1; i < path.length; i++) {
                const p1 = path[i - 1];
                const p2 = path[i];
                const segmentLength = Math.hypot(p2.x - p1.x, p2.y - p1.y);

                if (currentLength + segmentLength > targetLength) {
                    // Partial segment
                    const remaining = targetLength - currentLength;
                    const ratio = remaining / segmentLength;
                    const x = p1.x + (p2.x - p1.x) * ratio;
                    const y = p1.y + (p2.y - p1.y) * ratio;
                    layerCtx.lineTo(x, y);
                    break;
                } else {
                    layerCtx.lineTo(p2.x, p2.y);
                    currentLength += segmentLength;
                }
            }
        }
        layerCtx.stroke();

        // Draw the masked layer onto the main context
        ctx.drawImage(layerCanvas, 0, 0);

        // 5. Draw hand overlay if image provided
        if (handImage && progress < 1.0) {
            // Find current hand position
            let handX = 0;
            let handY = 0;

            // Re-calculate current position (could be optimized)
            currentLength = 0;
            if (path.length > 0) {
                handX = path[0].x;
                handY = path[0].y;

                for (let i = 1; i < path.length; i++) {
                    const p1 = path[i - 1];
                    const p2 = path[i];
                    const segmentLength = Math.hypot(p2.x - p1.x, p2.y - p1.y);

                    if (currentLength + segmentLength > targetLength) {
                        const remaining = targetLength - currentLength;
                        const ratio = remaining / segmentLength;
                        handX = p1.x + (p2.x - p1.x) * ratio;
                        handY = p1.y + (p2.y - p1.y) * ratio;
                        break;
                    } else {
                        handX = p2.x;
                        handY = p2.y;
                        currentLength += segmentLength;
                    }
                }
            }

            // Draw hand
            // IMPORTANT: Hand scale and offset must also be scaled by resolution
            const baseScale = handScale ?? 0.4;
            const handRenderScale = baseScale * finalResScale;

            const handWidth = handImage.width * handRenderScale;
            const handHeight = handImage.height * handRenderScale;

            // Offset from configuration (design space) scaled to resolution space
            const baseOffsetX = handOffset ? handOffset[0] : -150;
            const baseOffsetY = handOffset ? handOffset[1] : -40;

            const offsetX = baseOffsetX * finalResScale;
            const offsetY = baseOffsetY * finalResScale;

            ctx.drawImage(handImage, handX + offsetX, handY + offsetY, handWidth, handHeight);

        }
    }

    /**
     * Generate a diagonal zigzag path (bottom-left to top-right diagonals)
     */
    private static generateDiagonalPath(width: number, height: number, radius: number): { x: number, y: number }[] {
        const path: { x: number, y: number }[] = [];
        const step = radius * 1.5;
        let direction = 1;

        // Iterate through diagonals defined by x + y = k
        // k ranges from 0 to width + height
        for (let k = 0; k <= width + height + radius; k += step) {
            // Find intersection of x + y = k with the bounding box
            // x range: [max(0, k - height), min(width, k)]
            const xMin = Math.max(-radius, k - (height + radius));
            const xMax = Math.min(width + radius, k + radius);

            if (xMin > xMax) continue;

            const p1 = { x: xMin, y: k - xMin };
            const p2 = { x: xMax, y: k - xMax };

            if (direction === 1) {
                path.push(p1);
                path.push(p2);
            } else {
                path.push(p2);
                path.push(p1);
            }
            direction *= -1;
        }
        return path;
    }

    /**
     * Generate a horizontal zigzag path
     */
    private static generateHorizontalPath(width: number, height: number, radius: number): { x: number, y: number }[] {
        const path: { x: number, y: number }[] = [];
        const stepY = radius * 1.5;
        let y = 0;
        let direction = 1; // 1 for right, -1 for left

        while (y < height + radius) {
            if (direction === 1) {
                path.push({ x: -radius, y: y });
                path.push({ x: width + radius, y: y });
            } else {
                path.push({ x: width + radius, y: y });
                path.push({ x: -radius, y: y });
            }
            y += stepY;
            direction *= -1;
        }
        return path;
    }

    /**
     * Generate a vertical zigzag path
     */
    private static generateVerticalPath(width: number, height: number, radius: number): { x: number, y: number }[] {
        const path: { x: number, y: number }[] = [];
        const stepX = radius * 1.5;
        let x = 0;
        let direction = 1; // 1 for down, -1 for up

        while (x < width + radius) {
            if (direction === 1) {
                path.push({ x: x, y: -radius });
                path.push({ x: x, y: height + radius });
            } else {
                path.push({ x: x, y: height + radius });
                path.push({ x: x, y: -radius });
            }
            x += stepX;
            direction *= -1;
        }
        return path;
    }

    /**
     * Calculate total length of a path
     */
    private static getPathLength(path: { x: number, y: number }[]): number {
        let length = 0;
        for (let i = 1; i < path.length; i++) {
            length += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
        }
        return length;
    }
}

/**
 * ServerSvgLayer - Server-side SVG animation player
 * 
 * This is the server-side equivalent of the frontend SvgLayer class.
 * It provides frame-based SVG animation rendering using node-canvas.
 */

import { createCanvas, Canvas, CanvasRenderingContext2D, ImageData } from 'canvas';
import { ServerLayer } from './layer';
import { LayerConfig, AnimationType, WhiteboardConfig } from '../../shared/types';
import { resolveAssetPath, loadAssetFromPath } from '../utils/path_utils';
import { JSDOM } from 'jsdom';
import { svgPathProperties } from 'svg-path-properties';
// @ts-ignore
import { parseSVG, makeAbsolute } from 'svg-path-parser';
import { shapeToPath } from '../utils/svg_utils';

export interface ServerSvgLayerConfig extends LayerConfig {
    fps?: number;
    duration?: number;
    fill?: boolean;
    lineWidth?: number;
    lineDash?: [number, number][];
    lineColor?: [number, number, number, number];
    autoPlay?: boolean;
    loop?: boolean;
    handOverlayEnabled?: boolean;
    handImageUrl?: string;
    handScale?: number;
    handOffset?: [number, number];
    handAnchorTopLeft?: boolean;
    handAnchorPoint?: [number, number];
    svgContent?: string;
    svgUrl?: string;
}

export interface ServerSvgLayerControls {
    play: () => Promise<void>;
    pause: () => void;
    stop: () => void;
    restart: () => Promise<void>;
    clear: () => void;
    loadSvg: (svgContent: string) => Promise<void>;
    loadSvgFromUrl: (url: string) => Promise<void>;
}

export class ServerSvgLayer extends ServerLayer {
    private playerConfig: ServerSvgLayerConfig;
    private svgContent: string | null = null;
    private svgUrl: string | null = null;
    private frames: ImageData[] = [];
    private isPlaying: boolean = false;
    private isPaused: boolean = false;
    private currentFrame: number = 0;
    private drawingPositions: ([number, number] | null)[] = [];
    private offscreenCanvas: Canvas;
    private offscreenCtx: CanvasRenderingContext2D;
    private fullShapeImageData: ImageData | null = null;
    private svgViewBox: { x: number, y: number, width: number, height: number } | null = null;
    private paths: Array<{
        d: string;
        properties: any;
        commands: any[];
        stroke: string;
        fill: string;
        strokeWidth: number;
        length: number;
    }> = [];
    private totalAnimationLength: number = 0;

    constructor(config: ServerSvgLayerConfig, handsConfig?: WhiteboardConfig['hands']) {
        const processedConfig: any = config ? { ...config } : {};

        const hasLegacyHandProperties =
            processedConfig.handOverlayEnabled !== undefined ||
            processedConfig.handImageUrl !== undefined ||
            processedConfig.handScale !== undefined ||
            processedConfig.handOffset !== undefined ||
            processedConfig.handAnchorPoint !== undefined ||
            processedConfig.handAnchorTopLeft !== undefined;

        if (!processedConfig.handOverlay && hasLegacyHandProperties) {
            processedConfig.handOverlay = {
                enabled: processedConfig.handOverlayEnabled ?? false,
            };
        }

        const defaultConfig: ServerSvgLayerConfig = {
            id: 'server-svg-layer-' + Math.random().toString(36).substring(2, 11),
            type: 'svg_layer',
            position: { x: 0, y: 0 },
            opacity: 1,
            scale: 1,
            rotation: 0,
            fps: 30,
            duration: 0.05,
            fill: true,
            lineWidth: 2,
            lineColor: [0, 0, 0, 255],
            autoPlay: false,
            loop: false,
            width: 512,
            height: 512,
            ...processedConfig
        };

        // Backward compatibility for ServerKivgLayer properties
        if (processedConfig.svg_path && !defaultConfig.svgUrl) {
            defaultConfig.svgUrl = processedConfig.svg_path;
        }
        if (processedConfig.kivgConfig) {
            const kc = processedConfig.kivgConfig;
            if (kc.strokeWidth !== undefined) defaultConfig.lineWidth = kc.strokeWidth;
            if (kc.lineWidth !== undefined) defaultConfig.lineWidth = kc.lineWidth;
            if (kc.fill !== undefined) defaultConfig.fill = kc.fill;
        }

        super(defaultConfig, handsConfig);
        this.playerConfig = defaultConfig;

        this.offscreenCanvas = createCanvas(
            this.playerConfig.width || 512,
            this.playerConfig.height || 512
        );
        this.offscreenCtx = this.offscreenCanvas.getContext('2d');

        if (this.playerConfig.svgUrl) {
            this.svgUrl = this.playerConfig.svgUrl;
        } else if (this.playerConfig.svgContent) {
            this.svgContent = this.playerConfig.svgContent;
        }
    }

    protected async doPrepare(): Promise<void> {
        await super.doPrepare();

        // Refresh from config in case it was modified dynamically (e.g. by TextLayer)
        const svgUrl = this.playerConfig.svgUrl || (this.config as any).svgUrl || (this.config as any).svg_path;
        const svgContent = this.playerConfig.svgContent || (this.config as any).svgContent;

        if (svgUrl) {
            await this.loadSvgFromUrl(svgUrl);
        } else if (svgContent) {
            await this.loadSvg(svgContent);
        }
    }

    async loadSvg(svgContent: string): Promise<void> {
        try {
            this.clearFrames();
            this.svgContent = svgContent;
            const frames = await this.generateFramesFromPaths(svgContent);

            if (!frames || frames.length === 0) {
                throw new Error('Failed to generate animation frames');
            }

            this.frames = frames;
            this.currentFrame = 0;
        } catch (error) {
            console.error('[ServerSvgLayer] Failed to load SVG:', error);
            throw error;
        }
    }

    async loadSvgFromUrl(url: string): Promise<void> {
        try {
            this.svgUrl = url;
            let svgContent: string;

            if (url.startsWith('http://') || url.startsWith('https://')) {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Failed to fetch SVG: ${response.statusText}`);
                svgContent = await response.text();
            } else {
                const absolutePath = resolveAssetPath(url);
                const buffer = await loadAssetFromPath(absolutePath, 'svg');
                svgContent = buffer.toString('utf8');
            }

            await this.loadSvg(svgContent);
        } catch (error) {
            console.error(`[ServerSvgLayer] Failed to load SVG from ${url}:`, error);
            throw error;
        }
    }

    private async generateFramesFromPaths(svgContent: string): Promise<ImageData[]> {
        const frames: ImageData[] = [];
        const fps = this.playerConfig.fps || 30;
        const duration = this.playerConfig.duration || 0.05;
        const totalFrames = Math.max(2, Math.floor(fps * duration));

        const dom = new JSDOM(svgContent);
        const doc = dom.window.document;
        const svgEl = doc.querySelector('svg');

        if (!svgEl) throw new Error('No SVG element found in content');

        const viewBox = svgEl.getAttribute('viewBox');
        if (viewBox) {
            const parts = viewBox.split(/[\s,]+/).map(parseFloat);
            if (parts.length === 4) {
                this.svgViewBox = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
            }
        }

        const elements = doc.querySelectorAll('path, rect, circle, ellipse, line, polyline, polygon');
        this.paths = [];
        this.totalAnimationLength = 0;

        elements.forEach((el: Element) => {
            let d = el.getAttribute('d') || shapeToPath(el);
            if (d) {
                try {
                    const commands = makeAbsolute(parseSVG(d));
                    const properties = new svgPathProperties(d);
                    const length = properties.getTotalLength();
                    if (length < 1) return;

                    const elementStroke = el.getAttribute('stroke');
                    const elementFill = el.getAttribute('fill');
                    const elementStrokeWidth = el.getAttribute('stroke-width');

                    const stroke = this.playerConfig.lineColor
                        ? `rgba(${this.playerConfig.lineColor[0]},${this.playerConfig.lineColor[1]},${this.playerConfig.lineColor[2]},${this.playerConfig.lineColor[3] / 255})`
                        : (elementStroke || '#000000');

                    const fill = this.playerConfig.fill ? (elementFill || 'none') : 'none';
                    const strokeWidth = this.playerConfig.lineWidth !== undefined
                        ? this.playerConfig.lineWidth
                        : parseFloat(elementStrokeWidth || '2');

                    this.paths.push({ d, properties, commands, stroke, fill, strokeWidth, length });
                    this.totalAnimationLength += length;
                } catch (e) {
                    console.warn(`[ServerSvgLayer] Failed to parse path:`, e);
                }
            }
        });

        for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
            const progress = frameIndex / (totalFrames - 1);
            this.offscreenCtx.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);

            const currentLength = this.totalAnimationLength * progress;
            let accumulatedLength = 0;
            let drawingPosition: [number, number] | null = null;

            this.offscreenCtx.save();
            const transformInfo = this.getSVGTransformInfo();
            if (transformInfo) {
                this.offscreenCtx.scale(transformInfo.scale, transformInfo.scale);
                this.offscreenCtx.translate(transformInfo.translateX, transformInfo.translateY);
            }

            for (const path of this.paths) {
                const pathEndLength = accumulatedLength + path.length;
                let pathLocalProgress = 0;
                if (currentLength >= pathEndLength) pathLocalProgress = 1;
                else if (currentLength > accumulatedLength) pathLocalProgress = (currentLength - accumulatedLength) / path.length;

                if (pathLocalProgress > 0) {
                    this.offscreenCtx.beginPath();
                    this.drawCommands(this.offscreenCtx, path.commands);

                    if (path.stroke !== 'none' && path.strokeWidth > 0) {
                        this.offscreenCtx.strokeStyle = path.stroke;
                        this.offscreenCtx.lineWidth = path.strokeWidth;
                        if (pathLocalProgress < 1.0) {
                            const drawLen = path.length * pathLocalProgress;
                            this.offscreenCtx.setLineDash([drawLen, path.length - drawLen]);
                        } else {
                            this.offscreenCtx.setLineDash([]);
                        }
                        this.offscreenCtx.stroke();
                    }

                    if (pathLocalProgress > 0 && pathLocalProgress < 1 && !drawingPosition) {
                        const point = path.properties.getPointAtLength(path.length * pathLocalProgress);
                        drawingPosition = [point.x, point.y];
                    }
                }
                accumulatedLength = pathEndLength;
            }

            if (this.playerConfig.fill && progress >= 1) {
                for (const path of this.paths) {
                    if (path.fill === 'none') continue;
                    this.offscreenCtx.beginPath();
                    this.drawCommands(this.offscreenCtx, path.commands);
                    this.offscreenCtx.fillStyle = path.fill;
                    this.offscreenCtx.fill();
                }
            }
            this.offscreenCtx.restore();

            frames.push(this.offscreenCtx.getImageData(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height));
            this.drawingPositions.push(drawingPosition);
        }

        return frames;
    }

    private drawCommands(ctx: CanvasRenderingContext2D, commands: any[]): void {
        let currentX = 0, currentY = 0, lastControlX = 0, lastControlY = 0, lastQuadControlX = 0, lastQuadControlY = 0;
        for (const cmd of commands) {
            switch (cmd.code) {
                case 'M': ctx.moveTo(cmd.x, cmd.y); currentX = cmd.x; currentY = cmd.y; break;
                case 'L': ctx.lineTo(cmd.x, cmd.y); currentX = cmd.x; currentY = cmd.y; break;
                case 'H': ctx.lineTo(cmd.x, currentY); currentX = cmd.x; break;
                case 'V': ctx.lineTo(currentX, cmd.y); currentY = cmd.y; break;
                case 'C': ctx.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y); lastControlX = cmd.x2; lastControlY = cmd.y2; currentX = cmd.x; currentY = cmd.y; break;
                case 'S':
                    const cx1 = 2 * currentX - lastControlX;
                    const cy1 = 2 * currentY - lastControlY;
                    ctx.bezierCurveTo(cx1, cy1, cmd.x2, cmd.y2, cmd.x, cmd.y);
                    lastControlX = cmd.x2; lastControlY = cmd.y2; currentX = cmd.x; currentY = cmd.y;
                    break;
                case 'Q': ctx.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y); lastQuadControlX = cmd.x1; lastQuadControlY = cmd.y1; currentX = cmd.x; currentY = cmd.y; break;
                case 'T':
                    const qx1 = 2 * currentX - lastQuadControlX;
                    const qy1 = 2 * currentY - lastQuadControlY;
                    ctx.quadraticCurveTo(qx1, qy1, cmd.x, cmd.y);
                    lastQuadControlX = qx1; lastQuadControlY = qy1; currentX = cmd.x; currentY = cmd.y;
                    break;
                case 'A': ctx.lineTo(cmd.x, cmd.y); currentX = cmd.x; currentY = cmd.y; break;
                case 'Z': case 'z': ctx.closePath(); break;
            }
        }
    }

    private clearFrames(): void {
        this.frames = [];
        this.drawingPositions = [];
        this.fullShapeImageData = null;
    }

    async play(targetDurationSeconds?: number, initialProgress: number = 0): Promise<void> {
        if (this.frames.length === 0) return;
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.isPaused = false;
        this.currentFrame = Math.floor(initialProgress * this.frames.length);

        const fps = this.playerConfig.fps || 30;
        const frameInterval = targetDurationSeconds ? (targetDurationSeconds * 1000) / this.frames.length : 1000 / fps;

        return new Promise<void>((resolve) => {
            const playNextFrame = () => {
                if (!this.isPlaying || this.isPaused) {
                    resolve();
                    return;
                }
                this.currentFrame++;
                if (this.currentFrame >= this.frames.length) {
                    if (this.playerConfig.loop) {
                        this.currentFrame = 0;
                        setTimeout(playNextFrame, frameInterval);
                    } else {
                        this.isPlaying = false;
                        resolve();
                    }
                } else {
                    setTimeout(playNextFrame, frameInterval);
                }
            };
            playNextFrame();
        });
    }

    pause(): void { this.isPaused = true; }
    stop(): void { this.isPlaying = false; this.isPaused = false; this.currentFrame = 0; }
    async restart(): Promise<void> { this.stop(); return this.play(); }
    clear(): void { this.stop(); this.clearFrames(); this.svgContent = null; this.svgUrl = null; }

    seek(progress: number): void {
        if (this.frames.length === 0) return;
        this.currentFrame = Math.max(0, Math.min(Math.floor(progress * (this.frames.length - 1)), this.frames.length - 1));
        if (this.handOverlayManager && this.drawingPositions[this.currentFrame]) {
            const pos = this.drawingPositions[this.currentFrame];
            if (pos) {
                this.currentHandPosition = this.handOverlayManager.calculateHandPosition(progress, {
                    currentPoint: { x: pos[0], y: pos[1] }
                }, (p) => this.transformToGlobal(p));
            }
        }
    }

    async doRender(ctx: CanvasRenderingContext2D, time: number): Promise<void> {
        if (this.frames.length === 0) return;
        const animationType = this.config.entrance_animation?.type || 'draw';
        let progress = 0;
        if (animationType === 'draw' || animationType === 'stroke') {
            const fps = this.playerConfig.fps || 30;
            const totalDuration = (this.frames.length / fps) * 1000;
            progress = Math.min(1, time / totalDuration);
        } else {
            progress = 1;
        }

        const frameIndex = Math.max(0, Math.min(Math.floor(progress * (this.frames.length - 1)), this.frames.length - 1));
        const frame = this.frames[frameIndex];

        if (frame) {
            const tempCanvas = createCanvas(this.offscreenCanvas.width, this.offscreenCanvas.height);
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(frame, 0, 0);
            ctx.drawImage(tempCanvas, 0, 0);
        }

        if (this.handOverlayManager && this.drawingPositions[frameIndex]) {
            const pos = this.drawingPositions[frameIndex];
            if (pos) {
                this.currentHandPosition = this.handOverlayManager.calculateHandPosition(progress, {
                    currentPoint: { x: pos[0], y: pos[1] }
                }, (p) => this.transformToGlobalAnimated(p, time));
            }
        }
    }

    private getSVGTransformInfo(): { scale: number, translateX: number, translateY: number } | null {
        if (!this.svgViewBox) return null;
        const width = this.playerConfig.width || this.svgViewBox.width;
        const height = this.playerConfig.height || this.svgViewBox.height;
        const scale = Math.min(width / this.svgViewBox.width, height / this.svgViewBox.height);
        const offsetX = (width - this.svgViewBox.width * scale) / 2 / scale;
        const offsetY = (height - this.svgViewBox.height * scale) / 2 / scale;
        return { scale, translateX: -this.svgViewBox.x + offsetX, translateY: -this.svgViewBox.y + offsetY };
    }

    public transformToGlobal(point: { x: number; y: number }): { x: number; y: number } {
        const transformInfo = this.getSVGTransformInfo();
        let { x, y } = point;
        if (transformInfo) {
            x = (x + transformInfo.translateX) * transformInfo.scale;
            y = (y + transformInfo.translateY) * transformInfo.scale;
        }
        return super.transformToGlobal({ x, y });
    }

    public transformToGlobalAnimated(point: { x: number; y: number }, time: number): { x: number; y: number } {
        const transformInfo = this.getSVGTransformInfo();
        let { x, y } = point;
        if (transformInfo) {
            x = (x + transformInfo.translateX) * transformInfo.scale;
            y = (y + transformInfo.translateY) * transformInfo.scale;
        }
        return super.transformToGlobalAnimated({ x, y }, time);
    }

    public async renderAsMask(ctx: CanvasRenderingContext2D, time: number, forceFull: boolean = false): Promise<void> {
        if (this.paths.length === 0) return;
        const progress = forceFull ? 1.0 : (this.config.entrance_animation?.type === 'draw' ? Math.min(1, time / ((this.frames.length / (this.playerConfig.fps || 30)) * 1000)) : 1.0);

        ctx.save();
        this.applyTransform(ctx, progress, time);
        if (this.isCentered()) ctx.translate(-(this.config.width || 0) / 2, -(this.config.height || 0) / 2);

        const transformInfo = this.getSVGTransformInfo();
        if (transformInfo) {
            ctx.scale(transformInfo.scale, transformInfo.scale);
            ctx.translate(transformInfo.translateX, transformInfo.translateY);
        }

        const DILATION = 12;
        ctx.strokeStyle = 'black';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const currentLength = this.totalAnimationLength * progress;
        let accumulatedLength = 0;

        for (const path of this.paths) {
            const pathEndLength = accumulatedLength + path.length;
            let pathLocalProgress = 0;
            if (currentLength >= pathEndLength) pathLocalProgress = 1;
            else if (currentLength > accumulatedLength) pathLocalProgress = (currentLength - accumulatedLength) / path.length;

            if (pathLocalProgress > 0) {
                ctx.beginPath();
                this.drawCommands(ctx, path.commands);
                ctx.lineWidth = path.strokeWidth + DILATION;
                if (pathLocalProgress < 1.0) {
                    const drawLen = path.length * pathLocalProgress;
                    ctx.setLineDash([drawLen, path.length - drawLen]);
                } else {
                    ctx.setLineDash([]);
                }
                ctx.stroke();
            }
            accumulatedLength = pathEndLength;
        }
        ctx.restore();
    }
}

import { CanvasRenderingContext2D } from 'canvas';
import { ServerLayer } from '../core/layer';
import { LayerConfig, WhiteboardConfig, SvgPathLayerConfig } from '../../shared/types';
import { TimingManager } from '../../shared/infra/timing_manager';
import { JSDOM } from 'jsdom';
import { resolveAssetPath, loadAssetFromPath } from '../utils/path_utils';

import * as path from 'path';
import * as fs from 'fs';
import { svgPathProperties } from 'svg-path-properties';
// @ts-ignore
import { parseSVG, makeAbsolute } from 'svg-path-parser';
import { arcToBezier, shapeToPath } from '../utils/svg_utils';
import { PathDrawingHandStrategy } from '../../shared/core/hand_overlay_manager';

interface PathInfo {
    d: string;
    properties: any;
    commands: any[];
    stroke: string;
    fill: string;
    strokeWidth: number;
    length: number;
    transforms?: string[];
}

export class ServerSvgPathLayer extends ServerLayer {
    protected paths: PathInfo[] = [];
    private defaultStrokeColor: string = '#000000';
    private defaultFillColor: string = 'none';
    private defaultStrokeWidth: number = 2;
    protected svgViewBox: { x: number, y: number, width: number, height: number } | null = null;
    protected totalAnimationLength: number = 0;
    protected pathAnimationData: Array<{
        pathIndex: number;
        length: number;
        cumulativeLength: number;
        isGap: boolean;
    }> = [];

    // Cache for hand position calculation to improve performance
    private lastCalculatedHandPosition: {
        progress: number,
        position: { x: number, y: number, rotation?: number } | null
    } | null = null;

    constructor(config: LayerConfig, handsConfig?: WhiteboardConfig['hands']) {
        super(config, handsConfig);
        const kivgConfig = (config as any).kivgConfig || {};
        this.defaultStrokeColor = kivgConfig.strokeColor || '#000000';
        this.defaultFillColor = kivgConfig.fillColor || 'none';
        this.defaultStrokeWidth = kivgConfig.strokeWidth || 2;

        if (this.handOverlayManager) {
            this.handOverlayManager.setStrategy(new PathDrawingHandStrategy());
        }
    }

    protected async doPrepare(): Promise<void> {
        await super.doPrepare();

        // Clear existing paths and animation data to prevent duplication if prepare is called multiple times
        this.paths = [];
        this.pathAnimationData = [];
        this.totalAnimationLength = 0;

        const svgContent = (this.config as any).svgContent;
        const svgUrl = (this.config as any).svgUrl;
        let svgPath = (this.config as any).svg_path || (this.config as any).pathData;

        let content = svgContent;

        // If svg_path is a file path, read it
        if (svgPath && !content && !svgUrl) {
            try {
                // Check if it looks like a file path (contains / or .svg)
                if (svgPath.includes('/') || svgPath.toLowerCase().endsWith('.svg')) {
                    const absolutePath = resolveAssetPath(svgPath);
                    const buffer = await loadAssetFromPath(absolutePath, 'svg');
                    content = buffer.toString('utf8');
                }
            } catch (e) {
                console.warn(`Failed to read SVG file from ${svgPath}:`, e);
            }
        }

        if (!content && svgUrl) {
            try {
                if (svgUrl.startsWith('http://') || svgUrl.startsWith('https://')) {
                    const response = await fetch(svgUrl);
                    if (response.ok) {
                        content = await response.text();
                    }
                } else {
                    // Local path
                    const absolutePath = resolveAssetPath(svgUrl);
                    const buffer = await loadAssetFromPath(absolutePath, 'svg');
                    content = buffer.toString('utf8');
                }
            } catch (e) {
                console.error(`Failed to load SVG from ${svgUrl}:`, e);
            }
        }

        if (content) {
            console.log(`[ServerSvgPathLayer] Parsing SVG content (${content.length} chars)`);
            const dom = new JSDOM(content);
            const doc = dom.window.document;
            const svgEl = doc.querySelector('svg');

            if (svgEl) {
                const viewBox = svgEl.getAttribute('viewBox');
                if (viewBox) {
                    const parts = viewBox.split(/[\s,]+/).map(parseFloat);
                    if (parts.length === 4) {
                        this.svgViewBox = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
                        console.log(`[ServerSvgPathLayer] Found viewBox:`, this.svgViewBox);
                    }
                }
            }

            // Find all path-like elements
            const elements = doc.querySelectorAll('path, rect, circle, ellipse, line, polyline, polygon');
            console.log(`[ServerSvgPathLayer] Found ${elements.length} elements`);
            elements.forEach(el => {
                let d = el.getAttribute('d');
                if (!d) {
                    d = shapeToPath(el);
                }

                if (d) {
                    // Prioritize attributes from the element, but allow overrides from kivgConfig
                    const elementStroke = el.getAttribute('stroke');
                    const elementFill = el.getAttribute('fill');
                    const elementStrokeWidth = el.getAttribute('stroke-width');

                    const kivgConfig = (this.config as any).kivgConfig || {};

                    const stroke = kivgConfig.strokeColor || elementStroke || '#000000';
                    let fill = kivgConfig.fillColor || elementFill || 'none';
                    const strokeWidth = kivgConfig.strokeWidth !== undefined ? kivgConfig.strokeWidth :
                        (elementStrokeWidth ? parseFloat(elementStrokeWidth) : 2);

                    // Support group transforms (simple ones)
                    // We'll collect all parent transforms
                    let current: Element | null = el;
                    const transforms: string[] = [];
                    while (current && current.tagName.toLowerCase() !== 'svg') {
                        const transform = current.getAttribute('transform');
                        if (transform) {
                            transforms.unshift(transform);
                        }
                        current = current.parentElement;
                    }

                    this.addPath(d, stroke, fill, strokeWidth, transforms);
                }
            });
            console.log(`[ServerSvgPathLayer] Extracted ${this.paths.length} paths`);
        } else if (svgPath) {
            console.log(`[ServerSvgPathLayer] Using raw path data`);
            // Fallback: treat svgPath as raw path data if it wasn't a file
            this.addPath(svgPath, this.defaultStrokeColor, 'none', this.defaultStrokeWidth, []);
        }

        // Fallback: if no viewBox was found, calculate it from the paths
        if (!this.svgViewBox && this.paths.length > 0) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

            for (const path of this.paths) {
                const bounds = this.getBounds(path.commands);

                // Apply group transforms to the bounds corners to find the new bounding box
                const p1 = this.applyTransformsToPoint({ x: bounds.minX, y: bounds.minY }, path.transforms || []);
                const p2 = this.applyTransformsToPoint({ x: bounds.maxX, y: bounds.minY }, path.transforms || []);
                const p3 = this.applyTransformsToPoint({ x: bounds.minX, y: bounds.maxY }, path.transforms || []);
                const p4 = this.applyTransformsToPoint({ x: bounds.maxX, y: bounds.maxY }, path.transforms || []);

                const points = [p1, p2, p3, p4];
                for (const p of points) {
                    if (p.x < minX) minX = p.x;
                    if (p.x > maxX) maxX = p.x;
                    if (p.y < minY) minY = p.y;
                    if (p.y > maxY) maxY = p.y;
                }
            }

            if (minX !== Infinity) {
                this.svgViewBox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
                console.log(`[ServerSvgPathLayer] Calculated fallback viewBox:`, this.svgViewBox);
            }
        }

        // Calculate total animation length and path data for uniform speed
        const kivgConfig = (this.config as SvgPathLayerConfig).svgPathConfig || (this.config as any).kivgConfig || {};
        const animType = (this.config as any).anim_type || kivgConfig.anim_type || 'seq';
        const pathDelay = (this.config as any).path_delay || kivgConfig.path_delay || 0;

        this.totalAnimationLength = 0;
        this.pathAnimationData = [];

        const totalPathLength = this.paths.reduce((sum, p) => sum + p.length, 0);
        const duration = TimingManager.getLayerEntranceDuration(this.config);

        let customGapLength = 0;
        if (pathDelay > 0 && duration > 0) {
            // Convert seconds to "length units" based on total duration
            customGapLength = (pathDelay / duration) * totalPathLength;
        }

        for (let i = 0; i < this.paths.length; i++) {
            const path = this.paths[i];

            // Add path data
            this.pathAnimationData.push({
                pathIndex: i,
                length: path.length,
                cumulativeLength: this.totalAnimationLength,
                isGap: false
            });
            this.totalAnimationLength += path.length;

            // Add gap data between paths (except after the last path)
            if (i < this.paths.length - 1) {
                const nextPath = this.paths[i + 1];

                // Calculate distance between end of current path and start of next path
                const p1 = path.properties.getPointAtLength(path.length);
                const p2 = nextPath.properties.getPointAtLength(0);

                // Apply transforms to points for accurate distance
                let tp1 = { ...p1 };
                let tp2 = { ...p2 };
                if (path.transforms) tp1 = this.applyTransformsToPoint(tp1, path.transforms);
                if (nextPath.transforms) tp2 = this.applyTransformsToPoint(tp2, nextPath.transforms);

                let gapLength = customGapLength;
                if (gapLength <= 0) {
                    // Heuristic fallback if no custom pathDelay
                    const dx = tp2.x - tp1.x;
                    const dy = tp2.y - tp1.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    gapLength = distance > 20 ? 50 : 10;
                }

                this.pathAnimationData.push({
                    pathIndex: i,
                    length: gapLength,
                    cumulativeLength: this.totalAnimationLength,
                    isGap: true
                });
                this.totalAnimationLength += gapLength;
            }
        }
    }

    private addPath(d: string, stroke: string, fill: string, strokeWidth: number, transforms: string[] = []) {
        try {
            const commands = makeAbsolute(parseSVG(d));

            // Split path into sub-paths at M commands for sequential animation
            const subPaths = this.splitPathAtMoveCommands(commands);

            for (const subPath of subPaths) {
                const subPathD = this.commandsToPathString(subPath.commands);
                if (!subPathD || subPathD.trim() === '') continue;

                try {
                    const properties = new svgPathProperties(subPathD);
                    const length = properties.getTotalLength();

                    // Skip very short paths (likely just move commands)
                    if (length < 1) continue;

                    this.paths.push({
                        d: subPathD,
                        properties,
                        commands: subPath.commands,
                        stroke,
                        fill,
                        strokeWidth,
                        length,
                        transforms
                    });
                } catch (e) {
                    // Skip invalid sub-paths
                    console.warn(`[ServerSvgPathLayer] Skipping invalid sub-path:`, e);
                }
            }
        } catch (e) {
            console.error(`[ServerSvgPathLayer] Failed to parse path:`, e);
            console.error(`[ServerSvgPathLayer] Path data: ${d.substring(0, 100)}...`);
        }
    }

    /**
     * Split a path's commands into sub-paths at M (moveto) commands,
     * but group sub-paths that overlap (like a letter and its hole).
     */
    private splitPathAtMoveCommands(commands: any[]): { commands: any[] }[] {
        const individualSubPaths: any[][] = [];
        let currentSubPath: any[] = [];

        for (const cmd of commands) {
            if (cmd.code === 'M' && currentSubPath.length > 0) {
                individualSubPaths.push(currentSubPath);
                currentSubPath = [cmd];
            } else {
                currentSubPath.push(cmd);
            }
        }
        if (currentSubPath.length > 0) {
            individualSubPaths.push(currentSubPath);
        }

        if (individualSubPaths.length <= 1) {
            return individualSubPaths.map(cmds => ({ commands: cmds }));
        }

        const groups: { commands: any[], bounds: { minX: number, minY: number, maxX: number, maxY: number } }[] = [];
        for (let idx = 0; idx < individualSubPaths.length; idx++) {
            const cmds = individualSubPaths[idx];
            const bounds = this.getBounds(cmds);
            let merged = false;

            // Check if this sub-path overlaps with any existing group
            for (let i = 0; i < groups.length; i++) {
                const group = groups[i];
                // Check for overlap with a small margin
                const margin = 1;
                const overlap = !(bounds.maxX < group.bounds.minX - margin ||
                    bounds.minX > group.bounds.maxX + margin ||
                    bounds.maxY < group.bounds.minY - margin ||
                    bounds.minY > group.bounds.maxY + margin);

                if (overlap) {
                    group.commands.push(...cmds);
                    group.bounds.minX = Math.min(group.bounds.minX, bounds.minX);
                    group.bounds.minY = Math.min(group.bounds.minY, bounds.minY);
                    group.bounds.maxX = Math.max(group.bounds.maxX, bounds.maxX);
                    group.bounds.maxY = Math.max(group.bounds.maxY, bounds.maxY);
                    merged = true;
                    break;
                }
            }

            if (!merged) {
                groups.push({ commands: cmds, bounds });
            }
        }

        return groups.map(g => ({ commands: g.commands }));
    }

    /**
     * Calculate the bounding box for a set of commands.
     */
    private getBounds(commands: any[]): { minX: number, minY: number, maxX: number, maxY: number } {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        const updateX = (x: number) => {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
        };
        const updateY = (y: number) => {
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        };

        for (const cmd of commands) {
            if (cmd.x !== undefined) updateX(cmd.x);
            if (cmd.y !== undefined) updateY(cmd.y);
            if (cmd.x1 !== undefined) updateX(cmd.x1);
            if (cmd.y1 !== undefined) updateY(cmd.y1);
            if (cmd.x2 !== undefined) updateX(cmd.x2);
            if (cmd.y2 !== undefined) updateY(cmd.y2);
        }

        // Handle empty or invalid paths
        if (minX === Infinity) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };

        return { minX, minY, maxX, maxY };
    }

    /**
     * Convert parsed commands back to a path string for svgPathProperties.
     */
    private commandsToPathString(commands: any[]): string {
        let d = '';
        for (const cmd of commands) {
            switch (cmd.code) {
                case 'M': d += `M${cmd.x},${cmd.y} `; break;
                case 'L': d += `L${cmd.x},${cmd.y} `; break;
                case 'H': d += `H${cmd.x} `; break;
                case 'V': d += `V${cmd.y} `; break;
                case 'C': d += `C${cmd.x1},${cmd.y1} ${cmd.x2},${cmd.y2} ${cmd.x},${cmd.y} `; break;
                case 'S': d += `S${cmd.x2},${cmd.y2} ${cmd.x},${cmd.y} `; break;
                case 'Q': d += `Q${cmd.x1},${cmd.y1} ${cmd.x},${cmd.y} `; break;
                case 'T': d += `T${cmd.x},${cmd.y} `; break;
                case 'A': d += `A${cmd.rx},${cmd.ry} ${cmd.xAxisRotation} ${cmd.largeArc ? 1 : 0},${cmd.sweep ? 1 : 0} ${cmd.x},${cmd.y} `; break;
                case 'Z': d += 'Z '; break;
            }
        }
        return d.trim();
    }

    async doRender(ctx: CanvasRenderingContext2D, time: number): Promise<void> {
        if (this.paths.length === 0) return;

        const progress = this.getAnimationProgress(time);
        const animationType = this.config.entrance_animation?.type || 'draw';

        ctx.save();
        this.currentHandPosition = null; // Reset hand position at start of frame
        this.applyTransform(ctx, progress, time);

        if (this.isCentered()) {
            ctx.translate(-(this.config.width || 0) / 2, -(this.config.height || 0) / 2);
        }

        // Apply viewBox scaling if present
        const transformInfo = this.getSVGTransformInfo();
        if (transformInfo) {
            ctx.scale(transformInfo.scale, transformInfo.scale);
            ctx.translate(transformInfo.translateX, transformInfo.translateY);
        }

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const kivgConfig = (this.config as SvgPathLayerConfig).svgPathConfig || (this.config as any).kivgConfig || {};
        const animType = (this.config as any).anim_type || kivgConfig.anim_type || 'seq';

        if (animationType === 'draw' || animationType === 'stroke') {
            if (animType === 'par') {
                this.renderDrawParallel(ctx, progress, time);
            } else {
                this.renderDraw(ctx, progress, time);
            }
        } else if (animationType === 'typewriter') {
            this.renderTypewriter(ctx, progress, time);
        } else {
            this.renderFull(ctx);
        }

        ctx.restore();
    }

    private getAnimationStateAt(progress: number): {
        currentPathIndex: number,
        localProgress: number,
        isGap: boolean,
        lastFinishedPathIndex: number,
        nextPathIndex: number
    } {
        if (this.totalAnimationLength === 0) {
            return { currentPathIndex: 0, localProgress: 1, isGap: false, lastFinishedPathIndex: this.paths.length - 1, nextPathIndex: -1 };
        }

        const targetLength = progress * this.totalAnimationLength;
        let lastFinishedPathIndex = -1;

        for (let i = 0; i < this.pathAnimationData.length; i++) {
            const data = this.pathAnimationData[i];
            if (targetLength <= data.cumulativeLength + data.length + 0.0001) {
                const localProgress = data.length > 0 ? (targetLength - data.cumulativeLength) / data.length : 1;

                // Find next path index
                let nextPathIndex = -1;
                for (let j = i + 1; j < this.pathAnimationData.length; j++) {
                    if (!this.pathAnimationData[j].isGap) {
                        nextPathIndex = this.pathAnimationData[j].pathIndex;
                        break;
                    }
                }

                return {
                    currentPathIndex: data.pathIndex,
                    localProgress: Math.min(1, Math.max(0, localProgress)),
                    isGap: data.isGap,
                    lastFinishedPathIndex,
                    nextPathIndex
                };
            }
            if (!data.isGap) {
                lastFinishedPathIndex = data.pathIndex;
            }
        }

        return {
            currentPathIndex: this.paths.length - 1,
            localProgress: 1,
            isGap: false,
            lastFinishedPathIndex: this.paths.length - 1,
            nextPathIndex: -1
        };
    }

    private applySVGTransforms(ctx: CanvasRenderingContext2D, transforms: string[]): void {
        for (const transform of transforms) {
            // Simple transform parser for translate and scale
            const translateMatch = transform.match(/translate\(([^)]+)\)/);
            if (translateMatch) {
                const parts = translateMatch[1].split(/[\s,]+/).map(parseFloat);
                ctx.translate(parts[0], parts[1] || 0);
            }
            const scaleMatch = transform.match(/scale\(([^)]+)\)/);
            if (scaleMatch) {
                const parts = scaleMatch[1].split(/[\s,]+/).map(parseFloat);
                ctx.scale(parts[0], parts[1] !== undefined ? parts[1] : parts[0]);
            }
            const rotateMatch = transform.match(/rotate\(([^)]+)\)/);
            if (rotateMatch) {
                const parts = rotateMatch[1].split(/[\s,]+/).map(parseFloat);
                ctx.rotate(parts[0] * Math.PI / 180);
            }
        }
    }

    private renderFull(ctx: CanvasRenderingContext2D): void {
        for (const path of this.paths) {
            ctx.save();
            if (path.transforms) {
                this.applySVGTransforms(ctx, path.transforms);
            }
            ctx.beginPath();
            this.drawCommands(ctx, path.commands);

            if (path.fill !== 'none') {
                ctx.fillStyle = path.fill;
                ctx.fill('evenodd');
            }

            if (path.stroke !== 'none' && path.strokeWidth > 0) {
                ctx.strokeStyle = path.stroke;
                ctx.lineWidth = path.strokeWidth;
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    private renderDraw(ctx: CanvasRenderingContext2D, progress: number, time: number): void {
        const state = this.getAnimationStateAt(progress);

        const kivgConfig = (this.config as any).kivgConfig || {};
        const fillMode = kivgConfig.fillMode || 'end';

        // 1. Render Strokes
        for (let i = 0; i < this.paths.length; i++) {
            const path = this.paths[i];

            let pathLocalProgress = 0;
            if (i <= state.lastFinishedPathIndex) {
                pathLocalProgress = 1;
            } else if (i === state.currentPathIndex && !state.isGap) {
                pathLocalProgress = state.localProgress;
            }

            if (pathLocalProgress <= 0) continue;

            ctx.save();
            if (path.transforms) {
                this.applySVGTransforms(ctx, path.transforms);
            }

            ctx.beginPath();
            this.drawCommands(ctx, path.commands);

            if (path.stroke !== 'none' && path.strokeWidth > 0) {
                ctx.strokeStyle = path.stroke;
                ctx.lineWidth = path.strokeWidth;

                if (pathLocalProgress < 1.0) {
                    const drawLen = path.length * pathLocalProgress;
                    ctx.setLineDash([drawLen, path.length]);
                    ctx.lineDashOffset = 0;
                } else {
                    ctx.setLineDash([]);
                }
                ctx.stroke();
            }

            // Fill if fillMode is 'start'
            if (fillMode === 'start' && path.fill !== 'none' && pathLocalProgress >= 1.0) {
                ctx.fillStyle = path.fill;
                ctx.fill('evenodd');
            }

            // Update hand position
            if (i === state.currentPathIndex && !state.isGap && this.handOverlayManager && progress < 1.0) {
                const currentLength = path.length * state.localProgress;
                const point = path.properties.getPointAtLength(currentLength);

                const nextLength = Math.min(path.length, currentLength + 2);
                const nextPoint = path.properties.getPointAtLength(nextLength);

                let transformedPoint = { ...point };
                let transformedNextPoint = { ...nextPoint };

                if (path.transforms) {
                    transformedPoint = this.applyTransformsToPoint(point, path.transforms);
                    transformedNextPoint = this.applyTransformsToPoint(nextPoint, path.transforms);
                }

                // Apply viewBox scaling and centering
                const transformInfo = this.getSVGTransformInfo();
                if (transformInfo) {
                    transformedPoint.x = (transformedPoint.x + transformInfo.translateX) * transformInfo.scale;
                    transformedPoint.y = (transformedPoint.y + transformInfo.translateY) * transformInfo.scale;
                    transformedNextPoint.x = (transformedNextPoint.x + transformInfo.translateX) * transformInfo.scale;
                    transformedNextPoint.y = (transformedNextPoint.y + transformInfo.translateY) * transformInfo.scale;
                }

                this.currentHandPosition = this.handOverlayManager.calculateHandPosition(progress, {
                    currentPoint: transformedPoint,
                    nextPoint: transformedNextPoint
                }, (p) => this.transformToGlobalAnimated(p, time));
            }

            ctx.restore();
        }

        // Handle hand position during gaps
        if (state.isGap && this.handOverlayManager && progress < 1.0) {
            const prevPath = state.lastFinishedPathIndex >= 0 ? this.paths[state.lastFinishedPathIndex] : null;
            const nextPath = state.nextPathIndex >= 0 ? this.paths[state.nextPathIndex] : null;

            if (prevPath && nextPath) {
                const startPoint = prevPath.properties.getPointAtLength(prevPath.length);
                const endPoint = nextPath.properties.getPointAtLength(0);

                let p1 = { ...startPoint };
                let p2 = { ...endPoint };

                if (prevPath.transforms) p1 = this.applyTransformsToPoint(p1, prevPath.transforms);
                if (nextPath.transforms) p2 = this.applyTransformsToPoint(p2, nextPath.transforms);

                const transformInfo = this.getSVGTransformInfo();
                if (transformInfo) {
                    p1.x = (p1.x + transformInfo.translateX) * transformInfo.scale;
                    p1.y = (p1.y + transformInfo.translateY) * transformInfo.scale;
                    p2.x = (p2.x + transformInfo.translateX) * transformInfo.scale;
                    p2.y = (p2.y + transformInfo.translateY) * transformInfo.scale;
                }

                const currentPoint = {
                    x: p1.x + (p2.x - p1.x) * state.localProgress,
                    y: p1.y + (p2.y - p1.y) * state.localProgress
                };

                this.currentHandPosition = this.handOverlayManager.calculateHandPosition(progress, {
                    currentPoint,
                    nextPoint: p2
                }, (p) => this.transformToGlobalAnimated(p, time));
            }
        }

        // 2. Render Fills (if fillMode is 'end')
        if (fillMode === 'end' && progress >= 1.0) {
            for (const path of this.paths) {
                if (path.fill === 'none') continue;
                ctx.save();
                if (path.transforms) {
                    this.applySVGTransforms(ctx, path.transforms);
                }
                ctx.beginPath();
                this.drawCommands(ctx, path.commands);
                ctx.fillStyle = path.fill;
                ctx.fill('evenodd');
                ctx.restore();
            }
        }
    }

    private renderTypewriter(ctx: CanvasRenderingContext2D, progress: number, time: number): void {
        const state = this.getAnimationStateAt(progress);

        const kivgConfig = (this.config as any).kivgConfig || {};
        const fillMode = kivgConfig.fillMode || 'start';

        for (let i = 0; i < this.paths.length; i++) {
            const path = this.paths[i];

            let pathLocalProgress = 0;
            if (i <= state.lastFinishedPathIndex) {
                pathLocalProgress = 1;
            } else if (i === state.currentPathIndex && !state.isGap) {
                pathLocalProgress = state.localProgress;
            }

            if (pathLocalProgress <= 0 && i > state.currentPathIndex) continue;

            ctx.save();
            if (path.transforms) {
                this.applySVGTransforms(ctx, path.transforms);
            }
            ctx.beginPath();
            this.drawCommands(ctx, path.commands);

            if (path.fill !== 'none') {
                if (i <= state.lastFinishedPathIndex || (i === state.currentPathIndex && !state.isGap && fillMode === 'start' && state.localProgress > 0)) {
                    ctx.fillStyle = path.fill;
                    ctx.fill('evenodd');
                }
            }

            if (path.stroke !== 'none' && path.strokeWidth > 0) {
                ctx.strokeStyle = path.stroke;
                ctx.lineWidth = path.strokeWidth;

                if (i === state.currentPathIndex && !state.isGap && progress < 1.0) {
                    const drawLen = path.length * state.localProgress;
                    ctx.setLineDash([drawLen, path.length]);
                    ctx.lineDashOffset = 0;
                } else {
                    ctx.setLineDash([]);
                }
                ctx.stroke();
            }

            if (i === state.currentPathIndex && !state.isGap && this.handOverlayManager && progress < 1.0) {
                const point = path.properties.getPointAtLength(path.length * state.localProgress);

                let transformedPoint = { ...point };
                if (path.transforms) {
                    transformedPoint = this.applyTransformsToPoint(point, path.transforms);
                }

                // Apply viewBox scaling and centering
                const transformInfo = this.getSVGTransformInfo();
                if (transformInfo) {
                    transformedPoint.x = (transformedPoint.x + transformInfo.translateX) * transformInfo.scale;
                    transformedPoint.y = (transformedPoint.y + transformInfo.translateY) * transformInfo.scale;
                }

                // For typewriter, we can also provide a next point for rotation if needed
                let transformedNextPoint = { ...transformedPoint };
                if (state.localProgress < 0.95) {
                    const nextPoint = path.properties.getPointAtLength(path.length * Math.min(1, state.localProgress + 0.05));
                    transformedNextPoint = { ...nextPoint };
                    if (path.transforms) {
                        transformedNextPoint = this.applyTransformsToPoint(nextPoint, path.transforms);
                    }
                    if (transformInfo) {
                        transformedNextPoint.x = (transformedNextPoint.x + transformInfo.translateX) * transformInfo.scale;
                        transformedNextPoint.y = (transformedNextPoint.y + transformInfo.translateY) * transformInfo.scale;
                    }
                }

                this.currentHandPosition = this.handOverlayManager.calculateHandPosition(progress, {
                    currentPoint: transformedPoint,
                    nextPoint: transformedNextPoint
                }, (p) => this.transformToGlobalAnimated(p, time));
            }
            ctx.restore();
        }

        // Handle hand position during gaps
        if (state.isGap && this.handOverlayManager && progress < 1.0) {
            const prevPath = state.lastFinishedPathIndex >= 0 ? this.paths[state.lastFinishedPathIndex] : null;
            const nextPath = state.nextPathIndex >= 0 ? this.paths[state.nextPathIndex] : null;

            if (prevPath && nextPath) {
                const startPoint = prevPath.properties.getPointAtLength(prevPath.length);
                const endPoint = nextPath.properties.getPointAtLength(0);

                let p1 = { ...startPoint };
                let p2 = { ...endPoint };

                if (prevPath.transforms) p1 = this.applyTransformsToPoint(p1, prevPath.transforms);
                if (nextPath.transforms) p2 = this.applyTransformsToPoint(p2, nextPath.transforms);

                const transformInfo = this.getSVGTransformInfo();
                if (transformInfo) {
                    p1.x = (p1.x + transformInfo.translateX) * transformInfo.scale;
                    p1.y = (p1.y + transformInfo.translateY) * transformInfo.scale;
                    p2.x = (p2.x + transformInfo.translateX) * transformInfo.scale;
                    p2.y = (p2.y + transformInfo.translateY) * transformInfo.scale;
                }

                const currentPoint = {
                    x: p1.x + (p2.x - p1.x) * state.localProgress,
                    y: p1.y + (p2.y - p1.y) * state.localProgress
                };

                this.currentHandPosition = this.handOverlayManager.calculateHandPosition(progress, {
                    currentPoint,
                    nextPoint: p2
                }, (p) => this.transformToGlobalAnimated(p, time));
            }
        }

        // Hide hand at the end
        if (progress >= 1.0 && this.handOverlayManager) {
            this.currentHandPosition = null;
        }
    }

    private renderDrawParallel(ctx: CanvasRenderingContext2D, progress: number, time: number): void {
        const kivgConfig = (this.config as SvgPathLayerConfig).svgPathConfig || (this.config as any).kivgConfig || {};
        const fillMode = kivgConfig.fillMode || 'end';

        // 1. Render all strokes in parallel
        for (let i = 0; i < this.paths.length; i++) {
            const path = this.paths[i];

            ctx.save();
            if (path.transforms) {
                this.applySVGTransforms(ctx, path.transforms);
            }

            ctx.beginPath();
            this.drawCommands(ctx, path.commands);

            if (path.stroke !== 'none' && path.strokeWidth > 0) {
                ctx.strokeStyle = path.stroke;
                ctx.lineWidth = path.strokeWidth;

                if (progress < 1.0) {
                    const drawLen = path.length * progress;
                    ctx.setLineDash([drawLen, path.length]);
                    ctx.lineDashOffset = 0;
                } else {
                    ctx.setLineDash([]);
                }
                ctx.stroke();
            }

            // Fill if fillMode is 'start'
            if (fillMode === 'start' && path.fill !== 'none' && progress >= 1.0) {
                ctx.fillStyle = path.fill;
                ctx.fill('evenodd');
            }

            ctx.restore();
        }

        // 2. Render fills (if fillMode is 'end')
        if (fillMode === 'end' && progress >= 1.0) {
            for (const path of this.paths) {
                if (path.fill === 'none') continue;
                ctx.save();
                if (path.transforms) {
                    this.applySVGTransforms(ctx, path.transforms);
                }
                ctx.beginPath();
                this.drawCommands(ctx, path.commands);
                ctx.fillStyle = path.fill;
                ctx.fill('evenodd');
                ctx.restore();
            }
        }

        // Update hand position (simply follow the first path or centroid?)
        // In parallel mode, hand follows the first path by default for simplicity
        if (this.paths.length > 0 && this.handOverlayManager && progress < 1.0) {
            const path = this.paths[0];
            const currentLength = path.length * progress;
            const point = path.properties.getPointAtLength(currentLength);

            let transformedPoint = { ...point };
            if (path.transforms) {
                transformedPoint = this.applyTransformsToPoint(point, path.transforms);
            }

            const transformInfo = this.getSVGTransformInfo();
            if (transformInfo) {
                transformedPoint.x = (transformedPoint.x + transformInfo.translateX) * transformInfo.scale;
                transformedPoint.y = (transformedPoint.y + transformInfo.translateY) * transformInfo.scale;
            }

            this.currentHandPosition = this.handOverlayManager.calculateHandPosition(progress, {
                currentPoint: transformedPoint
            }, (p) => this.transformToGlobalAnimated(p, time));
        }
    }

    private applyTransformsToPoint(p: { x: number, y: number }, transforms: string[] = []): { x: number, y: number } {
        const pt = { ...p };
        for (const transform of transforms) {
            const translateMatch = transform.match(/translate\(([^)]+)\)/);
            if (translateMatch) {
                const parts = translateMatch[1].split(/[\s,]+/).map(parseFloat);
                pt.x += parts[0];
                pt.y += parts[1] || 0;
            }
            const scaleMatch = transform.match(/scale\(([^)]+)\)/);
            if (scaleMatch) {
                const parts = scaleMatch[1].split(/[\s,]+/).map(parseFloat);
                pt.x *= parts[0];
                pt.y *= parts[1] !== undefined ? parts[1] : parts[0];
            }
            const rotateMatch = transform.match(/rotate\(([^)]+)\)/);
            if (rotateMatch) {
                const rotateParts = rotateMatch[1].split(/[\s,]+/).map(parseFloat);
                const angle = rotateParts[0] * Math.PI / 180;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const rx = pt.x * cos - pt.y * sin;
                const ry = pt.x * sin + pt.y * cos;
                pt.x = rx;
                pt.y = ry;
            }
        }
        return pt;
    }

    private getSVGTransformInfo(): { scale: number, translateX: number, translateY: number } | null {
        if (!this.svgViewBox) return null;

        const width = this.config.width || this.svgViewBox.width;
        const height = this.config.height || this.svgViewBox.height;

        const scaleX = width / this.svgViewBox.width;
        const scaleY = height / this.svgViewBox.height;

        // Use uniform scaling to avoid stretching
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

    private drawCommands(ctx: CanvasRenderingContext2D, commands: any[]): void {
        let lastX = 0;
        let lastY = 0;
        let lastC2X = 0;
        let lastC2Y = 0;
        let lastQ1X = 0;
        let lastQ1Y = 0;

        for (const cmd of commands) {
            switch (cmd.code) {
                case 'M':
                    ctx.moveTo(cmd.x, cmd.y);
                    lastX = cmd.x;
                    lastY = cmd.y;
                    break;
                case 'L':
                    ctx.lineTo(cmd.x, cmd.y);
                    lastX = cmd.x;
                    lastY = cmd.y;
                    break;
                case 'H':
                    ctx.lineTo(cmd.x, lastY);
                    lastX = cmd.x;
                    break;
                case 'V':
                    ctx.lineTo(lastX, cmd.y);
                    lastY = cmd.y;
                    break;
                case 'C':
                    ctx.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
                    lastX = cmd.x;
                    lastY = cmd.y;
                    lastC2X = cmd.x2;
                    lastC2Y = cmd.y2;
                    break;
                case 'S': {
                    // Smooth cubic bezier
                    const x1 = (['C', 'c', 'S', 's'].includes(cmd.previousCommand))
                        ? 2 * lastX - lastC2X
                        : lastX;
                    const y1 = (['C', 'c', 'S', 's'].includes(cmd.previousCommand))
                        ? 2 * lastY - lastC2Y
                        : lastY;
                    ctx.bezierCurveTo(x1, y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
                    lastX = cmd.x;
                    lastY = cmd.y;
                    lastC2X = cmd.x2;
                    lastC2Y = cmd.y2;
                    break;
                }
                case 'Q':
                    ctx.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
                    lastX = cmd.x;
                    lastY = cmd.y;
                    lastQ1X = cmd.x1;
                    lastQ1Y = cmd.y1;
                    break;
                case 'T': {
                    // Smooth quadratic bezier
                    const x1 = (['Q', 'q', 'T', 't'].includes(cmd.previousCommand))
                        ? 2 * lastX - lastQ1X
                        : lastX;
                    const y1 = (['Q', 'q', 'T', 't'].includes(cmd.previousCommand))
                        ? 2 * lastY - lastQ1Y
                        : lastY;
                    ctx.quadraticCurveTo(x1, y1, cmd.x, cmd.y);
                    lastX = cmd.x;
                    lastY = cmd.y;
                    lastQ1X = x1;
                    lastQ1Y = y1;
                    break;
                }
                case 'A': {
                    // Convert Arc to Beziers
                    const beziers = arcToBezier(
                        lastX, lastY, cmd.x, cmd.y,
                        cmd.rx, cmd.ry, cmd.xAxisRotation,
                        cmd.largeArc, cmd.sweep
                    );
                    for (const b of beziers) {
                        if (b.type === 'CubicBezier' && b.control1 && b.control2 && b.end) {
                            ctx.bezierCurveTo(b.control1.x, b.control1.y, b.control2.x, b.control2.y, b.end.x, b.end.y);
                        } else if (b.type === 'Line' && b.end) {
                            ctx.lineTo(b.end.x, b.end.y);
                        }
                    }
                    lastX = cmd.x;
                    lastY = cmd.y;
                    break;
                }
                case 'Z':
                    ctx.closePath();
                    break;
            }
        }
    }

    /**
     * Transform a point from local coordinates to global scene coordinates based on layer transform.
     * Overridden to account for viewBox scaling and translation.
     */
    public transformToGlobal(point: { x: number; y: number }): { x: number; y: number } {
        const transformInfo = this.getSVGTransformInfo();
        let { x, y } = point;

        if (transformInfo) {
            // Apply viewBox transforms: first translate, then scale
            x = (x + transformInfo.translateX) * transformInfo.scale;
            y = (y + transformInfo.translateY) * transformInfo.scale;

            // Compensation for centering to avoid double-centering
            if (this.isCentered()) {
                x += (this.config.width || 0) / 2;
                y += (this.config.height || 0) / 2;
            }
        }

        return super.transformToGlobal({ x, y });
    }

    /**
     * Transform a point from local coordinates to global scene coordinates based on layer transform AND animation.
     * Overridden to account for viewBox scaling and translation.
     */
    public transformToGlobalAnimated(point: { x: number; y: number }, time: number): { x: number; y: number } {
        const transformInfo = this.getSVGTransformInfo();
        let { x, y } = point;

        if (transformInfo) {
            // Apply viewBox transforms: first translate, then scale
            x = (x + transformInfo.translateX) * transformInfo.scale;
            y = (y + transformInfo.translateY) * transformInfo.scale;

            // Compensation for centering to avoid double-centering
            if (this.isCentered()) {
                x += (this.config.width || 0) / 2;
                y += (this.config.height || 0) / 2;
            }
        }

        return super.transformToGlobalAnimated({ x, y }, time);
    }

    public async renderAsMask(ctx: CanvasRenderingContext2D, time: number, forceFull: boolean = false): Promise<void> {
        if (this.paths.length === 0) return;

        const progress = forceFull ? 1.0 : this.getAnimationProgress(time);
        const animationType = this.config.entrance_animation?.type || 'draw';

        ctx.save();
        this.applyTransform(ctx, progress, time);

        if (this.isCentered()) {
            ctx.translate(-(this.config.width || 0) / 2, -(this.config.height || 0) / 2);
        }

        // Apply viewBox scaling if present
        const transformInfo = this.getSVGTransformInfo();
        if (transformInfo) {
            ctx.scale(transformInfo.scale, transformInfo.scale);
            ctx.translate(transformInfo.translateX, transformInfo.translateY);
        }

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const DILATION = 12;

        // Apply reveal clipping if not forcing full
        const isReveal = !forceFull && animationType.startsWith('reveal_');
        if (isReveal) {
            const width = this.config.width || 0;
            const height = this.config.height || 0;
            ctx.beginPath();
            if (animationType === 'reveal_horizontal') {
                ctx.rect(0, 0, width * progress, height);
            } else if (animationType === 'reveal_vertical') {
                ctx.rect(0, 0, width, height * progress);
            } else if (animationType === 'reveal_diagonal') {
                const p = progress * 2;
                if (p <= 1) {
                    ctx.moveTo(0, 0);
                    ctx.lineTo(width * p, 0);
                    ctx.lineTo(0, height * p);
                } else {
                    const p2 = p - 1;
                    ctx.moveTo(0, 0);
                    ctx.lineTo(width, 0);
                    ctx.lineTo(width, height * p2);
                    ctx.lineTo(width * p2, height);
                    ctx.lineTo(0, height);
                }
            }
            ctx.closePath();
            ctx.clip();
        }

        if (!forceFull && (animationType === 'draw' || animationType === 'stroke') && progress < 1) {
            // Follow draw animation progress
            const state = this.getAnimationStateAt(progress);

            for (let i = 0; i < this.paths.length; i++) {
                const path = this.paths[i];

                let pathLocalProgress = 0;
                if (i <= state.lastFinishedPathIndex) {
                    pathLocalProgress = 1;
                } else if (i === state.currentPathIndex && !state.isGap) {
                    pathLocalProgress = state.localProgress;
                }

                if (pathLocalProgress <= 0) continue;

                ctx.save();
                if (path.transforms) {
                    this.applySVGTransforms(ctx, path.transforms);
                }

                ctx.beginPath();
                this.drawCommands(ctx, path.commands);

                ctx.strokeStyle = 'black';
                ctx.lineWidth = (path.strokeWidth || 0) + DILATION;

                if (pathLocalProgress < 1.0) {
                    const drawLen = path.length * pathLocalProgress;
                    ctx.setLineDash([drawLen, path.length]);
                    ctx.lineDashOffset = 0;
                } else {
                    ctx.setLineDash([]);
                }
                ctx.stroke();

                // Fill area that has been fully stroked
                if (pathLocalProgress >= 1 && path.fill !== 'none') {
                    ctx.fillStyle = 'black';
                    ctx.fill('evenodd');
                }

                ctx.restore();
            }
        } else {
            // Full shape (typewriter, fade_in, none, draw complete, or forceFull)
            // Note: reveal animations also end up here if forceFull is true or progress is 1

            // Add feathering for consistency with erase phase
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 15;

            for (const path of this.paths) {
                ctx.save();
                if (path.transforms) {
                    this.applySVGTransforms(ctx, path.transforms);
                }
                ctx.beginPath();
                this.drawCommands(ctx, path.commands);

                if (path.fill !== 'none') {
                    ctx.fillStyle = 'black';
                    ctx.fill('evenodd');
                }

                ctx.strokeStyle = 'black';
                ctx.lineWidth = (path.strokeWidth || 0) + DILATION;
                ctx.setLineDash([]);
                ctx.stroke();
                ctx.restore();
            }
        }

        ctx.restore();
    }
}
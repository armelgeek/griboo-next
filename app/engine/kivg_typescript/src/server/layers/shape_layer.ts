import { normalizeColorToHex } from '../../shared/utils/color_utils';
import { CanvasRenderingContext2D } from 'canvas';
import { ServerLayer } from '../core/layer';
import { ShapeLayerConfig, WhiteboardConfig } from '../../shared/types';
import { TimingManager } from '../../shared/infra/timing_manager';
import { ShapeHandStrategy } from '../../shared/core/hand_overlay_manager';
import { ShapeUtils } from '../../shared/utils/shape-utils';
import { JSDOM } from 'jsdom';
import { svgPathProperties } from 'svg-path-properties';
import { parseSVG, makeAbsolute } from 'svg-path-parser';
import { drawPathCommands, shapeToPath } from '../utils/svg_utils';
import { resolveAssetPath, loadAssetFromPath } from '../utils/path_utils';

interface PathInfo {
    d: string;
    properties: any;
    commands: any[];
    stroke: string;
    fill: string;
    strokeWidth: number;
    length: number;
    fillOpacity: number; // For fill animation
}

/**
 * Server-side Shape Layer
 * Renders shapes using SVG paths to match frontend implementation.
 * Supports: circle, rectangle, square, star, line, ellipse, triangle, polygon, hexagon, path, svg.
 */
export class ServerShapeLayer extends ServerLayer {
    private shapeType: string = 'circle';
    private strokeColor: string = '#000000';
    private fillColor: string = 'none';
    private strokeWidth: number = 2;
    private size: number = 100;
    private radiusX: number = 0;
    private radiusY: number = 0;
    private sides: number = 5;
    private points: number[] = [];
    private cornerRadius: number = 0;

    // SVG support
    private svgUrl?: string;
    private pathData?: string;

    // Path data for rendering
    private paths: PathInfo[] = [];

    constructor(config: ShapeLayerConfig, handsConfig?: WhiteboardConfig['hands']) {
        super(config, handsConfig);
        this.shapeType = config.shape || 'circle';

        // Handle different size properties based on shape (matching frontend logic)
        this.size = config.width || 100;
        this.radiusX = config.radius || (config.width ? config.width / 2 : 50);
        this.radiusY = config.height ? config.height / 2 : this.radiusX;
        this.sides = this.shapeType === 'triangle' ? 3 : (this.shapeType === 'hexagon' ? 6 : 5);

        if (this.shapeType === 'circle' || this.shapeType === 'star' || this.shapeType === 'ellipse' || this.shapeType === 'triangle' || this.shapeType === 'polygon' || this.shapeType === 'hexagon') {
            this.size = (config.radius || this.radiusX) * 2;
        }

        this.strokeColor = normalizeColorToHex(config.strokeColor || '#000000');
        this.fillColor = normalizeColorToHex(config.fillColor || 'none');
        this.strokeWidth = config.strokeWidth || 2;
        this.points = config.points || [];
        this.cornerRadius = config.cornerRadius || 0;

        if (this.shapeType === 'path' && config.pathData) {
            this.pathData = config.pathData;
        }
        if (this.shapeType === 'svg' && config.svgUrl) {
            this.svgUrl = config.svgUrl;
        }

        if (this.handOverlayManager) {
            this.handOverlayManager.setStrategy(new ShapeHandStrategy());
        }
    }

    protected async doPrepare(): Promise<void> {
        await super.doPrepare();

        // Clear existing paths to prevent duplication if prepare is called multiple times
        this.paths = [];

        // Generate or load paths
        if (this.shapeType === 'svg' && this.svgUrl) {
            await this.loadSvgContent();
        } else {
            this.generateShapePath();
        }
    }



    private async loadSvgContent(): Promise<void> {
        try {
            let content = '';

            if (this.svgUrl) {
                const resolvedPath = resolveAssetPath(this.svgUrl);
                const buffer = await loadAssetFromPath(resolvedPath, 'svg');
                content = buffer.toString('utf8');
            }

            if (content) {
                const dom = new JSDOM(content);
                const doc = dom.window.document;
                const elements = doc.querySelectorAll('path, rect, circle, ellipse, line, polyline, polygon');

                elements.forEach(el => {
                    let d = el.getAttribute('d');
                    if (!d) {
                        d = shapeToPath(el);
                    }

                    if (d) {
                        const getInheritedAttribute = (element: Element, attr: string): string | null => {
                            let current: Element | null = element;
                            while (current) {
                                const val = current.getAttribute(attr);
                                if (val) return val;
                                current = current.parentElement;
                            }
                            return null;
                        };

                        const stroke = getInheritedAttribute(el, 'stroke') || this.strokeColor;
                        const fill = getInheritedAttribute(el, 'fill') || 'none'; // Default to none for SVG sub-paths unless specified
                        const strokeWidthAttr = getInheritedAttribute(el, 'stroke-width');
                        const strokeWidth = strokeWidthAttr ? parseFloat(strokeWidthAttr) : this.strokeWidth;

                        this.addPath(d, stroke, fill, strokeWidth);
                    }
                });
            }
        } catch (e) {
            console.error(`[ServerShapeLayer] Failed to load SVG from ${this.svgUrl}:`, e);
        }
    }

    private generateShapePath(): void {
        let d = '';

        switch (this.shapeType) {
            case 'path':
                d = this.pathData || '';
                break;
            case 'circle':
                d = ShapeUtils.getCirclePathData(this.size / 2);
                break;
            case 'ellipse':
                d = ShapeUtils.getEllipsePathData(this.radiusX, this.radiusY);
                break;
            case 'rectangle':
            case 'square':
                d = ShapeUtils.getRectPathData(this.size, (this.config as ShapeLayerConfig).height || this.size, this.cornerRadius);
                break;
            case 'star':
                d = ShapeUtils.getStarPathData(this.size / 2);
                break;
            case 'triangle':
            case 'polygon':
            case 'hexagon':
                d = ShapeUtils.getPolygonPathData(this.size / 2, this.sides);
                break;
            case 'line':
                if (this.points && this.points.length >= 4) {
                    d = ShapeUtils.getLinePathData(this.points[0], this.points[1], this.points[2], this.points[3]);
                } else {
                    d = ShapeUtils.getLinePathData(0, 0, this.size, 0);
                }
                break;
        }

        if (d) {
            this.addPath(d, this.strokeColor, this.fillColor, this.strokeWidth);
        }
    }

    private addPath(d: string, stroke: string, fill: string, strokeWidth: number) {
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
                        fillOpacity: 0
                    });
                } catch (e) {
                    // Skip invalid sub-paths
                    console.warn(`[ServerShapeLayer] Skipping invalid sub-path:`, e);
                }
            }
        } catch (e) {
            console.error(`[ServerShapeLayer] Failed to parse path:`, e);
            console.error(`[ServerShapeLayer] Path data: ${d.substring(0, 100)}...`);
        }
    }

    /**
     * Convert parsed commands back to a path string.
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

        // Group sub-paths that overlap
        const groups: { commands: any[], bounds: { minX: number, minY: number, maxX: number, maxY: number } }[] = [];

        for (const cmds of individualSubPaths) {
            const bounds = this.getBounds(cmds);
            let merged = false;

            // Check if this sub-path overlaps with any existing group
            for (let i = 0; i < groups.length; i++) {
                const group = groups[i];
                // Check for overlap with a small margin
                const margin = 1;
                if (!(bounds.maxX < group.bounds.minX - margin ||
                    bounds.minX > group.bounds.maxX + margin ||
                    bounds.maxY < group.bounds.minY - margin ||
                    bounds.minY > group.bounds.maxY + margin)) {

                    // Overlap found, merge into this group
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

    async doRender(ctx: CanvasRenderingContext2D, time: number): Promise<void> {
        if (this.paths.length === 0) return;

        const progress = this.getAnimationProgress(time);
        const animationType = this.config.entrance_animation?.type || 'draw';
        const animType = (this.config as any).anim_type || (this.config as any).shape_config?.anim_type || 'seq';

        ctx.save();
        this.applyTransform(ctx, progress, time);

        // Apply rotation for circle/ellipse to match frontend (start at 12 o'clock)
        if (this.shapeType === 'circle' || this.shapeType === 'ellipse') {
            ctx.rotate(-Math.PI / 2);
        }

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (animationType === 'draw') {
            if (animType === 'par') {
                this.renderDrawParallel(ctx, progress, time);
            } else {
                this.renderDraw(ctx, progress, time);
            }
        } else if (animationType === 'fade_in') {
            ctx.globalAlpha *= progress;
            this.renderFull(ctx);
        } else {
            this.renderFull(ctx);
        }

        ctx.restore();
    }

    private renderFull(ctx: CanvasRenderingContext2D): void {
        for (const path of this.paths) {
            ctx.beginPath();
            drawPathCommands(ctx, path.commands);

            if (path.fill !== 'none') {
                ctx.fillStyle = path.fill;
                ctx.fill('evenodd');
            }

            if (path.stroke !== 'none' && path.strokeWidth > 0) {
                ctx.strokeStyle = path.stroke;
                ctx.lineWidth = path.strokeWidth;
                ctx.stroke();
            }
        }
    }

    private renderDraw(ctx: CanvasRenderingContext2D, progress: number, time: number): void {
        // Logic matching frontend animateDraw:
        // Frontend uses a SETTLE_RATIO of 0.2 (20% of duration is for settling/waiting)
        // The actual animation happens in the first 80% of the duration.
        const SETTLE_RATIO = 0.2;
        const animationCap = 1 - SETTLE_RATIO;

        // Normalize progress to the animation phase (0 -> 0.8 becomes 0 -> 1)
        const drawProgress = Math.min(1, progress / animationCap);

        const hasFillsToReveal = this.paths.some(p => p.fill !== 'none');
        const isSvgWithFills = this.shapeType === 'svg' && hasFillsToReveal;

        // Frontend logic:
        // If SVG with fills: 70% stroke, 30% fill
        // If Standard shape: 100% stroke, then 50ms fill fade-in (we'll map 50ms to a small chunk of settle time or just end of draw)

        let strokeRatio = 1.0;
        let fillStartTime = 1.0;

        if (isSvgWithFills) {
            strokeRatio = 0.7;
            fillStartTime = 0.7;
        } else {
            strokeRatio = 1.0;
            // For standard shapes, fill starts after stroke completes
            fillStartTime = 1.0;
        }

        const strokeProgress = Math.min(1, drawProgress / strokeRatio);

        // Fill progress calculation
        let fillProgress = 0;
        if (isSvgWithFills) {
            // Fill happens during the last 30% of the draw phase
            if (drawProgress > fillStartTime) {
                fillProgress = (drawProgress - fillStartTime) / (1 - fillStartTime);
            }
        } else {
            // For standard shapes, fill fades in AFTER the stroke (during settle phase)
            // Frontend uses fixed 50ms. We'll simulate this by fading in quickly after drawProgress reaches 1.
            // We use the raw 'progress' here which goes up to 1.0 (past 0.8)
            if (progress > animationCap) {
                // Map 0.8 -> 0.9 to 0 -> 1 for fill fade in (approx 10% of total duration, usually enough for 50ms)
                fillProgress = Math.min(1, (progress - animationCap) / 0.1);
            }
        }

        // Easing for fill (easeOutCubic)
        const easedFill = fillProgress < 0.5 ? 4 * fillProgress * fillProgress * fillProgress : 1 - Math.pow(-2 * fillProgress + 2, 3) / 2;

        const pathDelay = (this.config as any).path_delay || (this.config as any).shape_config?.path_delay || 0;
        const duration = TimingManager.getLayerEntranceDuration(this.config);
        const totalRawPathLength = this.paths.reduce((sum, p) => sum + p.length, 0);

        let gapLength = 0;
        if (pathDelay > 0 && duration > 0) {
            gapLength = (pathDelay / duration) * totalRawPathLength;
        }

        const totalPathLengthWithGaps = totalRawPathLength + gapLength * (this.paths.length - 1);
        let accumulatedLength = 0;
        let activePathIndex = -1;

        // Render Strokes
        for (let i = 0; i < this.paths.length; i++) {
            const path = this.paths[i];
            const pathStartProgress = accumulatedLength / totalPathLengthWithGaps;
            const pathEndProgress = (accumulatedLength + path.length) / totalPathLengthWithGaps;

            let pathLocalProgress = 0;
            if (strokeProgress >= pathEndProgress) {
                pathLocalProgress = 1;
                // If it's the last path and we're finished with strokes, keep it active for hand positioning
                if (i === this.paths.length - 1) {
                    activePathIndex = i;
                }
            } else if (strokeProgress > pathStartProgress) {
                pathLocalProgress = (strokeProgress - pathStartProgress) / (pathEndProgress - pathStartProgress);
                activePathIndex = i;
            }

            if (pathLocalProgress > 0) {
                ctx.beginPath();
                drawPathCommands(ctx, path.commands);

                if (path.stroke !== 'none' && path.strokeWidth > 0) {
                    ctx.strokeStyle = path.stroke;
                    ctx.lineWidth = path.strokeWidth;

                    if (pathLocalProgress < 1) {
                        const drawLen = path.length * pathLocalProgress;
                        ctx.setLineDash([drawLen, path.length]);
                        ctx.lineDashOffset = 0;
                    } else {
                        ctx.setLineDash([]);
                    }
                    ctx.stroke();
                }

                // Hand position - only update if not finished with stroke
                if (activePathIndex === i && this.handOverlayManager && strokeProgress < 1.0) {
                    let point = path.properties.getPointAtLength(path.length * pathLocalProgress);
                    const nextLength = Math.min(path.length, path.length * pathLocalProgress + 2);
                    let nextPoint = path.properties.getPointAtLength(nextLength);

                    // Apply extra rotation for circle/ellipse to match rendering
                    if (this.shapeType === 'circle' || this.shapeType === 'ellipse') {
                        const rad = -Math.PI / 2;
                        const cos = Math.cos(rad);
                        const sin = Math.sin(rad);

                        // Rotate point
                        const prx = point.x * cos - point.y * sin;
                        const pry = point.x * sin + point.y * cos;
                        point = { x: prx, y: pry };

                        // Rotate nextPoint
                        const nrx = nextPoint.x * cos - nextPoint.y * sin;
                        const nry = nextPoint.x * sin + nextPoint.y * cos;
                        nextPoint = { x: nrx, y: nry };
                    }

                    this.currentHandPosition = this.handOverlayManager.calculateHandPosition(progress, {
                        currentPoint: { x: point.x, y: point.y }
                    }, (p) => this.transformToGlobalAnimated(p, time));
                }
            }

            accumulatedLength += path.length + gapLength;
        }

        // Render Fills (Fade in)
        if (hasFillsToReveal && fillProgress > 0) {
            for (const path of this.paths) {
                if (path.fill !== 'none') {
                    ctx.save();
                    ctx.globalAlpha *= easedFill;
                    ctx.beginPath();
                    drawPathCommands(ctx, path.commands);
                    ctx.fillStyle = path.fill;
                    ctx.fill('evenodd');
                    ctx.restore();
                }
            }
        }
    }

    private renderDrawParallel(ctx: CanvasRenderingContext2D, progress: number, time: number): void {
        const SETTLE_RATIO = 0.2;
        const animationCap = 1 - SETTLE_RATIO;
        const drawProgress = Math.min(1, progress / animationCap);

        const hasFillsToReveal = this.paths.some(p => p.fill !== 'none');
        const isSvgWithFills = this.shapeType === 'svg' && hasFillsToReveal;

        let strokeRatio = 1.0;
        let fillStartTime = 1.0;

        if (isSvgWithFills) {
            strokeRatio = 0.7;
            fillStartTime = 0.7;
        } else {
            strokeRatio = 1.0;
            fillStartTime = 1.0;
        }

        const strokeProgress = Math.min(1, drawProgress / strokeRatio);

        let fillProgress = 0;
        if (isSvgWithFills) {
            if (drawProgress > fillStartTime) {
                fillProgress = (drawProgress - fillStartTime) / (1 - fillStartTime);
            }
        } else {
            if (progress > animationCap) {
                fillProgress = Math.min(1, (progress - animationCap) / 0.1);
            }
        }

        const easedFill = fillProgress < 0.5 ? 4 * fillProgress * fillProgress * fillProgress : 1 - Math.pow(-2 * fillProgress + 2, 3) / 2;

        // Render Strokes in parallel
        for (const path of this.paths) {
            ctx.beginPath();
            drawPathCommands(ctx, path.commands);

            if (path.stroke !== 'none' && path.strokeWidth > 0) {
                ctx.strokeStyle = path.stroke;
                ctx.lineWidth = path.strokeWidth;

                if (strokeProgress < 1.0) {
                    const drawLen = path.length * strokeProgress;
                    ctx.setLineDash([drawLen, path.length]);
                    ctx.lineDashOffset = 0;
                } else {
                    ctx.setLineDash([]);
                }
                ctx.stroke();
            }
        }

        // Render Fills
        if (hasFillsToReveal && fillProgress > 0) {
            for (const path of this.paths) {
                if (path.fill !== 'none') {
                    ctx.save();
                    ctx.globalAlpha *= easedFill;
                    ctx.beginPath();
                    drawPathCommands(ctx, path.commands);
                    ctx.fillStyle = path.fill;
                    ctx.fill('evenodd');
                    ctx.restore();
                }
            }
        }

        // Hand position for parallel draw (follow first path)
        if (this.paths.length > 0 && this.handOverlayManager && strokeProgress < 1.0) {
            const path = this.paths[0];
            let point = path.properties.getPointAtLength(path.length * strokeProgress);

            if (this.shapeType === 'circle' || this.shapeType === 'ellipse') {
                const rad = -Math.PI / 2;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);
                const prx = point.x * cos - point.y * sin;
                const pry = point.x * sin + point.y * cos;
                point = { x: prx, y: pry };
            }

            this.currentHandPosition = this.handOverlayManager.calculateHandPosition(progress, {
                currentPoint: { x: point.x, y: point.y }
            }, (p) => this.transformToGlobalAnimated(p, time));
        }
    }

    /**
     * Override transformToGlobalAnimated to handle coordinate system for shapes.
     * Built-in shapes (circle, rect, etc.) are already centered at (0,0) in their path data.
     */
    public transformToGlobalAnimated(point: { x: number; y: number }, time: number): { x: number; y: number } {
        const progress = this.getAnimationProgress(time);
        const exitProgress = this.getExitProgress(time);
        const currentState = this.getAnimatedTransform(progress, exitProgress);

        let x = point.x;
        let y = point.y;

        // For shapes, we don't apply the centering shift if the path is already centered.
        // ShapeUtils generates paths centered at (0,0).
        if (this.isCentered() && this.shapeType === 'path') {
            x -= (this.config.width || 0) / 2;
            y -= (this.config.height || 0) / 2;
        }

        return this.applyTransformToPoint(x, y, currentState);
    }

    protected getLayerDataForHand(progress: number): any {
        // This is used by the strategy, but we are updating currentHandPosition directly
        // The strategy might need to look at our currentHandPosition
        // Actually, ShapeHandStrategy in shared/hand_overlay_manager might expect something specific
        // Let's check ShapeHandStrategy implementation if needed.
        // But for now, we can return the shape info as before, or maybe the position?

        // If we want to use the position calculated here, we might need to expose it
        // or the strategy should use it.
        // In ServerLayer, getHandPosition(time) calls getLayerDataForHand(progress) -> Strategy.getHandPosition(data)
        // BUT ServerLayer.getHandPosition also checks if the layer implements getHandPosition directly?
        // No, ServerLayer.getHandPosition calls this.handOverlayManager.getHandPosition(this.getLayerDataForHand(progress))

        // Wait, I implemented getHandPosition in ServerSvgPathLayer.
        // I should do the same here to override the default strategy behavior if I want precise path following.
        return {
            shape: this.shapeType,
            width: this.config.width || 100,
            height: this.config.height || 100,
            radius: this.radiusX
        };
    }

    /**
     * Render the layer's shape as a black mask for occlusion.
     * This follows the drawing progress so the mask matches what is visible.
     * @param forceFull If true, renders the complete shape regardless of current animation progress.
     */
    public async renderAsMask(ctx: CanvasRenderingContext2D, time: number, forceFull: boolean = false): Promise<void> {
        if (this.paths.length === 0) return;

        const progress = forceFull ? 1.0 : this.getAnimationProgress(time);
        const animationType = this.config.entrance_animation?.type || 'draw';

        ctx.save();
        this.applyTransform(ctx, progress, time);

        // Apply rotation for circle/ellipse to match frontend (start at 12 o'clock)
        if (this.shapeType === 'circle' || this.shapeType === 'ellipse') {
            ctx.rotate(-Math.PI / 2);
        }

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Dilation
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

        if (!forceFull && animationType === 'draw' && progress < 1) {
            // Follow draw animation progress
            const SETTLE_RATIO = 0.2;
            const animationCap = 1 - SETTLE_RATIO;
            const drawProgress = Math.min(1, progress / animationCap);

            const totalPathLength = this.paths.reduce((sum, p) => sum + p.length, 0);
            let accumulatedLength = 0;

            for (let i = 0; i < this.paths.length; i++) {
                const path = this.paths[i];
                const pathStartProgress = accumulatedLength / totalPathLength;
                const pathEndProgress = (accumulatedLength + path.length) / totalPathLength;

                let pathLocalProgress = 0;
                if (drawProgress >= pathEndProgress) {
                    pathLocalProgress = 1;
                } else if (drawProgress > pathStartProgress) {
                    pathLocalProgress = (drawProgress - pathStartProgress) / (pathEndProgress - pathStartProgress);
                }

                accumulatedLength += path.length;

                if (pathLocalProgress > 0) {
                    ctx.beginPath();
                    drawPathCommands(ctx, path.commands);

                    ctx.strokeStyle = 'black';
                    ctx.lineWidth = (path.strokeWidth || 0) + DILATION;

                    if (pathLocalProgress < 1) {
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
                }
            }
        } else {
            // Full shape (fade_in, none, draw complete, or forceFull)
            // Note: reveal animations also end up here if forceFull is true or progress is 1

            // Add feathering for consistency with erase phase
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 15;

            for (const path of this.paths) {
                ctx.beginPath();
                drawPathCommands(ctx, path.commands);

                if (path.fill !== 'none') {
                    ctx.fillStyle = 'black';
                    ctx.fill('evenodd');
                }

                ctx.strokeStyle = 'black';
                ctx.lineWidth = (path.strokeWidth || 0) + DILATION;
                ctx.setLineDash([]);
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    /**
     * Get the occlusion proxy for this layer.
     * Overridden to provide accurate bounds for shapes.
     */
    public getOcclusionProxy(time?: number, forceFull: boolean = false): any {
        const progress = forceFull ? 1.0 : (time !== undefined ? this.getAnimationProgress(time) : 1);
        const exitProgress = forceFull ? 0.0 : (time !== undefined ? this.getExitProgress(time) : 0);
        const state = this.getAnimatedTransform(progress, exitProgress);

        const scaleX = state.scaleX ?? state.scale ?? 1;
        const scaleY = state.scaleY ?? state.scale ?? 1;

        // Use the calculated size/radius from the constructor
        let width = this.size;
        let height = (this.config as any).height || this.size;

        if (this.shapeType === 'circle' || this.shapeType === 'star' || this.shapeType === 'ellipse' || this.shapeType === 'triangle' || this.shapeType === 'polygon' || this.shapeType === 'hexagon') {
            width = this.radiusX * 2;
            height = this.radiusY * 2;
        }

        let x = state.position.x;
        let y = state.position.y;

        // Shapes are centered at (0,0) in their path data, so they are centered at (x,y)
        // OcclusionLogic expects top-left for 'rect' type.
        const proxyType = (this.shapeType === 'circle') ? 'circle' :
            (this.shapeType === 'ellipse') ? 'ellipse' :
                (this.shapeType === 'path' || this.shapeType === 'svg') ? 'path' : 'rect';

        const w = width * scaleX;
        const h = height * scaleY;

        // Shapes are centered at (x,y) in their path data
        const left = x - w / 2;
        const top = y - h / 2;

        return {
            type: proxyType,
            x: x,
            y: y,
            width: w,
            height: h,
            logicalWidth: w,
            logicalHeight: h,
            opacity: state.opacity,
            left: left,
            right: left + w,
            top: top,
            bottom: top + h
        };
    }
}

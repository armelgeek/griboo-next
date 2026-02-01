/**
 * Kivg - SVG drawing and animation using Canvas API
 * Core class and main API (headless, no UI required)
 * 
 * @deprecated Use Whiteboard and specialized Layer classes instead.
 */

import { CanvasRenderer } from '../rendering/canvas';
import { Animation } from '../animations/animation';
import { DrawingManager } from '../../drawing/manager';
import { PathRenderer } from '../../rendering/path_renderer';
import { ShapeRenderer } from '../../rendering/shape_renderer';
import { HandOverlay } from '../../rendering/hand_overlay';

class PropertyHolder {
    size: [number, number];
    pos: [number, number];
    mesh_opacity: number;
    [key: string]: any;

    constructor(width: number = 512, height: number = 512) {
        this.size = [width, height];
        this.pos = [0, 0];
        this.mesh_opacity = 1.0;
    }

    get width(): number { return this.size[0]; }
    get height(): number { return this.size[1]; }
}

type RGBA = [number, number, number, number];
type AnimationType = 'seq' | 'par';

interface DrawOptions {
    fill?: boolean;
    line_width?: number;
    line_color?: RGBA;
    dur?: number;
    fps?: number;
    from_shape_anim?: boolean;
    hand_draw?: boolean;
    hand_image?: string;
    hand_scale?: number;
    hand_offset?: [number, number];
    hand_anchorTopLeft?: boolean;
    hand_anchorPoint?: [number, number];
}

export class Kivg {
    width: number;
    height: number;
    canvas: CanvasRenderer;
    widget: PropertyHolder;

    private _fill: boolean;
    private _line_width: number;
    private _line_color: RGBA;
    private _animation_duration: number;
    private _previous_svg_file: string;

    path: any[];
    closed_shapes: Record<string, any>;
    svg_size: number[];
    current_svg_file: string;

    all_anim: Animation[];
    curr_count: number;
    prev_shapes: any[];
    curr_shape: any[];

    private _frames: ImageData[];
    private _drawing_positions: [number, number][];

    private _hand_overlay: HandOverlay | null;
    private _hand_draw_enabled: boolean;

    private _lastAnimList: Animation[] = [];
    private _lastInitialValues: Record<string, number> = {};
    private _lastAnimType: AnimationType = 'seq';
    private _lastFill: boolean = true;
    private _lastStrokeDuration: number = 0;
    private _lastTotalDuration: number = 0;
    private _lastFps: number = 30;

    constructor(width: number = 512, height: number = 512, background: RGBA = [0, 0, 0, 0]) {
        this.width = width;
        this.height = height;
        this.canvas = new CanvasRenderer(width, height, background);
        this.widget = new PropertyHolder(width, height);
        this._fill = true;
        this._line_width = 1;
        this._line_color = [0, 0, 0, 255];
        this._animation_duration = 0.02;
        this._previous_svg_file = '';
        this.path = [];
        this.closed_shapes = {};
        this.svg_size = [];
        this.current_svg_file = '';
        this.all_anim = [];
        this.curr_count = 0;
        this.prev_shapes = [];
        this.curr_shape = [];
        this._frames = [];
        this._drawing_positions = [];
        this._hand_overlay = null;
        this._hand_draw_enabled = false;
    }

    fillUp(shapes: number[][], color: number[]): void {
        ShapeRenderer.renderMesh(this.canvas, this.widget, shapes, color, 'mesh_opacity');
    }

    fillUpShapes(): void {
        for (const id in this.closed_shapes) {
            const closedPaths = this.closed_shapes[id];
            let color = closedPaths.color;
            if (color.length >= 4 && color[3] === 0) {
                let fillColor = [...this._line_color];
                if (!(fillColor.slice(0, 3).every(c => c <= 1.0))) {
                    fillColor = fillColor.map(c => c / 255.0);
                }
                this.fillUp(closedPaths[id + 'shapes'], fillColor);
            } else {
                this.fillUp(closedPaths[id + 'shapes'], color);
            }
        }
    }

    fillUpShapesAnim(shapes: [number[], number[][]][]): void {
        for (const shape of shapes) {
            this.fillUp(shape[1], shape[0]);
        }
    }

    updateCanvas(): void {
        let defaultColor: RGBA;
        if (this._line_color.slice(0, 3).every(c => c <= 1.0)) {
            defaultColor = this._line_color.map(c => Math.round(c * 255)) as RGBA;
        } else {
            defaultColor = this._line_color;
        }
        PathRenderer.updateCanvas(this.canvas, this.widget, this.path, defaultColor, this._line_width);
    }

    drawOriginalStrokes(): void {
        PathRenderer.updateCanvasOriginalStrokes(this.canvas, this.widget, this.path, this._line_width);
    }

    /**
     * Clear the canvas.
     */
    clear(): void {
        this.canvas.clear();
    }

    async draw(svgFile: string, animate: boolean = false, animType: AnimationType = 'seq', options: DrawOptions = {}): Promise<ImageData[] | null> {
        const fill = options.fill ?? this._fill;
        const lineWidth = options.line_width ?? this._line_width;
        const lineColor = options.line_color ?? this._line_color;
        const duration = options.dur ?? this._animation_duration;
        const fps = options.fps ?? 30;
        const fromShapeAnim = options.from_shape_anim ?? false;
        const validAnimType = ['seq', 'par'].includes(animType) ? animType : 'seq';

        this._fill = fill;
        this._line_width = lineWidth;
        this._line_color = lineColor;
        this._animation_duration = duration;
        this.current_svg_file = svgFile;

        this._hand_draw_enabled = !!(options.hand_draw && animate);
        if (this._hand_draw_enabled) {
            this._hand_overlay = new HandOverlay(options.hand_image, options.hand_scale ?? 0.3, options.hand_offset ?? [-18, -20], options.hand_anchorTopLeft, options.hand_anchorPoint);
            await this._hand_overlay.waitForLoad();
        } else {
            this._hand_overlay = null;
        }

        if (svgFile !== this._previous_svg_file) {
            const result = await DrawingManager.processPathData(svgFile);
            this.svg_size = result.svgSize;
            this.closed_shapes = Object.fromEntries(result.closedShapes);
            this.path = result.pathElements;
            this._previous_svg_file = svgFile;
        }

        const animList = DrawingManager.calculatePaths(this.widget, new Map(Object.entries(this.closed_shapes)), this.svg_size as [number, number], svgFile, animate, lineWidth, duration);

        this._lastAnimList = animList;
        this._lastAnimType = validAnimType as AnimationType;
        this._lastFill = fill;
        this._lastFps = fps;

        this._lastInitialValues = {};
        for (const anim of animList) {
            for (const key of Object.keys(anim.animatedProperties)) {
                if (!(key in this._lastInitialValues)) {
                    this._lastInitialValues[key] = this.widget[key] ?? 0;
                }
            }
        }

        if (animType === 'seq') {
            this._lastStrokeDuration = animList.reduce((sum, anim) => sum + anim.duration, 0);
        } else {
            this._lastStrokeDuration = Math.max(...animList.map(anim => anim.duration), 0);
        }
        this._lastTotalDuration = this._lastStrokeDuration + (fill ? 0.4 : 0);

        if (!fromShapeAnim) {
            if (!animate) {
                Animation.cancelAll(this.widget);
                this.canvas.clear();
                if (fill) {
                    this.fillUpShapes();
                    this.drawOriginalStrokes();
                } else {
                    this.updateCanvas();
                }
            }
        }
        return null;
    }

    getTotalDuration(): number { return this._lastTotalDuration; }

    renderFrameAtTime(currentTime: number): { imageData: ImageData; position: [number, number] | null } {
        for (const key in this._lastInitialValues) {
            this.widget[key] = this._lastInitialValues[key];
        }
        const currentAnimIdx = this._updateAnimationState(this._lastAnimList, currentTime, this._lastAnimType, this._lastInitialValues);
        this.canvas.clear();
        const fillStartTime = this._lastStrokeDuration;
        if (this._lastFill && currentTime >= fillStartTime) {
            const fillProgress = Math.min(1.0, (currentTime - fillStartTime) / 0.4);
            this.widget.mesh_opacity = fillProgress;
            this.fillUpShapes();
            this.drawOriginalStrokes();
        } else if (this._lastFill) {
            this.widget.mesh_opacity = 0.0;
            this.updateCanvas();
        } else {
            this.updateCanvas();
        }

        const currentPos = this._getCurrentDrawingPosition(this._lastAnimList, currentAnimIdx, this._lastAnimType, currentTime);
        let imageData = this.canvas.getImageData();
        if (this._hand_draw_enabled && currentTime < this._lastStrokeDuration && currentPos) {
            imageData = this._overlayHandOnImageData(imageData, currentPos[0], currentPos[1]);
        }
        return { imageData, position: currentPos };
    }

    private _overlayHandOnImageData(imageData: ImageData, x: number, y: number): ImageData {
        if (!this._hand_overlay || !this._hand_overlay.isLoaded) return imageData;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imageData.width;
        tempCanvas.height = imageData.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return imageData;
        tempCtx.putImageData(imageData, 0, 0);
        this._hand_overlay.render(tempCtx, x, y);
        return tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    }

    private _getCurrentDrawingPosition(animList: Animation[], currentAnimIdx: number, animType: AnimationType, currentTime: number): [number, number] | null {
        if (animList.length === 0 || currentAnimIdx < 0) return null;
        if (animType === 'seq') {
            if (currentAnimIdx >= animList.length) return null;
            const anim = animList[currentAnimIdx];
            let elapsedBefore = 0;
            for (let i = 0; i < currentAnimIdx; i++) elapsedBefore += animList[i].duration;
            const localTime = currentTime - elapsedBefore;
            const progress = anim.duration > 0 ? Math.min(1.0, Math.max(0.0, localTime / anim.duration)) : 1.0;
            const t = anim.transition(progress);
            for (const key in anim.animatedProperties) {
                if (key.endsWith('_end_x')) {
                    const prefix = key.slice(0, -6);
                    const startX = this.widget[`${prefix}_start_x`];
                    const startY = this.widget[`${prefix}_start_y`];
                    const targetEndX = anim.animatedProperties[`${prefix}_end_x`];
                    const targetEndY = anim.animatedProperties[`${prefix}_end_y`];
                    if (startX !== undefined && startY !== undefined && targetEndX !== undefined && targetEndY !== undefined) {
                        return [Math.round(startX + t * (targetEndX - startX)), Math.round(startY + t * (targetEndY - startY))];
                    }
                }
            }
        }
        return null;
    }

    private _updateAnimationState(animList: Animation[], currentTime: number, animType: AnimationType, initialValues: Record<string, number>): number {
        let currentAnimIdx = -1;
        if (animType === 'seq') {
            let elapsed = 0;
            for (let idx = 0; idx < animList.length; idx++) {
                const anim = animList[idx];
                const animEndTime = elapsed + anim.duration;
                if (currentTime < elapsed) break;
                else if (currentTime >= elapsed && currentTime < animEndTime) {
                    currentAnimIdx = idx;
                    const localProgress = anim.duration > 0 ? (currentTime - elapsed) / anim.duration : 1.0;

                    // Manually calculate and update properties for seek-like behavior
                    const t = anim.transition(localProgress);
                    for (const [key, target] of Object.entries(anim.animatedProperties)) {
                        const startVal = initialValues[key] ?? 0;
                        this.widget[key] = startVal * (1 - t) + target * t;
                    }
                    break;
                } else {
                    // Animation complete, set to final state
                    for (const [key, target] of Object.entries(anim.animatedProperties)) {
                        this.widget[key] = target;
                    }
                }
                elapsed = animEndTime;
            }
        }
        return currentAnimIdx;
    }
}

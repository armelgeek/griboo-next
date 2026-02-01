import { Point, Coordinate } from '../types';



export interface HandOverlayOptions {
    imageUrl?: string;
    scale?: number;
    offset?: Point;
    anchorTopLeft?: boolean;
    anchorPoint?: [number, number];
}

/**
 * Platform-agnostic hand overlay logic.
 * Contains the math for positioning and rotation.
 */
export abstract class BaseHandOverlay {
    protected _scale: number;
    protected _offset: Point;
    protected _anchorTopLeft: boolean;
    protected _anchorPoint?: [number, number];
    protected isImageLoaded: boolean = false;

    // Cache for scaled dimensions
    protected cachedWidth: number = 0;
    protected cachedHeight: number = 0;

    constructor(options: HandOverlayOptions = {}) {
        this._scale = options.scale ?? 0.80;
        this._offset = options.offset ?? [-18, -20];
        this._anchorTopLeft = options.anchorTopLeft ?? false;
        this._anchorPoint = options.anchorPoint;
    }

    get scale(): number { return this._scale; }
    set scale(value: number) {
        this._scale = Math.max(0.01, value);
        this.updateCachedDimensions();
    }

    get offset(): Point { return this._offset; }
    set offset(value: Point) { this._offset = value; }

    get isLoaded(): boolean { return this.isImageLoaded; }

    protected abstract updateCachedDimensions(): void;

    /**
     * Calculate the top-left position for the hand image.
     */
    protected calculatePosition(x: number, y: number): { handX: number, handY: number } {
        let handX: number;
        let handY: number;

        if (this._anchorPoint) {
            const ax = this._anchorPoint[0];
            const ay = this._anchorPoint[1];
            handX = Math.round(x - ax * this.cachedWidth) + this._offset[0];
            handY = Math.round(y - ay * this.cachedHeight) + this._offset[1];
        } else {
            handX = x + this._offset[0];
            handY = y + this._offset[1];
        }

        return { handX, handY };
    }

    /**
     * Calculate relative draw position for rotated rendering.
     */
    protected calculateRelativeDrawPosition(): { drawX: number, drawY: number } {
        if (this._anchorPoint) {
            const ax = this._anchorPoint[0];
            const ay = this._anchorPoint[1];
            return {
                drawX: -ax * this.cachedWidth + this._offset[0],
                drawY: -ay * this.cachedHeight + this._offset[1]
            };
        } else {
            return {
                drawX: this._offset[0],
                drawY: this._offset[1]
            };
        }
    }

    /**
     * Get the rotation angle to point the hand toward a target point.
     */
    static getAngleToPoint(fromX: number, fromY: number, toX: number, toY: number): number {
        return Math.atan2(toY - fromY, toX - fromX);
    }
}

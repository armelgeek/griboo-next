/**
 * Shape-specific animation functionality.
 * Handles creation and management of animations for SVG shapes.
 */

import { Animation } from '../core/animations/animation';

import type { AnimationContext } from '../core/logic/data_classes';
import { findCenter, linePoints, bezierPoints, type Line, type CubicBezier, type Point } from '../drawing/path_utils';

type PathElement = [Point, Point] | [Point, Point, Point, Point];
type PathData = PathElement[][];

interface ClosedShape {
    [key: string]: any;
}

/**
 * Handles creation and management of shape-specific animations.
 */
export class ShapeAnimator {
    /**
     * Set up the animation for a given shape.
     * 
     * @param caller - The widget calling the animation
     * @param context - AnimationContext containing animation parameters
     * @returns Array of Animation objects or null
     */
    static setupAnimation(caller: any, context: AnimationContext): Animation[] | null {
        if (!context.closedShapes[context.shapeId]) {
            return null;
        }

        caller.prevShapes = [];
        caller.currShape = [];

        let lineCount = 0;
        let bezierCount = 0;
        const animList: Animation[] = [];

        // Extract path data and transform to animation format
        const pathData = ShapeAnimator._extractPathData(
            context.widget,
            context.shapeId,
            context.closedShapes,
            context.swSize,
            context.svgFile
        );

        if (!pathData || pathData.length === 0) {
            return null;
        }

        // Calculate base point for animation, can be undefined if direct reveal
        const basePoint = ShapeAnimator._calculateBasePoint(pathData, context.direction);

        // Set up animation properties for each path element
        for (let i = 0; i < pathData.length; i++) {
            const pathElements = pathData[i];

            for (let j = 0; j < pathElements.length; j++) {
                const element = pathElements[j];

                if (element.length === 2) {
                    // Line
                    const newAnim = ShapeAnimator._setupLineAnimation(
                        context.widget,
                        context.shapeId,
                        lineCount,
                        element as [Point, Point],
                        basePoint,
                        context.direction,
                        context.transition,
                        context.duration
                    );
                    animList.push(newAnim);
                    lineCount++;
                } else if (element.length === 4) {
                    // Bezier
                    const newAnim = ShapeAnimator._setupBezierAnimation(
                        context.widget,
                        context.shapeId,
                        bezierCount,
                        element as [Point, Point, Point, Point],
                        basePoint,
                        context.direction,
                        context.transition,
                        context.duration
                    );
                    animList.push(newAnim);
                    bezierCount++;
                }
            }
        }

        // Store the extracted path data for later use
        caller[`${context.shapeId}_tmp`] = pathData;
        return animList;
    }

    /**
     * Extract and transform path data for animation.
     */
    private static _extractPathData(
        widget: any,
        shapeId: string,
        closedShapes: Record<string, ClosedShape>,
        swSize: Point,
        svgFile: string
    ): PathData {
        const result: PathData = [];
        const paths = closedShapes[shapeId][`${shapeId}paths`];

        if (!paths) {
            return result;
        }

        for (const path of paths) {
            const pathElements: PathElement[] = [];

            for (const element of path) {
                if (this._isLine(element)) {
                    const lp = linePoints(
                        element as Line,
                        [widget.width, widget.height],
                        [widget.pos[0], widget.pos[1]],
                        swSize,
                        svgFile
                    );
                    pathElements.push([
                        [lp[0], lp[1]],
                        [lp[2], lp[3]]
                    ]);
                } else if (this._isCubicBezier(element)) {
                    const bp = bezierPoints(
                        element as CubicBezier,
                        [widget.width, widget.height],
                        [widget.pos[0], widget.pos[1]],
                        swSize,
                        svgFile
                    );
                    pathElements.push([
                        [bp[0], bp[1]],
                        [bp[2], bp[3]],
                        [bp[4], bp[5]],
                        [bp[6], bp[7]]
                    ]);
                }
            }

            result.push(pathElements);
        }

        return result;
    }

    /**
     * Type guard to check if element is a Line.
     */
    private static _isLine(element: any): element is Line {
        return element && 'start' in element && 'end' in element && !('control1' in element);
    }

    /**
     * Type guard to check if element is a CubicBezier.
     */
    private static _isCubicBezier(element: any): element is CubicBezier {
        return element && 'start' in element && 'control1' in element && 'control2' in element && 'end' in element;
    }

    /**
     * Calculate the starting point for an animation based on direction.
     */
    private static _calculateBasePoint(pathData: PathData, direction: string): number | undefined {
        if (!direction) {
            return undefined;
        }

        const coordinates: number[] = [];

        // Extract relevant coordinates based on direction
        for (const path of pathData) {
            for (const element of path) {
                for (const point of element) {
                    if (direction === 'left' || direction === 'right' || direction === 'center_x') {
                        coordinates.push(point[0]);
                    } else {
                        coordinates.push(point[1]);
                    }
                }
            }
        }

        // Determine base point based on direction
        if (direction === 'top' || direction === 'right') {
            return Math.max(...coordinates); // Start from rightmost/topmost point
        } else if (direction === 'left' || direction === 'bottom') {
            return Math.min(...coordinates); // Start from leftmost/bottommost point
        } else if (direction === 'center_x' || direction === 'center_y') {
            return findCenter(coordinates.sort((a, b) => a - b));
        }

        return undefined;
    }

    /**
     * Set up animation for a line element.
     */
    private static _setupLineAnimation(
        widget: any,
        shapeId: string,
        lineCount: number,
        linePoints: [Point, Point],
        basePoint: number | undefined,
        direction: string,
        transition: string,
        duration: number
    ): Animation {
        const isHorizontal = direction === 'left' || direction === 'right' || direction === 'center_x';
        const isVertical = direction === 'top' || direction === 'bottom' || direction === 'center_y';
        const [startPoint, endPoint] = linePoints;

        // Set initial property values
        widget[`${shapeId}_mesh_line${lineCount}_start_x`] =
            isHorizontal && basePoint !== undefined ? basePoint : startPoint[0];
        widget[`${shapeId}_mesh_line${lineCount}_start_y`] =
            isVertical && basePoint !== undefined ? basePoint : startPoint[1];
        widget[`${shapeId}_mesh_line${lineCount}_end_x`] =
            isHorizontal && basePoint !== undefined ? basePoint : endPoint[0];
        widget[`${shapeId}_mesh_line${lineCount}_end_y`] =
            isVertical && basePoint !== undefined ? basePoint : endPoint[1];

        // Create animation properties
        const animProps: Record<string, number> = {};

        if (isHorizontal) {
            animProps[`${shapeId}_mesh_line${lineCount}_start_x`] = startPoint[0];
            animProps[`${shapeId}_mesh_line${lineCount}_end_x`] = endPoint[0];
        } else {
            animProps[`${shapeId}_mesh_line${lineCount}_start_y`] = startPoint[1];
            animProps[`${shapeId}_mesh_line${lineCount}_end_y`] = endPoint[1];
        }

        return new Animation({ duration, transition, ...animProps });
    }

    /**
     * Set up animation for a bezier curve element.
     */
    private static _setupBezierAnimation(
        widget: any,
        shapeId: string,
        bezierCount: number,
        bezierPoints: [Point, Point, Point, Point],
        basePoint: number | undefined,
        direction: string,
        transition: string,
        duration: number
    ): Animation {
        const isHorizontal = direction === 'left' || direction === 'right' || direction === 'center_x';
        const isVertical = direction === 'top' || direction === 'bottom' || direction === 'center_y';
        const [start, ctrl1, ctrl2, end] = bezierPoints;

        // Set initial properties
        ShapeAnimator._setBezierProperties(
            widget,
            shapeId,
            bezierCount,
            start,
            ctrl1,
            ctrl2,
            end,
            basePoint,
            isHorizontal,
            isVertical
        );

        // Create animation properties
        const animProps: Record<string, number> = {};

        if (isHorizontal) {
            animProps[`${shapeId}_mesh_bezier${bezierCount}_start_x`] = start[0];
            animProps[`${shapeId}_mesh_bezier${bezierCount}_control1_x`] = ctrl1[0];
            animProps[`${shapeId}_mesh_bezier${bezierCount}_control2_x`] = ctrl2[0];
            animProps[`${shapeId}_mesh_bezier${bezierCount}_end_x`] = end[0];
        } else {
            animProps[`${shapeId}_mesh_bezier${bezierCount}_start_y`] = start[1];
            animProps[`${shapeId}_mesh_bezier${bezierCount}_control1_y`] = ctrl1[1];
            animProps[`${shapeId}_mesh_bezier${bezierCount}_control2_y`] = ctrl2[1];
            animProps[`${shapeId}_mesh_bezier${bezierCount}_end_y`] = end[1];
        }

        return new Animation({ duration, transition, ...animProps });
    }

    /**
     * Set initial bezier curve properties.
     */
    private static _setBezierProperties(
        widget: any,
        shapeId: string,
        index: number,
        start: Point,
        ctrl1: Point,
        ctrl2: Point,
        end: Point,
        basePoint: number | undefined,
        isHorizontal: boolean,
        isVertical: boolean
    ): void {
        // Start point
        widget[`${shapeId}_mesh_bezier${index}_start_x`] =
            isHorizontal && basePoint !== undefined ? basePoint : start[0];
        widget[`${shapeId}_mesh_bezier${index}_start_y`] =
            isVertical && basePoint !== undefined ? basePoint : start[1];

        // Control point 1
        widget[`${shapeId}_mesh_bezier${index}_control1_x`] =
            isHorizontal && basePoint !== undefined ? basePoint : ctrl1[0];
        widget[`${shapeId}_mesh_bezier${index}_control1_y`] =
            isVertical && basePoint !== undefined ? basePoint : ctrl1[1];

        // Control point 2
        widget[`${shapeId}_mesh_bezier${index}_control2_x`] =
            isHorizontal && basePoint !== undefined ? basePoint : ctrl2[0];
        widget[`${shapeId}_mesh_bezier${index}_control2_y`] =
            isVertical && basePoint !== undefined ? basePoint : ctrl2[1];

        // End point
        widget[`${shapeId}_mesh_bezier${index}_end_x`] =
            isHorizontal && basePoint !== undefined ? basePoint : end[0];
        widget[`${shapeId}_mesh_bezier${index}_end_y`] =
            isVertical && basePoint !== undefined ? basePoint : end[1];
    }
}
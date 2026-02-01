/**
 * Smart Guides & Snapping
 * Provides visual alignment guides and magnetic snapping when moving elements
 */

import Konva from 'konva';

export interface SmartGuidesConfig {
    layer: Konva.Layer;
    sceneWidth: number;
    sceneHeight: number;
    snapThreshold?: number;
    enabled?: boolean;
}

export interface SnapResult {
    x?: number;
    y?: number;
    snappedX: boolean;
    snappedY: boolean;
}

export interface ElementBounds {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
    right: number;
    bottom: number;
}

/**
 * Smart Guides class for alignment and snapping
 */
export class SmartGuides {
    private layer: Konva.Layer;
    private sceneWidth: number;
    private sceneHeight: number;
    private snapThreshold: number;
    private enabled: boolean;
    
    private verticalGuides: Konva.Line[] = [];
    private horizontalGuides: Konva.Line[] = [];
    private elements: Map<string, ElementBounds> = new Map();

    constructor(config: SmartGuidesConfig) {
        this.layer = config.layer;
        this.sceneWidth = config.sceneWidth;
        this.sceneHeight = config.sceneHeight;
        this.snapThreshold = config.snapThreshold || 5; // pixels
        this.enabled = config.enabled !== false;
    }

    /**
     * Register an element for snapping
     */
    public registerElement(element: ElementBounds): void {
        this.elements.set(element.id, element);
    }

    /**
     * Unregister an element
     */
    public unregisterElement(id: string): void {
        this.elements.delete(id);
    }

    /**
     * Calculate snap position for a moving element
     */
    public calculateSnap(
        movingElement: ElementBounds,
        excludeIds: string[] = []
    ): SnapResult {
        if (!this.enabled) {
            return { snappedX: false, snappedY: false };
        }

        const result: SnapResult = {
            snappedX: false,
            snappedY: false,
        };

        const snapPoints = {
            x: [] as { position: number; type: string }[],
            y: [] as { position: number; type: string }[],
        };

        // Scene center lines
        const sceneCenterX = this.sceneWidth / 2;
        const sceneCenterY = this.sceneHeight / 2;

        // Check snapping to scene center
        if (Math.abs(movingElement.centerX - sceneCenterX) < this.snapThreshold) {
            snapPoints.x.push({ position: sceneCenterX - movingElement.width / 2, type: 'scene-center' });
        }
        if (Math.abs(movingElement.centerY - sceneCenterY) < this.snapThreshold) {
            snapPoints.y.push({ position: sceneCenterY - movingElement.height / 2, type: 'scene-center' });
        }

        // Check snapping to other elements
        this.elements.forEach((element, id) => {
            if (excludeIds.includes(id) || id === movingElement.id) {
                return;
            }

            // Horizontal alignment checks
            // Left edge to left edge
            if (Math.abs(movingElement.x - element.x) < this.snapThreshold) {
                snapPoints.x.push({ position: element.x, type: 'edge-left' });
            }
            // Right edge to right edge
            if (Math.abs(movingElement.right - element.right) < this.snapThreshold) {
                snapPoints.x.push({ position: element.right - movingElement.width, type: 'edge-right' });
            }
            // Center to center
            if (Math.abs(movingElement.centerX - element.centerX) < this.snapThreshold) {
                snapPoints.x.push({ position: element.centerX - movingElement.width / 2, type: 'center' });
            }
            // Left edge to right edge (adjacent)
            if (Math.abs(movingElement.x - element.right) < this.snapThreshold) {
                snapPoints.x.push({ position: element.right, type: 'adjacent' });
            }
            // Right edge to left edge (adjacent)
            if (Math.abs(movingElement.right - element.x) < this.snapThreshold) {
                snapPoints.x.push({ position: element.x - movingElement.width, type: 'adjacent' });
            }

            // Vertical alignment checks
            // Top edge to top edge
            if (Math.abs(movingElement.y - element.y) < this.snapThreshold) {
                snapPoints.y.push({ position: element.y, type: 'edge-top' });
            }
            // Bottom edge to bottom edge
            if (Math.abs(movingElement.bottom - element.bottom) < this.snapThreshold) {
                snapPoints.y.push({ position: element.bottom - movingElement.height, type: 'edge-bottom' });
            }
            // Center to center
            if (Math.abs(movingElement.centerY - element.centerY) < this.snapThreshold) {
                snapPoints.y.push({ position: element.centerY - movingElement.height / 2, type: 'center' });
            }
            // Top edge to bottom edge (adjacent)
            if (Math.abs(movingElement.y - element.bottom) < this.snapThreshold) {
                snapPoints.y.push({ position: element.bottom, type: 'adjacent' });
            }
            // Bottom edge to top edge (adjacent)
            if (Math.abs(movingElement.bottom - element.y) < this.snapThreshold) {
                snapPoints.y.push({ position: element.y - movingElement.height, type: 'adjacent' });
            }
        });

        // Apply snapping if found
        if (snapPoints.x.length > 0) {
            result.x = snapPoints.x[0].position;
            result.snappedX = true;
        }
        if (snapPoints.y.length > 0) {
            result.y = snapPoints.y[0].position;
            result.snappedY = true;
        }

        return result;
    }

    /**
     * Show guide lines for a moving element
     */
    public showGuides(movingElement: ElementBounds, excludeIds: string[] = []): void {
        if (!this.enabled) return;

        this.clearGuides();

        const sceneCenterX = this.sceneWidth / 2;
        const sceneCenterY = this.sceneHeight / 2;

        // Check for scene center alignment
        if (Math.abs(movingElement.centerX - sceneCenterX) < this.snapThreshold) {
            this.drawVerticalGuide(sceneCenterX, '#10b981'); // Green for scene center
        }
        if (Math.abs(movingElement.centerY - sceneCenterY) < this.snapThreshold) {
            this.drawHorizontalGuide(sceneCenterY, '#10b981'); // Green for scene center
        }

        // Check for element alignment
        this.elements.forEach((element, id) => {
            if (excludeIds.includes(id) || id === movingElement.id) {
                return;
            }

            // Vertical guides
            if (Math.abs(movingElement.x - element.x) < this.snapThreshold ||
                Math.abs(movingElement.right - element.right) < this.snapThreshold ||
                Math.abs(movingElement.centerX - element.centerX) < this.snapThreshold) {
                const guideX = Math.abs(movingElement.centerX - element.centerX) < this.snapThreshold
                    ? element.centerX
                    : Math.abs(movingElement.x - element.x) < this.snapThreshold
                        ? element.x
                        : element.right;
                this.drawVerticalGuide(guideX, '#ec4899'); // Pink for element alignment
            }

            // Horizontal guides
            if (Math.abs(movingElement.y - element.y) < this.snapThreshold ||
                Math.abs(movingElement.bottom - element.bottom) < this.snapThreshold ||
                Math.abs(movingElement.centerY - element.centerY) < this.snapThreshold) {
                const guideY = Math.abs(movingElement.centerY - element.centerY) < this.snapThreshold
                    ? element.centerY
                    : Math.abs(movingElement.y - element.y) < this.snapThreshold
                        ? element.y
                        : element.bottom;
                this.drawHorizontalGuide(guideY, '#ec4899'); // Pink for element alignment
            }
        });

        this.layer.batchDraw();
    }

    /**
     * Clear all guide lines
     */
    public clearGuides(): void {
        this.verticalGuides.forEach(guide => guide.destroy());
        this.horizontalGuides.forEach(guide => guide.destroy());
        this.verticalGuides = [];
        this.horizontalGuides = [];
        this.layer.batchDraw();
    }

    /**
     * Draw a vertical guide line
     */
    private drawVerticalGuide(x: number, color: string = '#ec4899'): void {
        const guide = new Konva.Line({
            points: [x, 0, x, this.sceneHeight],
            stroke: color,
            strokeWidth: 1,
            dash: [4, 4],
            listening: false,
        });

        this.layer.add(guide);
        this.verticalGuides.push(guide);
    }

    /**
     * Draw a horizontal guide line
     */
    private drawHorizontalGuide(y: number, color: string = '#ec4899'): void {
        const guide = new Konva.Line({
            points: [0, y, this.sceneWidth, y],
            stroke: color,
            strokeWidth: 1,
            dash: [4, 4],
            listening: false,
        });

        this.layer.add(guide);
        this.horizontalGuides.push(guide);
    }

    /**
     * Enable or disable snapping
     */
    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (!enabled) {
            this.clearGuides();
        }
    }

    /**
     * Update scene dimensions
     */
    public updateSceneSize(width: number, height: number): void {
        this.sceneWidth = width;
        this.sceneHeight = height;
    }

    /**
     * Set snap threshold
     */
    public setSnapThreshold(threshold: number): void {
        this.snapThreshold = threshold;
    }

    /**
     * Update all elements (useful when layers change)
     */
    public updateElements(elements: ElementBounds[]): void {
        this.elements.clear();
        elements.forEach(element => {
            this.elements.set(element.id, element);
        });
    }
}

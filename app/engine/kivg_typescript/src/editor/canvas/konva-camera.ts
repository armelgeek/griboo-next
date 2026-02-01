import Konva from 'konva';

export interface CameraConfig {
    id: string;
    position: { x: number; y: number }; // Absolute position in pixels relative to scene (top-left)
    width?: number;
    height?: number;
    zoom?: number;
    name?: string;
    locked?: boolean;
    isDefault?: boolean;
    color?: string; // Border color for this camera (hex format)
}

export interface EditorCameraCallbacks {
    onUpdate?: (cameraId: string, updates: Partial<CameraConfig>) => void;
    onSelect?: () => void;
}

/**
 * Pure Konva.js class for rendering and editing camera viewports.
 * Replaces the React-Konva KonvaCamera component.
 */
export class EditorCamera {
    private group: Konva.Group;
    private rect: Konva.Rect;
    private crossLine1: Konva.Line;
    private crossLine2: Konva.Line;
    private labelText: Konva.Text;
    private transformer: Konva.Transformer;
    private config: CameraConfig;
    private sceneWidth: number;
    private sceneHeight: number;
    private isSelected: boolean = false;
    private callbacks: EditorCameraCallbacks = {};
    private baseColor: string; // The base color for this camera

    constructor(config: CameraConfig, sceneWidth: number, sceneHeight: number) {
        this.config = config;
        this.sceneWidth = sceneWidth;
        this.sceneHeight = sceneHeight;
        this.baseColor = config.color || '#f9a8d4'; // Use provided color or default pink

        const pixelDims = this.getPixelDimensions();
        const pixelPos = this.getPixelPosition(pixelDims);

        // Create main group
        this.group = new Konva.Group({
            x: pixelPos.x,
            y: pixelPos.y,
            draggable: !config.locked,
            dragBoundFunc: (pos) => {
                const pixelDims = this.getPixelDimensions();
                const stage = this.group.getStage();
                if (!stage) return pos;

                // Scale of the stage (scene zoom)
                const scale = stage.scaleX();

                // Stage position (panning)
                const stageX = stage.x();
                const stageY = stage.y();

                // Scene boundaries in screen coordinates
                const minX = stageX;
                const minY = stageY;
                const maxX = stageX + (this.sceneWidth - pixelDims.width) * scale;
                const maxY = stageY + (this.sceneHeight - pixelDims.height) * scale;

                return {
                    x: Math.max(minX, Math.min(maxX, pos.x)),
                    y: Math.max(minY, Math.min(maxY, pos.y)),
                };
            },
        });

        // Camera viewport rectangle
        this.rect = new Konva.Rect({
            width: pixelDims.width,
            height: pixelDims.height,
            stroke: this.baseColor,
            strokeWidth: 3,
            dash: config.locked ? [] : [10, 5],
            fill: this.hexToRgba(this.baseColor, 0.05),
        });
        this.group.add(this.rect);

        // Cross lines for center indication
        this.crossLine1 = new Konva.Line({
            points: [0, 0, pixelDims.width, pixelDims.height],
            stroke: this.baseColor,
            strokeWidth: 2,
            dash: [5, 5],
            opacity: 0.3,
        });
        this.group.add(this.crossLine1);

        this.crossLine2 = new Konva.Line({
            points: [pixelDims.width, 0, 0, pixelDims.height],
            stroke: this.baseColor,
            strokeWidth: 2,
            dash: [5, 5],
            opacity: 0.3,
        });
        this.group.add(this.crossLine2);

        // Camera label
        this.labelText = new Konva.Text({
            x: 10,
            y: 10,
            text: config.name || 'Camera',
            fontSize: 16,
            fontFamily: 'Arial',
            fill: this.baseColor,
            fontStyle: 'bold',
        });
        this.group.add(this.labelText);

        // Transformer for resizing
        this.transformer = new Konva.Transformer({
            nodes: [],
            boundBoxFunc: (oldBox, newBox) => {
                // Minimum size constraint
                if (newBox.width < 100 || newBox.height < 100) {
                    return oldBox;
                }

                // Scene boundary constraints (in local coordinate system of the parent layer)
                // Note: newBox is in absolute coordinates, we need to handle it carefully
                // But Konva's boundBoxFunc for Transformer usually works in parent coordinates if not specified otherwise

                // Let's simplify: ensure width and height don't exceed scene
                if (newBox.width > this.sceneWidth || newBox.height > this.sceneHeight) {
                    return oldBox;
                }

                // Check if the new box is outside the scene
                if (newBox.x < 0) {
                    newBox.width += newBox.x;
                    newBox.x = 0;
                }
                if (newBox.y < 0) {
                    newBox.height += newBox.y;
                    newBox.y = 0;
                }
                if (newBox.x + newBox.width > this.sceneWidth) {
                    newBox.width = this.sceneWidth - newBox.x;
                }
                if (newBox.y + newBox.height > this.sceneHeight) {
                    newBox.height = this.sceneHeight - newBox.y;
                }

                return newBox;
            },
            enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
            keepRatio: true,
            rotateEnabled: false,
        });

        // Event handlers
        this.setupEventHandlers();
    }

    private getPixelDimensions(): { width: number; height: number } {
        return {
            width: this.config.width || 800,
            height: this.config.height || 450,
        };
    }

    private getPixelPosition(pixelDims: { width: number; height: number }): { x: number; y: number } {
        // Now position is directly in pixels (center)
        return {
            x: this.config.position.x - (pixelDims.width / 2),
            y: this.config.position.y - (pixelDims.height / 2),
        };
    }

    private setupEventHandlers(): void {
        // Click/tap to select
        this.group.on('click tap', (e) => {
            e.cancelBubble = true;
            if (this.callbacks.onSelect) {
                this.callbacks.onSelect();
            }
        });

        // Drag end
        this.group.on('dragend', () => {
            if (this.config.locked) return;

            // Get the current position (which should already be clamped by dragBoundFunc)
            const newX = this.group.x();
            const newY = this.group.y();

            // Re-calculate the pixel dimensions to get the center
            const width = this.rect.width();
            const height = this.rect.height();

            const centerX = newX + (width / 2);
            const centerY = newY + (height / 2);

            if (this.callbacks.onUpdate) {
                this.callbacks.onUpdate(this.config.id, {
                    position: {
                        x: centerX,
                        y: centerY,
                    },
                });
            }

            // Re-select camera after drag
            if (this.callbacks.onSelect) {
                this.callbacks.onSelect();
            }
        });

        // Transform end
        this.group.on('transformend', () => {
            if (this.config.locked) return;

            const scaleX = this.group.scaleX();
            const scaleY = this.group.scaleY();

            // Get current dimensions (rect dimensions * scale)
            const currentWidth = this.rect.width();
            const currentHeight = this.rect.height();

            const newWidth = Math.max(100, currentWidth * scaleX);
            const newHeight = Math.max(100, currentHeight * scaleY);

            // Calculate new zoom based on width change
            const oldWidth = this.config.width || currentWidth;
            const newZoom = Math.max(0.1, Math.min(5.0, (oldWidth / newWidth) * (this.config.zoom || 1)));

            const newX = this.group.x();
            const newY = this.group.y();
            const centerX = newX + (newWidth / 2);
            const centerY = newY + (newHeight / 2);

            if (this.callbacks.onUpdate) {
                this.callbacks.onUpdate(this.config.id, {
                    position: {
                        x: centerX,
                        y: centerY,
                    },
                    width: newWidth,
                    height: newHeight,
                    zoom: newZoom,
                });
            }

            // Reset scale of the group, apply dimensions to the rect
            this.group.scaleX(1);
            this.group.scaleY(1);

            this.rect.width(newWidth);
            this.rect.height(newHeight);
            this.crossLine1.points([0, 0, newWidth, newHeight]);
            this.crossLine2.points([newWidth, 0, 0, newHeight]);

            // Re-select camera after transform
            if (this.callbacks.onSelect) {
                this.callbacks.onSelect();
            }
        });

    }

    /**
     * Set callbacks for camera events
     */
    public setCallbacks(callbacks: EditorCameraCallbacks): void {
        this.callbacks = callbacks;
    }

    /**
     * Set whether this camera is selected
     */
    public setSelected(selected: boolean): void {
        this.isSelected = selected;
        // When selected, darken the base color slightly
        const color = selected ? this.darkenColor(this.baseColor, 0.2) : this.baseColor;
        const fillOpacity = selected ? 0.1 : 0.05;

        this.rect.setAttrs({
            stroke: color,
            fill: this.hexToRgba(this.baseColor, fillOpacity),
        });
        this.crossLine1.setAttrs({
            stroke: color,
            opacity: selected ? 0.6 : 0.3,
        });
        this.crossLine2.setAttrs({
            stroke: color,
            opacity: selected ? 0.6 : 0.3,
        });
        this.labelText.fill(color);

        if (selected && !this.config.locked) {
            this.transformer.nodes([this.group]);
        } else {
            this.transformer.nodes([]);
        }
    }

    /**
     * Update camera configuration
     */
    public update(config: Partial<CameraConfig>): void {
        Object.assign(this.config, config);

        const pixelDims = this.getPixelDimensions();
        const pixelPos = this.getPixelPosition(pixelDims);

        this.group.setAttrs({
            x: pixelPos.x,
            y: pixelPos.y,
            draggable: !this.config.locked,
        });

        this.rect.setAttrs({
            width: pixelDims.width,
            height: pixelDims.height,
            dash: this.config.locked ? [] : [10, 5],
        });

        this.crossLine1.points([0, 0, pixelDims.width, pixelDims.height]);
        this.crossLine2.points([pixelDims.width, 0, 0, pixelDims.height]);
        this.labelText.text(this.config.name || 'Camera');
    }

    /**
     * Get the current camera configuration
     */
    public getConfig(): CameraConfig {
        return { ...this.config };
    }

    /**
     * Get the Konva.Group node
     */
    public getNode(): Konva.Group {
        return this.group;
    }

    /**
     * Get the transformer (must be added to a separate layer above)
     */
    public getTransformer(): Konva.Transformer {
        return this.transformer;
    }

    /**
     * Convert hex color to rgba string
     * Handles both 3-char (#fff) and 6-char (#ffffff) hex formats
     */
    private hexToRgba(hex: string, alpha: number): string {
        // Remove # if present
        hex = hex.replace('#', '');

        // Expand short-form hex to full form (e.g., 'fff' -> 'ffffff')
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }

        // Parse hex values
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Darken a hex color by a given amount (0-1)
     * Handles both 3-char (#fff) and 6-char (#ffffff) hex formats
     */
    private darkenColor(hex: string, amount: number): string {
        // Remove # if present and normalize to 6-char format
        let normalizedHex = hex.replace('#', '');

        // Expand short-form hex to full form
        if (normalizedHex.length === 3) {
            normalizedHex = normalizedHex[0] + normalizedHex[0] + normalizedHex[1] + normalizedHex[1] + normalizedHex[2] + normalizedHex[2];
        }

        // Parse hex values
        let r = parseInt(normalizedHex.substring(0, 2), 16);
        let g = parseInt(normalizedHex.substring(2, 4), 16);
        let b = parseInt(normalizedHex.substring(4, 6), 16);

        // Darken by reducing each component
        r = Math.max(0, Math.floor(r * (1 - amount)));
        g = Math.max(0, Math.floor(g * (1 - amount)));
        b = Math.max(0, Math.floor(b * (1 - amount)));

        // Convert back to hex
        const toHex = (n: number) => {
            const hexStr = n.toString(16);
            return hexStr.length === 1 ? '0' + hexStr : hexStr;
        };

        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    /**
     * Destroy the camera and cleanup resources
     */
    public destroy(): void {
        this.transformer.destroy();
        this.group.destroy();
    }
}

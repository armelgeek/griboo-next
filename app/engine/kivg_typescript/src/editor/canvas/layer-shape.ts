import Konva from 'konva';

export type ShapeType =
    | 'circle'
    | 'rectangle'
    | 'square'
    | 'ellipse'
    | 'triangle'
    | 'star'
    | 'hexagon'
    | 'polygon'
    | 'line'
    | 'arrow';

export interface ShapeLayerConfig {
    id: string;
    type: 'shape';
    shape: ShapeType;
    position?: { x: number; y: number };
    width?: number;
    height?: number;
    radius?: number;
    scale?: number;
    rotation?: number;
    opacity?: number;
    strokeColor?: string;
    strokeWidth?: number;
    fillColor?: string;
    cornerRadius?: number;
    locked?: boolean;
    // For polygon/star
    numPoints?: number;
    innerRadius?: number;
    // For line/arrow
    points?: number[];
    pointerLength?: number;
    pointerWidth?: number;
}

export interface ShapeLayerCallbacks {
    onChange?: (layer: ShapeLayerConfig) => void;
    onSelect?: (e?: any) => void;
}

/**
 * Pure Konva.js class for rendering and editing shape layers.
 * Supports multiple shape types: circle, rectangle, triangle, star, etc.
 */
export class ShapeLayer {
    private shapeNode: Konva.Shape | null = null;
    private transformer: Konva.Transformer;
    private config: ShapeLayerConfig;
    private isSelected: boolean = false;
    private callbacks: ShapeLayerCallbacks = {};
    private dragStartPos: { x: number; y: number } | null = null;

    constructor(config: ShapeLayerConfig) {
        this.config = { ...config };

        // Create the shape
        this.createShape();

        // Create transformer
        this.transformer = new Konva.Transformer({
            nodes: [],
            rotateEnabled: true,
            boundBoxFunc: (oldBox, newBox) => {
                if (newBox.width < 5 || newBox.height < 5) {
                    return oldBox;
                }
                return newBox;
                return newBox;
            },
        });

        // Setup event handlers
        this.setupEventHandlers();
    }

    private createShape(): void {
        const config = this.config;
        const commonAttrs = {
            x: config.position?.x || 0,
            y: config.position?.y || 0,
            rotation: config.rotation || 0,
            opacity: config.opacity || 1.0,
            scaleX: config.scale || 1.0,
            scaleY: config.scale || 1.0,
            draggable: !config.locked,
            stroke: config.strokeColor || '#000000',
            strokeWidth: config.strokeWidth || 2,
            fill: config.fillColor || 'transparent',
        };

        switch (config.shape) {
            case 'circle':
                this.shapeNode = new Konva.Circle({
                    ...commonAttrs,
                    radius: config.radius || 50,
                });
                break;

            case 'ellipse':
                this.shapeNode = new Konva.Ellipse({
                    ...commonAttrs,
                    radiusX: (config.width || 100) / 2,
                    radiusY: (config.height || 60) / 2,
                });
                break;

            case 'rectangle':
            case 'square':
                const width = config.shape === 'square'
                    ? (config.width || config.height || 100)
                    : (config.width || 100);
                const height = config.shape === 'square'
                    ? (config.width || config.height || 100)
                    : (config.height || 80);
                this.shapeNode = new Konva.Rect({
                    ...commonAttrs,
                    width,
                    height,
                    offsetX: width / 2,
                    offsetY: height / 2,
                    cornerRadius: config.cornerRadius || 0,
                });
                break;

            case 'triangle':
                const triSize = config.width || 100;
                this.shapeNode = new Konva.RegularPolygon({
                    ...commonAttrs,
                    sides: 3,
                    radius: triSize / 2,
                });
                break;

            case 'hexagon':
                const hexSize = config.width || 100;
                this.shapeNode = new Konva.RegularPolygon({
                    ...commonAttrs,
                    sides: 6,
                    radius: hexSize / 2,
                });
                break;

            case 'polygon':
                this.shapeNode = new Konva.RegularPolygon({
                    ...commonAttrs,
                    sides: config.numPoints || 5,
                    radius: config.radius || 50,
                });
                break;

            case 'star':
                this.shapeNode = new Konva.Star({
                    ...commonAttrs,
                    numPoints: config.numPoints || 5,
                    innerRadius: config.innerRadius || 25,
                    outerRadius: config.radius || 50,
                });
                break;

            case 'line':
                this.shapeNode = new Konva.Line({
                    ...commonAttrs,
                    points: config.points || [0, 0, 100, 0],
                    lineCap: 'round',
                    lineJoin: 'round',
                });
                break;

            case 'arrow':
                this.shapeNode = new Konva.Arrow({
                    ...commonAttrs,
                    points: config.points || [0, 0, 100, 0],
                    pointerLength: config.pointerLength || 10,
                    pointerWidth: config.pointerWidth || 10,
                });
                break;

            default:
                // Default to rectangle
                this.shapeNode = new Konva.Rect({
                    ...commonAttrs,
                    width: config.width || 100,
                    height: config.height || 80,
                    offsetX: (config.width || 100) / 2,
                    offsetY: (config.height || 80) / 2,
                });
        }
    }

    private setupEventHandlers(): void {
        if (!this.shapeNode) return;

        // Click/tap to select
        this.shapeNode.on('click tap', (e) => {
            if (this.callbacks.onSelect) {
                this.callbacks.onSelect(e);
            }
        });

        // Drag start
        this.shapeNode.on('dragstart', (e) => {
            this.dragStartPos = {
                x: e.target.x(),
                y: e.target.y(),
            };
        });

        // Drag end
        this.shapeNode.on('dragend', (e) => {
            const finalX = e.target.x();
            const finalY = e.target.y();

            const updatedConfig: ShapeLayerConfig = {
                ...this.config,
                position: { x: finalX, y: finalY },
            };

            this.config = updatedConfig;

            if (this.callbacks.onChange) {
                this.callbacks.onChange(updatedConfig);
            }

            this.dragStartPos = null;
        });

        // Transform end
        this.shapeNode.on('transformend', () => {
            if (!this.shapeNode) return;

            const node = this.shapeNode;
            const newScale = Math.abs(node.scaleX());

            const updatedConfig: ShapeLayerConfig = {
                ...this.config,
                position: { x: node.x(), y: node.y() },
                scale: newScale,
                rotation: node.rotation(),
            };

            // Update width/height for rect-based shapes
            if (this.config.shape === 'rectangle' || this.config.shape === 'square') {
                const rect = node as Konva.Rect;
                updatedConfig.width = rect.width() * newScale;
                updatedConfig.height = rect.height() * newScale;
            }

            this.config = updatedConfig;

            // Reset node scale
            node.scaleX(1);
            node.scaleY(1);

            if (this.callbacks.onChange) {
                this.callbacks.onChange(updatedConfig);
            }
        });

        // Drag bounds
        this.shapeNode.dragBoundFunc((pos) => pos);
    }

    /**
     * Set callbacks for layer events
     */
    public setCallbacks(callbacks: ShapeLayerCallbacks): void {
        this.callbacks = callbacks;
    }

    /**
     * Set whether this layer is selected
     */
    public setSelected(selected: boolean): void {
        this.isSelected = selected;

        if (selected && this.shapeNode && !this.config.locked) {
            this.transformer.nodes([this.shapeNode]);
        } else {
            this.transformer.nodes([]);
        }
    }

    /**
     * Update layer configuration
     */
    public update(config: Partial<ShapeLayerConfig>): void {
        const shapeChanged = config.shape && config.shape !== this.config.shape;
        Object.assign(this.config, config);

        if (shapeChanged) {
            // Recreate shape if type changed
            if (this.shapeNode) {
                this.shapeNode.destroy();
            }
            this.createShape();
            this.setupEventHandlers();
        } else if (this.shapeNode) {
            // Update existing shape properties
            this.shapeNode.x(this.config.position?.x || 0);
            this.shapeNode.y(this.config.position?.y || 0);
            this.shapeNode.rotation(this.config.rotation || 0);
            this.shapeNode.opacity(this.config.opacity || 1.0);
            this.shapeNode.scaleX(this.config.scale || 1.0);
            this.shapeNode.scaleY(this.config.scale || 1.0);

            if (this.config.shape === 'rectangle' || this.config.shape === 'square') {
                this.shapeNode.offsetX((this.config.width || 0) / 2);
                this.shapeNode.offsetY((this.config.height || 0) / 2);
            }

            this.shapeNode.stroke(this.config.strokeColor || '#000000');
            this.shapeNode.strokeWidth(this.config.strokeWidth || 2);
            this.shapeNode.fill(this.config.fillColor || 'transparent');
            this.shapeNode.draggable(!this.config.locked);
        }
    }

    /**
     * Update shape styling (color, stroke, fill)
     */
    public updateStyle(style: { strokeColor?: string; strokeWidth?: number; fillColor?: string }): void {
        if (!this.shapeNode) return;

        if (style.strokeColor !== undefined) {
            this.config.strokeColor = style.strokeColor;
            this.shapeNode.stroke(style.strokeColor);
        }
        if (style.strokeWidth !== undefined) {
            this.config.strokeWidth = style.strokeWidth;
            this.shapeNode.strokeWidth(style.strokeWidth);
        }
        if (style.fillColor !== undefined) {
            this.config.fillColor = style.fillColor;
            this.shapeNode.fill(style.fillColor);
        }
    }

    /**
     * Get the Konva.Shape node
     */
    public getNode(): Konva.Shape | null {
        return this.shapeNode;
    }

    /**
     * Get the transformer
     */
    public getTransformer(): Konva.Transformer {
        return this.transformer;
    }

    /**
     * Get current shape type
     */
    public getShapeType(): ShapeType {
        return this.config.shape;
    }

    /**
     * Destroy the layer and cleanup resources
     */
    public destroy(): void {
        this.transformer.destroy();
        if (this.shapeNode) {
            this.shapeNode.destroy();
        }
    }
}

import Konva from 'konva';

export interface SvgLayerConfig {
    id: string;
    type: 'svg';
    svg_path: string;
    position?: { x: number; y: number };
    scale?: number;
    rotation?: number;
    opacity?: number;
    width?: number;
    height?: number;
    flipX?: boolean;
    flipY?: boolean;
    locked?: boolean;
    shape_config?: {
        color?: string;
        fill_color?: string;
        stroke_width?: number;
    };
}

export interface SvgLayerCallbacks {
    onChange?: (layer: SvgLayerConfig) => void;
    onSelect?: (e?: any) => void;
}

interface ParsedPath {
    data: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
}

/**
 * Pure Konva.js class for rendering and editing SVG layers.
 * Replaces the React-Konva LayerSvg component.
 */
export class SvgLayer {
    private group: Konva.Group;
    private paths: Konva.Path[] = [];
    private hitPath: Konva.Path | null = null;
    private transformer: Konva.Transformer;
    private config: SvgLayerConfig;
    private svgSize: { width: number; height: number } = { width: 100, height: 100 };
    private isSelected: boolean = false;
    private callbacks: SvgLayerCallbacks = {};
    private isLoaded: boolean = false;
    private dragStartPos: { x: number; y: number } | null = null;

    constructor(config: SvgLayerConfig) {
        this.config = { ...config };

        // Create main group
        this.group = new Konva.Group({
            x: config.position?.x || 0,
            y: config.position?.y || 0,
            scaleX: (config.scale || 1.0) * (config.flipX ? -1 : 1),
            scaleY: (config.scale || 1.0) * (config.flipY ? -1 : 1),
            rotation: config.rotation || 0,
            opacity: config.opacity || 1.0,
            draggable: !config.locked,
        });

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

    /**
     * Load and parse the SVG from the configured path
     */
    public async loadSvg(): Promise<void> {
        try {
            const response = await fetch(this.config.svg_path);
            const svgText = await response.text();

            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
            const svgElement = svgDoc.querySelector('svg');

            if (!svgElement) {
                throw new Error('No SVG element found');
            }

            // Get dimensions
            const width = parseFloat(svgElement.getAttribute('width') || '100');
            const height = parseFloat(svgElement.getAttribute('height') || '100');
            const viewBox = svgElement.getAttribute('viewBox');

            let actualWidth = width;
            let actualHeight = height;

            if (viewBox) {
                const [, , vbWidth, vbHeight] = viewBox.split(' ').map(Number);
                actualWidth = vbWidth || width;
                actualHeight = vbHeight || height;
            }

            this.svgSize = { width: actualWidth, height: actualHeight };

            // Update group offset for central origin
            this.group.setAttrs({
                offsetX: actualWidth / 2,
                offsetY: actualHeight / 2,
            });

            // Parse paths
            const pathElements = svgDoc.querySelectorAll('path');
            const parsedPaths: ParsedPath[] = [];

            pathElements.forEach((pathElement) => {
                const d = pathElement.getAttribute('d');
                if (d) {
                    const shapeConfig = this.config.shape_config || {};
                    const style = this.parseStyle(pathElement.getAttribute('style'));

                    const originalFill = pathElement.getAttribute('fill') || style['fill'] || '#000000';
                    const originalStroke = pathElement.getAttribute('stroke') || style['stroke'] || undefined;
                    const originalStrokeWidth = pathElement.getAttribute('stroke-width') !== null
                        ? parseFloat(pathElement.getAttribute('stroke-width')!)
                        : (style['stroke-width'] ? parseFloat(style['stroke-width']) : 0);

                    parsedPaths.push({
                        data: d,
                        fill: shapeConfig.fill_color && shapeConfig.fill_color !== 'none'
                            ? shapeConfig.fill_color
                            : originalFill,
                        stroke: shapeConfig.color || originalStroke,
                        strokeWidth: shapeConfig.stroke_width ?? originalStrokeWidth,
                    });
                }
            });

            // Create Konva paths
            this.createPaths(parsedPaths);
            this.isLoaded = true;

            // Notify about initial dimensions if needed
            if (!this.config.width || !this.config.height) {
                const currentScale = this.config.scale || 1.0;
                const updatedConfig: SvgLayerConfig = {
                    ...this.config,
                    width: actualWidth * currentScale,
                    height: actualHeight * currentScale,
                };
                this.config = updatedConfig;

                if (this.callbacks.onChange) {
                    this.callbacks.onChange(updatedConfig);
                }
            }
        } catch (e) {
            console.error('Error loading SVG (Check CORS policy if using external URLs):', e);
            throw e;
        }
    }

    private parseStyle(styleString: string | null): Record<string, string> {
        if (!styleString) return {};
        return styleString.split(';').reduce((acc, style) => {
            const [key, value] = style.split(':').map(s => s.trim());
            if (key && value) acc[key] = value;
            return acc;
        }, {} as Record<string, string>);
    }

    private createPaths(parsedPaths: ParsedPath[]): void {
        // Clear existing paths
        this.paths.forEach(p => p.destroy());
        this.paths = [];
        if (this.hitPath) {
            this.hitPath.destroy();
            this.hitPath = null;
        }

        // Create transparent hit area
        this.hitPath = new Konva.Path({
            data: `M0 0 H${this.svgSize.width} V${this.svgSize.height} H0 Z`,
            fill: 'rgba(0,0,0,0)',
            listening: true,
        });
        this.group.add(this.hitPath);

        // Create visible paths
        parsedPaths.forEach((pathConfig) => {
            const path = new Konva.Path({
                data: pathConfig.data,
                fill: pathConfig.fill,
                stroke: pathConfig.stroke,
                strokeWidth: pathConfig.strokeWidth,
            });
            this.paths.push(path);
            this.group.add(path);
        });
    }

    private setupEventHandlers(): void {
        // Click/tap to select
        this.group.on('click tap', (e) => {
            if (this.callbacks.onSelect) {
                this.callbacks.onSelect(e);
            }
        });

        // Drag start
        this.group.on('dragstart', (e) => {
            this.dragStartPos = {
                x: e.target.x(),
                y: e.target.y(),
            };
        });

        // Drag end
        this.group.on('dragend', (e) => {
            const finalX = e.target.x();
            const finalY = e.target.y();

            const updatedConfig: SvgLayerConfig = {
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
        this.group.on('transformend', () => {
            const newScale = Math.abs(this.group.scaleX());
            const newWidth = this.svgSize.width * newScale;
            const newHeight = this.svgSize.height * newScale;

            const updatedConfig: SvgLayerConfig = {
                ...this.config,
                position: { x: this.group.x(), y: this.group.y() },
                width: newWidth,
                height: newHeight,
                scale: newScale,
                rotation: this.group.rotation(),
            };

            this.config = updatedConfig;

            // Reset scale while preserving flip
            this.group.scaleX(this.config.flipX ? -1 : 1);
            this.group.scaleY(this.config.flipY ? -1 : 1);

            if (this.callbacks.onChange) {
                this.callbacks.onChange(updatedConfig);
            }
        });

        this.group.dragBoundFunc((pos) => pos);
    }

    /**
     * Set callbacks for layer events
     */
    public setCallbacks(callbacks: SvgLayerCallbacks): void {
        this.callbacks = callbacks;
    }

    /**
     * Set whether this layer is selected
     */
    public setSelected(selected: boolean): void {
        this.isSelected = selected;

        if (selected && !this.config.locked && this.isLoaded) {
            this.transformer.nodes([this.group]);
        } else {
            this.transformer.nodes([]);
        }
    }

    /**
     * Update layer configuration
     */
    public update(config: Partial<SvgLayerConfig>): void {
        Object.assign(this.config, config);

        this.group.setAttrs({
            x: this.config.position?.x || 0,
            y: this.config.position?.y || 0,
            scaleX: (this.config.scale || 1.0) * (this.config.flipX ? -1 : 1),
            scaleY: (this.config.scale || 1.0) * (this.config.flipY ? -1 : 1),
            offsetX: this.svgSize.width / 2,
            offsetY: this.svgSize.height / 2,
            rotation: this.config.rotation || 0,
            opacity: this.config.opacity || 1.0,
            draggable: !this.config.locked,
        });
    }

    /**
     * Get the Konva.Group node
     */
    public getNode(): Konva.Group {
        return this.group;
    }

    /**
     * Get the transformer
     */
    public getTransformer(): Konva.Transformer {
        return this.transformer;
    }

    /**
     * Check if SVG is loaded and ready
     */
    public isReady(): boolean {
        return this.isLoaded;
    }

    /**
     * Get SVG dimensions
     */
    public getSvgSize(): { width: number; height: number } {
        return { ...this.svgSize };
    }

    /**
     * Destroy the layer and cleanup resources
     */
    public destroy(): void {
        this.transformer.destroy();
        this.group.destroy();
    }
}

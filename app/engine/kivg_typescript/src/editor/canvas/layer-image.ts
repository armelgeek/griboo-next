import Konva from 'konva';

export interface ImageLayerConfig {
    id: string;
    type: 'image';
    image_path: string;
    position?: { x: number; y: number };
    scale?: number;
    rotation?: number;
    opacity?: number;
    width?: number;
    height?: number;
    flipX?: boolean;
    flipY?: boolean;
    locked?: boolean;
}

export interface ImageLayerCallbacks {
    onChange?: (layer: ImageLayerConfig) => void;
    onSelect?: (e?: any) => void;
}

/**
 * Pure Konva.js class for rendering and editing image layers.
 * Replaces the React-Konva LayerImage component.
 */
export class ImageLayer {
    private imageNode: Konva.Image | null = null;
    private transformer: Konva.Transformer;
    private config: ImageLayerConfig;
    private isSelected: boolean = false;
    private callbacks: ImageLayerCallbacks = {};
    private loadedImage: HTMLImageElement | null = null;
    private dragStartPos: { x: number; y: number } | null = null;

    constructor(config: ImageLayerConfig) {
        this.config = { ...config };

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
    }

    /**
     * Load the image from the configured path
     */
    public async loadImage(): Promise<void> {
        return new Promise((resolve, reject) => {
            const imageObj = new Image();
            imageObj.crossOrigin = 'anonymous';

            imageObj.onload = () => {
                this.loadedImage = imageObj;
                this.createImageNode();
                resolve();
            };

            imageObj.onerror = (err) => {
                console.error('Failed to load image:', this.config.image_path, err);
                reject(err);
            };

            imageObj.src = this.config.image_path;
        });
    }

    private createImageNode(): void {
        if (!this.loadedImage) return;

        const config = this.config;
        const img = this.loadedImage;

        this.imageNode = new Konva.Image({
            image: img,
            x: config.position?.x || 0,
            y: config.position?.y || 0,
            scaleX: (config.scale || 1.0) * (config.flipX ? -1 : 1),
            scaleY: (config.scale || 1.0) * (config.flipY ? -1 : 1),
            offsetX: img.width / 2, // Center offset
            offsetY: img.height / 2, // Center offset
            rotation: config.rotation || 0,
            opacity: config.opacity || 1.0,
            draggable: !config.locked,
        });

        // Setup event handlers
        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        if (!this.imageNode) return;

        // Click/tap to select
        this.imageNode.on('click tap', (e) => {
            if (this.callbacks.onSelect) {
                this.callbacks.onSelect(e);
            }
        });

        // Drag start
        this.imageNode.on('dragstart', (e) => {
            this.dragStartPos = {
                x: e.target.x(),
                y: e.target.y(),
            };
        });

        // Drag end
        this.imageNode.on('dragend', (e) => {
            const finalX = e.target.x();
            const finalY = e.target.y();

            const updatedConfig: ImageLayerConfig = {
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
        this.imageNode.on('transformend', () => {
            if (!this.imageNode || !this.loadedImage) return;

            const node = this.imageNode;
            const img = this.loadedImage;
            const newScale = Math.abs(node.scaleX());
            const newWidth = img.width * newScale;
            const newHeight = img.height * newScale;

            const updatedConfig: ImageLayerConfig = {
                ...this.config,
                position: { x: node.x(), y: node.y() },
                width: newWidth,
                height: newHeight,
                scale: newScale,
                rotation: node.rotation(),
            };

            this.config = updatedConfig;

            // Reset node scale while preserving flip
            node.scaleX(this.config.flipX ? -1 : 1);
            node.scaleY(this.config.flipY ? -1 : 1);

            if (this.callbacks.onChange) {
                this.callbacks.onChange(updatedConfig);
            }
        });

        // Drag bounds
        this.imageNode.dragBoundFunc((pos) => pos);
    }

    /**
     * Set callbacks for layer events
     */
    public setCallbacks(callbacks: ImageLayerCallbacks): void {
        this.callbacks = callbacks;
    }

    /**
     * Set whether this layer is selected
     */
    public setSelected(selected: boolean): void {
        this.isSelected = selected;

        if (selected && this.imageNode && !this.config.locked) {
            this.transformer.nodes([this.imageNode]);
        } else {
            this.transformer.nodes([]);
        }
    }

    /**
     * Update layer configuration
     */
    public update(config: Partial<ImageLayerConfig>): void {
        Object.assign(this.config, config);

        if (this.imageNode && this.loadedImage) {
            const img = this.loadedImage;

            this.imageNode.x(this.config.position?.x || 0);
            this.imageNode.y(this.config.position?.y || 0);
            this.imageNode.scaleX((this.config.scale || 1.0) * (this.config.flipX ? -1 : 1));
            this.imageNode.scaleY((this.config.scale || 1.0) * (this.config.flipY ? -1 : 1));
            this.imageNode.offsetX(img.width / 2);
            this.imageNode.offsetY(img.height / 2);
            this.imageNode.rotation(this.config.rotation || 0);
            this.imageNode.opacity(this.config.opacity || 1.0);
            this.imageNode.draggable(!this.config.locked);
        }
    }

    /**
     * Get the Konva.Image node (may be null if image not loaded)
     */
    public getNode(): Konva.Image | null {
        return this.imageNode;
    }

    /**
     * Get the transformer
     */
    public getTransformer(): Konva.Transformer {
        return this.transformer;
    }

    /**
     * Check if image is loaded and ready
     */
    public isReady(): boolean {
        return this.imageNode !== null;
    }

    /**
     * Destroy the layer and cleanup resources
     */
    public destroy(): void {
        this.transformer.destroy();
        if (this.imageNode) {
            this.imageNode.destroy();
        }
    }
}

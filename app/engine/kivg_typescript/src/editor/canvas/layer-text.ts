import Konva from 'konva';

export interface TextLayerConfig {
    id: string;
    type: 'text';
    position?: { x: number; y: number };
    text_config?: {
        text?: string;
        size?: number;
        font?: string;
        style?: 'normal' | 'bold' | 'italic' | 'bold_italic';
        color?: string | number[];
        align?: 'left' | 'center' | 'right';
        line_height?: number;
        direction?: 'ltr' | 'rtl';
    };
    scale?: number;
    scaleX?: number;
    scaleY?: number;
    rotation?: number;
    opacity?: number;
    width?: number;
    height?: number;
    locked?: boolean;
}

export interface TextLayerCallbacks {
    onChange?: (layer: TextLayerConfig) => void;
    onSelect?: (e?: any) => void;
    onDoubleClick?: () => void;
}

/**
 * Pure Konva.js class for rendering and editing text layers.
 * Replaces the React-Konva LayerText component.
 */
export class TextLayer {
    private textNode: Konva.Text;
    private transformer: Konva.Transformer;
    private config: TextLayerConfig;
    private isSelected: boolean = false;
    private callbacks: TextLayerCallbacks = {};
    private dragStartPos: { x: number; y: number } | null = null;

    constructor(config: TextLayerConfig) {
        this.config = { ...config };

        const textConfig = config.text_config || {};
        const text = textConfig.text || 'Texte';
        const fontSize = textConfig.size || 48;
        const fontFamily = textConfig.font || 'Arial';
        const align = textConfig.align || 'left';
        const lineHeight = textConfig.line_height || 1.2;

        // Calculate font style
        let fontStyle = 'normal';
        if (textConfig.style === 'bold') fontStyle = 'bold';
        else if (textConfig.style === 'italic') fontStyle = 'italic';
        else if (textConfig.style === 'bold_italic') fontStyle = 'bold italic';

        // Calculate fill color
        let fill = '#000000';
        if (Array.isArray(textConfig.color)) {
            fill = `#${textConfig.color.map((c: number) => c.toString(16).padStart(2, '0')).join('')}`;
        } else if (typeof textConfig.color === 'string') {
            fill = textConfig.color;
        }

        // Create text node
        this.textNode = new Konva.Text({
            text,
            x: config.position?.x || 0,
            y: config.position?.y || 0,
            fontSize,
            fontFamily,
            fontStyle,
            fill,
            align,
            lineHeight,
            rotation: config.rotation || 0,
            scaleX: (config.scale || 1.0) * (config.scaleX || 1.0),
            scaleY: (config.scale || 1.0) * (config.scaleY || 1.0),
            opacity: config.opacity || 1.0,
            draggable: !config.locked,
        });

        // Calculate and set offsets for alignment
        this.updateTextOffsets();

        // Create transformer
        this.transformer = new Konva.Transformer({
            nodes: [],
            rotateEnabled: true,
            boundBoxFunc: (oldBox, newBox) => {
                if (newBox.width < 10 || newBox.height < 10) {
                    return oldBox;
                }
                return newBox;
                return newBox;
            },
        });

        // Setup event handlers
        this.setupEventHandlers();
    }

    private updateTextOffsets(): void {
        const align = this.config.text_config?.align || 'left';
        const width = this.textNode.width();
        const height = this.textNode.height();

        this.textNode.setAttrs({
            offsetX: width / 2,
            offsetY: height / 2,
        });
    }

    private setupEventHandlers(): void {
        // Click/tap to select
        this.textNode.on('click tap', (e) => {
            if (this.callbacks.onSelect) {
                this.callbacks.onSelect(e);
            }
        });

        // Double click for editing
        this.textNode.on('dblclick dbltap', () => {
            if (this.callbacks.onDoubleClick) {
                this.callbacks.onDoubleClick();
            }
        });

        // Drag start
        this.textNode.on('dragstart', (e) => {
            this.dragStartPos = {
                x: e.target.x(),
                y: e.target.y(),
            };
        });

        // Drag end
        this.textNode.on('dragend', (e) => {
            const finalX = e.target.x();
            const finalY = e.target.y();

            const updatedConfig: TextLayerConfig = {
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
        this.textNode.on('transformend', () => {
            const transformScaleX = this.textNode.scaleX();
            const transformScaleY = this.textNode.scaleY();

            const currentScaleX = this.config.scaleX || 1.0;
            const currentScaleY = this.config.scaleY || 1.0;

            const newScaleX = currentScaleX * transformScaleX;
            const newScaleY = currentScaleY * transformScaleY;

            const updatedConfig: TextLayerConfig = {
                ...this.config,
                position: { x: this.textNode.x(), y: this.textNode.y() },
                width: this.textNode.width(),
                height: this.textNode.height(),
                scale: this.config.scale || 1.0,
                scaleX: newScaleX,
                scaleY: newScaleY,
                rotation: this.textNode.rotation(),
            };

            this.config = updatedConfig;

            // Reset node scale
            this.textNode.scaleX(1);
            this.textNode.scaleY(1);

            if (this.callbacks.onChange) {
                this.callbacks.onChange(updatedConfig);
            }

            // Keep selection after transform
            if (this.callbacks.onSelect) {
                this.callbacks.onSelect();
            }
        });

        this.textNode.dragBoundFunc((pos) => pos);
    }

    /**
     * Set callbacks for layer events
     */
    public setCallbacks(callbacks: TextLayerCallbacks): void {
        this.callbacks = callbacks;
    }

    /**
     * Set whether this layer is selected
     */
    public setSelected(selected: boolean): void {
        this.isSelected = selected;

        if (selected && !this.config.locked) {
            this.transformer.nodes([this.textNode]);
        } else {
            this.transformer.nodes([]);
        }
    }

    /**
     * Update layer configuration
     */
    public update(config: Partial<TextLayerConfig>): void {
        Object.assign(this.config, config);

        const textConfig = this.config.text_config || {};
        const text = textConfig.text || 'Texte';
        const fontSize = textConfig.size || 48;
        const fontFamily = textConfig.font || 'Arial';
        const align = textConfig.align || 'left';
        const lineHeight = textConfig.line_height || 1.2;

        // Calculate font style
        let fontStyle = 'normal';
        if (textConfig.style === 'bold') fontStyle = 'bold';
        else if (textConfig.style === 'italic') fontStyle = 'italic';
        else if (textConfig.style === 'bold_italic') fontStyle = 'bold italic';

        // Calculate fill color
        let fill = '#000000';
        if (Array.isArray(textConfig.color)) {
            fill = `#${textConfig.color.map((c: number) => c.toString(16).padStart(2, '0')).join('')}`;
        } else if (typeof textConfig.color === 'string') {
            fill = textConfig.color;
        }

        this.textNode.setAttrs({
            text,
            x: this.config.position?.x || 0,
            y: this.config.position?.y || 0,
            fontSize,
            fontFamily,
            fontStyle,
            fill,
            align,
            lineHeight,
            rotation: this.config.rotation || 0,
            scaleX: (this.config.scale || 1.0) * (this.config.scaleX || 1.0),
            scaleY: (this.config.scale || 1.0) * (this.config.scaleY || 1.0),
            opacity: this.config.opacity || 1.0,
            draggable: !this.config.locked,
        });

        this.updateTextOffsets();
    }

    /**
     * Get the Konva.Text node
     */
    public getNode(): Konva.Text {
        return this.textNode;
    }

    /**
     * Get the transformer
     */
    public getTransformer(): Konva.Transformer {
        return this.transformer;
    }

    /**
     * Destroy the layer and cleanup resources
     */
    public destroy(): void {
        this.transformer.destroy();
        this.textNode.destroy();
    }
}

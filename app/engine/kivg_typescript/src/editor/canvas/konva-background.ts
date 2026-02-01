import Konva from 'konva';
import { BackgroundConfig, GridConfig, TemplateConfig } from '../../shared/types';

export interface KonvaBackgroundConfig {
    width: number;
    height: number;
    config?: BackgroundConfig;
}

/**
 * Pure Konva.js class for rendering background with optional grid and template image.
 * Replaces the React-Konva KonvaBackground component.
 */
export class KonvaBackground {
    private group: Konva.Group;
    private backgroundRect: Konva.Rect;
    private gridGroup: Konva.Group;
    private templateImage: Konva.Image | null = null;
    private width: number;
    private height: number;
    private config: BackgroundConfig;

    constructor({ width, height, config }: KonvaBackgroundConfig) {
        this.width = width;
        this.height = height;
        this.config = config || { color: '#ffffff' };

        // Create main group
        this.group = new Konva.Group({
            listening: false,
        });

        // Create background rectangle
        this.backgroundRect = new Konva.Rect({
            width: this.width,
            height: this.height,
            fill: this.config.color || '#ffffff',
            stroke: 'rgba(0, 0, 0, 0.4)',
            strokeWidth: 4,
            dash: [10, 5],
            listening: false,
        });
        this.group.add(this.backgroundRect);

        // Create grid group
        this.gridGroup = new Konva.Group({
            listening: false,
        });
        this.group.add(this.gridGroup);

        // Apply initial configuration
        this.updateGrid();
        this.updateTemplate();
    }

    /**
     * Update the background with new configuration
     */
    public update(config: Partial<KonvaBackgroundConfig>): void {
        if (config.width !== undefined) this.width = config.width;
        if (config.height !== undefined) this.height = config.height;
        if (config.config !== undefined) this.config = config.config || { color: '#ffffff' };

        // Update background rect
        this.backgroundRect.setAttrs({
            width: this.width,
            height: this.height,
            fill: this.config.color || '#ffffff',
            stroke: 'rgba(0, 0, 0, 0.4)',
            strokeWidth: 4,
            dash: [10, 5],
        });

        // Update grid
        this.updateGrid();

        // Update template
        this.updateTemplate();
    }

    /**
     * Update grid elements based on current configuration
     */
    private updateGrid(): void {
        // Clear existing grid elements
        this.gridGroup.destroyChildren();

        const grid = this.config.grid;
        if (!grid) return;

        const size = grid.size || 40;
        const color = grid.color || '#cccccc';
        const opacity = grid.opacity !== undefined ? grid.opacity : 0.5;
        const lineWidth = grid.lineWidth || 1;

        if (grid.type === 'dots') {
            this.createDotsGrid(size, color, opacity);
        } else if (grid.type === 'lines') {
            this.createLinesGrid(size, color, opacity, lineWidth);
        } else if (grid.type === 'squares') {
            this.createSquaresGrid(size, color, opacity, lineWidth);
        } else if (grid.type === 'hexagonal') {
            this.createHexagonalGrid(size, color, opacity, lineWidth);
        } else if (grid.type === 'isometric') {
            this.createIsometricGrid(size, color, opacity, lineWidth);
        }
    }

    private createDotsGrid(size: number, color: string, opacity: number): void {
        for (let x = size / 2; x < this.width; x += size) {
            for (let y = size / 2; y < this.height; y += size) {
                const dot = new Konva.Circle({
                    x,
                    y,
                    radius: 1,
                    fill: color,
                    opacity,
                    listening: false,
                });
                this.gridGroup.add(dot);
            }
        }
    }

    private createLinesGrid(size: number, color: string, opacity: number, lineWidth: number): void {
        for (let y = size / 2; y < this.height; y += size) {
            const line = new Konva.Line({
                points: [0, y, this.width, y],
                stroke: color,
                strokeWidth: lineWidth,
                opacity,
                listening: false,
            });
            this.gridGroup.add(line);
        }
    }

    private createSquaresGrid(size: number, color: string, opacity: number, lineWidth: number): void {
        // Vertical lines
        for (let x = 0; x <= this.width; x += size) {
            const line = new Konva.Line({
                points: [x, 0, x, this.height],
                stroke: color,
                strokeWidth: lineWidth,
                opacity,
                listening: false,
            });
            this.gridGroup.add(line);
        }
        // Horizontal lines
        for (let y = 0; y <= this.height; y += size) {
            const line = new Konva.Line({
                points: [0, y, this.width, y],
                stroke: color,
                strokeWidth: lineWidth,
                opacity,
                listening: false,
            });
            this.gridGroup.add(line);
        }
    }

    private createHexagonalGrid(size: number, color: string, opacity: number, lineWidth: number): void {
        const hexHeight = size * Math.sqrt(3);
        const hexWidth = size * 2;

        for (let row = 0; row * hexHeight * 0.75 < this.height + hexHeight; row++) {
            const offsetX = row % 2 === 1 ? hexWidth * 0.75 : 0;
            for (let col = 0; col * hexWidth * 1.5 - offsetX < this.width + hexWidth; col++) {
                const cx = col * hexWidth * 1.5 + hexWidth / 2 - offsetX;
                const cy = row * hexHeight * 0.75 + hexHeight / 2;
                this.drawHexagon(cx, cy, size, color, opacity, lineWidth);
            }
        }
    }

    private drawHexagon(cx: number, cy: number, size: number, color: string, opacity: number, lineWidth: number): void {
        const points: number[] = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 6;
            points.push(cx + size * Math.cos(angle), cy + size * Math.sin(angle));
        }
        const hexagon = new Konva.Line({
            points,
            stroke: color,
            strokeWidth: lineWidth,
            opacity,
            closed: true,
            listening: false,
        });
        this.gridGroup.add(hexagon);
    }

    private createIsometricGrid(size: number, color: string, opacity: number, lineWidth: number): void {
        const isoHeight = size * Math.sqrt(3) / 2;

        // Diagonal lines (left-to-right)
        for (let i = -Math.ceil(this.height / isoHeight); i <= Math.ceil(this.width / size) + Math.ceil(this.height / isoHeight); i++) {
            const startX = i * size;
            const startY = 0;
            const endX = startX + this.height / Math.tan(Math.PI / 3);
            const endY = this.height;

            const line = new Konva.Line({
                points: [startX, startY, endX, endY],
                stroke: color,
                strokeWidth: lineWidth,
                opacity,
                listening: false,
            });
            this.gridGroup.add(line);
        }

        // Diagonal lines (right-to-left)
        for (let i = -Math.ceil(this.height / isoHeight); i <= Math.ceil(this.width / size) + Math.ceil(this.height / isoHeight); i++) {
            const startX = i * size;
            const startY = 0;
            const endX = startX - this.height / Math.tan(Math.PI / 3);
            const endY = this.height;

            const line = new Konva.Line({
                points: [startX, startY, endX, endY],
                stroke: color,
                strokeWidth: lineWidth,
                opacity,
                listening: false,
            });
            this.gridGroup.add(line);
        }
    }

    /**
     * Update template image
     */
    private updateTemplate(): void {
        const template = this.config.template;

        // Remove existing template image
        if (this.templateImage) {
            this.templateImage.destroy();
            this.templateImage = null;
        }

        if (!template?.url) return;

        // Load template image
        const imageObj = new Image();
        imageObj.crossOrigin = 'anonymous';
        imageObj.onload = () => {
            this.templateImage = new Konva.Image({
                image: imageObj,
                width: this.width,
                height: this.height,
                opacity: template.opacity !== undefined ? template.opacity : 1,
                listening: false,
            });

            // Insert after background rect but before grid
            const gridIndex = this.gridGroup.getZIndex();
            this.group.add(this.templateImage);
            this.templateImage.setZIndex(gridIndex);
        };
        imageObj.src = template.url;
    }

    /**
     * Get the Konva.Group node to add to a layer/stage
     */
    public getNode(): Konva.Group {
        return this.group;
    }

    /**
     * Destroy the background and cleanup resources
     */
    public destroy(): void {
        this.group.destroy();
    }
}

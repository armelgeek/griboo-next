import { BackgroundConfig, GridConfig, TemplateConfig, GradientConfig, BackgroundEffectConfig } from '../types';
import { isDebugEnabled } from '../../../shared/config/debug_config';

export class GridRenderer {
    private static readonly SVG_NS = 'http://www.w3.org/2000/svg';

    public static createPattern(id: string, config: GridConfig): SVGPatternElement {
        const pattern = document.createElementNS(this.SVG_NS, 'pattern');
        const size = config.size || 20;
        const color = config.color || '#cccccc';
        const opacity = config.opacity !== undefined ? config.opacity : 0.5;

        pattern.setAttribute('id', id);
        pattern.setAttribute('x', '0');
        pattern.setAttribute('y', '0');
        pattern.setAttribute('width', size.toString());
        pattern.setAttribute('height', size.toString());
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');

        switch (config.type) {
            case 'dots':
                const circle = document.createElementNS(this.SVG_NS, 'circle');
                circle.setAttribute('cx', (size / 2).toString());
                circle.setAttribute('cy', (size / 2).toString());
                circle.setAttribute('r', (config.lineWidth || 1).toString());
                circle.setAttribute('fill', color);
                circle.setAttribute('fill-opacity', opacity.toString());
                pattern.appendChild(circle);
                break;
            case 'lines':
                const line = document.createElementNS(this.SVG_NS, 'line');
                line.setAttribute('x1', '0');
                line.setAttribute('y1', (size / 2).toString());
                line.setAttribute('x2', size.toString());
                line.setAttribute('y2', (size / 2).toString());
                line.setAttribute('stroke', color);
                line.setAttribute('stroke-width', (config.lineWidth || 1).toString());
                line.setAttribute('stroke-opacity', opacity.toString());
                pattern.appendChild(line);
                break;
            case 'squares':
                const rect = document.createElementNS(this.SVG_NS, 'rect');
                rect.setAttribute('x', '0');
                rect.setAttribute('y', '0');
                rect.setAttribute('width', size.toString());
                rect.setAttribute('height', size.toString());
                rect.setAttribute('fill', 'none');
                rect.setAttribute('stroke', color);
                rect.setAttribute('stroke-width', (config.lineWidth || 1).toString());
                rect.setAttribute('stroke-opacity', opacity.toString());
                pattern.appendChild(rect);
                break;
            case 'hexagonal':
                const hexWidth = size * Math.sqrt(3);
                const hexHeight = size * 2;
                pattern.setAttribute('width', hexWidth.toString());
                pattern.setAttribute('height', (size * 3).toString());

                const hexPath = document.createElementNS(this.SVG_NS, 'path');
                // Create a "brick-like" hex pattern
                const h = size;
                const w = size * Math.sqrt(3) / 2;
                const d = `M ${w},0 L ${2 * w},${h / 2} L ${2 * w},${1.5 * h} L ${w},${2 * h} L 0,${1.5 * h} L 0,${h / 2} Z 
                           M ${w},${1.5 * h} L ${2 * w},${2 * h} L ${2 * w},${3 * h} L ${w},${3.5 * h} L 0,${3 * h} L 0,${2 * h} Z`;

                hexPath.setAttribute('d', d);
                hexPath.setAttribute('fill', 'none');
                hexPath.setAttribute('stroke', color);
                hexPath.setAttribute('stroke-width', (config.lineWidth || 1).toString());
                hexPath.setAttribute('stroke-opacity', opacity.toString());
                pattern.appendChild(hexPath);
                break;
            case 'isometric':
                const isoWidth = size * Math.sqrt(3);
                const isoHeight = size;
                pattern.setAttribute('width', isoWidth.toString());
                pattern.setAttribute('height', isoHeight.toString());

                const isoPath = document.createElementNS(this.SVG_NS, 'path');
                // Isometric grid of 30/150 degree lines
                const iw = isoWidth;
                const ih = isoHeight;
                const id = `M 0,${ih / 2} L ${iw / 2},0 L ${iw},${ih / 2} L ${iw / 2},${ih} Z M 0,${ih / 2} L ${iw},${ih / 2} M ${iw / 2},0 L ${iw / 2},${ih}`;

                isoPath.setAttribute('d', id);
                isoPath.setAttribute('fill', 'none');
                isoPath.setAttribute('stroke', color);
                isoPath.setAttribute('stroke-width', (config.lineWidth || 1).toString());
                isoPath.setAttribute('stroke-opacity', opacity.toString());
                pattern.appendChild(isoPath);
                break;
        }

        return pattern;
    }
}

export class TemplateRenderer {
    private static readonly SVG_NS = 'http://www.w3.org/2000/svg';

    public static createTemplate(config: TemplateConfig, width: number, height: number): SVGImageElement {
        const image = document.createElementNS(this.SVG_NS, 'image');
        image.setAttribute('href', config.url || '');
        image.setAttribute('width', width.toString());
        image.setAttribute('height', height.toString());
        image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
        if (config.opacity !== undefined) {
            image.setAttribute('opacity', config.opacity.toString());
        }
        return image;
    }
}

export class GradientRenderer {
    private static readonly SVG_NS = 'http://www.w3.org/2000/svg';

    public static createGradient(id: string, config: GradientConfig): SVGGradientElement {
        const gradient = document.createElementNS(this.SVG_NS, config.type === 'linear' ? 'linearGradient' : 'radialGradient');
        gradient.setAttribute('id', id);

        if (config.type === 'linear' && config.angle !== undefined) {
            const angle = (config.angle * Math.PI) / 180;
            const x1 = Math.round(50 + Math.sin(angle) * 50) + '%';
            const y1 = Math.round(50 + Math.cos(angle) * 50) + '%';
            const x2 = Math.round(50 - Math.sin(angle) * 50) + '%';
            const y2 = Math.round(50 - Math.cos(angle) * 50) + '%';
            gradient.setAttribute('x1', x1);
            gradient.setAttribute('y1', y1);
            gradient.setAttribute('x2', x2);
            gradient.setAttribute('y2', y2);
        } else if (config.type === 'radial') {
            gradient.setAttribute('cx', (config.cx ?? 50) + '%');
            gradient.setAttribute('cy', (config.cy ?? 50) + '%');
            gradient.setAttribute('r', (config.r ?? 50) + '%');
        }

        config.stops.forEach(stop => {
            const s = document.createElementNS(this.SVG_NS, 'stop');
            s.setAttribute('offset', (stop.offset * 100) + '%');
            s.setAttribute('stop-color', stop.color);
            if (stop.opacity !== undefined) {
                s.setAttribute('stop-opacity', stop.opacity.toString());
            }
            gradient.appendChild(s);
        });

        return gradient;
    }
}

export class FilterRenderer {
    private static readonly SVG_NS = 'http://www.w3.org/2000/svg';

    public static createFilter(id: string, config: BackgroundEffectConfig): SVGFilterElement {
        const filter = document.createElementNS(this.SVG_NS, 'filter');
        filter.setAttribute('id', id);

        if (config.blur !== undefined) {
            const blur = document.createElementNS(this.SVG_NS, 'feGaussianBlur');
            blur.setAttribute('stdDeviation', config.blur.toString());
            filter.appendChild(blur);
        }

        if (config.grayscale !== undefined || config.sepia !== undefined || config.brightness !== undefined || config.contrast !== undefined || config.hueRotate !== undefined || config.invert !== undefined) {
            const matrix = document.createElementNS(this.SVG_NS, 'feColorMatrix');
            // Simplified: we'll use CSS-like filters for now as SVG filters are complex to compose manually
            // But for a robust implementation, we'd use feComponentTransfer or feColorMatrix
            // For now, let's just use feColorMatrix for simple grayscale if requested
            if (config.grayscale !== undefined) {
                matrix.setAttribute('type', 'saturate');
                matrix.setAttribute('values', (1 - config.grayscale).toString());
                filter.appendChild(matrix);
            }
        }

        return filter;
    }
}

export class BackgroundManager {
    private svg: SVGSVGElement;
    private backgroundGroup: SVGGElement;
    private backgroundRect: SVGRectElement;
    private defs: SVGDefsElement;
    private width: number;
    private height: number;
    private currentConfig: string | BackgroundConfig | null = null;
    private cameraTransform: { zoom: number; position: { x: number; y: number }; virtualSize: { width: number; height: number } } | null = null;
    private animationFrameId: number | null = null;
    private animationStartTime: number = 0;

    constructor(svg: SVGSVGElement, width: number, height: number) {
        this.svg = svg;
        this.width = width;
        this.height = height;

        // Ensure defs exist
        this.defs = svg.querySelector('defs') || document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        if (!svg.querySelector('defs')) {
            svg.insertBefore(this.defs, svg.firstChild);
        }

        this.backgroundRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        this.backgroundRect.setAttribute('width', '100%');
        this.backgroundRect.setAttribute('height', '100%');
        this.backgroundRect.setAttribute('id', 'whiteboard-solid-background');

        // Create a group for elements that follow the camera (grids, templates)
        this.backgroundGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.backgroundGroup.setAttribute('id', 'whiteboard-background-group');

        // Insert fixed background and then camera-following group at the beginning of the SVG
        if (svg.firstChild) {
            svg.insertBefore(this.backgroundRect, svg.firstChild);
            svg.insertBefore(this.backgroundGroup, this.backgroundRect.nextSibling);
        } else {
            svg.appendChild(this.backgroundRect);
            svg.appendChild(this.backgroundGroup);
        }
    }

    public apply(config: string | BackgroundConfig): void {
        // Skip if config is identical to avoid DOM thrashing
        if (this.currentConfig && JSON.stringify(this.currentConfig) === JSON.stringify(config)) {
            return;
        }

        // Store current configuration for preload
        this.currentConfig = config;

        // Clear previous background elements (these are camera-following elements)
        while (this.backgroundGroup.childNodes.length > 0) {
            this.backgroundGroup.removeChild(this.backgroundGroup.lastChild!);
        }

        if (typeof config === 'string') {
            this.backgroundRect.setAttribute('fill', config);
            return;
        }

        // Apply solid color
        this.backgroundRect.setAttribute('fill', config.color || '#ffffff');

        // Apply template if present
        if (config.template) {
            const template = TemplateRenderer.createTemplate(config.template, this.width, this.height);
            this.backgroundGroup.appendChild(template);
        }

        // Apply gradient if present
        if (config.gradient) {
            const gradientId = `bg-gradient-${Math.random().toString(36).substr(2, 9)}`;
            const gradient = GradientRenderer.createGradient(gradientId, config.gradient);
            this.defs.appendChild(gradient);
            this.backgroundRect.setAttribute('fill', `url(#${gradientId})`);
        }

        // Apply grid if present
        if (config.grid) {
            const patternId = `grid-pattern-${config.grid.type}-${config.grid.size || 20}-${config.grid.color || 'gray'}`;
            let pattern = this.defs.querySelector(`#${patternId}`) as SVGPatternElement;

            if (!pattern) {
                pattern = GridRenderer.createPattern(patternId, config.grid);
                this.defs.appendChild(pattern);
            }

            const gridRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            // Use virtual size if available, otherwise 100%
            if (this.cameraTransform?.virtualSize) {
                gridRect.setAttribute('width', this.cameraTransform.virtualSize.width.toString());
                gridRect.setAttribute('height', this.cameraTransform.virtualSize.height.toString());
            } else {
                gridRect.setAttribute('width', '100%');
                gridRect.setAttribute('height', '100%');
            }
            gridRect.setAttribute('fill', `url(#${patternId})`);
            this.backgroundGroup.appendChild(gridRect);
        }

        // Apply effects if present
        if (config.effects) {
            const filterId = `bg-filter-${Math.random().toString(36).substr(2, 9)}`;
            const filter = FilterRenderer.createFilter(filterId, config.effects);
            this.defs.appendChild(filter);
            this.backgroundGroup.setAttribute('filter', `url(#${filterId})`);
        }

        // Apply initial camera transform if available
        if (this.cameraTransform) {
            this.applyCameraTransform();
        }

        // Start animation if configured
        if (config.animation) {
            this.startAnimation();
        } else {
            this.stopAnimation();
        }
    }

    private startAnimation(): void {
        this.stopAnimation();
        this.animationStartTime = performance.now();
        const animate = () => {
            this.updateAnimation();
            this.animationFrameId = requestAnimationFrame(animate);
        };
        this.animationFrameId = requestAnimationFrame(animate);
    }

    private stopAnimation(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    private updateAnimation(): void {
        if (!this.currentConfig || typeof this.currentConfig === 'string' || !this.currentConfig.animation) return;

        this.applyCameraTransform();
    }

    /**
     * Set the camera transform for background alignment.
     */
    public setCameraTransform(zoom: number, position: { x: number; y: number }, virtualSize: { width: number; height: number }): void {
        const oldVirtualSize = this.cameraTransform?.virtualSize;
        this.cameraTransform = { zoom, position, virtualSize };

        // If virtual size changed, we might need to re-apply the background to update rect sizes
        if (!oldVirtualSize || oldVirtualSize.width !== virtualSize.width || oldVirtualSize.height !== virtualSize.height) {
            if (this.currentConfig) {
                this.apply(this.currentConfig);
            }
        } else {
            this.applyCameraTransform();
        }
    }

    /**
     * Apply the stored camera transform to the background group.
     */
    private applyCameraTransform(): void {
        if (!this.cameraTransform) return;

        const { zoom, position, virtualSize } = this.cameraTransform;

        // Guard against invalid inputs
        const safeZoom = (isNaN(zoom) || zoom <= 0) ? 1 : zoom;
        const safePosX = (isNaN(position?.x)) ? 0.5 : position.x;
        const safePosY = (isNaN(position?.y)) ? 0.5 : position.y;
        const vWidth = (isNaN(virtualSize?.width) || virtualSize?.width <= 0) ? this.width : virtualSize.width;
        const vHeight = (isNaN(virtualSize?.height) || virtualSize?.height <= 0) ? this.height : virtualSize.height;

        const centerX = vWidth * safePosX;
        const centerY = vHeight * safePosY;

        let translateX = this.width / 2 - centerX * safeZoom;
        let translateY = this.height / 2 - centerY * safeZoom;
        let rotation = 0;
        let scale = safeZoom;

        // Apply animation offsets if present
        if (this.currentConfig && typeof this.currentConfig !== 'string' && this.currentConfig.animation) {
            const anim = this.currentConfig.animation;
            const elapsed = (performance.now() - this.animationStartTime) / 1000;

            if (anim.type === 'scroll') {
                translateX += (anim.speedX || 0) * elapsed * safeZoom;
                translateY += (anim.speedY || 0) * elapsed * safeZoom;
            } else if (anim.type === 'rotate') {
                rotation = (anim.rotationSpeed || 0) * elapsed;
            } else if (anim.type === 'pulse') {
                const pulse = 1 + Math.sin(elapsed * (anim.pulseFrequency || 1) * Math.PI * 2) * (anim.pulseIntensity || 0.1);
                scale *= pulse;
            }
        }

        // Final safety check
        if (isNaN(translateX) || isNaN(translateY) || isNaN(scale) || isNaN(rotation)) {
            return;
        }

        this.backgroundGroup.setAttribute('transform', `translate(${translateX}, ${translateY}) scale(${scale}) rotate(${rotation}, ${centerX}, ${centerY})`);
    }

    /**
     * Preload background images to ensure they are loaded before animations start.
     * Returns a Promise that resolves when all background images are loaded.
     */
    public async preload(): Promise<void> {
        if (!this.currentConfig || typeof this.currentConfig === 'string') {
            // No image to preload (solid color only)
            return Promise.resolve();
        }

        const config = this.currentConfig as BackgroundConfig;

        // Check if there's a template (background image) to preload
        if (!config.template?.url) {
            return Promise.resolve();
        }

        return this.preloadUrl(config.template.url);
    }

    /**
     * Preload a specific image URL.
     */
    public async preloadUrl(url: string): Promise<void> {
        // Use HTTP loader for remote URLs
        if (url.startsWith('http://') || url.startsWith('https://')) {
            const { getGlobalCache } = await import('../../utils/asset_cache');
            const { fetchImage } = await import('../../utils/http_loader');

            const cache = getGlobalCache();
            let blob = await cache.get(url);

            if (!blob) {
                try {
                    blob = await fetchImage(url, { retries: 3, timeout: 30000 });
                    await cache.set(url, blob);
                } catch (error) {
                    if (isDebugEnabled()) {
                        console.error('[BackgroundManager] Failed to fetch background image:', url, error);
                    }
                    return; // Resolve to not block animation
                }
            }

            // Convert blob to Image to trigger decode
            return new Promise((resolve) => {
                const img = new Image();
                const objectUrl = URL.createObjectURL(blob);

                img.onload = () => {
                    URL.revokeObjectURL(objectUrl);
                    if (isDebugEnabled()) {
                        console.log('[BackgroundManager] Background image preloaded successfully:', url);
                    }
                    resolve();
                };

                img.onerror = () => {
                    URL.revokeObjectURL(objectUrl);
                    if (isDebugEnabled()) {
                        console.error('[BackgroundManager] Failed to decode background image:', url);
                    }
                    resolve();
                };

                img.src = objectUrl;
            });
        }

        // Local path - use standard Image API
        return new Promise((resolve) => {
            const img = new Image();

            img.onload = () => {
                if (isDebugEnabled()) {
                    console.log('[BackgroundManager] Background image preloaded successfully:', url);
                }
                resolve();
            };

            img.onerror = (error) => {
                if (isDebugEnabled()) {
                    console.error('[BackgroundManager] Failed to preload background image:', url, error);
                }
                // Resolve anyway to not block the animation
                resolve();
            };

            img.src = url;
        });
    }

    public updateDimensions(width: number, height: number): void {
        this.width = width;
        this.height = height;
        // Update any template images if they exist
        const template = this.backgroundGroup.querySelector('image');
        if (template) {
            template.setAttribute('width', width.toString());
            template.setAttribute('height', height.toString());
        }

        // Re-apply camera transform with new dimensions
        if (this.cameraTransform) {
            this.applyCameraTransform();
        }
    }

    /**
     * Cleanup background resources
     */
    public cleanup(): void {
        // Clear background group
        while (this.backgroundGroup.childNodes.length > 0) {
            this.backgroundGroup.removeChild(this.backgroundGroup.lastChild!);
        }
        this.currentConfig = null;
        this.cameraTransform = null;
    }
}

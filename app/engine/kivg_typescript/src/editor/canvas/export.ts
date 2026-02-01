import { SceneConfig as Scene, AnyLayerConfig as Layer, CameraSceneConfig, SimpleImageConfig, ShapeLayerConfig } from '../../shared/types';
import { CANVAS_DEFAULTS, EditorScene, EditorLayer } from './store'; // Import types from store
import { Camera } from './scene-canvas'; // Import Camera interface

/**
 * Scene Export Utility
 * Exports complete scenes with all layers combined using camera-based cropping
 */

interface ExportSceneImageOptions {
    sceneWidth?: number;
    sceneHeight?: number;
    background?: string;
    pixelRatio?: number;
    targetWidth?: number;
    targetHeight?: number;
    lowRes?: boolean;
}

// Simple cache for SVG parsing to improve performance
const svgCache = new Map<string, { svgElement: SVGSVGElement, vbWidth: number, vbHeight: number }>();

export const exportSceneImage = async (
    scene: EditorScene,
    options: ExportSceneImageOptions = {}
): Promise<string> => {
    const {
        sceneWidth = CANVAS_DEFAULTS.WIDTH,
        sceneHeight = CANVAS_DEFAULTS.HEIGHT,
        background = '#FFFFFF',
        pixelRatio = 1,
    } = options;

    // Get the default camera
    const cameras: Camera[] = scene.sceneCameras || [];
    const defaultCamera = cameras.find((cam: Camera) => cam.isDefault);

    if (!defaultCamera) {
        throw new Error('No default camera found in scene. Cannot export scene without a camera.');
    }

    // Camera dimensions (the "view" size)
    const cameraWidth = defaultCamera.width || 800;
    const cameraHeight = defaultCamera.height || 450;

    // Target dimensions (the "output" size)
    const targetWidth = options.targetWidth || cameraWidth;
    const targetHeight = options.targetHeight || cameraHeight;

    // Create canvas with pixel ratio scaling
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth * pixelRatio;
    canvas.height = targetHeight * pixelRatio;
    const ctx = canvas.getContext('2d', { willReadFrequently: false, alpha: true });
    if (!ctx) throw new Error('Could not get 2D context for canvas');

    // Scale context for pixel ratio AND target scaling
    const globalScale = targetWidth / cameraWidth;
    ctx.scale(pixelRatio * globalScale, pixelRatio * globalScale);

    // Fill background
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, cameraWidth, cameraHeight);

    // Render scene background image if exists
    // BackgroundConfig is string | object. Handle both.
    const bgUrl = typeof scene.background === 'string' ? scene.background : (scene.background?.template?.url);
    if (bgUrl) {
        await renderBackgroundImage(ctx, bgUrl, cameraWidth, cameraHeight, defaultCamera, sceneWidth, sceneHeight);
    }


    // Calculate camera viewport in scene coordinates
    const cameraX = (defaultCamera.position.x * sceneWidth) - (cameraWidth / 2);
    const cameraY = (defaultCamera.position.y * sceneHeight) - (cameraHeight / 2);

    // Get all visible layers sorted by z_index
    // scene.layers is EditorLayer[] which has 'visible' property?
    // AnyLayerConfig might not have 'visible'. 'BaseLayer' has?
    // We assume EditorLayer has 'visible' if it was working before, or we check property.
    // Actually BaseLayerConfig in scene-canvas had it. EditorLayer inherits AnyLayerConfig.
    // 'LayerConfig' has 'hidden' maybe? Or opacity 0?
    // Let's assume (layer as any).visible since EditorLayer intersection was loose on properties not in shared types.

    const layers = (scene.layers || [])
        .filter((layer: EditorLayer) => {
            // Check visibility safely
            const anyLayer = layer as any;
            return anyLayer.visible === undefined || anyLayer.visible !== false;
        })
        .slice()
        .sort((a: EditorLayer, b: EditorLayer) => {
            const zA = (a as any).z_index || (a as any).zIndex || 0;
            const zB = (b as any).z_index || (b as any).zIndex || 0;
            return zA - zB;
        });

    // Render each layer
    for (const layer of layers) {
        try {
            switch (layer.type) {
                case 'image':
                    // Cast to SimpleImageConfig (or EditorLayer which has imageUrl/image_path)
                    // Shared types use imageUrl. Old usage used image_path. Logic needs to support both?
                    // We'll prioritize imageUrl, fallback to image_path (any)
                    const imgLayer = layer as any;
                    const imgPath = imgLayer.imageUrl || imgLayer.image_path;

                    if (imgPath) {
                        await renderImageLayer(ctx, layer, imgPath, cameraX, cameraY);
                    }
                    break;
                case 'text':
                    renderTextLayer(ctx, layer, cameraX, cameraY);
                    break;
                case 'shape':
                    // Cast to ShapeLayerConfig
                    const shapeLayer = layer as any;
                    const shapeConfig = shapeLayer.shape_config || shapeLayer; // Handle nested vs direct

                    // Check if it's an engine shape or SVG shape
                    const isEngineShape: boolean = !!(shapeConfig &&
                        ['circle', 'rectangle', 'square', 'star', 'line', 'ellipse', 'triangle', 'polygon', 'hexagon'].includes(shapeConfig.shape));

                    if (isEngineShape) {
                        renderEngineShape(ctx, layer, cameraX, cameraY);
                    } else {
                        await renderSvgLayer(ctx, layer, cameraX, cameraY);
                    }
                    break;
                case 'whiteboard':
                    renderWhiteboardLayer(ctx, layer, cameraX, cameraY);
                    break;
                default:
                    console.warn(`Unsupported layer type: ${layer.type}`);
            }
        } catch (error) {
            console.error(`Error rendering layer ${layer.id}:`, error);
        }
    }

    return canvas.toDataURL('image/png');
};

/**
 * Render scene background image with camera cropping
 */
const renderBackgroundImage = (
    ctx: CanvasRenderingContext2D,
    imageUrl: string,
    canvasWidth: number,
    canvasHeight: number,
    camera: Camera,
    sceneWidth: number,
    sceneHeight: number
): Promise<void> => {
    return new Promise((resolve) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            try {
                ctx.save();
                // Calculate camera viewport position in scene
                const cameraX = (camera.position.x * sceneWidth) - (canvasWidth / 2);
                const cameraY = (camera.position.y * sceneHeight) - (canvasHeight / 2);
                // Calculate source rectangle (portion of background image to show)
                const sourceX = (cameraX / sceneWidth) * img.width;
                const sourceY = (cameraY / sceneHeight) * img.height;
                const sourceWidth = (canvasWidth / sceneWidth) * img.width;
                const sourceHeight = (canvasHeight / sceneHeight) * img.height;

                ctx.drawImage(
                    img,
                    sourceX, sourceY, sourceWidth, sourceHeight,  // source rectangle
                    0, 0, canvasWidth, canvasHeight               // destination rectangle
                );
                ctx.restore();
                resolve();
            } catch (error) {
                console.error('Error rendering background:', error);
                resolve(); // Continue even if background fails
            }
        };

        img.onerror = () => {
            console.warn('Failed to load background image:', imageUrl);
            resolve(); // Continue even if background fails
        };

        img.src = imageUrl;
    });
};

/**
 * Render an image layer
 */
const renderImageLayer = (ctx: CanvasRenderingContext2D, layer: EditorLayer, imagePath: string, cameraX: number, cameraY: number): Promise<void> => {
    return new Promise((resolve) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            try {
                // Calculate layer position relative to camera viewport
                const layerX = (layer.position?.x || 0) - cameraX;
                const layerY = (layer.position?.y || 0) - cameraY;
                const scale = (layer as any).scale || 1.0;
                const opacity = (layer as any).opacity !== undefined ? (layer as any).opacity : 1.0;
                const rotation = (layer as any).rotation || 0;
                const flipX = (layer as any).flipX ?? false;
                const flipY = (layer as any).flipY ?? false;

                ctx.save();
                ctx.globalAlpha = opacity;

                const imgWidth = img.width * scale;
                const imgHeight = img.height * scale;

                // Check if any transformations are needed
                if (rotation !== 0 || flipX || flipY) {
                    // Translate to the center point for rotation and flipping
                    ctx.translate(layerX + imgWidth / 2, layerY + imgHeight / 2);

                    // Apply rotation if needed
                    if (rotation !== 0) {
                        ctx.rotate(rotation * Math.PI / 180);
                    }

                    // Apply flip transformations
                    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);

                    // Draw image centered on the transformed point
                    ctx.drawImage(
                        img,
                        -imgWidth / 2,
                        -imgHeight / 2,
                        imgWidth,
                        imgHeight
                    );
                } else {
                    // No transformations: simple top-left positioning
                    ctx.drawImage(
                        img,
                        layerX,
                        layerY,
                        imgWidth,
                        imgHeight
                    );
                }

                ctx.restore();
                resolve();
            } catch (error) {
                console.error('Error drawing image layer:', error);
                resolve();
            }
        };

        img.onerror = () => {
            console.warn('Failed to load image:', imagePath);
            resolve();
        };

        img.src = imagePath || '';
    });
};

/**
 * Render a text layer
 */
const renderTextLayer = (ctx: CanvasRenderingContext2D, layer: EditorLayer, cameraX: number, cameraY: number) => {
    const layerAny = layer as any;
    const textConfig = layerAny.text_config || {};
    const text = textConfig.text || '';
    const fontSize = textConfig.size || 48;
    const fontFamily = textConfig.font || 'Arial';
    const fontStyle = textConfig.style || 'normal';
    const scale = layerAny.scale || 1.0;
    const opacity = layerAny.opacity !== undefined ? layerAny.opacity : 1.0;
    const rotation = layerAny.rotation || 0;
    const align = textConfig.align || 'left';
    const lineHeight = textConfig.line_height || 1.2;

    // Parse font style
    let fontWeight = 'normal';
    let fontStyleCSS = 'normal';
    if (fontStyle === 'bold') {
        fontWeight = 'bold';
    } else if (fontStyle === 'italic') {
        fontStyleCSS = 'italic';
    } else if (fontStyle === 'bold_italic') {
        fontWeight = 'bold';
        fontStyleCSS = 'italic';
    }

    // Parse color
    let fillStyle = '#000000';
    if (Array.isArray(textConfig.color)) {
        fillStyle = `rgb(${textConfig.color[0]}, ${textConfig.color[1]}, ${textConfig.color[2]})`;
    } else if (typeof textConfig.color === 'string') {
        fillStyle = textConfig.color;
    }

    // Calculate layer position relative to camera viewport
    const layerX = (layer.position?.x || 0) - cameraX;
    const layerY = (layer.position?.y || 0) - cameraY;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(layerX, layerY);
    if (rotation) {
        ctx.rotate(rotation * Math.PI / 180);
    }

    ctx.font = `${fontStyleCSS} ${fontWeight} ${fontSize * scale}px ${fontFamily}`;
    ctx.fillStyle = fillStyle;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';

    // Render multi-line text
    const lines = text.split('\n');
    const lineHeightPx = fontSize * scale * lineHeight;

    lines.forEach((line: string, index: number) => {
        const yOffset = (index - (lines.length - 1) / 2) * lineHeightPx;
        ctx.fillText(line, 0, yOffset);
    });

    ctx.restore();
};

/**
 * Render an SVG layer by parsing and drawing paths
 */
const renderSvgLayer = async (ctx: CanvasRenderingContext2D, layer: EditorLayer, cameraX: number, cameraY: number) => {
    try {
        // Fetch the SVG content
        const layerAny = layer as any;
        const svgPath = layerAny.svg_path || layerAny.image_path || layerAny.imageUrl;
        if (!svgPath) return;

        let cached = svgCache.get(svgPath);

        if (!cached) {
            const response = await fetch(svgPath);
            const svgText = await response.text();

            // Parse SVG
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
            const svgElement = svgDoc.querySelector('svg');

            if (!svgElement) {
                console.warn('No SVG element found');
                return;
            }

            // Get SVG dimensions
            const svgWidth = parseFloat(svgElement.getAttribute('width') || '100');
            const svgHeight = parseFloat(svgElement.getAttribute('height') || '100');
            const viewBox = svgElement.getAttribute('viewBox');

            let vbWidth = svgWidth;
            let vbHeight = svgHeight;

            if (viewBox) {
                const [, , vbW, vbH] = viewBox.split(' ').map(Number);
                vbWidth = vbW || svgWidth;
                vbHeight = vbH || svgHeight;
            }

            cached = { svgElement, vbWidth, vbHeight };
            svgCache.set(svgPath, cached);
        }

        const { svgElement, vbWidth, vbHeight } = cached;

        // Calculate layer position relative to camera viewport
        const layerX = (layer.position?.x || 0) - cameraX;
        const layerY = (layer.position?.y || 0) - cameraY;
        const scale = layerAny.scale || 1.0;
        const opacity = layerAny.opacity !== undefined ? layerAny.opacity : 1.0;
        const rotation = layerAny.rotation || 0;
        const flipX = layerAny.flipX ?? false;
        const flipY = layerAny.flipY ?? false;

        const scaledWidth = vbWidth * scale;
        const scaledHeight = vbHeight * scale;

        ctx.save();
        ctx.globalAlpha = opacity;

        // Apply transformations
        if (rotation !== 0 || flipX || flipY) {
            ctx.translate(layerX + scaledWidth / 2, layerY + scaledHeight / 2);
            if (rotation !== 0) {
                ctx.rotate(rotation * Math.PI / 180);
            }
            ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
            ctx.translate(-scaledWidth / 2, -scaledHeight / 2);
        } else {
            ctx.translate(layerX, layerY);
        }

        ctx.scale(scale, scale);

        // Extract and render all path elements
        const pathElements = svgElement.querySelectorAll('path');
        const shapeConfig = layerAny.shape_config || {};
        pathElements.forEach((pathElement) => {
            const d = pathElement.getAttribute('d');
            if (!d) return;

            // Priorité shape_config, puis attribut SVG, puis valeur par défaut (pas de contour par défaut pour les SVG)
            const fill = shapeConfig.fillColor || shapeConfig.fill_color || pathElement.getAttribute('fill') || 'transparent';
            const stroke = shapeConfig.strokeColor || shapeConfig.color || pathElement.getAttribute('stroke') || undefined;
            const strokeWidth = shapeConfig.strokeWidth !== undefined ? shapeConfig.strokeWidth : (shapeConfig.stroke_width !== undefined ? shapeConfig.stroke_width : (pathElement.getAttribute('stroke-width') !== null ? parseFloat(pathElement.getAttribute('stroke-width')!) : 0));

            // Create a Path2D object from the SVG path data
            const path2D = new Path2D(d);

            // Fill
            if (fill && fill !== 'none' && fill !== 'transparent') {
                ctx.fillStyle = fill;
                ctx.fill(path2D);
            }

            // Stroke
            if (strokeWidth > 0) {
                ctx.strokeStyle = stroke && stroke !== 'none' ? stroke : '#000000';
                ctx.lineWidth = strokeWidth;
                ctx.stroke(path2D);
            }
        });

        ctx.restore();
    } catch (error) {
        console.error('Error rendering SVG layer:', error);
    }
};

/**
 * Render an engine shape layer (circle, rectangle, star, line)
 */
const renderEngineShape = (ctx: CanvasRenderingContext2D, layer: EditorLayer, cameraX: number, cameraY: number) => {
    const layerAny = layer as any;
    const shapeConfig = layerAny.shape_config;
    if (!shapeConfig) return;

    // Calculate layer position relative to camera viewport
    const layerX = (layer.position?.x || 0) - cameraX;
    const layerY = (layer.position?.y || 0) - cameraY;
    const scaleX = layerAny.scaleX ?? layerAny.scale ?? 1.0;
    const scaleY = layerAny.scaleY ?? layerAny.scale ?? 1.0;
    const opacity = layerAny.opacity !== undefined ? layerAny.opacity : 1.0;
    const rotation = layerAny.rotation || 0;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(layerX, layerY);

    if (rotation) {
        ctx.rotate(rotation * Math.PI / 180);
    }

    ctx.scale(scaleX, scaleY);

    // Set stroke and fill styles
    const strokeColor = shapeConfig.strokeColor || shapeConfig.color || shapeConfig.stroke || '#000000';
    const fillColor = shapeConfig.fillColor || shapeConfig.fill_color || shapeConfig.fill || 'transparent';
    const strokeWidth = shapeConfig.strokeWidth !== undefined ? shapeConfig.strokeWidth : (shapeConfig.stroke_width !== undefined ? shapeConfig.stroke_width : 2);

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;

    if (fillColor !== 'transparent' && fillColor !== 'none') {
        ctx.fillStyle = fillColor;
    }

    ctx.beginPath();

    switch (shapeConfig.shape) {
        case 'circle':
            const radius = shapeConfig.radius || 50;
            ctx.rotate(-Math.PI / 2);
            ctx.arc(0, 0, radius, 0, 2 * Math.PI);
            break;

        case 'ellipse':
            const radiusX = shapeConfig.radiusX || 50;
            const radiusY = shapeConfig.radiusY || 30;
            ctx.rotate(-Math.PI / 2);
            ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, 2 * Math.PI);
            break;

        case 'rectangle':
        case 'square':
            const width = shapeConfig.width || 100;
            const height = shapeConfig.height || 100;
            const cornerRadius = shapeConfig.cornerRadius || 0;

            if (cornerRadius > 0) {
                ctx.moveTo(cornerRadius, 0);
                ctx.lineTo(width - cornerRadius, 0);
                ctx.arcTo(width, 0, width, cornerRadius, cornerRadius);
                ctx.lineTo(width, height - cornerRadius);
                ctx.arcTo(width, height, width - cornerRadius, height, cornerRadius);
                ctx.lineTo(cornerRadius, height);
                ctx.arcTo(0, height, 0, height - cornerRadius, cornerRadius);
                ctx.lineTo(0, cornerRadius);
                ctx.arcTo(0, 0, cornerRadius, 0, cornerRadius);
            } else {
                ctx.rect(0, 0, width, height);
            }
            break;

        case 'star':
            const outerRadius = shapeConfig.outerRadius || 50;
            const innerRadius = shapeConfig.innerRadius || 25;
            const numPoints = shapeConfig.numPoints || 5;
            const centerX = 0;
            const centerY = 0;

            for (let i = 0; i < numPoints * 2; i++) {
                const r = i % 2 === 0 ? outerRadius : innerRadius;
                const angle = (Math.PI / numPoints) * i - Math.PI / 2;
                const x = centerX + r * Math.cos(angle);
                const y = centerY + r * Math.sin(angle);

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.closePath();
            break;

        case 'triangle':
        case 'polygon':
        case 'hexagon':
            const sides = shapeConfig.shape === 'triangle' ? 3 : (shapeConfig.shape === 'hexagon' ? 6 : (shapeConfig.sides || 5));
            const polyRadius = shapeConfig.radius || 50;
            for (let i = 0; i < sides; i++) {
                const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
                const x = polyRadius * Math.cos(angle);
                const y = polyRadius * Math.sin(angle);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            break;

        case 'line':
            const points = shapeConfig.points || [0, 0, 100, 0];
            ctx.moveTo(points[0], points[1]);
            ctx.lineTo(points[2], points[3]);

            if (shapeConfig.lineCap) {
                ctx.lineCap = shapeConfig.lineCap;
            }
            if (shapeConfig.lineJoin) {
                ctx.lineJoin = shapeConfig.lineJoin;
            }
            break;
    }

    if (fillColor !== 'transparent' && fillColor !== 'none') {
        ctx.fill();
    }

    ctx.stroke();

    ctx.restore();
};

/**
 * Render a whiteboard/strokes layer
 */
const renderWhiteboardLayer = (ctx: CanvasRenderingContext2D, layer: EditorLayer, cameraX: number, cameraY: number) => {
    const layerAny = layer as any;
    const strokes = layerAny.strokes || [];
    const scale = layerAny.scale || 1.0;
    const opacity = layerAny.opacity !== undefined ? layerAny.opacity : 1.0;
    const rotation = layerAny.rotation || 0;

    if (!strokes.length) {
        return;
    }

    // Calculate layer position relative to camera viewport
    const layerX = (layer.position?.x || 0) - cameraX;
    const layerY = (layer.position?.y || 0) - cameraY;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(layerX, layerY);
    if (rotation) {
        ctx.rotate(rotation * Math.PI / 180);
    }

    // Render each stroke
    strokes.forEach((stroke: any) => {
        const points = stroke.points || [];
        if (points.length < 2) return;

        const strokeWidth = (stroke.strokeWidth || stroke.stroke_width || 2) * scale;
        const strokeColor = stroke.strokeColor || stroke.stroke_color || '#000000';
        const lineJoin = stroke.lineJoin || stroke.line_join || 'round';
        const lineCap = stroke.lineCap || stroke.line_cap || 'round';

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineJoin = lineJoin;
        ctx.lineCap = lineCap;

        ctx.beginPath();

        if (points.length === 2) {
            ctx.moveTo(points[0].x * scale, points[0].y * scale);
            ctx.lineTo(points[1].x * scale, points[1].y * scale);
        } else {
            ctx.moveTo(points[0].x * scale, points[0].y * scale);

            for (let i = 1; i < points.length - 1; i++) {
                const xc = (points[i].x + points[i + 1].x) / 2 * scale;
                const yc = (points[i].y + points[i + 1].y) / 2 * scale;
                ctx.quadraticCurveTo(
                    points[i].x * scale,
                    points[i].y * scale,
                    xc,
                    yc
                );
            }

            const lastPoint = points[points.length - 1];
            const secondLastPoint = points[points.length - 2];
            ctx.quadraticCurveTo(
                secondLastPoint.x * scale,
                secondLastPoint.y * scale,
                lastPoint.x * scale,
                lastPoint.y * scale
            );
        }

        ctx.stroke();
    });

    ctx.restore();
};

/**
 * Download a data URL as a file
 * @param {string} dataUrl - Data URL to download
 * @param {string} filename - Filename for download
 */
export const downloadSceneImage = (dataUrl: string, filename: string) => {
    try {
        const arr = dataUrl.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/png';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);

        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }

        const blob = new Blob([u8arr], { type: mime });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }, 100);

    } catch (error) {
        console.error('Error downloading scene image:', error);
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
};

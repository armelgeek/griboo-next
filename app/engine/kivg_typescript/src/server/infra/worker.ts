import { parentPort } from 'worker_threads';
import { createCanvas, loadImage } from 'canvas';
import { ServerScene } from '../core/scene';
import { TransitionRenderer } from '../rendering/transition_renderer';
import { ServerCaptionLayer } from '../layers/caption_layer';
import { SceneConfig, WhiteboardConfig, RGBA } from '../../shared/types';
import { resolveAssetPath, loadAssetFromPath } from '../utils/path_utils';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Worker thread for rendering frames in parallel.
 * Receives rendering tasks and sends back frame buffers.
 */

if (!parentPort) {
    throw new Error('This script must be run as a worker thread.');
}

// Global cache for expensive resources in this worker
const sceneCache: Map<string, ServerScene> = new Map();
let handImageCache: any = null;
const customHandImages: Map<string, any> = new Map();
const subtitleLayerCache: Map<string, ServerCaptionLayer> = new Map();

async function getScene(config: SceneConfig, width: number, height: number, background: RGBA, handsConfig?: WhiteboardConfig['hands']): Promise<ServerScene> {
    const key = JSON.stringify(config.id);
    if (sceneCache.has(key)) {
        return sceneCache.get(key)!;
    }

    const scene = new ServerScene(config, width, height, background, handsConfig);
    await scene.prepare();
    sceneCache.set(key, scene);
    return scene;
}

async function renderSubtitlesOnCanvas(canvas: any, time: number, whiteboardConfig: WhiteboardConfig, whiteboardWidth: number): Promise<void> {
    if (!whiteboardConfig.subtitles || !whiteboardConfig.subtitles.enabled) {
        return;
    }

    const subtitles = whiteboardConfig.subtitles;
    const segments = subtitles.segments || [];
    const timeMs = time * 1000;
    const activeSegment = segments.find(seg => timeMs >= seg.startTime && timeMs <= seg.endTime);

    if (!activeSegment) return;

    let captionLayer = subtitleLayerCache.get(activeSegment.id);
    if (!captionLayer) {
        const style = subtitles.style || {};
        const position = subtitles.position || 'bottom';
        const offset = subtitles.offset || { x: 0, y: 0 };
        const scale = canvas.width / whiteboardWidth;

        let yPos = canvas.height / 2;
        if (position === 'top') yPos = canvas.height * 0.15;
        else if (position === 'bottom') yPos = canvas.height * 0.85;

        captionLayer = new ServerCaptionLayer({
            id: activeSegment.id,
            type: 'caption',
            text: activeSegment.text,
            position: { x: canvas.width / 2 + (offset.x * scale), y: yPos + (offset.y * scale) },
            fontSize: (style.fontSize || 32) * scale,
            fontFamily: style.fontFamily || 'Arial',
            fontWeight: style.fontWeight || 'normal',
            color: style.color || '#ffffff',
            backgroundColor: style.backgroundColor || '#000000',
            backgroundOpacity: style.backgroundOpacity ?? 0.8,
            stroke: style.stroke,
            shadow: style.shadow,
            textAlign: style.alignment || 'center',
            maxWidth: style.maxWidth ? (style.maxWidth * scale) : (canvas.width * 0.8),
            padding: (style.padding || 16) * scale,
            borderRadius: (style.borderRadius || 8) * scale,
            lineHeight: 1.3,
            entrance_animation: { type: 'none', duration: 0 },
            opacity: 1
        } as any);
        await captionLayer.prepare();
        subtitleLayerCache.set(activeSegment.id, captionLayer);
    }

    const ctx = canvas.getContext('2d');
    await captionLayer.render(ctx, (timeMs - activeSegment.startTime) / 1000);
}

async function getHandImage(url: string) {
    if (url === 'default_eraser') {
        if (handImageCache) return handImageCache;
        const { getEraserHandImageUrl } = require('../../shared/config/hand_config');
        const resolvedPath = resolveAssetPath(getEraserHandImageUrl());
        const buffer = await loadAssetFromPath(resolvedPath, 'image');
        handImageCache = await loadImage(buffer);
        return handImageCache;
    }

    if (customHandImages.has(url)) return customHandImages.get(url);

    const resolvedPath = resolveAssetPath(url);
    const buffer = await loadAssetFromPath(resolvedPath, 'image');
    const img = await loadImage(buffer);
    customHandImages.set(url, img);
    return img;
}

// Global reusable canvases for memory optimization
let sharedCanvas: any = null;
let sharedCtx: any = null;
let sharedFromCanvas: any = null;
let sharedToCanvas: any = null;
let sharedTransitionCanvas: any = null;

function resizeCanvasIfNeeded(canvas: any, width: number, height: number): any {
    if (!canvas) {
        return createCanvas(width, height);
    }
    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }
    // Clear canvas
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    return canvas;
}

parentPort.on('message', async (message) => {
    try {
        const { type, task, whiteboardSettings } = message;

        if (type === 'render') {
            const { width, height, background, handsConfig, targetWidth, targetHeight, whiteboardConfig } = whiteboardSettings;
            const absoluteTime = (task.sceneBaseTime || 0) + task.time;
            let buffer: Buffer;

            if (task.type === 'scene') {
                const scene = await getScene(task.sceneConfig, width, height, background, handsConfig);

                if (whiteboardConfig.subtitles?.enabled) {
                    sharedCanvas = resizeCanvasIfNeeded(sharedCanvas, targetWidth, targetHeight);
                    await scene.renderToCanvas(sharedCanvas, task.time, undefined, true, targetWidth, targetHeight);
                    await renderSubtitlesOnCanvas(sharedCanvas, absoluteTime, whiteboardConfig, width);
                    buffer = sharedCanvas.toBuffer('image/png');
                } else {
                    buffer = await scene.renderFrame(task.time, undefined, true, targetWidth, targetHeight);
                }
            } else if (task.type === 'transition') {
                const fromScene = await getScene(task.sceneConfig, width, height, background, handsConfig);
                const toScene = await getScene(task.nextSceneConfig, width, height, background, handsConfig);

                sharedFromCanvas = resizeCanvasIfNeeded(sharedFromCanvas, targetWidth, targetHeight);
                sharedToCanvas = resizeCanvasIfNeeded(sharedToCanvas, targetWidth, targetHeight);

                const isEraserTransition = task.sceneConfig.transition?.type === 'eraser';

                await fromScene.renderToCanvas(sharedFromCanvas, task.time, undefined, isEraserTransition, targetWidth, targetHeight);
                await toScene.renderToCanvas(sharedToCanvas, 0, undefined, false, targetWidth, targetHeight);

                let transitionHandImage = null;
                if (isEraserTransition) {
                    const handUrl = task.sceneConfig.transition?.handImage || 'default_eraser';
                    transitionHandImage = await getHandImage(handUrl);
                }

                // Calculate scales for transition (matching whiteboard.ts logic)
                const virtualWidth = task.sceneConfig.camera?.virtualSize?.width || width;
                const virtualHeight = task.sceneConfig.camera?.virtualSize?.height || height;
                const viewportScale = Math.min(targetWidth / virtualWidth, targetHeight / virtualHeight);

                // resScale: Base resolution scale for UI elements like hands (relative to 800px design)
                const resScale = targetWidth / 800;

                // eraserScale: Content-aware scale for physical effect (camera zoom * viewport scale)
                const cameraController = fromScene.getCameraController();
                let eraserScale = viewportScale;
                if (cameraController && cameraController.isActive()) {
                    const cameraConfig = cameraController.getConfigAtTime(task.time, fromScene.getLayers());
                    eraserScale = (cameraConfig.zoom || 1.0) * viewportScale;
                }

                const transitionCanvas = TransitionRenderer.renderTransition(
                    sharedFromCanvas,
                    sharedToCanvas,
                    task.sceneConfig.transition?.type || 'fade',
                    task.transitionProgress,
                    transitionHandImage,
                    task.sceneConfig.transition?.eraserPattern,
                    task.sceneConfig.transition?.handOffset,
                    task.sceneConfig.transition?.handScale,
                    resScale,
                    eraserScale
                );

                if (whiteboardConfig.subtitles?.enabled) {
                    await renderSubtitlesOnCanvas(transitionCanvas, absoluteTime, whiteboardConfig, width);
                }

                buffer = transitionCanvas.toBuffer('image/png');
            } else {
                throw new Error(`Unknown task type: ${task.type}`);
            }

            // Optimization: If filePath is provided, write directly to disk to save main thread memory
            if (task.filePath) {
                await fs.promises.writeFile(task.filePath, buffer);
                parentPort!.postMessage({ id: task.id, success: true, buffer: null });
            } else {
                parentPort!.postMessage({ id: task.id, buffer, success: true });
            }
        }
    } catch (error: any) {
        console.error('[Worker] Error during rendering:', error);
        parentPort!.postMessage({ id: message.task?.id, error: error.message, success: false });
    }
});

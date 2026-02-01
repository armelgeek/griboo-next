import * as path from 'path';
import * as fs from 'fs';
import { createCanvas, Canvas, loadImage } from 'canvas';
import { SceneConfig, WhiteboardConfig, RGBA, SubtitleSegment } from '../../shared/types';
import { ServerScene } from './scene';
import { TransitionRenderer } from '../rendering/transition_renderer';
import { ServerTimingMonitor } from './timing_monitor';
import { ServerPerformanceMonitor } from './server_perf_monitor';
import { VideoExporter, VideoResolutionPreset, VIDEO_PRESETS, VideoCodec } from '../infra/video_exporter';
import { globalHandConfig } from '../../shared/config/hand_config';
import { ServerCaptionLayer } from '../layers/caption_layer';
import { WorkerPool } from '../infra/worker_pool';
import { loadAssetFromPath, resolveAssetPath } from '../utils/path_utils';
import { ServerAudioManager } from './audio';
import { validateWhiteboardConfig } from '../../shared/validation/config_validator';
import * as os from 'os';
import * as crypto from 'crypto';
import { Logger } from '../../shared/infra/logger';

/**
 * Server-side Whiteboard
 * Manages multiple scenes and handles video export with transitions
 */
export class ServerWhiteboard {
    private config: WhiteboardConfig;
    private scenes: ServerScene[] = [];
    private width: number;
    private height: number;
    private background: RGBA;
    private eraserHandImage: any = null;
    private customHandImages: Map<string, any> = new Map();
    private subtitleLayerCache: Map<string, ServerCaptionLayer> = new Map();

    constructor(config: WhiteboardConfig, width: number = 800, height: number = 600, background: RGBA = [255, 255, 255, 255]) {
        // Validate configuration
        try {
            this.config = validateWhiteboardConfig(config) as WhiteboardConfig;
        } catch (error) {
            Logger.error('[ServerWhiteboard] Configuration validation failed', error);
            throw error;
        }

        this.width = config.width ?? width;
        this.height = config.height ?? height;
        this.background = background;

        // Apply hand presets if provided in config
        if (config.hands) {
            if (config.hands.draw) {
                globalHandConfig.updatePreset('drawing', config.hands.draw);
            }
            if (config.hands.erase) {
                globalHandConfig.updatePreset('eraser', config.hands.erase);
            }
            if (config.hands.push) {
                globalHandConfig.updatePreset('push', config.hands.push);
            }
        }

        if (config.scenes) {
            this.scenes = config.scenes.map(sceneConfig => new ServerScene(sceneConfig, this.width, this.height, this.background, config.hands));
        }
    }

    /**
     * Add a scene to the whiteboard
     */
    addScene(sceneConfig: SceneConfig): void {
        this.scenes.push(new ServerScene(sceneConfig, this.width, this.height, this.background, this.config.hands));
    }

    /**
     * Helper function to calculate transition duration
     * @private
     */
    private getTransitionDuration(sceneConfig: SceneConfig): number {
        return sceneConfig.transition?.duration ?? 0;
    }

    /**
     * Remove a scene by ID
     */
    removeScene(sceneId: string): void {
        this.scenes = this.scenes.filter(scene => scene.getConfig().id !== sceneId);
    }

    /**
     * Get a scene by ID
     */
    getScene(sceneId: string): ServerScene | undefined {
        return this.scenes.find(scene => scene.getConfig().id === sceneId);
    }

    /**
     * Get all scenes
     */
    getScenes(): ServerScene[] {
        return this.scenes;
    }

    /**
     * Prepare all scenes
     */
    async prepare(): Promise<void> {
        await Promise.all(this.scenes.map(scene => scene.prepare()));

        // Load eraser hand image
        try {
            const eraserPath = resolveAssetPath('assets/hand/eraser.png');
            if (fs.existsSync(eraserPath)) {
                this.eraserHandImage = await loadImage(eraserPath);
            } else {
                Logger.warn(`[ServerWhiteboard] Eraser hand image not found at ${eraserPath}`);
            }
        } catch (error) {
            Logger.error(`[ServerWhiteboard] Failed to load eraser hand image`, error);
        }

        // Load custom hand images for transitions
        for (const scene of this.scenes) {
            const config = scene.getConfig();
            if (config.transition?.handImage) {
                try {
                    // Check if it's already loaded
                    if (!this.customHandImages.has(config.transition.handImage)) {
                        const imagePath = config.transition.handImage;
                        const fullPath = resolveAssetPath(imagePath);

                        if (fullPath.startsWith('http') || fs.existsSync(fullPath)) {
                            const img = await loadImage(fullPath);
                            this.customHandImages.set(config.transition.handImage, img);
                        } else {
                            Logger.warn(`[ServerWhiteboard] Custom hand image not found at ${fullPath}`);
                        }
                    }
                } catch (error) {
                    Logger.error(`[ServerWhiteboard] Failed to load custom hand image ${config.transition?.handImage}`, error);
                }
            }
        }
    }

    /**
     * Calculate total duration including transitions
     */
    calculateTotalDuration(): number {
        let total = 0;
        for (let i = 0; i < this.scenes.length; i++) {
            const scene = this.scenes[i];
            const sceneConfig = scene.getConfig();
            const duration = scene.getDuration();
            const transitionDuration = this.getTransitionDuration(sceneConfig);
            total += (duration - transitionDuration);
        }
        // Add back the last scene's transition duration if it has one (though usually there's no next scene)
        // Correct logic: sum of (scene.duration - transition.duration)
        return total;
    }

    /**
     * Render the entire whiteboard to a video file
     */
    async renderToVideo(
        outputPath: string,
        options: {
            resolution?: VideoResolutionPreset | { width: number, height: number, fps?: number },
            fps?: number,
            tempDir?: string,
            parallelism?: number | 'auto',
            onProgress?: (progress: number, etaSeconds: number, fps: number) => void,
            keepTemp?: boolean,
            codec?: VideoCodec,
            quality?: number,
            normalizeAudio?: boolean
        } = {}
    ): Promise<void> {
        let { fps, resolution, tempDir, parallelism, codec, quality, normalizeAudio } = options;

        // Handle auto parallelism
        if (parallelism === 'auto') {
            parallelism = os.cpus().length;
        }
        parallelism = parallelism ?? 1;

        let targetWidth = this.width;
        let targetHeight = this.height;

        if (resolution) {
            if (typeof resolution === 'string') {
                const preset = VIDEO_PRESETS[resolution];
                if (preset) {
                    targetWidth = preset.width;
                    targetHeight = preset.height;
                    fps = fps ?? preset.fps;
                }
            } else {
                targetWidth = resolution.width;
                targetHeight = resolution.height;
            }
        }

        fps = fps ?? 30;
        tempDir = tempDir ?? path.join(process.cwd(), 'temp_frames');

        Logger.info(`🎬 Starting multi-scene video rendering: ${outputPath}`, {
            resolution: `${targetWidth}x${targetHeight}`,
            fps,
            parallelism: parallelism > 1 ? parallelism : 'sequential',
            codec
        });

        const monitor = new ServerTimingMonitor();
        const perfMonitor = new ServerPerformanceMonitor();

        await this.prepare();

        const renderedBuffers: Buffer[] = [];

        // Pre-calculate all frame tasks
        const tasks: Array<{
            sceneIndex: number;
            type: 'scene' | 'transition';
            time: number;
            nextSceneIndex?: number;
            transitionProgress?: number;
        }> = [];

        for (let i = 0; i < this.scenes.length; i++) {
            const currentScene = this.scenes[i];
            const nextScene = this.scenes[i + 1];
            const sceneConfig = currentScene.getConfig();

            const sceneDuration = currentScene.getDuration();
            const transitionDuration = this.getTransitionDuration(sceneConfig);
            const mainDuration = sceneDuration - transitionDuration;

            // 1. Scene frames
            const mainFrames = Math.ceil(mainDuration * fps);
            for (let f = 0; f < mainFrames; f++) {
                tasks.push({
                    sceneIndex: i,
                    type: 'scene',
                    time: f / fps
                });
            }

            // Add the exact end frame of the main part if it's not already covered
            const lastMainTime = (mainFrames - 1) / fps;
            if (lastMainTime < mainDuration) {
                tasks.push({
                    sceneIndex: i,
                    type: 'scene',
                    time: mainDuration
                });
            }

            // 2. Transition frames
            if (sceneConfig.transition && nextScene && transitionDuration > 0) {
                const transitionFrames = Math.ceil(transitionDuration * fps);
                for (let f = 0; f < transitionFrames; f++) {
                    tasks.push({
                        sceneIndex: i,
                        nextSceneIndex: i + 1,
                        type: 'transition',
                        time: mainDuration + (f / fps),
                        transitionProgress: f / transitionFrames
                    });
                }
            } else if (transitionDuration > 0) {
                const remainingFrames = Math.ceil(transitionDuration * fps);
                for (let f = 0; f < remainingFrames; f++) {
                    tasks.push({
                        sceneIndex: i,
                        type: 'scene',
                        time: mainDuration + (f / fps)
                    });
                }
                tasks.push({
                    sceneIndex: i,
                    type: 'scene',
                    time: sceneDuration
                });
            } else {
                const lastTime = (mainFrames - 1) / fps;
                if (lastTime < sceneDuration) {
                    tasks.push({
                        sceneIndex: i,
                        type: 'scene',
                        time: sceneDuration
                    });
                }
            }
        }

        // Add a final hold frame
        if (this.scenes.length > 0) {
            const lastSceneIndex = this.scenes.length - 1;
            const lastSceneDuration = this.scenes[lastSceneIndex].getDuration();
            tasks.push({
                sceneIndex: lastSceneIndex,
                type: 'scene',
                time: lastSceneDuration + 0.1
            });
        }

        // Sort and deduplicate tasks
        tasks.sort((a, b) => {
            if (a.sceneIndex !== b.sceneIndex) return a.sceneIndex - b.sceneIndex;
            return a.time - b.time;
        });

        const finalTasks: typeof tasks = [];
        for (const task of tasks) {
            const last = finalTasks[finalTasks.length - 1];
            if (!last || last.sceneIndex !== task.sceneIndex || Math.abs(last.time - task.time) > 0.0001 || last.type !== task.type) {
                finalTasks.push(task);
            }
        }

        console.log(`   - Total frames to render: ${finalTasks.length}`);

        // Initialize Server Audio Manager
        const audioManager = new ServerAudioManager(fps);
        audioManager.setTotalDuration(this.calculateTotalDuration());

        let currentSceneStartTime = 0;
        for (let i = 0; i < this.scenes.length; i++) {
            const scene = this.scenes[i];
            const sceneConfig = scene.getConfig();
            const sceneDuration = scene.getDuration();
            const transitionDuration = Math.min(sceneDuration, this.getTransitionDuration(sceneConfig));

            await audioManager.processSceneAudio(scene, currentSceneStartTime, this.config.width);

            // Increment the cumulative start time for the next scene
            // We subtract transitionDuration because scenes overlap during transitions
            currentSceneStartTime += (sceneDuration - transitionDuration);
        }

        // Get processed tracks (this generates procedural WAVs in tempDir)
        const rawTracks = await audioManager.getProcessedTracks(tempDir);

        // Process audio tracks: download HTTP assets and ensure local paths for files
        const processedAudioTracks = await Promise.all(rawTracks.map(async (track) => {
            if (track.path.startsWith('http://') || track.path.startsWith('https://')) {
                try {
                    Logger.debug(`[ServerWhiteboard] Downloading/Caching audio: ${track.path}`);
                    const buffer = await loadAssetFromPath(track.path, 'audio');

                    // Write to a temporary file for FFmpeg
                    const hash = crypto.createHash('md5').update(track.path).digest('hex');
                    const ext = path.extname(new URL(track.path).pathname) || '.mp3';
                    const tempAudioPath = path.join(tempDir, `audio_${hash}${ext}`);

                    if (!fs.existsSync(tempAudioPath)) {
                        fs.writeFileSync(tempAudioPath, buffer);
                    }

                    return {
                        ...track,
                        path: tempAudioPath
                    };
                } catch (error) {
                    Logger.error(`[ServerWhiteboard] Failed to cache audio ${track.path}`, error);
                    return track;
                }
            }
            // Local path: ensure it's absolute
            return {
                ...track,
                path: resolveAssetPath(track.path)
            };
        }));

        // Render frames
        const startTime = Date.now();
        let completedFrames = 0;

        const updateProgress = () => {
            if (options.onProgress) {
                const elapsedMs = Date.now() - startTime;
                const progress = completedFrames / finalTasks.length;
                const fps = elapsedMs > 0 ? (completedFrames / (elapsedMs / 1000)) : 0;
                const remainingFrames = finalTasks.length - completedFrames;
                const etaSeconds = fps > 0 ? (remainingFrames / fps) : 0;

                options.onProgress(0.1 + 0.8 * progress, etaSeconds, parseFloat(fps.toFixed(2)));
            }
        };

        const framePattern = path.join(tempDir, 'frame_%05d.png');

        if (parallelism > 1) {
            const workerExt = __filename.endsWith('.ts') ? 'ts' : 'js';
            const pool = new WorkerPool(parallelism, path.join(__dirname, `../infra/worker.${workerExt}`));
            const whiteboardSettings = {
                width: this.width,
                height: this.height,
                background: this.background,
                handsConfig: this.config.hands,
                targetWidth,
                targetHeight,
                whiteboardConfig: this.config
            };

            let sceneBaseTime = 0;
            const sceneStartTimes = this.scenes.map(s => {
                const t = sceneBaseTime;
                sceneBaseTime += s.getDuration();
                return t;
            });

            try {
                const taskPromises = finalTasks.map((task, index) => {
                    const filePath = path.join(tempDir, `frame_${index.toString().padStart(5, '0')}.png`);
                    const frameStartTime = Date.now();
                    return pool.runTask({
                        id: index,
                        ...task,
                        filePath,
                        sceneBaseTime: sceneStartTimes[task.sceneIndex],
                        sceneConfig: this.scenes[task.sceneIndex].getConfig(),
                        nextSceneConfig: task.nextSceneIndex !== undefined ? this.scenes[task.nextSceneIndex].getConfig() : undefined
                    }, whiteboardSettings).then(() => {
                        const frameEndTime = Date.now();
                        perfMonitor.recordFrame(frameEndTime - frameStartTime, 0); // Active layers estimation hard in worker mode
                        completedFrames++;
                        if (completedFrames % 5 === 0 || completedFrames === finalTasks.length) {
                            updateProgress();
                        }
                    });
                });

                await Promise.all(taskPromises);
            } finally {
                await pool.terminate();
            }
        } else {
            let sceneBaseTime = 0;
            const sceneStartTimes = this.scenes.map(s => {
                const t = sceneBaseTime;
                sceneBaseTime += s.getDuration();
                return t;
            });

            for (let i = 0; i < finalTasks.length; i++) {
                const task = finalTasks[i];
                const frameStartTime = Date.now();
                const absoluteTime = sceneStartTimes[task.sceneIndex] + task.time;
                const filePath = path.join(tempDir, `frame_${i.toString().padStart(5, '0')}.png`);
                let buffer: Buffer;

                if (task.type === 'scene') {
                    if (this.config.subtitles?.enabled) {
                        const canvas = createCanvas(targetWidth, targetHeight);
                        await this.scenes[task.sceneIndex].renderToCanvas(canvas, task.time, monitor, true, targetWidth, targetHeight);
                        await this.renderSubtitlesOnCanvas(canvas as any, absoluteTime);
                        buffer = canvas.toBuffer('image/png');
                    } else {
                        buffer = await this.scenes[task.sceneIndex].renderFrame(task.time, monitor, true, targetWidth, targetHeight);
                    }
                } else {
                    const fromCanvas = createCanvas(targetWidth, targetHeight);
                    const toCanvas = createCanvas(targetWidth, targetHeight);
                    const sceneConfig = this.scenes[task.sceneIndex].getConfig();

                    const virtualWidth = sceneConfig.camera?.virtualSize?.width || this.width;
                    const virtualHeight = sceneConfig.camera?.virtualSize?.height || this.height;
                    const viewportScale = Math.min(targetWidth / virtualWidth, targetHeight / virtualHeight);

                    const resScale = targetWidth / 800;

                    const fromScene = this.scenes[task.sceneIndex];
                    const cameraController = fromScene.getCameraController();
                    let eraserScale = viewportScale;
                    if (cameraController && cameraController.isActive()) {
                        const cameraConfig = cameraController.getConfigAtTime(task.time, fromScene.getLayers());
                        eraserScale = (cameraConfig.zoom || 1.0) * viewportScale;
                    }

                    await this.scenes[task.sceneIndex].renderToCanvas(fromCanvas, task.time, monitor, sceneConfig.transition?.type === 'eraser', targetWidth, targetHeight);
                    await this.scenes[task.nextSceneIndex!].renderToCanvas(toCanvas, 0, monitor, false, targetWidth, targetHeight);

                    const handImage = sceneConfig.transition?.handImage ? (this.customHandImages.get(sceneConfig.transition.handImage) || this.eraserHandImage) : this.eraserHandImage;
                    const transitionCanvas = TransitionRenderer.renderTransition(
                        fromCanvas as any, toCanvas as any, sceneConfig.transition?.type || 'fade',
                        task.transitionProgress!, handImage, sceneConfig.transition?.eraserPattern,
                        sceneConfig.transition?.handOffset, sceneConfig.transition?.handScale,
                        resScale, eraserScale
                    );

                    if (this.config.subtitles?.enabled) {
                        await this.renderSubtitlesOnCanvas(transitionCanvas as any, absoluteTime);
                    }
                    buffer = transitionCanvas.toBuffer('image/png');
                }

                await fs.promises.writeFile(filePath, buffer);
                const frameEndTime = Date.now();
                perfMonitor.recordFrame(frameEndTime - frameStartTime, 0);

                completedFrames++;
                if (completedFrames % 5 === 0 || completedFrames === finalTasks.length) {
                    updateProgress();
                }
            }
        }

        if (options.onProgress) options.onProgress(0.9, 0, 0);

        await VideoExporter.exportFromFrames(framePattern, outputPath, {
            fps, width: targetWidth, height: targetHeight,
            preset: typeof resolution === 'string' ? resolution : undefined,
            codec, quality, audioTracks: processedAudioTracks, keepTemp: options.keepTemp,
            normalize: normalizeAudio
        });

        monitor.logResults();

        const perfReport = perfMonitor.getSummaryReport();
        console.log('\n🚀 Performance Summary:');
        console.log(`  Average FPS: ${perfReport.averageFps.toFixed(1)}`);
        console.log(`  P95 Render Time: ${perfReport.p95FrameTimeMs.toFixed(0)}ms`);
        console.log(`  Peak Memory: ${perfReport.peakMemoryMb}MB`);
        console.log(`  Total Frames: ${perfReport.totalFrames}`);
        if (perfReport.alerts.length > 0) {
            console.log(`  Alerts: ${perfReport.alerts.length} detected`);
        }
        console.log('');

        if (!options.keepTemp && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        Logger.info(`✨ Video generated: ${outputPath}`);
    }

    private async renderSubtitlesOnCanvas(canvas: Canvas, time: number): Promise<void> {
        if (!this.config.subtitles?.enabled) return;
        const subtitles = this.config.subtitles;
        const timeMs = time * 1000;
        const segment = (subtitles.segments || []).find(seg => timeMs >= seg.startTime && timeMs <= seg.endTime);
        if (!segment) return;

        let captionLayer = this.subtitleLayerCache.get(segment.id);
        if (!captionLayer) {
            const style = subtitles.style || {};
            const position = subtitles.position || 'bottom';
            const offset = subtitles.offset || { x: 0, y: 0 };
            const scale = canvas.width / this.width;

            let yPos = canvas.height / 2;
            if (position === 'top') yPos = canvas.height * 0.15;
            else if (position === 'bottom') yPos = canvas.height * 0.85;

            captionLayer = new ServerCaptionLayer({
                id: segment.id, type: 'caption', text: segment.text,
                position: { x: (canvas.width / 2) + offset.x * scale, y: yPos + offset.y * scale },
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
                lineHeight: 1.3
            }, this.config.hands);
            await captionLayer.prepare();
            this.subtitleLayerCache.set(segment.id, captionLayer);
        }
        await captionLayer.doRender(canvas.getContext('2d'), time);
    }
}


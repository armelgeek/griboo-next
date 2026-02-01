import * as path from 'path';
import * as fs from 'fs';
import { HybridLayerAnimator } from './hybrid_layer_animator';
import { VideoExporter, VideoExportOptions } from '../infra/video_exporter';
import { HybridImageConfig, SceneConfig } from '../../shared/types';
import { ServerScene } from '../core/scene';

export interface HybridVideoOptions extends VideoExportOptions {
    frameCount?: number;
    tempDir?: string;
    /** 
     * Number of frames to render in parallel (default: 1). 
     * Note: Parallel rendering may not improve performance in Node.js due to single-threaded canvas operations.
     * Set to 1 for sequential rendering (recommended).
     */
    parallelism?: number;
    fps?: number;
}

/**
 * HybridVideoAnimator - High-level API for generating videos from hybrid animations.
 */
export class HybridVideoAnimator {
    private layerAnimator: HybridLayerAnimator | null = null;
    private config: HybridImageConfig;

    constructor(config: HybridImageConfig) {
        this.config = config;
    }

    private getOrCreateLayerAnimator(): HybridLayerAnimator {
        if (!this.layerAnimator) {
            this.layerAnimator = new HybridLayerAnimator(this.config);
        }
        return this.layerAnimator;
    }

    /**
     * Render the animation and export it to a video file.
     * @param imageSource - Path or Buffer of the source image
     * @param outputPath - Path to the output video file
     * @param options - Video and rendering options
     */
    async renderToVideo(
        imageSource: string | Buffer,
        outputPath: string,
        options: HybridVideoOptions = {}
    ): Promise<void> {
        const frameCount = options.frameCount ?? 60;
        const tempDir = options.tempDir ?? path.join(process.cwd(), 'temp_frames');

        console.log(`🎬 Starting video rendering: ${outputPath}`);
        console.log(`   - Frames: ${frameCount}`);
        console.log(`   - FPS: ${options.fps ?? 30}`);

        // 1. Prepare the animator
        const animator = this.getOrCreateLayerAnimator();
        await animator.prepare(imageSource);

        // 2. Render frames
        const frameBuffers: Buffer[] = [];
        for (let i = 0; i <= frameCount; i++) {
            const progress = i / frameCount;
            const buffer = await animator.renderFrame(progress);
            frameBuffers.push(buffer);

            if (i % 10 === 0 || i === frameCount) {
                console.log(`   📦 Rendered frame ${i}/${frameCount} (${Math.round(progress * 100)}%)`);
            }
        }

        // 3. Export to video
        console.log(`   🎥 Exporting to video...`);
        await VideoExporter.exportFromBuffers(frameBuffers, tempDir, outputPath, options);

        console.log(`✨ Video successfully generated: ${outputPath}`);

        // Cleanup tempDir if it's empty
        try {
            if (fs.existsSync(tempDir) && fs.readdirSync(tempDir).length === 0) {
                fs.rmdirSync(tempDir);
            }
        } catch (err) {
            // Ignore cleanup errors
        }
    }

    /**
     * Render a full scene to video.
     * @param sceneConfig - Configuration of the scene
     * @param outputPath - Path to the output video file
     * @param options - Video and rendering options
     */
    async renderSceneToVideo(
        sceneConfig: SceneConfig,
        outputPath: string,
        options: HybridVideoOptions = {}
    ): Promise<void> {
        const fps = options.fps ?? 30;
        const tempDir = options.tempDir ?? path.join(process.cwd(), 'temp_frames');

        const scene = new ServerScene(
            sceneConfig,
            this.config.width,
            this.config.height,
            this.config.background
        );

        console.log(`🎬 Starting scene video rendering: ${outputPath}`);

        // 1. Prepare the scene
        await scene.prepare();

        // 2. Calculate frames
        const duration = scene.getDuration();
        const frameCount = Math.ceil(duration * fps);

        console.log(`   - Duration: ${duration.toFixed(2)}s`);
        console.log(`   - Frames: ${frameCount}`);
        console.log(`   - FPS: ${fps}`);

        // 3. Render frames (with optional parallelism)
        const parallelism = options.parallelism ?? 1;
        const frameBuffers: Buffer[] = new Array(frameCount + 1);

        if (parallelism > 1) {
            console.log(`   - Parallelism: ${parallelism} frames at a time`);

            // Batch frames into chunks for parallel rendering
            const batches: number[][] = [];
            for (let i = 0; i <= frameCount; i += parallelism) {
                const batch: number[] = [];
                for (let j = 0; j < parallelism && i + j <= frameCount; j++) {
                    batch.push(i + j);
                }
                batches.push(batch);
            }

            // Render batches in parallel
            for (const batch of batches) {
                const buffers = await Promise.all(
                    batch.map(frameIndex => scene.renderFrame(frameIndex / fps))
                );

                // Store buffers in correct order
                batch.forEach((frameIndex, idx) => {
                    frameBuffers[frameIndex] = buffers[idx];
                });

                const lastFrameInBatch = batch[batch.length - 1];
                if (lastFrameInBatch % 10 === 0 || lastFrameInBatch === frameCount) {
                    const progress = Math.round((lastFrameInBatch / frameCount) * 100);
                    console.log(`   📦 Rendered frame ${lastFrameInBatch}/${frameCount} (${progress}%)`);
                }
            }
        } else {
            // Sequential rendering
            for (let i = 0; i <= frameCount; i++) {
                const time = i / fps;
                const buffer = await scene.renderFrame(time);
                frameBuffers[i] = buffer;

                if (i % 10 === 0 || i === frameCount) {
                    const progress = Math.round((i / frameCount) * 100);
                    console.log(`   📦 Rendered frame ${i}/${frameCount} (${progress}%)`);
                }
            }
        }

        // 4. Export to video
        console.log(`   🎥 Exporting to video...`);
        await VideoExporter.exportFromBuffers(frameBuffers, tempDir, outputPath, options);

        console.log(`✨ Scene video successfully generated: ${outputPath}`);
    }

    /**
     * Get the underlying layer animator
     */
    getLayerAnimator(): HybridLayerAnimator {
        return this.getOrCreateLayerAnimator();
    }
}

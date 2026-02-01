import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../shared/infra/logger';

export type VideoResolutionPreset = '360p' | '480p' | '720p' | '1080p' | 'custom';

export interface VideoResolution {
    width: number;
    height: number;
    fps: number;
    quality: number; // CRF value (0-51, lower is better)
}

export const VIDEO_PRESETS: Record<VideoResolutionPreset, VideoResolution> = {
    '360p': { width: 640, height: 360, fps: 24, quality: 28 },
    '480p': { width: 854, height: 480, fps: 25, quality: 23 },
    '720p': { width: 1280, height: 720, fps: 30, quality: 20 }, // Adjusted for better balance
    '1080p': { width: 1920, height: 1080, fps: 48, quality: 16 }, // Lowered slightly for high-res
    'custom': { width: 1920, height: 1080, fps: 60, quality: 16 }
};

export type VideoCodec = 'libx264' | 'libx265' | 'h264_nvenc' | 'hevc_nvenc';

export interface AudioTrack {
    path: string;
    startTime?: number; // in seconds
    volume?: number;    // 0.0 to 1.0
    loop?: boolean;
}

export interface VideoExportOptions {
    preset?: VideoResolutionPreset;
    width?: number;
    height?: number;
    fps?: number;
    quality?: number; // 0-51 (lower is better, default 23)
    pixelFormat?: string; // default 'yuv420p'
    audioTracks?: AudioTrack[];
    keepTemp?: boolean; // If true, do not delete temporary frames
    movflags?: string; // e.g. 'faststart'
    codec?: VideoCodec; // Codec for encoding
    extraArgs?: string[]; // Custom ffmpeg arguments
    normalize?: boolean; // If true, apply audio normalization
}

/**
 * VideoExporter - Wraps ffmpeg to create videos from image frames.
 */
export class VideoExporter {
    /**
     * Export a video from a sequence of image files.
     * @param framePattern - Pattern for input frames (e.g., 'frame_%03d.png')
     * @param outputPath - Path to the output video file
     * @param options - Export options
     */
    static async exportFromFrames(
        framePattern: string,
        outputPath: string,
        options: VideoExportOptions = {}
    ): Promise<void> {
        let { fps, quality, width, height, preset } = options;

        if (preset && VIDEO_PRESETS[preset]) {
            const presetValues = VIDEO_PRESETS[preset];
            fps = fps ?? presetValues.fps;
            quality = quality ?? presetValues.quality;
            width = width ?? presetValues.width;
            height = height ?? presetValues.height;
        }

        fps = fps ?? 30;
        quality = quality ?? 23;
        const pixelFormat = options.pixelFormat ?? 'yuv420p';

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        return new Promise((resolve, reject) => {
            const args = [
                '-y', // Overwrite output file
                '-framerate', fps!.toString(),
                '-i', framePattern
            ];

            const audioTracks = options.audioTracks || [];
            // Add audio inputs
            for (const track of audioTracks) {
                if (track.loop) {
                    args.push('-stream_loop', '-1');
                }
                args.push('-i', track.path);
            }

            if (width && height) {
                // Ensure width/height are even for yuv420p (ffmpeg requirement)
                const evenWidth = width % 2 === 0 ? width : width - 1;
                const evenHeight = height % 2 === 0 ? height : height - 1;

                // Only add scaling filter if we actually need to change the resolution
                args.push('-vf', `scale=${evenWidth}:${evenHeight}:flags=lanczos`);
            }

            const codec = options.codec ?? 'libx264';
            args.push('-c:v', codec);

            // Set quality based on codec
            if (codec === 'libx264' || codec === 'libx265') {
                args.push('-crf', quality!.toString());
                args.push('-preset', 'slower');
                if (codec === 'libx265') {
                    // HEVC improvements for flat content (like whiteboards)
                    args.push('-x265-params', 'log-level=error');
                }
            } else if (codec === 'h264_nvenc' || codec === 'hevc_nvenc') {
                // NVENC uses different quality control
                // -rc vbr: variable bitrate
                // -cq: constant quality (similar to CRF)
                args.push('-rc', 'vbr', '-cq', (quality! + 4).toString(), '-preset', 'p7'); // p7 is slowest/best for nvenc, adjust quality as CRF != CQ exactly
            }

            const movflags = options.movflags ?? 'faststart';
            if (movflags) {
                args.push('-movflags', movflags);
            }

            args.push('-pix_fmt', pixelFormat);

            if (options.extraArgs) {
                args.push(...options.extraArgs);
            }

            if (audioTracks.length > 0) {
                // Construct filter_complex for audio mixing
                let filterComplex = '';
                const audioLabels: string[] = [];

                audioTracks.forEach((track, i) => {
                    const inputIdx = i + 1; // 0 is the video frames
                    const label = `a${inputIdx}`;
                    const delayMs = Math.round((track.startTime || 0) * 1000);
                    const volume = track.volume ?? 1.0;

                    // adelay needs delay for each channel, usually 2 for stereo
                    filterComplex += `[${inputIdx}:a]adelay=${delayMs}|${delayMs},volume=${volume}[${label}];`;
                    audioLabels.push(`[${label}]`);
                });

                let amixFilter = `amix=inputs=${audioTracks.length}:duration=longest:dropout_transition=2`;
                if (options.normalize) {
                    // Apply EBU R128 loudness normalization
                    amixFilter += ',loudnorm';
                }

                filterComplex += `${audioLabels.join('')}${amixFilter}[outa]`;

                args.push('-filter_complex', filterComplex);
                args.push('-map', '0:v');
                args.push('-map', '[outa]');
            }

            args.push(outputPath);

            Logger.info(`[VideoExporter] Running ffmpeg command`, { args: args.join(' ') });

            const ffmpeg = spawn('ffmpeg', args);

            let stderr = '';
            ffmpeg.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`ffmpeg failed with code ${code}\n${stderr}`));
                }
            });

            ffmpeg.on('error', (err) => {
                reject(err);
            });
        });
    }

    /**
     * Export a video from a list of image buffers.
     * @param buffers - Array of image buffers
     * @param tempDir - Directory to store temporary frames
     * @param outputPath - Path to the output video file
     * @param options - Export options
     */
    static async exportFromBuffers(
        buffers: Buffer[],
        tempDir: string,
        outputPath: string,
        options: VideoExportOptions = {}
    ): Promise<void> {
        if (fs.existsSync(tempDir)) {
            // Clear existing frames to avoid including stale frames from previous runs
            const files = fs.readdirSync(tempDir);
            for (const file of files) {
                if (file.startsWith('frame_') && file.endsWith('.png')) {
                    fs.unlinkSync(path.join(tempDir, file));
                }
            }
        } else {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Save buffers to temporary files
        const framePromises = buffers.map((buffer, i) => {
            const fileName = `frame_${i.toString().padStart(5, '0')}.png`;
            const filePath = path.join(tempDir, fileName);
            return fs.promises.writeFile(filePath, buffer);
        });

        await Promise.all(framePromises);

        // Export from frames
        const framePattern = path.join(tempDir, 'frame_%05d.png');
        await this.exportFromFrames(framePattern, outputPath, options);

        // Cleanup temporary files
        if (!options.keepTemp) {
            const cleanupPromises = buffers.map((_, i) => {
                const fileName = `frame_${i.toString().padStart(5, '0')}.png`;
                const filePath = path.join(tempDir, fileName);
                return fs.promises.unlink(filePath).catch(() => { }); // Ignore errors during cleanup
            });

            await Promise.all(cleanupPromises);
        }
    }
}

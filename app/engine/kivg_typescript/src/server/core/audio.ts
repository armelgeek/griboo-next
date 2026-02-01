/**
 * Server-side Audio Manager Module
 * 
 * Mirror of frontend/core/audio.ts for Node.js environment.
 * Provides support for procedural sound generation and audio track management.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { loadAssetFromPath } from '../utils/path_utils';
import { AudioSceneConfig } from '../../shared/types';

/**
 * Simplified AudioBuffer for server-side PCM handling
 */
export class ServerAudioBuffer {
    numberOfChannels: number;
    length: number;
    sampleRate: number;
    private data: Float32Array[];

    constructor(numberOfChannels: number, length: number, sampleRate: number) {
        this.numberOfChannels = numberOfChannels;
        this.length = length;
        this.sampleRate = sampleRate;
        this.data = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
    }

    getChannelData(channel: number): Float32Array {
        return this.data[channel];
    }

    static create(numberOfChannels: number, length: number, sampleRate: number): ServerAudioBuffer {
        return new ServerAudioBuffer(numberOfChannels, length, sampleRate);
    }
}

export interface AudioTrack {
    audio: ServerAudioBuffer;
    start: number; // Start time in milliseconds
    trackType: 'effect' | 'voiceover' | 'typewriter' | 'drawing';
    volume: number;
    path?: string; // Original path if loaded from file
}

/**
 * Manages audio tracks and procedural sounds on the server.
 */
export class ServerAudioManager {
    frameRate: number;
    sampleRate: number;
    audioTracks: AudioTrack[] = [];
    backgroundMusic: { path: string, volume: number, loop: boolean, fadeIn: number, fadeOut: number } | null = null;
    totalDurationMs: number = 0;

    constructor(frameRate: number = 30, sampleRate: number = 44100) {
        this.frameRate = frameRate;
        this.sampleRate = sampleRate;
        console.log(`🎵 ServerAudioManager initialized: frameRate=${frameRate}, sampleRate=${sampleRate}`);
    }

    setTotalDuration(durationSeconds: number): void {
        this.totalDurationMs = Math.floor(durationSeconds * 1000);
    }

    /**
     * Add a pre-loaded or procedural audio buffer as a track
     */
    addBufferTrack(buffer: ServerAudioBuffer, startTime: number, type: AudioTrack['trackType'], volume: number = 1.0): void {
        this.audioTracks.push({
            audio: buffer,
            start: Math.floor(startTime * 1000),
            trackType: type,
            volume
        });
    }

    /**
     * Generate typewriter sound effects (White noise bursts)
     */
    async generateTypewriterSound(
        startTime: number,
        numCharacters: number,
        charInterval: number = 0.1,
        volume: number = 0.3,
        pan: number = 0.0 // -1.0 (left) to 1.0 (right)
    ): Promise<void> {
        const clickDuration = 0.05; // 50ms click
        const totalDuration = numCharacters * charInterval + clickDuration;
        const totalSamples = Math.floor(totalDuration * this.sampleRate);

        const buffer = ServerAudioBuffer.create(2, totalSamples, this.sampleRate);
        const leftData = buffer.getChannelData(0);
        const rightData = buffer.getChannelData(1);

        // Pan gains (constant power)
        const leftGain = Math.cos((pan + 1) * Math.PI / 4);
        const rightGain = Math.sin((pan + 1) * Math.PI / 4);

        for (let i = 0; i < numCharacters; i++) {
            const startSample = Math.floor(i * charInterval * this.sampleRate);
            const clickSamples = Math.floor(clickDuration * this.sampleRate);

            for (let j = 0; j < clickSamples && startSample + j < totalSamples; j++) {
                const envelope = Math.max(0, 1 - (j / clickSamples));
                let noise = (Math.random() * 2 - 1) * 0.2 * envelope * volume;
                // Clamp to prevent clipping
                noise = Math.max(-1, Math.min(1, noise));

                leftData[startSample + j] = noise * leftGain;
                rightData[startSample + j] = noise * rightGain;
            }
        }

        this.addBufferTrack(buffer, startTime, 'typewriter', volume);
    }

    /**
     * Generate drawing/sketching sound effects
     */
    async generateDrawingSound(
        startTime: number,
        duration: number,
        volume: number = 0.2,
        pan: number = 0.0
    ): Promise<void> {
        const totalSamples = Math.floor(duration * this.sampleRate);
        const buffer = ServerAudioBuffer.create(2, totalSamples, this.sampleRate);
        const leftData = buffer.getChannelData(0);
        const rightData = buffer.getChannelData(1);

        const leftGain = Math.cos((pan + 1) * Math.PI / 4);
        const rightGain = Math.sin((pan + 1) * Math.PI / 4);

        const fadeInSamples = Math.floor(0.1 * this.sampleRate);
        const fadeOutSamples = Math.floor(0.2 * this.sampleRate);
        const fadeOutStart = totalSamples - fadeOutSamples;

        for (let i = 0; i < totalSamples; i++) {
            let envelope = 1.0;
            if (i < fadeInSamples) envelope = i / fadeInSamples;
            if (i >= fadeOutStart) envelope = 1 - ((i - fadeOutStart) / fadeOutSamples);

            let noise = (Math.random() * 2 - 1) * 0.05 * envelope * volume;
            // Clamp to prevent clipping
            noise = Math.max(-1, Math.min(1, noise));

            leftData[i] = noise * leftGain;
            rightData[i] = noise * rightGain;
        }

        this.addBufferTrack(buffer, startTime, 'drawing', volume);
    }

    /**
     * Convert ServerAudioBuffer to WAV format
     */
    exportToWav(buffer: ServerAudioBuffer): Buffer {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const bitDepth = 16;
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        const samples = buffer.length;
        const dataSize = samples * blockAlign;
        const wavSize = 44 + dataSize;

        const wavBuffer = Buffer.alloc(wavSize);

        // RIFF header
        wavBuffer.write('RIFF', 0);
        wavBuffer.writeUInt32LE(wavSize - 8, 4);
        wavBuffer.write('WAVE', 8);

        // fmt chunk
        wavBuffer.write('fmt ', 12);
        wavBuffer.writeUInt32LE(16, 16);
        wavBuffer.writeUInt16LE(1, 20); // PCM
        wavBuffer.writeUInt16LE(numChannels, 22);
        wavBuffer.writeUInt32LE(sampleRate, 24);
        wavBuffer.writeUInt32LE(sampleRate * blockAlign, 28);
        wavBuffer.writeUInt16LE(blockAlign, 32);
        wavBuffer.writeUInt16LE(bitDepth, 34);

        // data chunk
        wavBuffer.write('data', 36);
        wavBuffer.writeUInt32LE(dataSize, 40);

        const offset = 44;
        for (let i = 0; i < samples; i++) {
            for (let channel = 0; channel < numChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
                const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                wavBuffer.writeInt16LE(Math.floor(intSample), offset + (i * blockAlign) + (channel * bytesPerSample));
            }
        }

        return wavBuffer;
    }

    /**
     * Get all tracks as a list of local file paths for FFmpeg
     * Procedural tracks are exported to temporary files.
     */
    async getProcessedTracks(tempDir: string): Promise<Array<{ path: string, startTime: number, volume: number, loop?: boolean }>> {
        const processed: any[] = [];

        // Ensure temp directory exists for procedural WAVs
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Add background music if exists
        if (this.backgroundMusic) {
            processed.push({
                path: this.backgroundMusic.path,
                startTime: 0,
                volume: this.backgroundMusic.volume,
                loop: this.backgroundMusic.loop
            });
        }

        // Add buffer tracks (procedural or pre-loaded)
        for (let i = 0; i < this.audioTracks.length; i++) {
            const track = this.audioTracks[i];

            if (track.audio) {
                const wavBuffer = this.exportToWav(track.audio);
                const fileName = `proc_audio_${Date.now()}_${i}.wav`;
                const filePath = path.join(tempDir, fileName);
                fs.writeFileSync(filePath, wavBuffer);

                processed.push({
                    path: filePath,
                    startTime: track.start / 1000,
                    volume: track.volume
                });
            } else if (track.path) {
                processed.push({
                    path: track.path,
                    startTime: track.start / 1000,
                    volume: track.volume
                });
            }
        }

        return processed;
    }

    /**
     * Process audio configuration for a specific scene or layer
     */
    async processAudioConfig(config: any, currentTime: number = 0.0): Promise<void> {
        if (!config) return;

        // Background music (only if not already set or at start)
        if (config.background_music) {
            const music = typeof config.background_music === 'string' ? { path: config.background_music } : config.background_music;
            this.backgroundMusic = {
                path: music.path,
                volume: music.volume ?? 1.0,
                loop: music.loop ?? true,
                fadeIn: music.fade_in ?? 0,
                fadeOut: music.fade_out ?? 0
            };
        }

        // Sound effects
        if (config.sound_effects) {
            for (const effect of config.sound_effects) {
                const start = (effect.start_time ?? 0) + currentTime;
                this.audioTracks.push({
                    audio: null as any, // Will be handled by VideoExporter if it's a file
                    path: effect.path,
                    start: Math.floor(start * 1000),
                    trackType: 'effect',
                    volume: effect.volume ?? 1.0
                });
            }
        }

        // Voice overs
        if (config.voice_overs) {
            for (const voice of config.voice_overs) {
                const start = (voice.start_time ?? 0) + currentTime;
                this.audioTracks.push({
                    audio: null as any,
                    path: voice.path,
                    start: Math.floor(start * 1000),
                    trackType: 'voiceover',
                    volume: voice.volume ?? 1.0
                });
            }
        }

        // Typewriter sounds
        if (config.typewriter) {
            const tw = config.typewriter;
            const start = (tw.start_time ?? 0) + currentTime;
            await this.generateTypewriterSound(
                start,
                tw.num_characters ?? 10,
                tw.char_interval ?? 0.1,
                tw.volume ?? 0.3
            );
        }

        // Drawing sounds
        if (config.drawing_sound) {
            const ds = config.drawing_sound;
            const start = (ds.start_time ?? 0) + currentTime;
            await this.generateDrawingSound(
                start,
                ds.duration ?? 1.0,
                ds.volume ?? 0.2
            );
        }
    }

    /**
     * Process all audio from a scene and its layers
     */
    async processSceneAudio(scene: any, sceneStartTime: number, viewportWidth: number = 800): Promise<void> {
        const config = scene.getConfig();

        // Scene level
        if (config.audio) {
            await this.processAudioConfig(config.audio, sceneStartTime);
        }

        // Layer level (automatic procedural sounds can be added here)
        if (config.layers) {
            for (const layer of config.layers) {
                // Calculate pan based on layer X position if available
                const lx = layer.position?.x ?? (viewportWidth / 2);
                const pan = Math.max(-1, Math.min(1, (lx - viewportWidth / 2) / (viewportWidth / 2)));

                // If a layer has explicit audio config
                if (layer.audio) {
                    await this.processAudioConfig(layer.audio, sceneStartTime + (layer.entrance_animation?.delay || 0));
                }

                // Automatic typewriter sound for text layers if enabled
                if (layer.textConfig?.strokeAnimation?.mode === 'typewriter') {
                    const duration = layer.textConfig.strokeAnimation.duration || layer.entrance_animation?.duration || 2;
                    const numChars = layer.textConfig.text.length;
                    const delay = layer.entrance_animation?.delay || 0;
                    await this.generateTypewriterSound(
                        sceneStartTime + delay,
                        numChars,
                        duration / numChars,
                        0.3,
                        pan
                    );
                }
            }
        }
    }
}

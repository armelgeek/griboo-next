/**
 * Audio Manager Module for Kivg Core
 * 
 * Provides comprehensive audio support for whiteboard animations.
 * This is the centralized audio module for the Griboo engine.
 * 
 * Features:
 * - Background music loading and looping
 * - Sound effects synchronized with animations
 * - Voice-over/narration support
 * - Typewriter sounds for text animations
 * - Drawing sounds for whiteboard effects
 * - Audio/video synchronization
 * - Multi-track audio mixing
 * - Volume control per element
 * - Fade in/out effects
 * 
 * Note: This module uses the Web Audio API for browser-based audio processing.
 * 
 * Usage:
 *     import { AudioManager, processAudioConfig } from './core/audio';
 *     
 *     const audio = new AudioManager(30); // 30 fps
 *     
 *     await audio.loadBackgroundMusic('music.mp3', { volume: 0.5, loop: true });
 *     await audio.addVoiceOver('narration.mp3', 0.0);
 *     await audio.addSoundEffect('pop.wav', 2.5);
 *     
 *     const mixedAudio = audio.getAudioBuffer();
 */

/**
 * Represents a single audio track with timing information.
 */
export interface AudioTrack {
    audio: AudioBuffer;
    start: number; // Start time in milliseconds
    trackType: 'effect' | 'voiceover' | 'typewriter' | 'drawing';
    volume: number;
    duration?: number; // Duration in milliseconds
}

/**
 * Configuration for background music.
 */
export interface BackgroundMusicConfig {
    path: string;
    volume: number;
    loop: boolean;
    fadeIn: number; // Seconds
    fadeOut: number; // Seconds
}

/**
 * Configuration for a sound effect.
 */
export interface SoundEffectConfig {
    path: string;
    startTime: number; // Seconds
    volume: number;
    duration?: number; // Seconds
}

/**
 * Configuration for voice-over/narration.
 */
export interface VoiceOverConfig {
    path: string;
    startTime: number; // Seconds
    volume: number;
}

/**
 * Configuration for typewriter sounds.
 */
export interface TypewriterConfig {
    startTime: number; // Seconds
    numCharacters: number;
    charInterval: number; // Seconds between keystrokes
    volume: number;
}

/**
 * Configuration for drawing sounds.
 */
export interface DrawingSoundConfig {
    startTime: number; // Seconds
    duration: number; // Seconds
    volume: number;
}

/**
 * Audio configuration for processing.
 */
export interface AudioConfig {
    file_path?: string;
    volume?: number;
    background_music?: string | {
        path: string;
        volume?: number;
        loop?: boolean;
        fade_in?: number;
        fade_out?: number;
    };
    sound_effects?: Array<{
        path: string;
        start_time?: number;
        volume?: number;
        duration?: number;
    }>;
    voice_overs?: Array<{
        path: string;
        start_time?: number;
        volume?: number;
    }>;
    typewriter?: {
        start_time?: number;
        num_characters?: number;
        char_interval?: number;
        volume?: number;
    };
    drawing_sound?: {
        start_time?: number;
        duration?: number;
        volume?: number;
    };
}

/**
 * Manages all audio aspects of whiteboard animation.
 * 
 * This class provides a unified interface for:
 * - Loading and mixing audio tracks
 * - Adding background music, sound effects, and voice-overs
 * - Generating procedural sounds (typewriter, drawing)
 * - Exporting mixed audio for video integration
 */
export class AudioManager {
    frameRate: number;
    sampleRate: number;
    audioTracks: AudioTrack[];
    backgroundMusic: AudioBuffer | null;
    totalDurationMs: number;
    private audioContext: AudioContext | null;
    private sourceNode: AudioBufferSourceNode | null = null;
    private mixedBuffer: AudioBuffer | null = null;

    // Multi-threading
    private mixerWorker: Worker | null = null;
    private isWorkerSupported: boolean = typeof Worker !== 'undefined';
    private playbackStartTime: number = 0;
    private playbackOffset: number = 0;
    private isPlaying: boolean = false;

    /**
     * Initialize the Audio Manager.
     * 
     * @param frameRate - Video frame rate (frames per second)
     * @param sampleRate - Audio sample rate (Hz)
     */
    constructor(frameRate: number = 30, sampleRate: number = 44100) {
        this.frameRate = frameRate;
        this.sampleRate = sampleRate;
        this.audioTracks = [];
        this.backgroundMusic = null;
        this.totalDurationMs = 0;
        this.audioContext = null;

        // Initialize AudioContext lazily
        console.log(`🎵 AudioManager initialized: frameRate=${frameRate}, sampleRate=${sampleRate}`);
    }

    /**
     * Get or create AudioContext.
     */
    private getAudioContext(): AudioContext {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        return this.audioContext;
    }

    /**
     * Check if audio functionality is available.
     */
    static isAvailable(): boolean {
        return typeof window !== 'undefined' &&
            (window.AudioContext !== undefined || (window as any).webkitAudioContext !== undefined);
    }

    /**
     * Set the total duration of the video.
     * 
     * @param durationSeconds - Total video duration in seconds
     */
    setTotalDuration(durationSeconds: number): void {
        this.totalDurationMs = Math.floor(durationSeconds * 1000);
    }

    /**
     * Load audio from a URL.
     * 
     * @param url - URL to the audio file
     * @returns Promise resolving to AudioBuffer or null
     */
    private async loadAudioFromUrl(url: string): Promise<AudioBuffer | null> {
        try {
            let arrayBuffer: ArrayBuffer;

            // Use HTTP loader for remote URLs
            if (url.startsWith('http://') || url.startsWith('https://')) {
                const { getGlobalCache } = await import('../../utils/asset_cache');
                const { fetchBlob } = await import('../../utils/http_loader');

                const cache = getGlobalCache();
                const cachedBlob = await cache.get(url);

                if (cachedBlob) {
                    arrayBuffer = await cachedBlob.arrayBuffer();
                } else {
                    const fetchedBlob = await fetchBlob(url, { retries: 3, timeout: 30000 });
                    await cache.set(url, fetchedBlob);
                    arrayBuffer = await fetchedBlob.arrayBuffer();
                }
            } else {
                // Local path - use standard fetch
                const response = await fetch(url);
                if (!response.ok) {
                    console.warn(`⚠️ Failed to fetch audio: ${url}`);
                    return null;
                }
                arrayBuffer = await response.arrayBuffer();
            }

            const audioContext = this.getAudioContext();
            return await audioContext.decodeAudioData(arrayBuffer);
        } catch (error) {
            console.error(`❌ Error loading audio from ${url}:`, error);
            return null;
        }
    }

    /**
     * Apply volume adjustment to an AudioBuffer.
     * 
     * @param buffer - Source AudioBuffer
     * @param volume - Volume multiplier (0.0 to 1.0)
     * @returns New AudioBuffer with adjusted volume
     */
    private applyVolume(buffer: AudioBuffer, volume: number): AudioBuffer {
        if (volume === 1.0) return buffer;

        const audioContext = this.getAudioContext();
        const newBuffer = audioContext.createBuffer(
            buffer.numberOfChannels,
            buffer.length,
            buffer.sampleRate
        );

        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const inputData = buffer.getChannelData(channel);
            const outputData = newBuffer.getChannelData(channel);
            for (let i = 0; i < inputData.length; i++) {
                outputData[i] = inputData[i] * volume;
            }
        }

        return newBuffer;
    }

    /**
     * Apply fade in effect to an AudioBuffer.
     * 
     * @param buffer - Source AudioBuffer
     * @param fadeInSeconds - Fade in duration in seconds
     * @returns Modified AudioBuffer with fade in
     */
    private applyFadeIn(buffer: AudioBuffer, fadeInSeconds: number): AudioBuffer {
        if (fadeInSeconds <= 0) return buffer;

        const fadeInSamples = Math.floor(fadeInSeconds * buffer.sampleRate);

        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const data = buffer.getChannelData(channel);
            for (let i = 0; i < Math.min(fadeInSamples, data.length); i++) {
                const fadeMultiplier = i / fadeInSamples;
                data[i] *= fadeMultiplier;
            }
        }

        return buffer;
    }

    /**
     * Apply fade out effect to an AudioBuffer.
     * 
     * @param buffer - Source AudioBuffer
     * @param fadeOutSeconds - Fade out duration in seconds
     * @returns Modified AudioBuffer with fade out
     */
    private applyFadeOut(buffer: AudioBuffer, fadeOutSeconds: number): AudioBuffer {
        if (fadeOutSeconds <= 0) return buffer;

        const fadeOutSamples = Math.floor(fadeOutSeconds * buffer.sampleRate);
        const startSample = buffer.length - fadeOutSamples;

        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const data = buffer.getChannelData(channel);
            for (let i = Math.max(0, startSample); i < data.length; i++) {
                const fadeProgress = (i - startSample) / fadeOutSamples;
                const fadeMultiplier = 1 - fadeProgress;
                data[i] *= fadeMultiplier;
            }
        }

        return buffer;
    }

    /**
     * Loop an AudioBuffer to a specified duration.
     * 
     * @param buffer - Source AudioBuffer
     * @param targetDurationMs - Target duration in milliseconds
     * @returns New AudioBuffer looped to target duration
     */
    private loopBuffer(buffer: AudioBuffer, targetDurationMs: number): AudioBuffer {
        const targetSamples = Math.floor((targetDurationMs / 1000) * buffer.sampleRate);

        if (buffer.length >= targetSamples) {
            // Trim to target duration
            const audioContext = this.getAudioContext();
            const newBuffer = audioContext.createBuffer(
                buffer.numberOfChannels,
                targetSamples,
                buffer.sampleRate
            );

            for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
                const inputData = buffer.getChannelData(channel);
                const outputData = newBuffer.getChannelData(channel);
                for (let i = 0; i < targetSamples; i++) {
                    outputData[i] = inputData[i];
                }
            }

            return newBuffer;
        }

        // Loop to target duration
        const audioContext = this.getAudioContext();
        const newBuffer = audioContext.createBuffer(
            buffer.numberOfChannels,
            targetSamples,
            buffer.sampleRate
        );

        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const inputData = buffer.getChannelData(channel);
            const outputData = newBuffer.getChannelData(channel);
            for (let i = 0; i < targetSamples; i++) {
                outputData[i] = inputData[i % inputData.length];
            }
        }

        return newBuffer;
    }

    /**
     * Load background music for the video.
     * 
     * @param musicPath - Path to the music file (mp3, wav, ogg, etc.)
     * @param options - Optional configuration
     * @returns Promise resolving to true if successful, false otherwise
     */
    async loadBackgroundMusic(
        musicPath: string,
        options: {
            volume?: number;
            loop?: boolean;
            fadeIn?: number;
            fadeOut?: number;
        } = {}
    ): Promise<boolean> {
        const { volume = 1.0, loop = true, fadeIn = 0, fadeOut = 0 } = options;

        try {
            let music = await this.loadAudioFromUrl(musicPath);
            if (!music) return false;

            // Apply volume
            if (volume !== 1.0) {
                music = this.applyVolume(music, volume);
            }

            // Loop if necessary
            if (loop && this.totalDurationMs > 0) {
                music = this.loopBuffer(music, this.totalDurationMs);
            }

            // Apply fade effects
            if (fadeIn > 0) {
                music = this.applyFadeIn(music, fadeIn);
            }

            if (fadeOut > 0) {
                music = this.applyFadeOut(music, fadeOut);
            }

            this.backgroundMusic = music;
            console.log(`✅ Background music loaded: ${musicPath}`);
            console.log(`   Duration: ${(music.length / music.sampleRate).toFixed(2)}s, Channels: ${music.numberOfChannels}`);
            return true;

        } catch (error) {
            console.error(`❌ Error loading background music:`, error);
            return false;
        }
    }

    /**
     * Add a sound effect at a specific time.
     * 
     * @param soundPath - Path to the sound file
     * @param startTime - When to play the sound (seconds from video start)
     * @param volume - Volume multiplier (0.0 to 1.0)
     * @param duration - Optional duration to trim/extend the sound
     * @returns Promise resolving to true if successful, false otherwise
     */
    async addSoundEffect(
        soundPath: string,
        startTime: number,
        volume: number = 1.0,
        duration?: number
    ): Promise<boolean> {
        try {
            let sound = await this.loadAudioFromUrl(soundPath);
            if (!sound) return false;

            // Apply volume
            if (volume !== 1.0) {
                sound = this.applyVolume(sound, volume);
            }

            // Trim if duration specified
            if (duration !== undefined) {
                const durationSamples = Math.floor(duration * sound.sampleRate);
                if (sound.length > durationSamples) {
                    const audioContext = this.getAudioContext();
                    const newBuffer = audioContext.createBuffer(
                        sound.numberOfChannels,
                        durationSamples,
                        sound.sampleRate
                    );

                    for (let channel = 0; channel < sound.numberOfChannels; channel++) {
                        const inputData = sound.getChannelData(channel);
                        const outputData = newBuffer.getChannelData(channel);
                        for (let i = 0; i < durationSamples; i++) {
                            outputData[i] = inputData[i];
                        }
                    }
                    sound = newBuffer;
                }
            }

            // Store with timing information
            this.audioTracks.push({
                audio: sound,
                start: Math.floor(startTime * 1000),
                trackType: 'effect',
                volume
            });

            console.log(`✅ Sound effect added: ${soundPath.split('/').pop()} at ${startTime.toFixed(2)}s`);
            return true;

        } catch (error) {
            console.error(`❌ Error adding sound effect:`, error);
            return false;
        }
    }

    /**
     * Add voice-over/narration at a specific time.
     * 
     * @param voicePath - Path to the voice file
     * @param startTime - When to play the voice (seconds from video start)
     * @param volume - Volume multiplier (0.0 to 1.0)
     * @returns Promise resolving to true if successful, false otherwise
     */
    async addVoiceOver(
        voicePath: string,
        startTime: number,
        volume: number = 1.0
    ): Promise<boolean> {
        try {
            let voice = await this.loadAudioFromUrl(voicePath);
            if (!voice) return false;

            // Apply volume
            if (volume !== 1.0) {
                voice = this.applyVolume(voice, volume);
            }

            // Store with timing information
            this.audioTracks.push({
                audio: voice,
                start: Math.floor(startTime * 1000),
                trackType: 'voiceover',
                volume
            });

            console.log(`✅ Voice-over added: ${voicePath.split('/').pop()} at ${startTime.toFixed(2)}s`);
            return true;

        } catch (error) {
            console.error(`❌ Error adding voice-over:`, error);
            return false;
        }
    }

    /**
     * Generate typewriter sound effects for text animations.
     * 
     * @param startTime - When to start the typewriter sound
     * @param numCharacters - Number of characters being typed
     * @param charInterval - Time between each keystroke (seconds)
     * @param volume - Volume multiplier (0.0 to 1.0)
     * @returns Promise resolving to true if successful, false otherwise
     */
    async generateTypewriterSound(
        startTime: number,
        numCharacters: number,
        charInterval: number = 0.1,
        volume: number = 0.3
    ): Promise<boolean> {
        try {
            const audioContext = this.getAudioContext();
            const clickDuration = 0.05; // 50ms click
            const totalDuration = numCharacters * charInterval + clickDuration;
            const totalSamples = Math.floor(totalDuration * this.sampleRate);

            const buffer = audioContext.createBuffer(1, totalSamples, this.sampleRate);
            const data = buffer.getChannelData(0);

            for (let i = 0; i < numCharacters; i++) {
                const startSample = Math.floor(i * charInterval * this.sampleRate);
                const clickSamples = Math.floor(clickDuration * this.sampleRate);

                for (let j = 0; j < clickSamples && startSample + j < totalSamples; j++) {
                    // Generate a short noise burst with envelope
                    const envelope = Math.max(0, 1 - (j / clickSamples));
                    const noise = (Math.random() * 2 - 1) * 0.2 * envelope * volume;
                    data[startSample + j] = noise;
                }
            }

            // Store with timing information
            this.audioTracks.push({
                audio: buffer,
                start: Math.floor(startTime * 1000),
                trackType: 'typewriter',
                volume
            });

            console.log(`✅ Typewriter sound generated: ${numCharacters} chars at ${startTime.toFixed(2)}s`);
            return true;

        } catch (error) {
            console.error(`❌ Error generating typewriter sound:`, error);
            return false;
        }
    }

    /**
     * Generate drawing/sketching sound effects for animations.
     * 
     * @param startTime - When to start the drawing sound
     * @param duration - How long the drawing lasts (seconds)
     * @param volume - Volume multiplier (0.0 to 1.0)
     * @returns Promise resolving to true if successful, false otherwise
     */
    async generateDrawingSound(
        startTime: number,
        duration: number,
        volume: number = 0.2
    ): Promise<boolean> {
        try {
            const audioContext = this.getAudioContext();
            const totalSamples = Math.floor(duration * this.sampleRate);

            const buffer = audioContext.createBuffer(1, totalSamples, this.sampleRate);
            const data = buffer.getChannelData(0);

            // Generate low-level continuous noise to simulate drawing
            const fadeInSamples = Math.floor(0.1 * this.sampleRate); // 100ms fade in
            const fadeOutSamples = Math.floor(0.2 * this.sampleRate); // 200ms fade out
            const fadeOutStart = totalSamples - fadeOutSamples;

            for (let i = 0; i < totalSamples; i++) {
                let envelope = 1.0;

                // Fade in
                if (i < fadeInSamples) {
                    envelope = i / fadeInSamples;
                }

                // Fade out
                if (i >= fadeOutStart) {
                    envelope = 1 - ((i - fadeOutStart) / fadeOutSamples);
                }

                // Low-level noise
                const noise = (Math.random() * 2 - 1) * 0.05 * envelope * volume;
                data[i] = noise;
            }

            // Store with timing information
            this.audioTracks.push({
                audio: buffer,
                start: Math.floor(startTime * 1000),
                trackType: 'drawing',
                volume
            });

            console.log(`✅ Drawing sound generated: ${duration.toFixed(2)}s at ${startTime.toFixed(2)}s`);
            return true;

        } catch (error) {
            console.error(`❌ Error generating drawing sound:`, error);
            return false;
        }
    }

    /**
     * Mix all audio tracks together using a Web Worker if available.
     * 
     * @returns Promise resolving to mixed audio as AudioBuffer, or null if no audio
     */
    async mixAudioAsync(): Promise<AudioBuffer | null> {
        if (!this.backgroundMusic && this.audioTracks.length === 0) {
            return null;
        }

        if (!this.isWorkerSupported) {
            return this.mixAudio();
        }

        try {
            // Prepare data for worker
            const totalSamples = Math.floor((this.totalDurationMs / 1000) * this.sampleRate);
            const numChannels = this.backgroundMusic?.numberOfChannels ??
                (this.audioTracks.length > 0 ? this.audioTracks[0].audio.numberOfChannels : 2);

            const tracksData = this.audioTracks.map(t => ({
                startOffsetSamples: (t.start / 1000) * this.sampleRate,
                channels: Array.from({ length: t.audio.numberOfChannels }, (_, c) => t.audio.getChannelData(c))
            }));

            const bgMusicData = this.backgroundMusic ? {
                channels: Array.from({ length: this.backgroundMusic.numberOfChannels }, (_, c) => this.backgroundMusic!.getChannelData(c))
            } : null;

            // Initialize worker
            if (!this.mixerWorker) {
                // @ts-ignore
                this.mixerWorker = new Worker(new URL('../../workers/audio-mixer.worker.ts', import.meta.url), { type: 'module' });
            }

            return new Promise((resolve) => {
                this.mixerWorker!.onmessage = (e) => {
                    const { type, payload } = e.data;
                    if (type === 'MIX_COMPLETED') {
                        const { channels, numChannels, totalSamples, sampleRate } = payload;
                        const audioContext = this.getAudioContext();
                        const mixed = audioContext.createBuffer(numChannels, totalSamples, sampleRate);

                        for (let c = 0; c < numChannels; c++) {
                            mixed.getChannelData(c).set(channels[c]);
                        }

                        resolve(mixed);
                    }
                };

                this.mixerWorker!.onerror = (err) => {
                    console.warn('[AudioManager] Mixer worker error, falling back:', err);
                    this.isWorkerSupported = false;
                    resolve(this.mixAudio());
                };

                // Post message with transferables
                const transferables: any[] = [];
                tracksData.forEach(t => t.channels.forEach(ch => transferables.push(ch.buffer)));
                if (bgMusicData) bgMusicData.channels.forEach(ch => transferables.push(ch.buffer));

                this.mixerWorker!.postMessage({
                    tracks: tracksData,
                    bgMusic: bgMusicData,
                    totalSamples,
                    numChannels,
                    sampleRate: this.sampleRate
                }, transferables);
            });
        } catch (err) {
            console.warn('[AudioManager] Failed to use mixer worker:', err);
            return this.mixAudio();
        }
    }

    mixAudio(): AudioBuffer | null {
        if (!this.backgroundMusic && this.audioTracks.length === 0) {
            console.log('ℹ️ No audio to mix');
            return null;
        }

        try {
            const audioContext = this.getAudioContext();

            // Calculate total duration
            let totalDurationMs = this.totalDurationMs;
            if (totalDurationMs === 0) {
                // Calculate from all tracks
                if (this.backgroundMusic) {
                    totalDurationMs = Math.floor((this.backgroundMusic.length / this.backgroundMusic.sampleRate) * 1000);
                }
                for (const track of this.audioTracks) {
                    const trackEnd = track.start + Math.floor((track.audio.length / track.audio.sampleRate) * 1000);
                    totalDurationMs = Math.max(totalDurationMs, trackEnd);
                }
            }

            const totalSamples = Math.floor((totalDurationMs / 1000) * this.sampleRate);
            const numChannels = this.backgroundMusic?.numberOfChannels ??
                (this.audioTracks.length > 0 ? this.audioTracks[0].audio.numberOfChannels : 2);

            // Create output buffer
            const mixed = audioContext.createBuffer(numChannels, totalSamples, this.sampleRate);

            // Start with background music if present
            if (this.backgroundMusic) {
                for (let channel = 0; channel < Math.min(numChannels, this.backgroundMusic.numberOfChannels); channel++) {
                    const mixedData = mixed.getChannelData(channel);
                    const bgData = this.backgroundMusic.getChannelData(channel);
                    for (let i = 0; i < Math.min(totalSamples, bgData.length); i++) {
                        mixedData[i] = bgData[i];
                    }
                }
            }

            // Overlay all tracks
            for (const track of this.audioTracks) {
                const startSample = Math.floor((track.start / 1000) * this.sampleRate);

                for (let channel = 0; channel < Math.min(numChannels, track.audio.numberOfChannels); channel++) {
                    const mixedData = mixed.getChannelData(channel);
                    const trackData = track.audio.getChannelData(channel);

                    for (let i = 0; i < trackData.length && startSample + i < totalSamples; i++) {
                        if (startSample + i >= 0) {
                            mixedData[startSample + i] += trackData[i];
                        }
                    }
                }
            }

            // Improved normalization with soft clipping to prevent harsh distortion
            // Peak normalization first
            let maxAmplitude = 0;
            for (let channel = 0; channel < numChannels; channel++) {
                const data = mixed.getChannelData(channel);
                for (let i = 0; i < data.length; i++) {
                    maxAmplitude = Math.max(maxAmplitude, Math.abs(data[i]));
                }
            }

            if (maxAmplitude > 0.95) {
                // Apply a hybrid approach: moderate peak reduction + soft clipping
                // This ensures we keep good volume while smoothing out peaks
                const peakReduction = Math.min(1.0, 0.95 / maxAmplitude);

                for (let channel = 0; channel < numChannels; channel++) {
                    const data = mixed.getChannelData(channel);
                    for (let i = 0; i < data.length; i++) {
                        // 1. Initial gain reduction
                        let sample = data[i] * peakReduction;

                        // 2. Soft clipping (using a soft-knee tanh-like function if still high)
                        // This prevents internal clipping if maxAmplitude was very high
                        if (Math.abs(sample) > 0.8) {
                            if (sample > 0) {
                                sample = 0.8 + (1.0 - 0.8) * Math.tanh((sample - 0.8) / (1.0 - 0.8));
                            } else {
                                sample = -0.8 - (1.0 - 0.8) * Math.tanh((-sample - 0.8) / (1.0 - 0.8));
                            }
                        }

                        data[i] = sample;
                    }
                }
            }

            console.log(`✅ Audio mixed: ${(totalDurationMs / 1000).toFixed(2)}s total`);
            return mixed;

        } catch (error) {
            console.error(`❌ Error mixing audio:`, error);
            return null;
        }
    }

    /**
     * Export the mixed audio as a WAV Blob.
     * 
     * @returns Promise resolving to WAV Blob or null
     */
    async exportAudioAsWav(): Promise<Blob | null> {
        const mixed = this.mixAudio();
        if (!mixed) return null;

        try {
            // Convert AudioBuffer to WAV
            const wavBlob = audioBufferToWav(mixed);
            console.log(`✅ Audio exported as WAV: ${(wavBlob.size / 1024).toFixed(2)} KB`);
            return wavBlob;
        } catch (error) {
            console.error(`❌ Error exporting audio:`, error);
            return null;
        }
    }

    /**
     * Get the final mixed audio ready for video encoding.
     * 
     * @returns Mixed audio as AudioBuffer, or null if no audio
     */
    getAudioBuffer(): AudioBuffer | null {
        return this.mixAudio();
    }

    /**
     * Play the mixed audio.
     * 
     * @param offsetSeconds - Offset from where to start playback
     * @returns Promise resolving when playback starts
     */
    async play(offsetSeconds: number = 0): Promise<void> {
        if (!this.mixedBuffer) {
            this.mixedBuffer = await this.mixAudioAsync();
        }

        if (!this.mixedBuffer) return;

        // Stop current playback if any
        this.stop();

        const audioContext = this.getAudioContext();

        // Ensure AudioContext is resumed (browser policy)
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        this.sourceNode = audioContext.createBufferSource();
        this.sourceNode.buffer = this.mixedBuffer;
        this.sourceNode.connect(audioContext.destination);

        const startTime = audioContext.currentTime;
        this.sourceNode.start(0, offsetSeconds);

        this.playbackStartTime = startTime;
        this.playbackOffset = offsetSeconds;
        this.isPlaying = true;

        this.sourceNode.onended = () => {
            if (this.isPlaying) {
                this.isPlaying = false;
                this.sourceNode = null;
            }
        };
    }

    /**
     * Pause the audio playback.
     */
    pause(): void {
        if (!this.isPlaying || !this.sourceNode) return;

        const audioContext = this.getAudioContext();
        this.playbackOffset += (audioContext.currentTime - this.playbackStartTime);

        this.stop();
    }

    /**
     * Stop the audio playback.
     */
    stop(): void {
        if (this.sourceNode) {
            try {
                this.sourceNode.stop();
            } catch (e) {
                // Ignore if already stopped
            }
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
        this.isPlaying = false;
    }

    /**
     * Seek to a specific time in the audio.
     * 
     * @param timeSeconds - Time to seek to
     */
    async seek(timeSeconds: number): Promise<void> {
        const wasPlaying = this.isPlaying;
        this.stop();
        this.playbackOffset = timeSeconds;

        if (wasPlaying) {
            await this.play(timeSeconds);
        }
    }

    /**
     * Clear all audio tracks.
     */
    clear(): void {
        this.audioTracks = [];
        this.backgroundMusic = null;
        this.totalDurationMs = 0;
    }
}

/**
 * Convert AudioBuffer to WAV Blob.
 * 
 * @param buffer - AudioBuffer to convert
 * @returns WAV Blob
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    const samples = buffer.length;
    const dataSize = samples * blockAlign;
    const wavSize = 44 + dataSize;

    const wavBuffer = new ArrayBuffer(wavSize);
    const view = new DataView(wavBuffer);

    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, wavSize - 8, true);
    writeString(view, 8, 'WAVE');

    // fmt chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Chunk size
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    // data chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write interleaved samples
    const channels: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) {
        channels.push(buffer.getChannelData(c));
    }

    let offset = 44;
    for (let i = 0; i < samples; i++) {
        for (let c = 0; c < numChannels; c++) {
            const sample = Math.max(-1, Math.min(1, channels[c][i]));
            const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, intSample, true);
            offset += 2;
        }
    }

    return new Blob([wavBuffer], { type: 'audio/wav' });
}

/**
 * Write a string to a DataView at a specific offset.
 */
function writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

/**
 * Process audio configuration and add to audio manager.
 * 
 * @param audioConfig - Audio configuration object
 * @param audioManager - AudioManager instance to add audio to
 * @param currentTime - Current time in video (seconds) for relative timing
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function processAudioConfig(
    audioConfig: AudioConfig,
    audioManager: AudioManager,
    currentTime: number = 0.0
): Promise<boolean> {
    if (!audioConfig) {
        return true;
    }

    let success = true;

    // Process simple file_path format
    if (audioConfig.file_path) {
        const path = audioConfig.file_path;
        const volume = audioConfig.volume ?? 1.0;

        // Skip blob URLs
        if (path.startsWith('blob:')) {
            console.log(`⚠️ Skipping blob URL audio: ${path}`);
            return true;
        }

        success = await audioManager.addVoiceOver(path, currentTime, volume);
    }

    // Process background music
    if (audioConfig.background_music) {
        const musicCfg = audioConfig.background_music;
        if (typeof musicCfg === 'string') {
            success = success && await audioManager.loadBackgroundMusic(musicCfg);
        } else {
            const path = musicCfg.path;
            const volume = musicCfg.volume ?? 1.0;
            const loop = musicCfg.loop ?? true;
            const fadeIn = musicCfg.fade_in ?? 0;
            const fadeOut = musicCfg.fade_out ?? 0;
            success = success && await audioManager.loadBackgroundMusic(path, {
                volume,
                loop,
                fadeIn,
                fadeOut
            });
        }
    }

    // Process sound effects
    if (audioConfig.sound_effects) {
        for (const effect of audioConfig.sound_effects) {
            const path = effect.path;
            const start = effect.start_time ?? currentTime;
            const volume = effect.volume ?? 1.0;
            const duration = effect.duration;
            success = success && await audioManager.addSoundEffect(path, start, volume, duration);
        }
    }

    // Process voice-overs
    if (audioConfig.voice_overs) {
        for (const voice of audioConfig.voice_overs) {
            const path = voice.path;
            const start = voice.start_time ?? currentTime;
            const volume = voice.volume ?? 1.0;
            success = success && await audioManager.addVoiceOver(path, start, volume);
        }
    }

    // Process typewriter sounds
    if (audioConfig.typewriter) {
        const twCfg = audioConfig.typewriter;
        const start = twCfg.start_time ?? currentTime;
        const numChars = twCfg.num_characters ?? 10;
        const interval = twCfg.char_interval ?? 0.1;
        const volume = twCfg.volume ?? 0.3;
        success = success && await audioManager.generateTypewriterSound(start, numChars, interval, volume);
    }

    // Process drawing sounds
    if (audioConfig.drawing_sound) {
        const drawCfg = audioConfig.drawing_sound;
        const start = drawCfg.start_time ?? currentTime;
        const duration = drawCfg.duration ?? 1.0;
        const volume = drawCfg.volume ?? 0.2;
        success = success && await audioManager.generateDrawingSound(start, duration, volume);
    }

    return success;
}

/**
 * Process audio configuration for a specific slide.
 * 
 * @param slideConfig - Slide configuration object
 * @param audioManager - AudioManager instance
 * @param slideStartTime - Start time of this slide in the video (seconds)
 * @returns Promise resolving to true if successful, false otherwise
 */
export async function processSlideAudio(
    slideConfig: {
        audio?: AudioConfig;
        layers?: Array<{ audio?: AudioConfig }>;
    },
    audioManager: AudioManager,
    slideStartTime: number = 0.0
): Promise<boolean> {
    if (!slideConfig) {
        return true;
    }

    let success = true;

    // Process slide-level audio
    if (slideConfig.audio) {
        success = success && await processAudioConfig(slideConfig.audio, audioManager, slideStartTime);
    }

    // Process layer-level audio
    if (slideConfig.layers) {
        for (const layer of slideConfig.layers) {
            if (layer.audio) {
                success = success && await processAudioConfig(layer.audio, audioManager, slideStartTime);
            }
        }
    }

    return success;
}

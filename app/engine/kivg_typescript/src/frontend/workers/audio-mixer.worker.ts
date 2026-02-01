/**
 * Web Worker for offloading expensive audio mixing operations.
 */

self.onmessage = (e: MessageEvent) => {
    const { tracks, bgMusic, totalSamples, numChannels, sampleRate } = e.data;

    // Create target interleaved or separate buffers
    const outputBuffers = new Array(numChannels);
    for (let c = 0; c < numChannels; c++) {
        outputBuffers[c] = new Float32Array(totalSamples);
    }

    // 1. Mix background music
    if (bgMusic) {
        const bgData = bgMusic.channels; // Array of Float32Array
        for (let c = 0; c < Math.min(numChannels, bgData.length); c++) {
            const out = outputBuffers[c];
            const src = bgData[c];
            const len = Math.min(totalSamples, src.length);
            for (let i = 0; i < len; i++) {
                out[i] = src[i];
            }
        }
    }

    // 2. Mix tracks
    for (const track of tracks) {
        const startSample = Math.floor(track.startOffsetSamples);
        const trackData = track.channels; // Array of Float32Array

        for (let c = 0; c < Math.min(numChannels, trackData.length); c++) {
            const out = outputBuffers[c];
            const src = trackData[c];
            const srcLen = src.length;

            for (let i = 0; i < srcLen && startSample + i < totalSamples; i++) {
                if (startSample + i >= 0) {
                    out[startSample + i] += src[i];
                }
            }
        }
    }

    // 3. Normalization & Soft Clipping
    let maxAmplitude = 0;
    for (let c = 0; c < numChannels; c++) {
        const data = outputBuffers[c];
        for (let i = 0; i < data.length; i++) {
            const abs = Math.abs(data[i]);
            if (abs > maxAmplitude) maxAmplitude = abs;
        }
    }

    if (maxAmplitude > 0.95) {
        const peakReduction = 0.95 / maxAmplitude;
        for (let c = 0; c < numChannels; c++) {
            const data = outputBuffers[c];
            for (let i = 0; i < data.length; i++) {
                let sample = data[i] * peakReduction;
                // Soft clipping
                if (Math.abs(sample) > 0.8) {
                    if (sample > 0) {
                        sample = 0.8 + (1.0 - 0.8) * Math.tanh((sample - 0.8) / (0.2));
                    } else {
                        sample = -0.8 - (1.0 - 0.8) * Math.tanh((-sample - 0.8) / (0.2));
                    }
                }
                data[c] = sample;
            }
        }
    }

    // Return the buffers
    const transferables = outputBuffers.map(b => b.buffer);
    (self as any).postMessage({
        type: 'MIX_COMPLETED',
        payload: {
            channels: outputBuffers,
            numChannels,
            totalSamples,
            sampleRate
        }
    }, transferables);
};

import { ServerTextLayer } from '../src/server/layers/text_layer';
import { LayerConfig } from '../src/shared/types';
import { createCanvas } from 'canvas';

async function debugTypewriterCutoff() {
    const text = 'Layer 1 - Should animate for 2 seconds';
    const config: LayerConfig = {
        id: 'test',
        type: 'text',
        textConfig: {
            text: text,
            fontSize: 50,
            fontFamily: 'Arial'
        },
        entrance_animation: {
            type: 'typewriter',
            duration: 1.0 // 1 second for simplicity
        }
    };

    const layer = new ServerTextLayer(config);
    // @ts-ignore - access private for testing
    layer.absoluteTiming = {
        entranceDelay: 0,
        animationDuration: 1.0,
        pauseDuration: 0,
        occlusionDuration: 0,
        exitDuration: 0,
        totalDuration: 1.0
    };

    const canvas = createCanvas(1920, 1080);
    const ctx = canvas.getContext('2d');

    console.log(`📝 Text length: ${text.length}`);
    console.log(`📝 Last character: "${text[text.length - 1]}"`);

    const times = [0.9, 0.95, 0.966, 0.99, 0.999, 1.0, 1.00001];

    for (const time of times) {
        const progress = layer.getAnimationProgress(time);
        // @ts-ignore
        const charCount = Math.ceil(progress * text.length + 0.5);
        const visibleText = text.substring(0, charCount);
        const isVisible = layer.isVisible(time);

        console.log(`t=${time.toFixed(4)}s | progress=${progress.toFixed(6)} | charCount=${charCount} | visible="${visibleText}" | isVisible=${isVisible}`);
    }
}

debugTypewriterCutoff().catch(console.error);

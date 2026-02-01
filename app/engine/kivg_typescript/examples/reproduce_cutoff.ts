import { ServerScene } from '../src/server/core/scene';
import { SceneConfig, LayerConfig } from '../src/shared/types';

async function reproduceCutoff() {
    console.log('🧪 Reproducing Typewriter Cutoff Bug\n');

    const text = 'Layer 1 - Should animate for 2 seconds';
    const scene: SceneConfig = {
        id: 'test-scene',
        timingConfig: { drawSpeed: 2.0 },
        layers: [
            {
                id: 'text1',
                type: 'text',
                textConfig: {
                    text: text,
                    fontSize: 50
                },
                entrance_animation: {
                    type: 'typewriter',
                    duration: 2.0
                }
            } as LayerConfig
        ]
    };

    const serverScene = new ServerScene(scene, 1920, 1080);
    await serverScene.prepare();

    const layer = serverScene['layers'][0];
    const fps = 30;

    console.log(`Text length: ${text.length}`);
    console.log(`Expected duration (scaled): 1.0s`);
    console.log('\nChecking frames around the end of animation:');

    // Check frames around t=1.0s
    for (let f = 28; f <= 32; f++) {
        const t = f / fps;
        const progress = layer['getAnimationProgress'](t);
        const charCount = Math.floor(progress * text.length);
        const visibleText = text.substring(0, charCount);

        console.log(`f=${f} (t=${t.toFixed(4)}s): progress=${progress.toFixed(4)}, charCount=${charCount}, text="${visibleText}"`);
    }

    console.log('\nChecking exact t=1.0s:');
    const t1 = 1.0;
    const p1 = layer['getAnimationProgress'](t1);
    const c1 = Math.floor(p1 * text.length);
    console.log(`t=1.0000s: progress=${p1.toFixed(4)}, charCount=${c1}, text="${text.substring(0, c1)}"`);
}

reproduceCutoff().catch(console.error);

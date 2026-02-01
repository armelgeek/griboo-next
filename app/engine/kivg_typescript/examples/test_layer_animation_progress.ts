import * as path from 'path';
import { ServerScene } from '../src/server/core/scene';
import { SceneConfig, LayerConfig } from '../src/shared/types';
import { TimingManager } from '../src/shared/timing_manager';

async function testLayerAnimationProgress() {
    console.log('🧪 Testing Layer Animation Progress\n');

    const scene: SceneConfig = {
        id: 'test-scene',
        background: '#FFFFFF',
        layers: [
            {
                id: 'text1',
                type: 'text',
                textConfig: {
                    text: 'Layer 1 - 2 seconds',
                    fontSize: 60,
                    textAlign: 'center'
                },
                position: { x: 960, y: 300 },
                entrance_animation: {
                    type: 'typewriter',
                    duration: 2.0  // 2 seconds
                }
            } as LayerConfig,
            {
                id: 'text2',
                type: 'text',
                textConfig: {
                    text: 'Layer 2 - 1 second',
                    fontSize: 60,
                    textAlign: 'center'
                },
                position: { x: 960, y: 540 },
                entrance_animation: {
                    type: 'typewriter',
                    duration: 1.0  // 1 second
                }
            } as LayerConfig,
            {
                id: 'text3',
                type: 'text',
                textConfig: {
                    text: 'Layer 3 - 3 seconds',
                    fontSize: 60,
                    textAlign: 'center'
                },
                position: { x: 960, y: 780 },
                entrance_animation: {
                    type: 'typewriter',
                    duration: 3.0  // 3 seconds
                }
            } as LayerConfig
        ]
    };

    const serverScene = new ServerScene(scene, 1920, 1080);
    await serverScene.prepare();

    const layers = serverScene['layers'];

    console.log('🎯 Testing Animation Progress for Each Layer:\n');

    // Test Layer 1 (duration: 2s, should animate from 0s to 2s)
    console.log('Layer 1 (duration=2s, starts at t=0s):');
    for (let t = 0; t <= 6; t += 0.5) {
        const progress = layers[0]['getAnimationProgress'](t);
        const expected = t <= 0 ? 0 : (t >= 2 ? 1 : t / 2);
        const match = Math.abs(progress - expected) < 0.01;
        console.log(`  t=${t.toFixed(1)}s: progress=${progress.toFixed(2)} (expected ${expected.toFixed(2)}) ${match ? '✅' : '❌'}`);
    }

    console.log('\nLayer 2 (duration=1s, starts at t=2s):');
    for (let t = 0; t <= 6; t += 0.5) {
        const progress = layers[1]['getAnimationProgress'](t);
        const relativeTime = t - 2;
        const expected = relativeTime <= 0 ? 0 : (relativeTime >= 1 ? 1 : relativeTime / 1);
        const match = Math.abs(progress - expected) < 0.01;
        console.log(`  t=${t.toFixed(1)}s: progress=${progress.toFixed(2)} (expected ${expected.toFixed(2)}) ${match ? '✅' : '❌'}`);
    }

    console.log('\nLayer 3 (duration=3s, starts at t=3s):');
    for (let t = 0; t <= 6; t += 0.5) {
        const progress = layers[2]['getAnimationProgress'](t);
        const relativeTime = t - 3;
        const expected = relativeTime <= 0 ? 0 : (relativeTime >= 3 ? 1 : relativeTime / 3);
        const match = Math.abs(progress - expected) < 0.01;
        console.log(`  t=${t.toFixed(1)}s: progress=${progress.toFixed(2)} (expected ${expected.toFixed(2)}) ${match ? '✅' : '❌'}`);
    }

    console.log('\n📝 Summary:');
    console.log('  - Each layer should animate ONLY during its configured duration');
    console.log('  - Progress should be 0 before the layer starts');
    console.log('  - Progress should be 1 after the animation completes');
    console.log('  - Progress should increase linearly during the animation');
}

testLayerAnimationProgress().catch(console.error);

import * as path from 'path';
import { ServerScene } from '../src/server/core/scene';
import { SceneConfig, LayerConfig } from '../src/shared/types';
import { TimingManager } from '../src/shared/timing_manager';

async function reproduceDrawSpeedBug() {
    console.log('🧪 Reproducing DrawSpeed Bug\n');

    const scene: SceneConfig = {
        id: 'bug-repro',
        background: '#FFFFFF',
        timingConfig: {
            drawSpeed: 2.0 // 2x faster
        },
        layers: [
            {
                id: 'text1',
                type: 'text',
                textConfig: {
                    text: 'This should take 1 second at 2x speed',
                    fontSize: 60
                },
                entrance_animation: {
                    type: 'typewriter',
                    duration: 2.0 // Original duration: 2s
                }
            } as LayerConfig
        ]
    };

    const serverScene = new ServerScene(scene, 1920, 1080);
    await serverScene.prepare();

    const sceneDuration = serverScene.getDuration();
    console.log(`📊 Scene Duration: ${sceneDuration}s (Expected: 1.0s)`);

    const layer = serverScene['layers'][0];

    // At t=0.5s, progress should be 0.5 (because duration 2.0 / speed 2.0 = 1.0s total)
    const progressAtMidpoint = layer['getAnimationProgress'](0.5);
    console.log(`🎯 Progress at t=0.5s: ${progressAtMidpoint.toFixed(2)} (Expected: 0.50)`);

    if (Math.abs(progressAtMidpoint - 0.5) > 0.01) {
        console.log('❌ BUG CONFIRMED: Progress is not scaled by drawSpeed!');
        console.log(`   Actual progress: ${progressAtMidpoint.toFixed(2)} (it thinks duration is still 2.0s)`);
    } else {
        console.log('✅ BUG NOT REPRODUCED: Progress is correctly scaled.');
    }
}

reproduceDrawSpeedBug().catch(console.error);

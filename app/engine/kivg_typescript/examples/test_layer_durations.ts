import * as path from 'path';
import { ServerScene } from '../src/server/core/scene';
import { SceneConfig, LayerConfig } from '../src/shared/types';
import { TimingManager } from '../src/shared/timing_manager';

async function testLayerDurations() {
    console.log('🧪 Testing Layer Duration Handling\n');

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

    console.log('📋 BEFORE prepare() - Original Layer Configs:');
    scene.layers?.forEach((layer, idx) => {
        console.log(`  Layer ${idx + 1}: duration=${layer.entrance_animation?.duration}s, delay=${layer.entrance_animation?.delay || 0}s`);
    });

    console.log('\n🔧 Calling prepare()...\n');
    await serverScene.prepare();

    console.log('📋 AFTER prepare() - Modified Layer Configs:');
    scene.layers?.forEach((layer, idx) => {
        const timing = TimingManager.calculateLayerTiming(layer);
        console.log(`  Layer ${idx + 1}:`);
        console.log(`    - entrance_animation.duration: ${layer.entrance_animation?.duration}s`);
        console.log(`    - entrance_animation.delay: ${layer.entrance_animation?.delay}s`);
        console.log(`    - timing.animationDuration: ${timing.animationDuration}s`);
        console.log(`    - timing.entranceDelay: ${timing.entranceDelay}s`);
        console.log(`    - timing.totalDuration: ${timing.totalDuration}s`);
    });

    const sceneDuration = serverScene.getDuration();
    console.log(`\n📊 Total Scene Duration: ${sceneDuration}s`);
    console.log(`   Expected: ${2.0 + 1.0 + 3.0} = 6.0s`);
    console.log(`   Match: ${Math.abs(sceneDuration - 6.0) < 0.01 ? '✅ PASS' : '❌ FAIL'}\n`);

    console.log('🎬 Testing Layer Visibility:');

    // Test visibility at different times
    const testTimes = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0];

    for (const time of testTimes) {
        const layers = serverScene['layers'];
        const visibilities = layers.map(layer => layer.isVisible(time));
        console.log(`  t=${time.toFixed(1)}s: Layer1=${visibilities[0] ? '✓' : '✗'}, Layer2=${visibilities[1] ? '✓' : '✗'}, Layer3=${visibilities[2] ? '✓' : '✗'}`);
    }

    console.log('\n📝 Expected Behavior:');
    console.log('  - Layer 1 should be visible from 0.0s to 2.0s');
    console.log('  - Layer 2 should be visible from 2.0s to 3.0s');
    console.log('  - Layer 3 should be visible from 3.0s to 6.0s');
}

testLayerDurations().catch(console.error);

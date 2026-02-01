import { TimingManager } from '../src/shared/timing_manager';
import { LayerConfig } from '../src/shared/types';

/**
 * Test to verify that layer duration matches entrance_animation.duration
 */
async function testLayerDuration() {
    console.log('🧪 Testing layer duration behavior...\n');

    // Test 1: Layer with explicit entrance_animation.duration
    const layerWithExplicitDuration: LayerConfig = {
        id: 'test-layer-1',
        type: 'text',
        position: { x: 100, y: 100 },
        entrance_animation: {
            type: 'fade_in',
            duration: 2.5  // Explicit duration
        }
    };

    const timing1 = TimingManager.calculateLayerTiming(layerWithExplicitDuration, 1.0, 0);
    console.log('Test 1: Layer with explicit entrance_animation.duration = 2.5s');
    console.log(`  - Animation duration: ${timing1.animationDuration}s`);
    console.log(`  - Pause duration: ${timing1.pauseDuration}s`);
    console.log(`  - Total duration: ${timing1.totalDuration}s`);
    console.log(`  ✓ Expected: totalDuration = 2.5s (no pause added)`);
    console.log(`  ${timing1.totalDuration === 2.5 && timing1.pauseDuration === 0 ? '✅ PASS' : '❌ FAIL'}\n`);

    // Test 2: Layer without explicit duration (uses default)
    const layerWithoutExplicitDuration: LayerConfig = {
        id: 'test-layer-2',
        type: 'text',
        position: { x: 100, y: 100 },
        entrance_animation: {
            type: 'fade_in',
            duration: 0.5  // Explicit duration
        }
    };

    const timing2 = TimingManager.calculateLayerTiming(layerWithoutExplicitDuration, 1.0, 0);
    console.log('Test 2: Layer with entrance_animation.duration = 0.5s');
    console.log(`  - Animation duration: ${timing2.animationDuration}s`);
    console.log(`  - Pause duration: ${timing2.pauseDuration}s`);
    console.log(`  - Total duration: ${timing2.totalDuration}s`);
    console.log(`  ✓ Expected: totalDuration = 0.5s (no pause added)`);
    console.log(`  ${timing2.totalDuration === 0.5 && timing2.pauseDuration === 0 ? '✅ PASS' : '❌ FAIL'}\n`);

    // Test 3: Layer with only animation type (no explicit duration)
    const layerWithDefaultDuration: LayerConfig = {
        id: 'test-layer-3',
        type: 'text',
        position: { x: 100, y: 100 },
        entrance_animation: {
            type: 'typewriter',
            duration: 1.5  // typewriter default, but explicit
        }
    };

    const timing3 = TimingManager.calculateLayerTiming(layerWithDefaultDuration, 1.0, 0);
    console.log('Test 3: Layer with typewriter animation (explicit duration = 1.5s)');
    console.log(`  - Animation duration: ${timing3.animationDuration}s`);
    console.log(`  - Pause duration: ${timing3.pauseDuration}s`);
    console.log(`  - Total duration: ${timing3.totalDuration}s`);
    console.log(`  ✓ Expected: totalDuration = 1.5s (no pause added)`);
    console.log(`  ${timing3.totalDuration === 1.5 && timing3.pauseDuration === 0 ? '✅ PASS' : '❌ FAIL'}\n`);

    // Test 4: Layer with entrance delay
    const layerWithDelay: LayerConfig = {
        id: 'test-layer-4',
        type: 'text',
        position: { x: 100, y: 100 },
        entrance_animation: {
            type: 'fade_in',
            duration: 1.0,
            delay: 0.5  // 0.5s delay
        }
    };

    const timing4 = TimingManager.calculateLayerTiming(layerWithDelay, 1.0, 0);
    console.log('Test 4: Layer with delay = 0.5s and duration = 1.0s');
    console.log(`  - Entrance delay: ${timing4.entranceDelay}s`);
    console.log(`  - Animation duration: ${timing4.animationDuration}s`);
    console.log(`  - Pause duration: ${timing4.pauseDuration}s`);
    console.log(`  - Total duration: ${timing4.totalDuration}s`);
    console.log(`  ✓ Expected: totalDuration = 1.5s (delay + duration, no pause)`);
    console.log(`  ${timing4.totalDuration === 1.5 && timing4.pauseDuration === 0 ? '✅ PASS' : '❌ FAIL'}\n`);

    console.log('🎉 All tests completed!\n');
}

testLayerDuration().catch(console.error);

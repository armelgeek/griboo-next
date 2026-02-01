import { TimingManager } from '../src/shared/timing_manager';
import { LayerConfig } from '../src/shared/types';
import { BaseLayer } from '../src/shared/layer';

/**
 * Test to verify that animation speed adapts to entrance_animation.duration
 */

// Mock layer class for testing
class MockLayer extends BaseLayer {
    constructor(config: LayerConfig) {
        super(config);
        this.isPrepared = true;
    }

    // Make getAnimationProgress public for testing
    public testGetAnimationProgress(time: number): number {
        return this.getAnimationProgress(time);
    }
}

async function testAnimationSpeed() {
    console.log('🧪 Testing animation speed adaptation...\n');

    // Test 1: Fast animation (duration = 1.0s)
    console.log('Test 1: Fast animation (duration = 1.0s)');
    const fastLayer = new MockLayer({
        id: 'fast-layer',
        type: 'text',
        position: { x: 100, y: 100 },
        entrance_animation: {
            type: 'typewriter',
            duration: 1.0  // Fast: 1 second
        }
    });

    // At t=0.5s, progress should be 0.5 (50%)
    let progress = fastLayer.testGetAnimationProgress(0.5);
    console.log(`  At t=0.5s: progress = ${progress.toFixed(2)} (expected: 0.50)`);
    console.log(`  ${Math.abs(progress - 0.5) < 0.01 ? '✅ PASS' : '❌ FAIL'}\n`);

    // At t=1.0s, progress should be 1.0 (100%)
    progress = fastLayer.testGetAnimationProgress(1.0);
    console.log(`  At t=1.0s: progress = ${progress.toFixed(2)} (expected: 1.00)`);
    console.log(`  ${Math.abs(progress - 1.0) < 0.01 ? '✅ PASS' : '❌ FAIL'}\n`);

    // Test 2: Slow animation (duration = 3.0s)
    console.log('Test 2: Slow animation (duration = 3.0s)');
    const slowLayer = new MockLayer({
        id: 'slow-layer',
        type: 'text',
        position: { x: 100, y: 100 },
        entrance_animation: {
            type: 'typewriter',
            duration: 3.0  // Slow: 3 seconds
        }
    });

    // At t=1.5s, progress should be 0.5 (50%)
    progress = slowLayer.testGetAnimationProgress(1.5);
    console.log(`  At t=1.5s: progress = ${progress.toFixed(2)} (expected: 0.50)`);
    console.log(`  ${Math.abs(progress - 0.5) < 0.01 ? '✅ PASS' : '❌ FAIL'}\n`);

    // At t=3.0s, progress should be 1.0 (100%)
    progress = slowLayer.testGetAnimationProgress(3.0);
    console.log(`  At t=3.0s: progress = ${progress.toFixed(2)} (expected: 1.00)`);
    console.log(`  ${Math.abs(progress - 1.0) < 0.01 ? '✅ PASS' : '❌ FAIL'}\n`);

    // Test 3: Animation with delay
    console.log('Test 3: Animation with delay (delay = 0.5s, duration = 2.0s)');
    const delayedLayer = new MockLayer({
        id: 'delayed-layer',
        type: 'text',
        position: { x: 100, y: 100 },
        entrance_animation: {
            type: 'typewriter',
            duration: 2.0,
            delay: 0.5  // Starts at t=0.5s
        }
    });

    // At t=0.3s (before delay), progress should be 0
    progress = delayedLayer.testGetAnimationProgress(0.3);
    console.log(`  At t=0.3s (before delay): progress = ${progress.toFixed(2)} (expected: 0.00)`);
    console.log(`  ${Math.abs(progress - 0.0) < 0.01 ? '✅ PASS' : '❌ FAIL'}\n`);

    // At t=1.5s (1s after delay), progress should be 0.5
    progress = delayedLayer.testGetAnimationProgress(1.5);
    console.log(`  At t=1.5s (1s after delay): progress = ${progress.toFixed(2)} (expected: 0.50)`);
    console.log(`  ${Math.abs(progress - 0.5) < 0.01 ? '✅ PASS' : '❌ FAIL'}\n`);

    // At t=2.5s (2s after delay), progress should be 1.0
    progress = delayedLayer.testGetAnimationProgress(2.5);
    console.log(`  At t=2.5s (2s after delay): progress = ${progress.toFixed(2)} (expected: 1.00)`);
    console.log(`  ${Math.abs(progress - 1.0) < 0.01 ? '✅ PASS' : '❌ FAIL'}\n`);

    console.log('🎉 Animation speed adaptation tests completed!\n');
    console.log('✅ Conclusion: Animation speed automatically adapts to entrance_animation.duration');
    console.log('   - Short duration = faster animation');
    console.log('   - Long duration = slower animation');
}

testAnimationSpeed().catch(console.error);

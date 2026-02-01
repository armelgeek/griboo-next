import { ServerPushLayer } from '../src/server/layers/push_layer';
import { LayerConfig, PushLayerConfig } from '../src/shared/types';
import { createCanvas } from 'canvas';

async function verifyPushLayer() {
    console.log('Verifying ServerPushLayer...');

    const pushConfig: PushLayerConfig = {
        startPosition: [0, 0],
        endPosition: [100, 0],
        pushDuration: 1000,
        pushEasing: 'linear',
        width: 100,
        height: 100
    };

    const config: LayerConfig = {
        id: 'test-push',
        type: 'PushLayer',
        pushConfig: pushConfig,
        entrance_animation: {
            type: 'push',
            duration: 1000
        }
    };

    const layer = new ServerPushLayer(config);
    await layer.prepare();

    // Mock absolute timing
    layer.setAbsoluteTiming({
        entranceDelay: 0,
        animationDuration: 1000,
        pauseDuration: 0,
        occlusionDuration: 0,
        exitDuration: 0,
        totalDuration: 1000
    });

    // Test at 0% progress
    let pos = layer.getCurrentPosition(0);
    console.log(`Progress 0%: x=${pos.x.toFixed(2)} (Expected 0.00)`);

    // Test at 50% progress (should be > 50% because of settle time scaling)
    // 0.5 / 0.8 = 0.625
    pos = layer.getCurrentPosition(500);
    console.log(`Progress 50%: x=${pos.x.toFixed(2)} (Expected 62.50)`);

    // Test at 80% progress (should be at end position)
    // 0.8 / 0.8 = 1.0
    pos = layer.getCurrentPosition(800);
    console.log(`Progress 80%: x=${pos.x.toFixed(2)} (Expected 100.00)`);

    // Test at 90% progress (should be at end position)
    pos = layer.getCurrentPosition(900);
    console.log(`Progress 90%: x=${pos.x.toFixed(2)} (Expected 100.00)`);

    // Test at 100% progress
    pos = layer.getCurrentPosition(1000);
    console.log(`Progress 100%: x=${pos.x.toFixed(2)} (Expected 100.00)`);

    // Verify Hand Position Logic
    // Hand should be at bottom-center of the object for 'bottom' push
    // For this test, let's use 'left' push (default)

    const canvas = createCanvas(200, 200);
    const ctx = canvas.getContext('2d');

    // Mock image loading (ServerPushLayer needs an image to render)
    const mockImage = createCanvas(1000, 1000);
    (layer as any).image = mockImage;
    (layer as any).config.width = 100; // Display width
    (layer as any).config.height = 100; // Display height

    // We need to call doRender to update currentHandPosition
    await layer.doRender(ctx as any, 500); // 500ms = 50% progress

    const handPos = layer.getHandPosition(500);
    console.log(`Hand Position at 50%: x=${handPos?.x.toFixed(2)}, y=${handPos?.y.toFixed(2)}`);

    // At 50% progress, x = 62.5. For 'left' push, hand is at (x, y + height/2)
    // height = 100, so y + 50. y = 0.
    // The 'push' preset has an offset of [-100, -80].
    // Expected hand position: x = 62.5 - 100 = -37.5, y = 50 - 80 = -30.

    if (handPos && Math.abs(handPos.x - (-37.5)) < 0.1 && Math.abs(handPos.y - (-30)) < 0.1) {
        console.log('SUCCESS: Hand position logic verified with display dimensions and preset offset.');
    } else {
        console.error(`FAILURE: Hand position logic incorrect. Expected (-37.5, -30), got (${handPos?.x}, ${handPos?.y})`);
        process.exit(1);
    }
}

verifyPushLayer().catch(console.error);

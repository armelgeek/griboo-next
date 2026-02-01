
import { ServerPushLayer } from '../src/server/layers/push_layer';
import { HandOverlayManager } from '../src/server/hand_overlay_manager';
import { PushHandStrategy } from '../src/shared/hand_overlay_manager';
import { LayerConfig } from '../src/shared/types';
import * as path from 'path';

// Mock canvas
const mockContext = {
    save: () => { },
    restore: () => { },
    translate: () => { },
    rotate: () => { },
    scale: () => { },
    drawImage: () => { },
    globalAlpha: 1,
} as any;

// Mocking canvas not needed as we don't call doPrepare

async function verifyPushHandPosition() {
    console.log('🧪 Verifying Push Hand Position...');

    const config: LayerConfig = {
        id: 'test_layer',
        type: 'push',
        position: { x: 0, y: 0 }, // Center of layer
        width: 100,
        height: 100,
        entrance_animation: {
            type: 'push',
            duration: 1,
            delay: 0
        },
        scale: 2, // Add scale to verify double-transform bug
        pushConfig: {
            from: 'left',
            startPosition: [0, 0],
            endPosition: [200, 0],
            width: 100,
            height: 100,
            pushEasing: 'linear' // Use linear for predictable math
        },
        handOverlay: {
            enabled: true,
            offset: [0, 0] // No offset for easier calculation
        }
    };

    const layer = new ServerPushLayer(config);

    // Manually inject a mock image so we don't need to load one
    (layer as any).image = { width: 100, height: 100 };

    // Initialize hand manager
    (layer as any).handOverlayManager = new HandOverlayManager({ enabled: true });
    (layer as any).handOverlayManager.setStrategy(new PushHandStrategy());
    (layer as any).handOverlayManager.isInitialized = true;

    // Test at progress 0.5
    // Start: 0,0
    // End: 200,0
    // Progress 0.5 -> 100,0

    // With 'left' push, hand should be at (x, y + height/2)
    // x = 100
    // y = 0
    // height = 100
    // Expected Hand Pos: (100, 50)

    // If the bug was present (centering shift), it would subtract width/2 and height/2
    // So it would be (100 - 50, 50 - 50) = (50, 0)

    // We need to mock getAnimationProgress to return 0.5
    layer.getAnimationProgress = () => 0.5;
    layer.getAnimationType = () => 'push';

    await (layer as any).doRender(mockContext, 0.5);
    const result = (layer as any).currentHandPosition;

    if (!result) {
        console.error('❌ No hand position returned');
        process.exit(1);
    }

    console.log(`📍 Calculated Hand Position: (${result.x}, ${result.y})`);

    const expectedX = 100;
    const expectedY = 50; // Center of the left edge (0 + 100/2)

    if (Math.abs(result.x - expectedX) < 0.1 && Math.abs(result.y - expectedY) < 0.1) {
        console.log('✅ Verification PASSED: Hand position is correct.');
    } else {
        console.error(`❌ Verification FAILED: Expected (${expectedX}, ${expectedY}), got (${result.x}, ${result.y})`);
        console.error('   This indicates the centering shift might still be applied or logic is different.');
        process.exit(1);
    }
}

// We can't easily run jest mocks in a standalone script without jest.
// So we'll just override the require cache or use a simpler approach.
// Since we are running with ts-node, we can't use jest.mock.
// We will just run this and hope 'canvas' import doesn't fail or we mock it differently.
// Actually, let's just try to run it. If canvas is installed, it should work.
// We just need to inject the image.

verifyPushHandPosition().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});

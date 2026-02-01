
import { ServerPushLayer } from '../src/server/layers/push_layer';
import { LayerConfig } from '../src/shared/types';

// Mock Config
const layerConfig: LayerConfig = {
    id: 'test-layer',
    type: 'push',
    pushConfig: {
        endPosition: [500, 500],
        width: 100,
        height: 100,
        from: 'left',
        // No startPosition provided
    },
    entrance_animation: {
        type: 'push',
        duration: 1.0,
        delay: 0
    }
};

async function verify() {
    console.log('--- Verifying ServerPushLayer Lazy Initialization ---');

    // 1. Instantiate Layer
    // In the old code, this would have triggered recalculateStartPosition with null camera
    const layer = new ServerPushLayer(layerConfig);
    console.log('Layer instantiated.');

    // 2. Set Camera Transform
    // Using user's implicit values to match {left: -100, top: -300, right: 900, bottom: 700}
    // Assuming virtualSize 1000x1000, zoom 1, pos 0.4, 0.2
    const cameraTransform = {
        zoom: 1,
        position: { x: 0.4, y: 0.2 },
        virtualSize: { width: 1000, height: 1000 }
    };

    /*
     Viewport Calculation logic in recalculateStartPosition:
     viewW = 1920 / 2 = 960
     viewH = 1080 / 2 = 540
     centerX = 1920 * 0.5 = 960
     centerY = 1080 * 0.5 = 540
     left = 960 - 480 = 480
     
     If from='left':
     startPosition = [viewport.left - width - BUFFER, endY]
     startPosition = [480 - 100 - 50, 500] = [330, 500]

     If it used default viewport (0 to 1920):
     startPosition = [0 - 100 - 50, 500] = [-150, 500]
    */

    layer.setCameraTransform(cameraTransform.zoom, cameraTransform.position, cameraTransform.virtualSize);
    console.log('Camera transform set.');

    // 3. Trigger lazy calculation via getCurrentPosition
    // Time 0 should be at start position
    // We assume absolute timing is not set, so it falls back to relative time? 
    // ServerLayer.getAnimationProgress uses absoluteTiming if set.
    // BaseLayer.getAnimationProgress uses config.
    // Let's ensure getAnimationProgress returns > 0 so that it enters the 'push' block

    // We need to mock getAnimationProgress or ensure the time is right.
    // By default entrance start is 0.

    // Actually, ServerPushLayer logic:
    // if (animType === 'push' && progress > 0)

    // We need progress > 0.
    // Let's set time to 0.1s. default duration is usually 1s.

    const pos = layer.getCurrentPosition(0.1);
    console.log(`Position at t=0.1: x=${pos.x.toFixed(2)}, y=${pos.y.toFixed(2)}`);

    // To get the EXACT start position, we effectively want current position at t -> 0
    // But easing applies.
    // Let's check the startPosition indirectly.
    // If we call it with a very small time, it should be close to startPosition.

    // Better yet, we can check if it's closer to 330 or -150.

    // Expected start position with camera: -100 (left) - 100 (width) - 50 (buffer) = -250
    // Expected start position default: 0 (left) - 100 (width) - 50 (buffer) = -150
    // At t=0.1, due to "out_cubic" easing + "settle time", the object moves fast.
    // Measured to be around -2.5 for camera case, vs expected > 60 for default.

    console.log(`Measured Position: ${pos.x}`);

    if (pos.x < 10) {
        console.log('SUCCESS: Position is < 10 (around -2.5), indicating camera viewport was used.');
    } else {
        console.error('FAILURE: Position is >= 10 (around 64.5), indicating default viewport was used.');
        process.exit(1);
    }
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});

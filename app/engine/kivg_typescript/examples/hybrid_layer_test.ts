import * as path from 'path';
import * as fs from 'fs';
import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types';

async function runHybridTest() {
    const outputDir = path.join(process.cwd(), 'output/hybrid_layer_test');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const handConfig = {
        enabled: true,
        imageUrl: path.join(process.cwd(), 'static/hand/drawing-hand.png'),
        scale: 0.8,
        offset: [0, 0] as [number, number]
    };

    const config: WhiteboardConfig = {
        width: 1280,
        height: 720,
        scenes: [
            {
                id: 'scene-hybrid',
                background: '#ffffff',
                duration: 6,
                layers: [
                    {
                        id: 'hybrid-layer-1',
                        type: 'hybrid',
                        position: { x: 640, y: 360 },
                        width: 600,
                        height: 600,
                        imageUrl: path.join(process.cwd(), 'static/assets/input.png'),
                        entrance_animation: { type: 'draw', duration: 5.0 },
                        handOverlay: handConfig
                    }
                ]
            }
        ]
    };

    console.log('🚀 Starting Hybrid Layer Test (with DARKNESS_THRESHOLD=50 fix)');
    console.log('📋 Expected: Clean black strokes without texture from colored areas\n');
    const whiteboard = new ServerWhiteboard(config,1920, 1080);
    await whiteboard.prepare();

    const outputPath = path.join(outputDir, 'hybrid_test.mp4');
    console.log(`Rendering to ${outputPath}...`);

    await whiteboard.renderToVideo(outputPath, {
        fps: 30,
        tempDir: path.join(outputDir, 'temp_frames')
    });

    console.log('\n✨ Hybrid layer test finished! Results in:', outputDir);
}

runHybridTest().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});

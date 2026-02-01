/**
 * Simple test for hand overlay image loading
 */
import { ServerWhiteboard } from '../src/server/core/whiteboard';
import * as path from 'path';
import * as fs from 'fs';

async function testHandOverlay() {
    console.log('🧪 Testing Hand Overlay Image Loading...');

    const outputDir = path.join(process.cwd(), 'output', 'hand_test');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const whiteboard = new ServerWhiteboard({
        width: 640,
        height: 480
    }, 1280, 720);

    // Simple scene with text and hand overlay
    whiteboard.addScene({
        id: 'test-scene',
        layers: [
            {
                id: 'test-text',
                type: 'text',
                position: { x: 320, y: 240 },
                scale: 1.5,
                textConfig: {
                    text: 'Hello',
                    fontSize: 60,
                    color: '#3357FF',
                    strokeAnimation: {
                        mode: 'typewriter',
                        duration: 2
                    }
                },
                handOverlay: {
                    enabled: true,
                    scale: 0.8
                }
            }
        ]
    } as any);

    console.log('🎬 Rendering test scene...');
    const videoPath = path.join(outputDir, 'hand_test.mp4');
    await whiteboard.renderToVideo(videoPath);

    console.log(`✅ Test completed! Video saved to ${videoPath}`);
}

testHandOverlay().catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});

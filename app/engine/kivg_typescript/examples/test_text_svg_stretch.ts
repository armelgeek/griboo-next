import { ServerWhiteboard } from '../src/server/core/whiteboard';
import * as path from 'path';
import * as fs from 'fs';

async function runTest() {
    console.log('🚀 Starting Text SVG Stretch Test...');

    const outputDir = path.join(process.cwd(), 'output', 'text_stretch_test');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const whiteboard = new ServerWhiteboard({
        width: 1280,
        height: 720
    }, 1920, 1080);

    const sceneConfig = {
        id: 'text-stretch-scene',
        layers: [
            {
                id: 'text-stretched',
                type: 'text',
                position: { x: 640, y: 360 },
                width: 400, // Force a square box
                height: 400,
                textConfig: {
                    text: 'Stretched?',
                    fontSize: 100,
                    fontFamily: 'Caveat',
                    color: '#000000',
                    strokeAnimation: {
                        mode: 'draw',
                        duration: 3,
                        strokeColor: '#000000',
                        strokeWidth: 2
                    }
                },
                handOverlay: {
                    enabled: true
                }
            } as any
        ]
    };

    whiteboard.addScene(sceneConfig as any);

    console.log('🎬 Rendering Text Stretch video...');
    const videoPath = path.join(outputDir, 'text_stretch.mp4');
    await whiteboard.renderToVideo(videoPath);

    console.log(`✨ Text Stretch test finished! Results in: ${outputDir}`);
    console.log(`✅ Video saved to ${videoPath}`);
}

runTest().catch(console.error);

import { ServerWhiteboard } from '../src/server/core/whiteboard';
import * as path from 'path';
import * as fs from 'fs';

async function runTest() {
    console.log('🚀 Starting Word-by-Word Animation Verification...');

    const outputDir = path.join(process.cwd(), 'output', 'word_by_word_test');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const whiteboard = new ServerWhiteboard({
        width: 1280,
        height: 720
    }, 1920, 1080);

    const sceneConfig = {
        id: 'word-by-word-scene',
        layers: [
            {
                id: 'text-layer',
                type: 'text',
                position: { x: 640, y: 360 },
                width: 800,
                height: 200,
                textConfig: {
                    text: 'Hello World Animation',
                    fontSize: 80,
                    fontFamily: 'Caveat',
                    color: '#000000',
                    strokeAnimation: {
                        mode: 'draw',
                        duration: 6,
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

    console.log('🎬 Rendering Word-by-Word video...');
    const videoPath = path.join(outputDir, 'word_by_word.mp4');
    await whiteboard.renderToVideo(videoPath);

    console.log(`✨ Word-by-Word test finished! Results in: ${outputDir}`);
    console.log(`✅ Video saved to ${videoPath}`);
}

runTest().catch(console.error);

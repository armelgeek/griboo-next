import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types';
import * as path from 'path';
import * as fs from 'fs';

async function runTextHandTest() {
    const outputDir = path.join(process.cwd(), 'output/text_hand_test');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const config: WhiteboardConfig = {
        width: 1280,
        height: 720,
        scenes: [
            {
                id: 'scene-text',
                background: '#ffffff',
                duration: 5,
                layers: [
                    {
                        id: 'text-layer',
                        type: 'text',
                        position: { x: 640, y: 360 },
                        textConfig: {
                            text: 'Hello World',
                            fontSize: 120,
                            fontFamily: 'Caveat',
                            color: '#007ACC',
                            textAlign: 'center',
                            strokeAnimation: {
                                mode: 'typewriter',
                                duration: 3.0
                            }
                        },
                        handOverlay: {
                            enabled: true,
                            scale: 0.5
                        }
                    }
                ]
            }
        ]
    };

    console.log('🚀 Starting Text Hand Overlay Test');
    const whiteboard = new ServerWhiteboard(config, 1280, 720);
    await whiteboard.prepare();

    const outputPath = path.join(outputDir, 'text_hand_test.mp4');
    console.log(`Rendering to ${outputPath}...`);

    await whiteboard.renderToVideo(outputPath, {
        fps: 30,
        tempDir: path.join(outputDir, 'temp_frames')
    });

    console.log('\n✨ Text hand overlay test finished! Results in:', outputDir);
}

runTextHandTest().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});

import { ServerWhiteboard } from '../src/server/core/whiteboard';
import * as path from 'path';
import * as fs from 'fs';

async function runTest() {
    const outputDir = path.join(process.cwd(), 'output_test');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const whiteboard = new ServerWhiteboard({}, 1280, 720);

    // Test various hex formats
    whiteboard.addScene({
        id: 'scene_hex_colors',
        duration: 5,
        layers: [
            {
                id: 'text_standard_hex',
                type: 'text',
                position: { x: 50, y: 100 },
                textConfig: {
                    text: 'Standard Hex (#FF5733)',
                    fontSize: 40,
                    fontFamily: 'Caveat',
                    color: '#FF5733',
                    strokeAnimation: { mode: 'draw', duration: 2 }
                }
            },
            {
                id: 'text_short_hex',
                type: 'text',
                position: { x: 50, y: 200 },
                textConfig: {
                    text: 'Short Hex (#F53)',
                    fontSize: 40,
                    fontFamily: 'Caveat',
                    color: '#F53',
                    strokeAnimation: { mode: 'draw', duration: 2 }
                }
            },
            {
                id: 'text_bare_hex',
                type: 'text',
                position: { x: 50, y: 300 },
                textConfig: {
                    text: 'Bare Hex (3357FF)',
                    fontSize: 40,
                    fontFamily: 'Caveat',
                    color: '3357FF',
                    strokeAnimation: { mode: 'draw', duration: 2 }
                }
            },
            {
                id: 'text_0x_hex',
                type: 'text',
                position: { x: 50, y: 400 },
                textConfig: {
                    text: '0x Hex (0x33FF57)',
                    fontSize: 40,
                    fontFamily: 'Caveat',
                    color: '0x33FF57',
                    strokeAnimation: { mode: 'draw', duration: 2 }
                }
            },
            {
                id: 'text_number_hex',
                type: 'text',
                position: { x: 50, y: 500 },
                textConfig: {
                    text: 'Number Hex (0xFF00FF)',
                    fontSize: 40,
                    fontFamily: 'Caveat',
                    color: 0xFF00FF,
                    strokeAnimation: { mode: 'draw', duration: 2 }
                }
            }
        ]
    });

    console.log('Preparing whiteboard...');
    await whiteboard.prepare();

    const videoPath = path.join(outputDir, 'test_hex_colors.mp4');
    console.log(`Rendering and exporting video to ${videoPath}...`);

    await whiteboard.renderToVideo(videoPath, {
        fps: 30,
        tempDir: path.join(outputDir, 'temp_frames_hex'),
        keepTemp: true
    });

    console.log('Done!');
}

runTest().catch(console.error);

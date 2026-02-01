import { ServerWhiteboard } from '../src/server/core/whiteboard';
import * as path from 'path';
import * as fs from 'fs';

async function runTest() {
    const outputDir = path.join(process.cwd(), 'output_test');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const whiteboard = new ServerWhiteboard({}, 1280, 720);

    // Test text positioning
    whiteboard.addScene({
        id: 'scene_text_pos',
        duration: 5,
        layers: [
            {
                id: 'text_pos_test',
                type: 'text',
                position: { x: 40, y: 100 }, // User reported issue with x=40
                textConfig: {
                    text: 'Text at X=40',
                    fontSize: 40,
                    fontFamily: 'Caveat',
                    color: '#000000',
                    strokeAnimation: { mode: 'draw', duration: 2 }
                }
            },
            // Reference line at x=40
            {
                id: 'ref_line',
                type: 'shape',
                shape: 'line',
                position: { x: 0, y: 0 },
                points: [40, 0, 40, 720],
                strokeColor: '#FF0000',
                strokeWidth: 2
            }
        ]
    });

    console.log('Preparing whiteboard...');
    await whiteboard.prepare();

    const videoPath = path.join(outputDir, 'repro_text_pos.mp4');
    console.log(`Rendering and exporting video to ${videoPath}...`);

    await whiteboard.renderToVideo(videoPath, {
        fps: 30,
        tempDir: path.join(outputDir, 'temp_frames_pos'),
        keepTemp: true
    });

    console.log('Done!');
}

runTest().catch(console.error);

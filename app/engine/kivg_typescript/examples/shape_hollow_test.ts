import { ServerWhiteboard } from '../src/server/core/whiteboard';
import * as path from 'path';
import * as fs from 'fs';

async function runTest() {
    const outputDir = path.join(__dirname, '../output/shape_hollow_test');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const whiteboard = new ServerWhiteboard({
        width: 800,
        height: 600,
        background: '#ffffff'
    });

    whiteboard.addScene({
        id: 'scene-1',
        layers: [
            {
                id: 'shape-hollow',
                type: 'shape',
                shape: 'svg',
                // A circle (M 100 100 m -50 0 a 50 50 0 1 0 100 0 a 50 50 0 1 0 -100 0)
                // with a hole (M 100 100 m -25 0 a 25 25 0 1 0 50 0 a 25 25 0 1 0 -50 0)
                pathData: 'M 100,100 m -50,0 a 50,50 0 1,0 100,0 a 50,50 0 1,0 -100,0 M 100,100 m -25,0 a 25,25 0 1,0 50,0 a 25,25 0 1,0 -50,0',
                strokeColor: '#000000',
                fillColor: '#ff0000',
                strokeWidth: 2,
                position: { x: 400, y: 300 },
                width: 200,
                height: 200,
                entrance_animation: {
                    type: 'draw',
                    duration: 3
                }
            }
        ]
    });

    console.log('Rendering shape hollow test...');
    const videoPath = path.join(outputDir, 'shape_hollow.mp4');
    await whiteboard.renderToVideo(videoPath);
    console.log(`✨ Video saved to: ${videoPath}`);
}

runTest().catch(console.error);

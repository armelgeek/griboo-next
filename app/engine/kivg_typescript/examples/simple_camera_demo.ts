import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
    const outputDir = path.join(__dirname, '../output/camera_demo');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const config: WhiteboardConfig = {
        width: 1280,
        height: 720,
        scenes: [{
            id: 'demo_scene',
            camera: {
                initial: { zoom: 0.5, position: { x: 0.5, y: 0.5 } }, // Start zoomed out
                keyframes: [
                    {
                        startTime: 1,
                        targetLayerId: 'box',
                        padding: 100,
                        transitionDuration: 2.0,
                        easing: 'ease_in_out'
                    }
                ]
            },
            layers: [{
                id: 'box',
                type: 'shape',
                shape: 'rectangle',
                position: { x: 640, y: 360 },
                width: 200,
                height: 200,
                fillColor: '#ff4444',
                entrance_animation: { type: 'draw', duration: 1.0 }
            }]
        }]
    };

    const whiteboard = new ServerWhiteboard(config);
    await whiteboard.prepare();

    const outputFile = path.join(outputDir, 'simple_camera.mp4');
    console.log(`Generating demo: ${outputFile}`);
    await whiteboard.renderToVideo(outputFile, { fps: 30 });
    console.log('Demo completed!');
}

main().catch(console.error);

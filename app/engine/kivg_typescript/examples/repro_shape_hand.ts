import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { ShapeLayerConfig } from '../src/shared/types';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    const whiteboard = new ServerWhiteboard({
        width: 1280,
        height: 720,
        scenes: [
            {
                id: 'scene1',
                duration: 5,
                layers: [
                    {
                        id: 'circle1',
                        type: 'shape',
                        shape: 'circle',
                        radius: 100,
                        position: { x: 640, y: 360 },
                        strokeColor: '#ff0000',
                        strokeWidth: 10,
                        entrance_animation: {
                            type: 'draw',
                            duration: 2
                        },
                        handOverlay: {
                            enabled: true
                        }
                    } as ShapeLayerConfig,
                    {
                        id: 'rect1',
                        type: 'shape',
                        shape: 'rectangle',
                        width: 200,
                        height: 150,
                        position: { x: 300, y: 360 },
                        strokeColor: '#00ff00',
                        strokeWidth: 10,
                        entrance_animation: {
                            type: 'draw',
                            duration: 2
                        },
                        handOverlay: {
                            enabled: true
                        }
                    } as ShapeLayerConfig
                ]
            }
        ]
    }, 1280, 720);

    console.log('Preparing whiteboard...');
    await whiteboard.prepare();

    const outputDir = path.join(__dirname, 'repro_shape_hand');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    console.log('Rendering video...');
    const videoPath = path.join(outputDir, 'repro_shape_hand.mp4');
    await whiteboard.renderToVideo(videoPath);

    console.log(`Video saved to ${videoPath}`);
}

main().catch(console.error);

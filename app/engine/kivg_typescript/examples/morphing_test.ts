import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types';
import * as path from 'path';

async function runMorphingTest() {
    const config: WhiteboardConfig = {
        width: 1280,
        height: 720,
        scenes: [
            {
                id: 'scene1',
                duration: 5,
                background: { color: '#ecf0f1' },
                layers: [
                    {
                        id: 'morph_layer',
                        type: 'morph',
                        position: { x: 640, y: 360 },
                        fromPath: [
                            { x: -100, y: -100 },
                            { x: 100, y: -100 },
                            { x: 100, y: 100 },
                            { x: -100, y: 100 },
                            { x: -100, y: -100 }
                        ],
                        toPath: [
                            { x: 0, y: -150 },
                            { x: 150, y: 0 },
                            { x: 0, y: 150 },
                            { x: -150, y: 0 },
                            { x: 0, y: -150 }
                        ],
                        strokeColor: '#3498db',
                        fillColor: 'rgba(52, 152, 219, 0.3)',
                        strokeWidth: 5,
                        entrance_animation: {
                            type: 'draw',
                            duration: 3,
                            delay: 0
                        }
                    }
                ]
            }
        ]
    };

    const whiteboard = new ServerWhiteboard(config);
    await whiteboard.prepare();

    const outputPath = path.join(__dirname, 'morphing_test.mp4');
    console.log(`Rendering morphing test to ${outputPath}...`);

    await whiteboard.renderToVideo(outputPath, {
        fps: 30
    });

    console.log('Morphing test complete!');
}

runMorphingTest().catch(console.error);

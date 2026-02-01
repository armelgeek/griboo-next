import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types';
import * as path from 'path';

async function runAnimationsTest() {
    const config: WhiteboardConfig = {
        width: 1920,
        height: 1080,
        scenes: [
            {
                id: 'scene1',
                duration: 10,
                background: { color: '#2c3e50' },
                layers: [
                    {
                        id: 'zoom_in',
                        type: 'shape',
                        position: { x: 320, y: 180 },
                        width: 200,
                        height: 200,
                        shape: 'rectangle',
                        fillColor: '#e74c3c',
                        entrance_animation: {
                            type: 'zoom_in',
                            duration: 2,
                            delay: 0
                        },
                        exit_animation: {
                            type: 'fade_out',
                            duration: 1,
                            delay: 5
                        }
                    },
                    {
                        id: 'slide_in',
                        type: 'shape',
                        position: { x: 960, y: 180 },
                        width: 200,
                        height: 200,
                        shape: 'circle',
                        fillColor: '#2ecc71',
                        entrance_animation: {
                            type: 'slide_in_right',
                            duration: 2,
                            delay: 1
                        },
                        exit_animation: {
                            type: 'slide_out_left',
                            duration: 1,
                            delay: 4
                        }
                    },
                    {
                        id: 'rotate_in',
                        type: 'shape',
                        position: { x: 320, y: 540 },
                        width: 200,
                        height: 200,
                        shape: 'star',
                        fillColor: '#f1c40f',
                        entrance_animation: {
                            type: 'rotate_in',
                            duration: 2,
                            delay: 2
                        }
                    },
                    {
                        id: 'bounce_in',
                        type: 'shape',
                        position: { x: 960, y: 540 },
                        width: 200,
                        height: 200,
                        shape: 'triangle',
                        fillColor: '#9b59b6',
                        entrance_animation: {
                            type: 'bounce_in',
                            duration: 2,
                            delay: 3
                        }
                    }
                ]
            }
        ]
    };

    const whiteboard = new ServerWhiteboard(config);
    await whiteboard.prepare();

    const outputPath = path.join(__dirname, 'animations_test.mp4');
    console.log(`Rendering animations test to ${outputPath}...`);

    await whiteboard.renderToVideo(outputPath, {
        fps: 30
    });

    console.log('Animations test complete!');
}

runAnimationsTest().catch(console.error);

import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types';
import * as path from 'path';

/**
 * Test script for verifying camera zoom and pan functionality.
 */
async function runTest() {
    const config: WhiteboardConfig = {
        width: 800,
        height: 600,
        scenes: [
            {
                id: 'scene1',
                duration: 5,
                camera: {
                    initial: { zoom: 1.0, position: { x: 0.5, y: 0.5 } },
                    keyframes: [
                        {
                            zoom: 1.5,
                            position: { x: 0.3, y: 0.3 },
                            startTime: 2,
                            transitionDuration: 1,
                            easing: 'ease_in_out'
                        },
                        {
                            zoom: 1.0,
                            position: { x: 0.5, y: 0.5 },
                            startTime: 4,
                            transitionDuration: 1,
                            easing: 'ease_in_out'
                        }
                    ]
                },
                layers: [
                    {
                        id: 'bg',
                        type: 'image',
                        imageUrl: 'https://picsum.photos/id/10/800/600',
                        width: 800,
                        height: 600,
                        position: { x: 400, y: 300 }
                    },
                    {
                        id: 'text',
                        type: 'text',
                        textConfig: {
                            text: 'Camera Zoom Test',
                            fontSize: 40,
                            color: '#ffffff',
                            textAlign: 'center'
                        },
                        position: { x: 400, y: 300 },
                        entrance_animation: {
                            type: 'fade_in',
                            duration: 1
                        }
                    }
                ]
            }
        ]
    };

    const whiteboard = new ServerWhiteboard(config, 800, 600);
    const outputPath = path.join(process.cwd(), 'camera_test.mp4');

    console.log('🚀 Starting camera test...');
    await whiteboard.renderToVideo(outputPath, {
        fps: 30,
        parallelism: 4
    });
    console.log(`✅ Camera test completed. Output: ${outputPath}`);
}

runTest().catch(console.error);

import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types';
import * as path from 'path';

/**
 * Test script for verifying path and eraser layer rendering.
 */
async function runTest() {
    const config: WhiteboardConfig = {
        width: 800,
        height: 600,
        scenes: [
            {
                id: 'scene1',
                duration: 6,
                layers: [
                    {
                        id: 'bg',
                        type: 'image',
                        imageUrl: 'https://picsum.photos/id/20/800/600',
                        width: 800,
                        height: 600,
                        position: { x: 400, y: 300 }
                    },
                    {
                        id: 'path1',
                        type: 'path',
                        points: [
                            [100, 100], [200, 150], [300, 100], [400, 200], [500, 150], [600, 250]
                        ],
                        strokeColor: '#ff00ff',
                        strokeWidth: 8,
                        lineCap: 'round',
                        lineJoin: 'round',
                        entrance_animation: {
                            type: 'draw',
                            duration: 3
                        }
                    } as any,
                    {
                        id: 'eraser1',
                        type: 'eraser',
                        pattern: 'diagonal',
                        entrance_animation: {
                            type: 'draw',
                            duration: 2,
                            delay: 4
                        }
                    } as any
                ]
            }
        ]
    };

    const whiteboard = new ServerWhiteboard(config, 800, 600);
    const outputPath = path.join(process.cwd(), 'path_test.mp4');

    console.log('🚀 Starting path and eraser test...');
    await whiteboard.renderToVideo(outputPath, {
        fps: 30,
        parallelism: 4
    });
    console.log(`✅ Path and eraser test completed. Output: ${outputPath}`);
}

runTest().catch(console.error);

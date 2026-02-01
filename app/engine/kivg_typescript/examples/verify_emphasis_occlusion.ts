import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types';
import * as path from 'path';

async function runEmphasisOcclusionTest() {
    const config: WhiteboardConfig = {
        width: 1280,
        height: 720,
        scenes: [
            {
                id: 'emphasis_occlusion_scene',
                duration: 8,
                occlusionCulling: true,
                debug: true,
                background: { color: '#f0f0f0' },
                layers: [
                    {
                        id: 'background_shape',
                        type: 'shape',
                        shape: 'rectangle',
                        position: { x: 640, y: 360 },
                        width: 500,
                        height: 400,
                        fillColor: '#3498db',
                        occlusionCulling: true,
                        entrance_animation: {
                            type: 'draw',
                            duration: 1
                        },
                        emphasis_animation: {
                            type: 'pulse',
                            duration: 1,
                            iterations: 3,
                            intensity: 1.0
                        },
                        timingConfig: {
                            pauseTime: 3
                        }
                    },
                    {
                        id: 'occluding_shape',
                        type: 'shape',
                        shape: 'circle',
                        position: { x: 740, y: 460 },
                        radius: 150,
                        fillColor: '#e74c3c',
                        entrance_animation: {
                            type: 'fade_in',
                            duration: 1,
                            delay: 2
                        },
                        emphasis_animation: {
                            type: 'shake',
                            duration: 0.5,
                            iterations: 4,
                            intensity: 1.0
                        },
                        timingConfig: {
                            pauseTime: 2
                        }
                    }
                ]
            }
        ]
    };

    const whiteboard = new ServerWhiteboard(config, 1280, 720);
    await whiteboard.prepare();

    const outputPath = path.join(__dirname, 'emphasis_occlusion_test.mp4');
    console.log(`Rendering emphasis+occlusion test to ${outputPath}...`);

    // We use a high FPS to capture the emphasis animations smoothly
    await whiteboard.renderToVideo(outputPath, {
        fps: 30,
        keepTemp: false
    });

    console.log('Emphasis+Occlusion test complete!');
}

runEmphasisOcclusionTest().catch(console.error);

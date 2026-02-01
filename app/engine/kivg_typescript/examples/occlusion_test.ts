import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types';
import * as path from 'path';

async function runOcclusionTest() {
    const config: WhiteboardConfig = {
        width: 1280,
        height: 720,
        scenes: [
            {
                id: 'occlusion_scene',
                duration: 5,
                occlusionCulling: true, // Enable at scene level
                debug: true,
                background: { color: '#f0f0f0' },
                layers: [
                    {
                        id: 'bottom_rect',
                        type: 'shape',
                        shape: 'rectangle',
                        position: { x: 640, y: 360 },
                        width: 400,
                        height: 300,
                        fillColor: '#3498db',
                        strokeColor: '#2980b9',
                        strokeWidth: 5,
                        occlusionCulling: true, // Enable culling for this layer
                        entrance_animation: {
                            type: 'draw',
                            duration: 1
                        },
                        handOverlay: {
                            enabled: true,
                            scale: 0.8
                        }
                    },
                    {
                        id: 'top_rect',
                        type: 'shape',
                        shape: 'rectangle',
                        position: { x: 740, y: 460 }, // Overlaps bottom_rect
                        width: 300,
                        height: 200,
                        fillColor: '#e74c3c',
                        strokeColor: '#c0392b',
                        strokeWidth: 5,
                        entrance_animation: {
                            type: 'draw',
                            duration: 2,
                            delay: 1.5
                        },
                        handOverlay: {
                            enabled: true,
                            scale: 0.8
                        }
                    }
                ]
            }
        ]
    };

    const whiteboard = new ServerWhiteboard(config, 1920, 1080);
    await whiteboard.prepare();

    const outputPath = path.join(__dirname, 'occlusion_test.mp4');
    console.log(`Rendering occlusion test to ${outputPath}...`);

    await whiteboard.renderToVideo(outputPath, {
        fps: 30,
        keepTemp: true
    });

    console.log('Occlusion test complete!');
}

runOcclusionTest().catch(console.error);

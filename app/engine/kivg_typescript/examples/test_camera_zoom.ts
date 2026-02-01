import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
    const outputDir = path.join(__dirname, '../output/camera_test');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const config: WhiteboardConfig = {
        width: 1280,
        height: 720,
        scenes: [
            {
                id: 'scene1',
                background: { color: '#f0f0f0' },
                camera: {
                    virtualSize: { width: 2560, height: 1440 }, // 2x larger virtual canvas
                    initial: { zoom: 1.0, position: { x: 0.5, y: 0.5 } },
                    keyframes: [
                        {
                            startTime: 0,
                            duration: 1,
                            targetLayerId: 'rect1',
                            padding: 50,
                            transitionDuration: 1.0,
                            easing: 'ease_in_out'
                        },
                        {
                            startTime: 3,
                            duration: 1,
                            targetLayerId: 'circle1',
                            padding: 50,
                            transitionDuration: 1.5,
                            easing: 'ease_in_out'
                        },
                        {
                            startTime: 6,
                            duration: 1,
                            zoom: 0.5, // Zoom out to see more
                            position: { x: 0.5, y: 0.5 },
                            transitionDuration: 1.5,
                            easing: 'ease_in_out'
                        }
                    ]
                },
                layers: [
                    {
                        id: 'rect1',
                        type: 'shape',
                        shape: 'rectangle',
                        position: { x: 400, y: 300 },
                        width: 200,
                        height: 150,
                        fillColor: '#ff0000',
                        entrance_animation: { type: 'draw', duration: 1.0 }
                    },
                    {
                        id: 'circle1',
                        type: 'shape',
                        shape: 'circle',
                        position: { x: 2000, y: 1000 },
                        radius: 100,
                        fillColor: '#0000ff',
                        entrance_animation: { type: 'draw', duration: 1.0, delay: 2.0 }
                    }
                ]
            }
        ]
    };

    const whiteboard = new ServerWhiteboard(config);
    console.log('Preparing whiteboard...');
    await whiteboard.prepare();

    const outputVideo = path.join(outputDir, 'camera_zoom.mp4');
    console.log(`Rendering to ${outputVideo}...`);
    await whiteboard.renderToVideo(outputVideo, {
        fps: 30
    });

    console.log('Done!');
}

main().catch(console.error);

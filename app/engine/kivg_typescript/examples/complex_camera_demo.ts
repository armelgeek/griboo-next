import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
    const outputDir = path.join(__dirname, '../output/camera_complex_demo');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const config: WhiteboardConfig = {
        width: 1280,
        height: 720,
        scenes: [{
            id: 'complex_scene',
            camera: {
                virtualSize: { width: 4000, height: 3000 },
                followMode: 'manual', // Use keyframes instead of automatic hand following
                initial: { size: { width: 800, height: 450 }, position: { x: 500, y: 500 } },
                keyframes: [
                    {
                        startTime: 1.5,
                        targetLayerId: 'top_left',
                        zoom: 1.5,
                        padding: 100,
                        transitionDuration: 1.5,
                        easing: 'ease_in_out'
                    },
                    {
                        startTime: 6.0,
                        targetLayerId: 'center_box',
                        zoom: 1.0, // Zoom in closer
                        padding: 50,
                        transitionDuration: 1.5,
                        easing: 'out_bounce'
                    },
                    {
                        startTime: 9.0,
                        targetLayerId: 'bottom_right',
                        zoom: 1.2,
                        padding: 150,
                        transitionDuration: 1.5,
                        easing: 'ease_in_out'
                    },
                    // Manual Viewport Example (Camera 3 style)
                    {
                        startTime: 12.0,
                        position: { x: 2000, y: 1500 }, // Center of virtual canvas
                        size: { width: 1000, height: 1000 }, // A 1000x1000 box
                        transitionDuration: 2.0,
                        easing: 'in_out_cubic'
                    }
                ]
            },
            layers: [
                {
                    id: 'top_left',
                    type: 'shape',
                    shape: 'circle',
                    position: { x: 500, y: 500 },
                    radius: 150,
                    fillColor: '#4285F4',
                    entrance_animation: { type: 'draw', duration: 1.5, delay: 0 },
                    handOverlay: {
                        enabled: true,
                        scale: 0.8
                    }
                },
                {
                    id: 'center_box',
                    type: 'shape',
                    shape: 'rectangle',
                    position: { x: 2000, y: 1500 },
                    width: 400,
                    height: 300,
                    fillColor: '#EA4335',
                    entrance_animation: { type: 'draw', duration: 1.5, delay: 0 },
                    handOverlay: {
                        enabled: true,
                        scale: 0.8
                    }
                },
                {
                    id: 'bottom_right',
                    type: 'shape',
                    shape: 'star',
                    position: { x: 3500, y: 2500 },
                    radius: 200,
                    fillColor: '#FBBC05',
                    entrance_animation: { type: 'draw', duration: 1.5, delay: 0 },
                    handOverlay: {
                        enabled: true,
                        scale: 0.8
                    }
                }
            ]
        }]
    };

    const whiteboard = new ServerWhiteboard(config);
    console.log('Preparing complex whiteboard...');
    await whiteboard.prepare();

    const outputFile = path.join(outputDir, 'complex_camera.mp4');
    console.log(`Generating complex demo: ${outputFile}`);
    await whiteboard.renderToVideo(outputFile, {
        fps: 30,
        keepTemp: true
    });
    console.log('Complex demo completed!');
}

main().catch(console.error);

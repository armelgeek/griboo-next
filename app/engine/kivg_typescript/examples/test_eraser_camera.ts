/**
 * Test combining eraser layer with camera
 * Verifies that hand position correctly accounts for camera zoom/pan
 */

import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { SceneConfig } from '../src/shared/types';
import * as path from 'path';

async function runTest() {
    const width = 1920;
    const height = 1080;

    // Scene with camera and eraser layer
    const scene: SceneConfig = {
        id: 'test_scene',
        duration: 5,
        background: '#FFFFFF',
        camera: {
            virtualSize: {
                width: 2400,
                height: 1350
            },
            initial: {
                zoom: 1.0,
                position: { x: 0.5, y: 0.5 }
            },
            keyframes: [
                {
                    zoom: 1.5,
                    position: { x: 0.3, y: 0.3 },
                    startTime: 0,
                    duration: 2,
                    transitionDuration: 1,
                    easing: 'ease_in_out'
                },
                {
                    zoom: 2.0,
                    position: { x: 0.7, y: 0.7 },
                    startTime: 3,
                    duration: 2,
                    transitionDuration: 1,
                    easing: 'ease_in_out'
                }
            ]
        },
        layers: [
            {
                id: 'background_rect',
                type: 'shape',
                shapeType: 'rectangle',
                width: 800,
                height: 600,
                position: { x: 1200, y: 675 },
                fillColor: '#E0E0E0',
                entrance_animation: {
                    type: 'none'
                }
            },
            {
                id: 'eraser1',
                type: 'eraser',
                pattern: 'diagonal',
                entrance_animation: {
                    type: 'draw',
                    duration: 3,
                    delay: 1
                },
                handOverlay: {
                    enabled: true,
                    preset: 'eraser'
                }
            }
        ]
    };

    const whiteboard = new ServerWhiteboard({
        width,
        height,
        scenes: [scene]
    });

    const outputPath = path.join(__dirname, 'test_eraser_camera.mp4');
    console.log('🎥 Testing eraser layer with camera...');
    console.log(`   Output: ${outputPath}`);
    console.log('   Virtual size: 2400x1350, Output size: 1920x1080');
    console.log('   Camera: zoom from 1.5 to 2.0, pan from (0.3, 0.3) to (0.7, 0.7)');
    console.log('   Expected: Hand should stay aligned with eraser path throughout camera movement');

    await whiteboard.renderToVideo(outputPath, {
        fps: 30,
        parallelism: 4,
        keepTemp: false
    });

    console.log('✅ Test completed successfully!');
    console.log('   Please review the video to ensure hand stays aligned with eraser path');
}

runTest().catch(console.error);

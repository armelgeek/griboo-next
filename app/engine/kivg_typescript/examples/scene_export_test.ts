import * as fs from 'fs';
import * as path from 'path';
import { HybridVideoAnimator } from '../src/server/hybrid_video_animator';
import { HybridAnimatorConfig, SceneConfig } from '../src/shared/types';

async function runTest() {
    const inputPath = path.join(process.cwd(), 'test-images/sample.png');
    const outputDir = path.join(process.cwd(), 'output/scene_export_test');
    const videoOutputPath = path.join(outputDir, 'scene_animation.mp4');

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('🚀 Starting Server-side Scene Export Test');
    console.log(`  Output Dir: ${outputDir}`);
    console.log(`  Video Output: ${videoOutputPath}`);

    // Global Animator Config
    const animatorConfig: HybridAnimatorConfig = {
        width: 800,
        height: 600,
        background: [240, 240, 240, 255],
        handOverlay: {
            enabled: true,
            imageUrl: path.join(process.cwd(), 'assets/hand/drawing-hand.png'),
            scale: 0.5,
            offset: [0, 0]
        }
    };

    // Scene Configuration with multiple layers
    const sceneConfig: SceneConfig = {
        id: 'test-scene-1',
        layers: [
            // 1. Image Layer (Background Image)
            {
                id: 'bg-image',
                type: 'image',
                imageUrl: inputPath,
                width: 400,
                height: 400,
                position: { x: 200, y: 100 },
                entrance_animation: {
                    type: 'fade_in',
                    duration: 2.0,
                    delay: 0
                }
            },
            // 2. Kivg Layer (SVG Path - Star shape)
            {
                id: 'star-shape',
                type: 'kivg',
                pathData: 'M 100 10 L 123 80 L 195 80 L 136 120 L 158 190 L 100 150 L 42 190 L 64 120 L 5 80 L 77 80 Z',
                position: { x: 50, y: 50 },
                scale: 0.8,
                kivgConfig: {
                    strokeColor: '#FF5722',
                    strokeWidth: 4
                },
                entrance_animation: {
                    type: 'draw',
                    duration: 3.0,
                    delay: 1.0
                },
                handOverlay: {
                    enabled: true
                }
            },
            // 3. Text Layer
            {
                id: 'title-text',
                type: 'text',
                position: { x: 400, y: 550 },
                textConfig: {
                    text: 'Hello World from Server!',
                    fontSize: 48,
                    fontFamily: 'Arial',
                    color: '#333333',
                    textAlign: 'center'
                },
                entrance_animation: {
                    type: 'draw',
                    duration: 2.0,
                    delay: 3.0
                },
                handOverlay: {
                    enabled: true
                }
            },
            // 4. Hybrid Layer (Stroke + Fill animation)
            {
                id: 'hybrid-demo',
                type: 'hybrid',
                imageUrl: inputPath,
                width: 300,
                height: 300,
                position: { x: 450, y: 100 },
                hybridConfig: {
                    strokeDurationRatio: 0.6,
                    colorTolerance: 15.0,
                    minRegionSize: 30,
                    strokeWidth: 2,
                    fillDirection: 'diagonal'
                },
                entrance_animation: {
                    type: 'draw', // Hybrid layer uses its own internal animation logic, but we trigger it
                    duration: 5.0,
                    delay: 5.0
                },
                handOverlay: {
                    enabled: true
                }
            }
        ]
    };

    const videoAnimator = new HybridVideoAnimator(animatorConfig);

    try {
        await videoAnimator.renderSceneToVideo(sceneConfig, videoOutputPath, {
            frameCount: 150, // 5 seconds @ 30fps
            fps: 30,
            tempDir: path.join(outputDir, 'temp_frames')
        });
        console.log('\n✨ Test complete! Check the output directory for results.');
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

runTest().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});

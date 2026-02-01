import * as fs from 'fs';
import * as path from 'path';
import { HybridVideoAnimator } from '../src/server/hybrid_video_animator';
import { SceneConfig } from '../src/shared/types';

async function runTest() {
    const outputDir = path.join(process.cwd(), 'output/background_test');

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('🚀 Starting Background Rendering Test');
    console.log(`  Output Dir: ${outputDir}`);

    // Test 1: Solid Color Background
    console.log('\n--- Test 1: Solid Color Background ---');
    const solidColorScene: SceneConfig = {
        id: 'solid-color-test',
        background: '#e3f2fd', // Light blue
        layers: [
            {
                id: 'text-1',
                type: 'text',
                position: { x: 100, y: 300 },
                textConfig: {
                    text: 'Solid Color Background',
                    fontSize: 48,
                    color: '#1976d2'
                },
                entrance_animation: {
                    type: 'typewriter',
                    duration: 3.0
                }
            }
        ]
    };

    const videoAnimator1 = new HybridVideoAnimator({ width: 1920, height: 1080 });
    await videoAnimator1.renderSceneToVideo(
        solidColorScene,
        path.join(outputDir, 'solid_color.mp4'),
        { frameCount: 60, fps: 30 }
    );

    // Test 2: Dot Grid Background
    console.log('\n--- Test 2: Dot Grid Background ---');
    const dotGridScene: SceneConfig = {
        id: 'dot-grid-test',
        background: {
            color: '#ffffff',
            grid: {
                type: 'dots',
                size: 30,
                color: '#bdbdbd',
                opacity: 0.5
            }
        },
        layers: [
            {
                id: 'text-2',
                type: 'text',
                position: { x: 400, y: 300 },
                textConfig: {
                    text: 'Dot Grid Background',
                    fontSize: 48,
                    color: '#424242'
                },
                entrance_animation: {
                    type: 'fade_in',
                    duration: 1.0
                }
            }
        ]
    };

    const videoAnimator2 = new HybridVideoAnimator({ width: 1920, height: 1080 });
    await videoAnimator2.renderSceneToVideo(
        dotGridScene,
        path.join(outputDir, 'dot_grid.mp4'),
        { frameCount: 60, fps: 30 }
    );

    // Test 3: Line Grid Background
    console.log('\n--- Test 3: Line Grid Background ---');
    const lineGridScene: SceneConfig = {
        id: 'line-grid-test',
        background: {
            color: '#fafafa',
            grid: {
                type: 'lines',
                size: 50,
                color: '#e0e0e0',
                opacity: 0.7
            }
        },
        layers: [
            {
                id: 'text-3',
                type: 'text',
                position: { x: 400, y: 300 },
                textConfig: {
                    text: 'Line Grid Background',
                    fontSize: 48,
                    color: '#212121'
                },
                entrance_animation: {
                    type: 'fade_in',
                    duration: 1.0
                }
            }
        ]
    };

    const videoAnimator3 = new HybridVideoAnimator({ width: 1920, height: 1080 });
    await videoAnimator3.renderSceneToVideo(
        lineGridScene,
        path.join(outputDir, 'line_grid.mp4'),
        { frameCount: 60, fps: 30 }
    );

    // Test 4: Combined Grid and Color
    console.log('\n--- Test 4: Square Grid with Tinted Background ---');
    const squareGridScene: SceneConfig = {
        id: 'square-grid-test',
        background: {
            color: '#fff3e0', // Light orange
            grid: {
                type: 'squares',
                size: 40,
                color: '#ff9800',
                opacity: 0.3
            }
        },
        layers: [
            {
                id: 'text-4',
                type: 'text',
                position: { x: 400, y: 300 },
                textConfig: {
                    text: 'Square Grid Background',
                    fontSize: 48,
                    color: '#e65100'
                },
                entrance_animation: {
                    type: 'fade_in',
                    duration: 1.0
                }
            }
        ]
    };

    const videoAnimator4 = new HybridVideoAnimator({ width: 1920, height: 1080 });
    await videoAnimator4.renderSceneToVideo(
        squareGridScene,
        path.join(outputDir, 'square_grid.mp4'),
        { frameCount: 60, fps: 30 }
    );

    console.log('\n✨ Background test complete! Check the output directory for results.');
}

runTest().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});

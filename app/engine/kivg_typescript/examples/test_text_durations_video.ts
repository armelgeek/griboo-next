import * as path from 'path';
import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig, SceneConfig, LayerConfig } from '../src/shared/types';

async function testTextLayerDurations() {
    const outputDir = path.join(__dirname, '../output/test_durations');
    const assetsDir = path.join(__dirname, '../assets');

    const fs = require('fs');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('🎬 Creating test video with 3 text layers with different durations');

    const scene: SceneConfig = {
        id: 'duration-test',
        background: '#F0F8FF',
        timingConfig: {
            drawSpeed: 2.0 // 2x faster
        },
        layers: [
            {
                id: 'text1',
                type: 'text',
                textConfig: {
                    text: 'Layer 1 - Should animate for 2 seconds',
                    fontFamily: 'Arial',
                    fontSize: 50,
                    color: '#E74C3C',
                    textAlign: 'center'
                },
                position: { x: 960, y: 300 },
                entrance_animation: {
                    type: 'typewriter',
                    duration: 2.0  // 2 seconds
                },
                handOverlay: {
                    enabled: true,
                    imageUrl: path.join(assetsDir, 'hand/drawing-hand.png'),
                    scale: 0.3
                }
            } as LayerConfig,
            {
                id: 'text2',
                type: 'text',
                textConfig: {
                    text: 'Layer 2 - Should animate for 1 second',
                    fontFamily: 'Arial',
                    fontSize: 50,
                    color: '#3498DB',
                    textAlign: 'center'
                },
                position: { x: 960, y: 540 },
                entrance_animation: {
                    type: 'typewriter',
                    duration: 1.0  // 1 second (FAST)
                },
                handOverlay: {
                    enabled: true,
                    imageUrl: path.join(assetsDir, 'hand/drawing-hand.png'),
                    scale: 0.3
                }
            } as LayerConfig,
            {
                id: 'text3',
                type: 'text',
                textConfig: {
                    text: 'Layer 3 - Should animate for 3 seconds',
                    fontFamily: 'Arial',
                    fontSize: 50,
                    color: '#2ECC71',
                    textAlign: 'center'
                },
                position: { x: 960, y: 780 },
                entrance_animation: {
                    type: 'typewriter',
                    duration: 3.0  // 3 seconds (SLOW)
                },
                handOverlay: {
                    enabled: true,
                    imageUrl: path.join(assetsDir, 'hand/drawing-hand.png'),
                    scale: 0.3
                }
            } as LayerConfig
        ]
    };

    const config: WhiteboardConfig = {
        width: 1920,
        height: 1080,
        scenes: [scene]
    };

    const whiteboard = new ServerWhiteboard(config, 1920, 1080);

    console.log('📦 Preparing whiteboard...');
    await whiteboard.prepare();

    const sceneDuration = whiteboard['scenes'][0].getDuration();
    console.log(`📊 Scene Duration: ${sceneDuration}s (expected: 3s for (2+1+3)/2)`);

    const outputPath = path.join(outputDir, 'text_layer_durations_fast.mp4');
    console.log(`🎥 Rendering to ${outputPath}...`);

    await whiteboard.renderToVideo(outputPath, {
        fps: 30,
        parallelism: 4,
        keepTemp: true,
        tempDir: path.join(outputDir, 'temp')
    });

    console.log('✨ Test complete!');
    console.log(`\n📹 Watch the video at: ${outputPath}`);
    console.log('\n📝 Expected behavior:');
    console.log('  - Total video duration should be 3 seconds');
    console.log('  - Layer 1 (RED) should typewrite over 1 second (0s-1s)');
    console.log('  - Layer 2 (BLUE) should typewrite over 0.5 seconds (1s-1.5s) - VERY FAST');
    console.log('  - Layer 3 (GREEN) should typewrite over 1.5 seconds (1.5s-3s) - FAST');
    console.log('\n⚠️  If all layers typewrite at the same speed, the bug is confirmed!');
}

testTextLayerDurations().catch(console.error);

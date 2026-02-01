import * as fs from 'fs';
import * as path from 'path';
import { HybridLayerAnimator } from '../src/server/hybrid_layer_animator';
import { HybridVideoAnimator } from '../src/server/hybrid_video_animator';

import { HybridAnimatorConfig } from '../src/shared/types';

async function runTest() {
    const inputPath = path.join(__dirname, '../test-images/sample.png');
    const outputDir = path.join(__dirname, '../output/server_layer_test');
    const videoOutputPath = path.join(outputDir, 'animation.mp4');

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('🚀 Starting Server-side Hybrid Layer Animator Test');
    console.log(`  Input: ${inputPath}`);
    console.log(`  Output Dir: ${outputDir}`);
    console.log(`  Video Output: ${videoOutputPath}`);

    const config: HybridAnimatorConfig = {
        width: 400,
        height: 400,
        strokeDurationRatio: 0.6,
        colorTolerance: 15.0,
        minRegionSize: 30,
        strokeWidth: 1,
        fillDirection: 'diagonal',
        handOverlay: {
            enabled: true,
            imageUrl: path.join(__dirname, '../assets/hand/drawing-hand.png'),
            scale: 0.5,
            offset: [0, 0]
        }
    };
    

    // 1. Test Frame Rendering (Existing logic)
    console.log('\n--- Phase 1: Frame Rendering ---');
    const animator = new HybridLayerAnimator(config);
    console.log('  🔄 Preparing animator (loading and processing)...');
    const startTime = Date.now();
    await animator.prepare(inputPath);
    const processTime = Date.now() - startTime;
    console.log(`  ✅ Prepared in ${processTime}ms`);
    console.log(`    - Strokes: ${animator.getStrokeCount()}`);
    console.log(`    - Regions: ${animator.getColorRegionCount()}`);

    const frameCount = 120; // Increased for very fluid test
    const framesToRender = Array.from({ length: frameCount + 1 }, (_, i) => i / frameCount);
    console.log(`  🎬 Rendering ${framesToRender.length} frames...`);

    for (let i = 0; i < framesToRender.length; i++) {
        const progress = framesToRender[i];
        const frameBuffer = await animator.renderFrame(progress);

        const fileName = `frame_${i.toString().padStart(3, '0')}.png`;
        const filePath = path.join(outputDir, fileName);

        fs.writeFileSync(filePath, frameBuffer);
        if (i % 10 === 0) {
            console.log(`    ✅ Rendered ${fileName} (${Math.round(progress * 100)}%)`);
        }
    }

    // 2. Test Video Export (New logic)
    console.log('\n--- Phase 2: Video Export ---');
    const videoAnimator = new HybridVideoAnimator(config);
    await videoAnimator.renderToVideo(inputPath, videoOutputPath, {
        frameCount: 120,
        fps: 60,
        tempDir: path.join(outputDir, 'temp_frames')
    });

    console.log('\n✨ Test complete! Check the output directory for results.');
}

runTest().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});

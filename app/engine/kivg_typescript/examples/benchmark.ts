import * as fs from 'fs';
import * as path from 'path';
import { HybridVideoAnimator } from '../src/server/hybrid_video_animator';
import { SceneConfig } from '../src/shared/types';

async function runBenchmark() {
    const outputDir = path.join(process.cwd(), 'output/benchmark');

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('🚀 Starting Performance Benchmark');
    console.log(`  Output Dir: ${outputDir}\n`);

    // Create a test scene with multiple layers
    const testScene: SceneConfig = {
        id: 'benchmark-scene',
        background: {
            color: '#ffffff',
            grid: {
                type: 'dots',
                size: 30,
                color: '#e0e0e0',
                opacity: 0.3
            }
        },
        layers: [
            {
                id: 'text-1',
                type: 'text',
                position: { x: 400, y: 150 },
                textConfig: {
                    text: 'Performance Benchmark',
                    fontSize: 52,
                    color: '#1976d2'
                },
                entrance_animation: {
                    type: 'typewriter',
                    duration: 2.0
                },
                handOverlay: { enabled: true }
            },
            {
                id: 'text-2',
                type: 'text',
                position: { x: 400, y: 300 },
                textConfig: {
                    text: 'Testing Parallel Rendering',
                    fontSize: 36,
                    color: '#424242'
                },
                entrance_animation: {
                    type: 'typewriter',
                    duration: 2.0,
                    delay: 2.0
                },
                handOverlay: { enabled: true }
            },
            {
                id: 'text-3',
                type: 'text',
                position: { x: 400, y: 450 },
                textConfig: {
                    text: 'Multiple Layers & Complex Timing',
                    fontSize: 32,
                    color: '#757575'
                },
                entrance_animation: {
                    type: 'fade_in',
                    duration: 1.0,
                    delay: 4.0
                }
            }
        ]
    };

    const parallelismLevels = [1, 2, 4, 8];
    const results: { parallelism: number; time: number; fps: number }[] = [];

    for (const parallelism of parallelismLevels) {
        console.log(`\n--- Test: Parallelism = ${parallelism} ---`);

        const animator = new HybridVideoAnimator({ width: 800, height: 600 });
        const outputPath = path.join(outputDir, `benchmark_p${parallelism}.mp4`);

        const startTime = Date.now();

        await animator.renderSceneToVideo(
            testScene,
            outputPath,
            {
                fps: 30,
                parallelism: parallelism,
                tempDir: path.join(outputDir, `temp_p${parallelism}`)
            }
        );

        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000; // seconds
        const renderFps = duration > 0 ? (5 * 30) / duration : 0; // 5 seconds of video at 30fps

        results.push({
            parallelism,
            time: duration,
            fps: renderFps
        });

        console.log(`  ⏱️  Total time: ${duration.toFixed(2)}s`);
        console.log(`  🎬 Rendering throughput: ${renderFps.toFixed(2)} frames/sec`);
    }

    // Print summary
    console.log('\n\n═══════════════════════════════════════');
    console.log('           BENCHMARK RESULTS           ');
    console.log('═══════════════════════════════════════');
    console.log('Parallelism | Time (s) | Throughput (fps) | Speedup');
    console.log('-----------|---------|-----------------|--------');

    const baselineTime = results[0].time;

    results.forEach(result => {
        const speedup = baselineTime / result.time;
        console.log(
            `    ${result.parallelism.toString().padStart(2)}     | ` +
            `${result.time.toFixed(2).padStart(7)} | ` +
            `${result.fps.toFixed(2).padStart(16)} | ` +
            `${speedup.toFixed(2)}x`
        );
    });

    console.log('═══════════════════════════════════════\n');

    // Save results to file
    const resultsPath = path.join(outputDir, 'benchmark_results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`📊 Results saved to: ${resultsPath}`);

    console.log('\n✨ Benchmark complete!');
}

runBenchmark().catch(err => {
    console.error('❌ Benchmark failed:', err);
    process.exit(1);
});

import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types';
import * as path from 'path';
import { TimingManager } from '../src/shared/infra/timing_manager';

async function verifyServerParallel() {
    console.log('🧪 Verifying Server-Side Parallel Animations...');

    const config: WhiteboardConfig = {
        width: 800,
        height: 450,
        scenes: [
            {
                id: "test-parallel",
                duration: 5,
                layers: [
                    {
                        id: "parallel-svg",
                        type: "kivg",
                        svgUrl: path.join(__dirname, '../static/demo/icons/typescript.svg'),
                        position: { x: 200, y: 200 },
                        width: 100,
                        height: 100,
                        anim_type: 'par',
                        path_delay: 0.5, // 0.5s delay between paths
                        entrance_animation: {
                            type: "draw",
                            duration: 2.0
                        }
                    },
                    {
                        id: "parallel-shape",
                        type: "shape",
                        shape: 'star',
                        position: { x: 500, y: 200 },
                        width: 100,
                        anim_type: 'par',
                        path_delay: 0.2,
                        entrance_animation: {
                            type: "draw",
                            duration: 2.0
                        }
                    }
                ]
            }
        ]
    };

    const whiteboard = new ServerWhiteboard(config);

    console.log('  🔄 Preparing whiteboard...');
    await whiteboard.prepare();
    console.log('  ✅ Preparation complete');

    const scene = whiteboard.getScene("test-parallel")!;
    const layers = scene.getLayers();
    const svgLayer = layers.find((l: any) => l.getConfig().id === "parallel-svg") as any;
    const shapeLayer = layers.find((l: any) => l.getConfig().id === "parallel-shape") as any;

    console.log('\n📊 Timing Checks:');
    const svgTiming = TimingManager.calculateLayerTiming(svgLayer.config);
    console.log(`  SVG Entrance Duration: ${svgTiming.animationDuration}s`);

    // Check if totalAnimationLength in svgLayer accounts for gaps
    // We expect totalAnimationLength > sum of path lengths if path_delay > 0
    if (svgLayer.totalAnimationLength > 0) {
        console.log(`  SVG Total Animation "Length" (with gaps): ${svgLayer.totalAnimationLength.toFixed(2)}`);
    }

    console.log('\n🎬 Frame Logic Checks:');
    // Test a frame in the middle of animation
    const midTime = 1.0;

    // For SVG Layer
    console.log(`  SVG at ${midTime}s (Parallel):`);
    // We can't easily check private state, but we can check if it renders without error
    const dummyCtx = {
        save: () => { },
        restore: () => { },
        translate: () => { },
        scale: () => { },
        rotate: () => { },
        beginPath: () => { },
        moveTo: () => { },
        lineTo: () => { },
        stroke: () => { },
        fill: () => { },
        setLineDash: () => { },
        closePath: () => { },
    } as any;

    try {
        await svgLayer.doRender(dummyCtx, midTime);
        console.log('    ✅ SVG Parallel Render OK');
    } catch (e) {
        console.error('    ❌ SVG Parallel Render Failed:', e);
    }

    // For Shape Layer
    console.log(`  Shape at ${midTime}s (Parallel):`);
    try {
        await shapeLayer.doRender(dummyCtx, midTime);
        console.log('    ✅ Shape Parallel Render OK');
    } catch (e) {
        console.error('    ❌ Shape Parallel Render Failed:', e);
    }

    console.log('\n✨ Verification script finished.');
}

verifyServerParallel().catch(err => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
});

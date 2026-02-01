import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

async function runAdvancedExportTest() {
    const outputDir = path.join(__dirname, '../output/advanced_test');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('🚀 Starting Advanced Export Test');
    console.log(`💻 System: ${os.cpus().length} CPU cores detected`);

    const config: WhiteboardConfig = {
        width: 1280,
        height: 720,
        background: "#ffffff",
        subtitles: {
            enabled: true,
            style: {
                fontSize: 32,
                color: "#ffffff",
                backgroundColor: "#000000",
                backgroundOpacity: 0.8,
                stroke: { color: "#000000", width: 2 }
            },
            segments: [
                { id: "s1", startTime: 0, endTime: 2000, text: "Wait for it... Parallel rendering!" },
                { id: "s2", startTime: 2000, endTime: 4000, text: "Using all available cores for speed." },
                { id: "s3", startTime: 4000, endTime: 6000, text: "H.265 encoding for smaller file size." }
            ]
        },
        scenes: [
            {
                id: "scene1",
                background: "#f8fafc",
                layers: [
                    {
                        id: "text1",
                        type: "text",
                        position: { x: 640, y: 360 },
                        textConfig: {
                            text: "Parallel Rendering",
                            fontSize: 72,
                            fontFamily: "Caveat",
                            color: "#0f172a",
                            strokeAnimation: { duration: 2, mode: 'draw' }
                        },
                        handOverlay: { enabled: true },
                        entrance_animation: { type: "draw", duration: 2, delay: 0 }
                    }
                ]
            },
            {
                id: "scene2",
                background: "#f1f5f9",
                transition: { type: "eraser", duration: 1.5, eraserPattern: "diagonal" },
                layers: [
                    {
                        id: "text2",
                        type: "text",
                        position: { x: 640, y: 360 },
                        textConfig: {
                            text: "Fast. Efficient. KIVG.",
                            fontSize: 72,
                            fontFamily: "Caveat",
                            color: "#1e293b",
                            strokeAnimation: { duration: 1.5, mode: 'draw' }
                        },
                        handOverlay: { enabled: true },
                        entrance_animation: { type: "draw", duration: 1.5, delay: 0 }
                    }
                ]
            }
        ]
    };

    const whiteboard = new ServerWhiteboard(config);

    // 1. Parallel Render with H.265
    console.log('\n🎬 Case 1: Parallel Render + H.265 (libx265)');
    const pathH265 = path.join(outputDir, 'parallel_h265.mp4');
    const start = Date.now();
    await whiteboard.renderToVideo(pathH265, {
        resolution: '720p',
        parallelism: 4, // Stress testing parallel rendering
        codec: 'libx265',
        quality: 20,
        onProgress: (p) => process.stdout.write(`\rProgress: ${(p * 100).toFixed(1)}%`)
    });
    console.log(`\n✅ H.265 export complete in ${((Date.now() - start) / 1000).toFixed(1)}s`);

    // 2. Sequential Render for comparison (if you want to compare speed)
    /*
    console.log('\n🎬 Case 2: Sequential Render (libx264)');
    const pathH264 = path.join(outputDir, 'sequential_h264.mp4');
    const startSeq = Date.now();
    await whiteboard.renderToVideo(pathH264, {
        resolution: '720p',
        parallelism: 1,
        codec: 'libx264',
        quality: 23
    });
    console.log(`✅ Sequential export complete in ${((Date.now() - startSeq) / 1000).toFixed(1)}s`);
    */

    console.log('\n✨ Advanced tests complete! Check the output folder.');
}

runAdvancedExportTest().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});

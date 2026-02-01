/**
 * HTTP Assets Test
 * Tests the HTTP asset loading with cache system
 */

import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types';
import { getGlobalCache } from '../src/server/utils/asset_cache';
import * as path from 'path';
import * as fs from 'fs';

async function runHttpAssetsTest() {
    const outputDir = path.join(__dirname, '../output/http_test');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const videoOutputPath = path.join(outputDir, 'http_assets_test.mp4');

    console.log('🚀 Starting HTTP Assets Test');
    console.log(`   Output Dir: ${outputDir}`);
    console.log(`   Video Output: ${videoOutputPath}`);

    // Example HTTP URLs (using placeholder.com for testing)
    // In real use, replace with your actual asset URLs
    const HTTP_IMAGE_URL = 'https://via.placeholder.com/300x300';
    const HTTP_SVG_URL = 'https://dev.w3.org/SVG/tools/svgweb/samples/svg-files/410.svg';

    const config: WhiteboardConfig = {
        width: 800,
        height: 450,
        debug: true,
        background: "#f0f9ff",
        scenes: [
            {
                id: "http_test_scene",
                background: "#f0f9ff",
                camera: {
                    virtualSize: { width: 1000, height: 1000 },
                    followMode: 'manual',
                    initial: {
                        size: { width: 1000, height: 1000 },
                        zoom: 1,
                        position: { x: 400, y: 200 }
                    },
                    keyframes: []
                },
                layers: [
                    {
                        id: "http-title",
                        type: "text",
                        position: { x: 400, y: 60 },
                        textConfig: {
                            text: "HTTP Assets Test",
                            fontFamily: "sans-serif",
                            fontSize: 36,
                            color: "#0c4a6e",
                            strokeAnimation: {
                                duration: 1.5,
                                mode: 'typewriter',
                            }
                        },
                        handOverlay: {
                            enabled: true
                        },
                        entrance_animation: {
                            type: "draw",
                            duration: 1.5,
                            delay: 0
                        }
                    },
                    {
                        id: "http-image",
                        type: "image",
                        position: { x: 200, y: 200 },
                        width: 150,
                        height: 150,
                        imageUrl: HTTP_IMAGE_URL,  // HTTP URL!
                        handOverlay: {
                            enabled: true
                        },
                        entrance_animation: {
                            type: "fade_in",
                            duration: 1.0,
                            delay: 1.5
                        }
                    },
                    {
                        id: 'http-push',
                        type: 'push',
                        position: { x: 600, y: 200 },
                        handOverlay: {
                            enabled: true
                        },
                        entrance_animation: {
                            type: 'push',
                            duration: 2,
                            delay: 2.5
                        },
                        pushConfig: {
                            imageUrl: HTTP_IMAGE_URL,  // HTTP URL!
                            width: 120,
                            height: 120,
                            from: 'right',
                            pushEasing: 'out_cubic'
                        }
                    }
                ]
            }
        ]
    };

    // Get cache stats before
    const cacheBefore = getGlobalCache().getStats();
    console.log('\n📊 Cache stats BEFORE:');
    console.log(`   Entries: ${cacheBefore.entries}`);
    console.log(`   Size: ${Math.round(cacheBefore.totalSize / 1024)}KB`);
    console.log(`   Utilization: ${cacheBefore.utilizationPercent.toFixed(2)}%`);

    const whiteboard = new ServerWhiteboard(config, 800, 450);

    console.log('\n🔄 Preparing whiteboard (downloading HTTP assets)...');
    const prepareStart = Date.now();
    await whiteboard.prepare();
    const prepareTime = Date.now() - prepareStart;
    console.log(`✅ Preparation complete in ${prepareTime}ms`);

    // Get cache stats after preparation
    const cacheAfter = getGlobalCache().getStats();
    console.log('\n📊 Cache stats AFTER preparation:');
    console.log(`   Entries: ${cacheAfter.entries}`);
    console.log(`   Size: ${Math.round(cacheAfter.totalSize / 1024)}KB`);
    console.log(`   Utilization: ${cacheAfter.utilizationPercent.toFixed(2)}%`);

    console.log('\n🎬 Rendering video...');
    const renderStart = Date.now();
    await whiteboard.renderToVideo(videoOutputPath, {
        fps: 30,
        keepTemp: false
    });
    const renderTime = Date.now() - renderStart;

    console.log('\n📊 Performance Summary:');
    console.log(`   Preparation: ${prepareTime}ms`);
    console.log(`   Rendering: ${renderTime}ms`);
    console.log(`   Total: ${prepareTime + renderTime}ms`);
    console.log(`   Cache hits: Assets loaded from cache during render`);

    // Final cache stats
    const cacheFinal = getGlobalCache().getStats();
    console.log('\n📊 Final Cache stats:');
    console.log(`   Entries: ${cacheFinal.entries}`);
    console.log(`   Size: ${Math.round(cacheFinal.totalSize / 1024)}KB`);

    console.log('\n✨ Test complete! Check the output directory for results.');
    console.log('\n💡 Tip: Run this test again to see cache performance improvement!');
}

runHttpAssetsTest().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});

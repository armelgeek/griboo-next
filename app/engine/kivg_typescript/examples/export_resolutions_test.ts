import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types';
import * as path from 'path';
import * as fs from 'fs';

async function runResolutionTest() {
    const outputDir = path.join(__dirname, '../output/resolution_test');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('🚀 Starting Resolution and Quality Test');

    const config: WhiteboardConfig = {
        width: 800,
        height: 450,
        background: "#ffffff",
        subtitles: {
            enabled: true,
            style: {
                fontSize: 24,
                color: "#ffffff",
                backgroundColor: "#000000",
                backgroundOpacity: 0.7
            },
            segments: [
                { id: "seg1", startTime: 0, endTime: 2000, text: "Testing 480p resolution" },
                { id: "seg2", startTime: 2000, endTime: 4000, text: "High quality export at 1080p" }
            ]
        },
        hands: {
            draw: {
                imageUrl: path.join(__dirname, '../static/hand/drawing-hand.png'),
                scale: 1,
                offset: [-9, -10]
            }
        },
        scenes: [
            {
                id: "scene1",
                background: "#f0f9ff",
                layers: [
                    {
                        id: "title",
                        type: "text",
                        position: { x: 400, y: 225 },
                        textConfig: {
                            text: "Resolution Test",
                            fontFamily: "sans-serif",
                            fontSize: 48,
                            color: "#0c4a6e",
                            strokeAnimation: {
                                duration: 2,
                                mode: 'draw'
                            }
                        },
                        handOverlay: { enabled: true },
                        entrance_animation: { type: "draw", duration: 2, delay: 0 }
                    }
                ]
            },
            {
                id: "scene2",
                background: "#fff1f2",
                transition: {
                    type: "eraser",
                    duration: 1.5,
                    eraserPattern: "diagonal"
                },
                layers: [
                    {
                        id: "content",
                        type: "text",
                        position: { x: 400, y: 225 },
                        textConfig: {
                            text: "Transition Test",
                            fontFamily: "sans-serif",
                            fontSize: 48,
                            color: "#be123c",
                            strokeAnimation: {
                                duration: 1,
                                mode: 'draw'
                            }
                        },
                        handOverlay: { enabled: true },
                        entrance_animation: { type: "draw", duration: 1, delay: 0 }
                    }
                ]
            }
        ]
    };

    const whiteboard = new ServerWhiteboard(config);

    // 1. Test 480p
    console.log('\n🎬 Rendering 480p (Medium Quality)...');
    const path480p = path.join(outputDir, 'test_480p.mp4');
    await whiteboard.renderToVideo(path480p, {
        resolution: '480p'
    });
    console.log(`✅ 480p export complete: ${path480p}`);

    // 2. Test 1080p
    console.log('\n🎬 Rendering 1080p (Maximum Quality)...');
    const path1080p = path.join(outputDir, 'test_1080p.mp4');
    await whiteboard.renderToVideo(path1080p, {
        resolution: '1080p'
    });
    console.log(`✅ 1080p export complete: ${path1080p}`);

    console.log('\n✨ All tests complete!');
}

runResolutionTest().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});

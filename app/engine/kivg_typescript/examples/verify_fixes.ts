import { ServerWhiteboard } from '../src/server/core/whiteboard.ts';
import { WhiteboardConfig, AnimationType, EmphasisAnimationType } from '../src/shared/types';
import * as path from 'path';
import * as fs from 'fs';

async function verifyBrokenAnimations() {
    const outputDir = path.join(__dirname, '../output/animation_verification');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const videoOutputPath = path.join(outputDir, 'broken_animations_fix.mp4');

    const testCases: { name: string, entrance?: any, exit?: any, emphasis?: any }[] = [
        { name: 'Click Entrance', entrance: { type: 'click', duration: 1.0 } },
        { name: 'Pulse Emphasis', emphasis: { type: 'pulse', duration: 1.0, iterations: 2 } },
        { name: 'Bounce Entrance', entrance: { type: 'bounce', duration: 1.0 } },
        { name: 'Bounce In Entrance', entrance: { type: 'bounce_in', duration: 1.0 } },
        { name: 'Bounce Out Exit', exit: { type: 'bounce_out', duration: 1.0 } },
        { name: 'Eraser Exit', exit: { type: 'eraser', duration: 1.5 } },
        { name: 'Flip Out Y Exit', exit: { type: 'flip_out_y', duration: 1.0 } },
        { name: 'Heart Beat Emphasis', emphasis: { type: 'heart_beat', duration: 1.0, iterations: 2 } },
        { name: 'Back Out Right Exit', exit: { type: 'back_out_right', duration: 1.0 } },
        { name: 'Bounce Out Right Exit', exit: { type: 'bounce_out_right', duration: 1.0 } },
        { name: 'Reveal Horizontal Entrance', entrance: { type: 'reveal_horizontal', duration: 1.0 } },
        { name: 'Reveal Diagonal Entrance', entrance: { type: 'reveal_diagonal', duration: 1.0 } }
    ];

    const config: WhiteboardConfig = {
        width: 1280,
        height: 720,
        background: "#0f172a",
        scenes: []
    };

    for (const test of testCases) {
        config.scenes!.push({
            id: `scene_${test.name.replace(/ /g, '_')}`,
            layers: [
                {
                    id: `label_${test.name}`,
                    type: 'text',
                    position: { x: 640, y: 100 },
                    textConfig: {
                        text: test.name,
                        fontFamily: "sans-serif",
                        fontSize: 48,
                        color: "#f8fafc",
                    }
                },
                {
                    id: `subject_${test.name}`,
                    type: 'shape',
                    shape: 'rectangle',
                    width: 400,
                    height: 250,
                    fillColor: '#3b82f6',
                    position: { x: 640, y: 400 },
                    entrance_animation: test.entrance || { type: 'fade_in', duration: 0.5 },
                    exit_animation: test.exit || { type: 'none', duration: 0.1 },
                    emphasis_animation: test.emphasis,
                    timingConfig: {
                        pauseTime: test.emphasis ? 2.5 : 0.5
                    }
                }
            ]
        });
    }

    const whiteboard = new ServerWhiteboard(config, 1280, 720);
    await whiteboard.prepare();
    await whiteboard.renderToVideo(videoOutputPath, {
        fps: 30,
        resolution: '720p',
        parallelism: 'auto'
    });

    console.log(`✨ Broken animations verification complete: ${videoOutputPath}`);
}

verifyBrokenAnimations().catch(console.error);

import { ServerWhiteboard } from '../src/server/core/whiteboard';
import * as path from 'path';
import * as fs from 'fs';
import { createCanvas } from 'canvas';

async function debugInitialFrames() {
    console.log('🔍 Debugging Initial Frames and Transitions...');

    const outputDir = path.join(process.cwd(), 'output', 'debug_flash');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const whiteboard = new ServerWhiteboard({
        width: 1280,
        height: 720
    });

    // Scene 1: 2s text
    whiteboard.addScene({
        id: 'scene-1',
        layers: [
            {
                id: 'text-1',
                type: 'text',
                position: { x: 640, y: 360 },
                textConfig: {
                    text: 'Scene 1',
                    fontSize: 80,
                    strokeAnimation: { mode: 'draw', duration: 2 }
                }
            }
        ],
        transition: { type: 'fade', duration: 1.0 }
    } as any);

    // Scene 2: SVG icon
    whiteboard.addScene({
        id: 'scene-2',
        layers: [
            {
                id: 'svg-icon',
                type: 'kivg',
                position: { x: 640, y: 360 },
                width: 300,
                height: 300,
                svg_path: 'assets/icons/typescript.svg',
                entrance_animation: { type: 'draw', duration: 2 }
            }
        ]
    } as any);

    await whiteboard.prepare();

    console.log('🎬 Rendering transition frames...');
    for (let t = 1.9; t <= 2.1; t += 0.033) {
        console.log(`📸 Rendering at time ${t.toFixed(4)}s...`);
        const s1 = whiteboard.getScene('scene-1')!;
        const s2 = whiteboard.getScene('scene-2')!;

        // During transition (t >= 2.0), s2 should stay at time 0 in the real engine
        const s2Time = t < 2.0 ? 0 : 0;

        const buffer1 = await s1.renderFrame(t);
        const buffer2 = await s2.renderFrame(s2Time);

        fs.writeFileSync(path.join(outputDir, `s1_t${t.toFixed(3)}.png`), buffer1);
        fs.writeFileSync(path.join(outputDir, `s2_t${t.toFixed(3)}.png`), buffer2);

        const p1 = s1.getLayers()[0].getAnimationProgress(t);
        const p2 = s2.getLayers()[0].getAnimationProgress(s2Time);
        console.log(`   - S1 Progress: ${p1.toFixed(4)}`);
        console.log(`   - S2 Progress: ${p2.toFixed(4)}`);
    }

    console.log(`✅ Debug frames saved to ${outputDir}`);
}

debugInitialFrames().catch(console.error);

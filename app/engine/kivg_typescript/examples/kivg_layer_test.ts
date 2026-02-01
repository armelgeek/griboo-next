import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { ServerScene } from '../src/server/core/scene';
import { ServerKivgLayer } from '../src/server/layers/kivg_layer';
import * as path from 'path';
import * as fs from 'fs';

async function runTest() {
    console.log('🚀 Starting Kivg Layer Test...');

    const outputDir = path.join(process.cwd(), 'output', 'kivg_layer_test');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const whiteboard = new ServerWhiteboard({
        width: 1280,
        height: 720
    }, 1920, 1080);

    // Read an SVG icon from assets
    const iconPath = path.join(process.cwd(), 'assets', 'icons', 'typescript.svg');
    const svgContent = fs.readFileSync(iconPath, 'utf8');

    const sceneConfig = {
        id: 'kivg-scene',
        layers: [
            {
                id: 'kivg-layer-icon',
                type: 'kivg',
                position: { x: 640, y: 360 },
                scale: 1.0,
                width: 400,
                height: 400,
                svg_path: iconPath,
                entrance_animation: {
                    type: 'draw',
                    duration: 3
                },
                handOverlay: {
                    enabled: true,
                    scale: 0.9
                },
                kivgConfig: {
                    fillMode: 'end' // Explicitly test fill fade-in
                }
            } as any
        ]
    };

    whiteboard.addScene(sceneConfig as any);

    console.log('🎬 Rendering Kivg layer video...');
    const videoPath = path.join(outputDir, 'kivg_test.mp4');
    await whiteboard.renderToVideo(videoPath);

    console.log(`✨ Kivg layer test finished! Results in: ${outputDir}`);
    console.log(`✅ Video saved to ${videoPath}`);
}

runTest().catch(console.error);

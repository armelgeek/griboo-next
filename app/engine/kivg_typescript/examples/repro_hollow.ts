import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types';
import * as path from 'path';
import * as fs from 'fs';

async function runRepro() {
    const outputDir = path.join(process.cwd(), 'output/hollow_test');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const config: WhiteboardConfig = {
        width: 1280,
        height: 720,
        scenes: [
            {
                id: 'scene-hollow',
                background: '#ffffff',
                duration: 4,
                layers: [
                    {
                        id: 'text-hollow',
                        type: 'text',
                        position: { x: 640, y: 360 },
                        textConfig: {
                            text: 'Typewriter M',
                            fontSize: 120,
                            fontFamily: 'Caveat',
                            color: '#4B00FF',
                            textAlign: 'center',
                            strokeAnimation: {
                                mode: 'typewriter',
                                duration: 3.0
                            }
                        }
                    }
                ]
            }
        ]
    };

    console.log('🚀 Starting Hollow Letters Repro');
    const whiteboard = new ServerWhiteboard(config, 1280, 720);
    await whiteboard.prepare();

    // Save the generated SVG for analysis
    const scene = (whiteboard as any).scenes[0];
    const layer = scene.layers[0];
    const svgContent = (layer.config as any).svgContent;
    if (svgContent) {
        fs.writeFileSync(path.join(outputDir, 'generated.svg'), svgContent);
        console.log(`Saved generated SVG to ${path.join(outputDir, 'generated.svg')}`);
    }

    const outputPath = path.join(outputDir, 'hollow_test.mp4');
    console.log(`Rendering to ${outputPath}...`);

    await whiteboard.renderToVideo(outputPath, {
        fps: 30,
        tempDir: path.join(outputDir, 'temp_frames')
    });

    console.log('\n✨ Repro finished! Results in:', outputDir);
}

runRepro().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});

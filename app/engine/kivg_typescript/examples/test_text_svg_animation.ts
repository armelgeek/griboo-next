import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { SceneConfig } from '../src/shared/types';
import * as path from 'path';
import * as fs from 'fs';

async function testTextSvgAnimation() {
    const outputDir = path.join(process.cwd(), 'output', 'text_svg_test');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const scene: SceneConfig = {
        id: 'scene1',
        duration: 5,
        layers: [
            {
                id: 'text1',
                type: 'text',
                position: { x: 400, y: 225 },
                textConfig: {
                    text: 'Griboo Text SVG',
                    fontSize: 80,
                    fontFamily: 'Patrick Hand',
                    textAlign: 'center'
                },
                entrance_animation: {
                    type: 'draw',
                    duration: 3,
                    delay: 0.5
                }
            }
        ]
    };

    const whiteboard = new ServerWhiteboard({
        width: 1920,
        height: 1080,
        scenes: [scene]
    }, 1920, 1080);

    console.log('Rendering video with Text-SVG layer...');
    const videoPath = path.join(outputDir, 'text_svg_animation.mp4');
    await whiteboard.renderToVideo(videoPath);
    console.log(`Video rendered to ${videoPath}`);
}

testTextSvgAnimation().catch(console.error);

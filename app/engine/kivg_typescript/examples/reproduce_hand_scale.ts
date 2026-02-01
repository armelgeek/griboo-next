import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types';
import * as path from 'path';
import * as fs from 'fs';

async function reproduceHandScale() {
    const outputDir = path.join(__dirname, '../output/reproduce_scale');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const config: WhiteboardConfig = {
        width: 800,
        height: 450,
        hands: {
            draw: {
                imageUrl: path.join(__dirname, '../static/hand/drawing-hand.png'),
                scale: 1, // Set to 1 as in user's example
                offset: [-9, -10]
            }
        },
        scenes: [
            {
                id: "scene1",
                camera: {
                    virtualSize: { width: 800, height: 450 },
                    initial: {
                        zoom: 0.5, // ZOOMED OUT
                        position: { x: 0.5, y: 0.5 }
                    }
                },
                layers: [
                    {
                        id: "layer1",
                        type: "shape",
                        shape: "circle",
                        width: 100,
                        position: { x: 400, y: 225 },
                        entrance_animation: {
                            type: "draw",
                            duration: 1
                        }
                    }
                ]
            }
        ]
    };

    const whiteboard = new ServerWhiteboard(config, 800, 450);
    await whiteboard.prepare();

    const scene = whiteboard.getScene('scene1')!;
    // Render a frame at t=0.5 where drawing is happening
    const frameBuffer = await scene.renderFrame(0.5);
    fs.writeFileSync(path.join(outputDir, 'frame_zoom_0_5.png'), frameBuffer);

    // Render a frame with zoom 1.0 for comparison
    const config2: WhiteboardConfig = JSON.parse(JSON.stringify(config));
    config2.scenes![0].camera!.initial!.zoom = 1.0;
    const whiteboard2 = new ServerWhiteboard(config2, 800, 450);
    await whiteboard2.prepare();
    const scene2 = whiteboard2.getScene('scene1')!;
    const frameBuffer2 = await scene2.renderFrame(0.5);
    fs.writeFileSync(path.join(outputDir, 'frame_zoom_1_0.png'), frameBuffer2);

    console.log('✅ Reproduced frames saved to output/reproduce_scale');
}

reproduceHandScale().catch(console.error);

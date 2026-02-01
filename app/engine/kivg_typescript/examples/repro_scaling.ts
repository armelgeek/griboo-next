
import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types';
import * as path from 'path';
import * as fs from 'fs';

async function repro() {
    const config: WhiteboardConfig = {
        width: 800,
        height: 600,
        background: "#ffffff",
        scenes: [
            {
                id: "scene1",
                duration: 2,
                layers: [
                    {
                        id: "layer1",
                        type: "shape",
                        shape: "rectangle",
                        position: { x: 400, y: 300 },
                        width: 400,
                        height: 300,
                        fillColor: "#ff0000",
                        entrance_animation: { type: "draw", duration: 1 }
                    }
                ],
                transition: {
                    type: "eraser",
                    duration: 1,
                    eraserPattern: "diagonal"
                }
            },
            {
                id: "scene2",
                duration: 1,
                layers: [
                    {
                        id: "layer2",
                        type: "shape",
                        shape: "circle",
                        position: { x: 400, y: 300 },
                        radius: 100,
                        fillColor: "#0000ff",
                        entrance_animation: { type: "fade_in", duration: 0.5 }
                    }
                ]
            }
        ]
    };

    const whiteboard = new ServerWhiteboard(config);
    const outputDir = path.join(__dirname, '../output/repro_scaling');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    console.log("--- 800x600 (1x) ---");
    await whiteboard.renderToVideo(path.join(outputDir, '800_trans.mp4'), {
        resolution: { width: 800, height: 600 }
    });

    console.log("--- 1920x1080 (2.4x) ---");
    await whiteboard.renderToVideo(path.join(outputDir, '1080_trans.mp4'), {
        resolution: '1080p'
    });
}

repro().catch(console.error);

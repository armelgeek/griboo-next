import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types.ts';
import * as path from 'path';
import * as fs from 'fs';

async function reproduceTransitionShift() {
    const outputDir = path.join(__dirname, '../output/reproduce_transition_shift');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const config: WhiteboardConfig = {
        width: 800,
        height: 450,
        scenes: [
            {
                id: "scene1",
                duration: 2,
                camera: {
                    virtualSize: { width: 800, height: 450 },
                    initial: {
                        zoom: 2.0,
                        position: { x: 0.2, y: 0.2 } // Panned to top-left
                    }
                },
                layers: [
                    {
                        id: "layer1",
                        type: "shape",
                        shape: "circle",
                        width: 100,
                        position: { x: 160, y: 90 }, // Should be visible in zoomed camera
                        entrance_animation: {
                            type: "fade",
                            duration: 0.5
                        }
                    }
                ],
                transition: {
                    type: "eraser",
                    duration: 1.0
                }
            },
            {
                id: "scene2",
                layers: []
            }
        ]
    };

    const whiteboard = new ServerWhiteboard(config as any, 800, 450);
    await whiteboard.prepare();

    const scene = whiteboard.getScene('scene1')!;

    // 1. Render a frame BEFORE transition (at t=1.0)
    const frameBufferBefore = await scene.renderFrame(1.0);
    fs.writeFileSync(path.join(outputDir, 'frame_before_transition.png'), frameBufferBefore);

    // 2. Render a frame AT START of transition (progress = 0%)
    // Transition starts at sceneDuration - transitionDuration = 2 - 1 = 1.0
    // We use whiteboard.renderFrame(1.0) or scene.renderFrame(1.0)
    // Actually whiteboard.renderFrame handles transitions.

    // Let's use ServerWhiteboard.renderFrame logic directly or call it if available
    // For simplicity, let's manually call TransitionRenderer with frames from our scenes
    const scene2 = whiteboard.getScene('scene2')!;
    const fromCanvas = (scene as any).getCanvas();
    const toCanvas = (scene2 as any).getCanvas();

    // This is what the whiteboard does during transition
    await scene.renderToCanvas(fromCanvas, 1.0); // progress 0 of transition
    await scene2.renderToCanvas(toCanvas, 0);

    fs.writeFileSync(path.join(outputDir, 'from_canvas_for_transition.png'), fromCanvas.toBuffer('image/png'));

    console.log('✅ Transition frames saved to output/reproduce_transition_shift');
    console.log('Check if frame_before_transition.png and from_canvas_for_transition.png are identical in content alignment.');
}

reproduceTransitionShift().catch(console.error);

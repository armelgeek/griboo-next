import { DEFAULT_HAND_OFFSET } from '../src/server/layers/push_layer';
import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types';
import * as path from 'path';

async function runPushLayerTest() {
    const config: WhiteboardConfig = {
        width: 1280,
        height: 720,
        scenes: [
            {
                id: 'push_scene',
                background: { color: '#ffffff' },
                layers: [
                    {
                        id: 'pushed_image',
                        type: 'push',
                        position: { x: 640, y: 360 }, // Final position
                        entrance_animation: {
                            type: 'push',
                            duration: 2
                        },
                        pushConfig: {
                            imageUrl: path.join(__dirname, '../assets/icons/cam.svg'),
                            width: 200,
                            height: 200,
                            from: 'top',
                            pushEasing: 'out_cubic'
                        },
                        handOverlay: {
                            enabled: true,
                            imageUrl: path.join(__dirname, '../assets/hand/push_hand_real.png'),
                            scale: 0.5,
                            offset: [...DEFAULT_HAND_OFFSET]
                        }
                    }
                ]
            }
        ]
    };

    const whiteboard = new ServerWhiteboard(config, 1280, 720);
    await whiteboard.prepare();

    const outputDir = path.join(__dirname, '../output/push_test');
    const outputPath = path.join(outputDir, 'push_test.mp4');

    console.log(`Rendering push layer test to ${outputPath}...`);

    await whiteboard.renderToVideo(outputPath, {
        fps: 30,
        keepTemp: true
    });

    console.log('Push layer test complete!');
}

runPushLayerTest().catch(console.error);

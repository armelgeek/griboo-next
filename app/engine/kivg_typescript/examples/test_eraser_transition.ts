import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { SceneConfig, LayerConfig } from '../src/shared/types';
import * as path from 'path';

async function runTest() {
    const width = 1920;
    const height = 1080;

    // Scene 1: Blue background with "Scene 1" text
    const scene1: SceneConfig = {
        id: 'scene1',
        duration: 2, // 2 seconds + transition
        background: '#C8DCFF', // Light blue
        transition: {
            type: 'eraser',
            duration: 1.5 // 1.5s eraser transition
        },
        layers: [
            {
                id: 'text1',
                type: 'text',
                textConfig: {
                    text: 'Scene 1',
                    fontFamily: 'Arial',
                    fontSize: 100,
                    color: '#000000',
                    textAlign: 'center',
                    // position is not in textConfig, it's in LayerConfig
                },
                position: { x: 400, y: 300 },
                entrance_animation: {
                    type: 'stroke',
                    duration: 1
                }
            }
        ]
    };

    // Scene 2: Green background with "Scene 2" text
    const scene2: SceneConfig = {
        id: 'scene2',
        duration: 2,
        background: '#C8FFC8', // Light green
        transition: {
            type: 'eraser',
            duration: 1.5,
            eraserPattern: 'vertical'
        },
        layers: [
            {
                id: 'text2',
                type: 'text',
                textConfig: {
                    text: 'Scene 2',
                    fontFamily: 'Arial',
                    fontSize: 100,
                    color: '#FF0000',
                    textAlign: 'center',
                },
                position: { x: 400, y: 300 },
                entrance_animation: {
                    type: 'stroke',
                    duration: 1
                }
            }
        ]
    };

    // Scene 3: Yellow background with "Horizontal" text
    const scene3: SceneConfig = {
        id: 'scene3',
        duration: 2,
        background: '#FFFFC8', // Light yellow
        transition: {
            type: 'eraser',
            duration: 1.5,
            eraserPattern: 'horizontal'
        },
        layers: [
            {
                id: 'text3',
                type: 'text',
                textConfig: {
                    text: 'Horizontal',
                    fontFamily: 'Arial',
                    fontSize: 100,
                    color: '#0000FF',
                    textAlign: 'center',
                },
                position: { x: 400, y: 300 },
                entrance_animation: {
                    type: 'stroke',
                    duration: 1
                }
            }
        ]
    };

    // Scene 4: Pink background with "Vertical" text
    const scene4: SceneConfig = {
        id: 'scene4',
        duration: 2,
        background: '#FFC8C8', // Light pink
        transition: {
            type: 'eraser',
            duration: 1.5,
            eraserPattern: 'vertical',
            handImage: 'assets/hand/push_hand_real.png',
            handScale: 0.35,
            handOffset: [-100, -80]
        },
        layers: [
            {
                id: 'text4',
                type: 'text',
                textConfig: {
                    text: 'Vertical',
                    fontFamily: 'Arial',
                    fontSize: 100,
                    color: '#008000',
                    textAlign: 'center',
                },
                position: { x: 400, y: 300 },
                entrance_animation: {
                    type: 'stroke',
                    duration: 1
                }
            }
        ]
    };

    const whiteboard = new ServerWhiteboard({
        width,
        height,
        scenes: [scene1, scene2, scene3, scene4]
    });

    const outputPath = path.join(__dirname, 'test_eraser_transition.mp4');
    console.log(`Rendering to ${outputPath}...`);

    await whiteboard.renderToVideo(outputPath, {
        fps: 30,
        parallelism: 4,
        keepTemp: false
    });

    console.log('Done!');
}

runTest().catch(console.error);

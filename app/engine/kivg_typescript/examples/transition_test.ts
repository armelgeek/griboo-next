import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig, SceneConfig } from '../src/shared/types';
import * as path from 'path';

async function runTransitionTest() {
    const config: WhiteboardConfig = {
        width: 1280,
        height: 720,
        scenes: [
            {
                id: 'scene1',
                duration: 2,
                background: { color: '#3498db' }, // Blue
                layers: [
                    {
                        id: 'text1',
                        type: 'text',
                        position: { x: 640, y: 360 },
                        textConfig: {
                            text: 'Scene 1: Blue',
                            fontSize: 60,
                            color: '#ffffff',
                            textAlign: 'center'
                        }
                    }
                ],
                transition: {
                    type: 'iris',
                    duration: 1.5
                }
            },
            {
                id: 'scene2',
                duration: 2,
                background: { color: '#e74c3c' }, // Red
                layers: [
                    {
                        id: 'text2',
                        type: 'text',
                        position: { x: 640, y: 360 },
                        textConfig: {
                            text: 'Scene 2: Red (Iris -> Zoom)',
                            fontSize: 60,
                            color: '#ffffff',
                            textAlign: 'center'
                        }
                    }
                ],
                transition: {
                    type: 'zoom_in',
                    duration: 1.5
                }
            },
            {
                id: 'scene3',
                duration: 2,
                background: { color: '#2ecc71' }, // Green
                layers: [
                    {
                        id: 'text3',
                        type: 'text',
                        position: { x: 640, y: 360 },
                        textConfig: {
                            text: 'Scene 3: Green (Zoom -> Rotate)',
                            fontSize: 60,
                            color: '#ffffff',
                            textAlign: 'center'
                        }
                    }
                ],
                transition: {
                    type: 'rotate',
                    duration: 1.5
                }
            },
            {
                id: 'scene4',
                duration: 2,
                background: { color: '#f1c40f' }, // Yellow
                layers: [
                    {
                        id: 'text4',
                        type: 'text',
                        position: { x: 640, y: 360 },
                        textConfig: {
                            text: 'Scene 4: Yellow (Rotate -> Fade White)',
                            fontSize: 60,
                            color: '#000000',
                            textAlign: 'center'
                        }
                    }
                ],
                transition: {
                    type: 'fade_to_white',
                    duration: 1.5
                }
            },
            {
                id: 'scene5',
                duration: 2,
                background: { color: '#9b59b6' }, // Purple
                layers: [
                    {
                        id: 'text5',
                        type: 'text',
                        position: { x: 640, y: 360 },
                        textConfig: {
                            text: 'Scene 5: Purple (Fade White -> End)',
                            fontSize: 60,
                            color: '#ffffff',
                            textAlign: 'center'
                        }
                    }
                ]
            }
        ]
    };

    const whiteboard = new ServerWhiteboard(config, 1920, 1080);
    await whiteboard.prepare();

    const outputPath = path.join(__dirname, 'transition_test.mp4');
    console.log(`Rendering transition test to ${outputPath}...`);

    await whiteboard.renderToVideo(outputPath, {
        fps: 30,
        parallelism: 4
    });

    console.log('Transition test complete!');
}

runTransitionTest().catch(console.error);

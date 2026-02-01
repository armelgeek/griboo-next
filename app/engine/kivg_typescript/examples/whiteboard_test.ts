import * as path from 'path';
import * as fs from 'fs';
import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types';

async function runTest() {
    const outputDir = path.join(process.cwd(), 'output/whiteboard_test');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const config: WhiteboardConfig = {
        scenes: [
            {
                id: 'scene-1',
                background: '#ffecb3', // Light amber
                duration: 3,
                transition: {
                    type: 'fade',
                    duration: 1.0
                },
                layers: [
                    {
                        id: 'text-1',
                        type: 'text',
                        position: { x: 400, y: 300 },
                        textConfig: {
                            text: 'Scene 1: Fade Transition',
                            fontSize: 48,
                            color: '#ff8f00'
                        },
                        entrance_animation: {
                            type: 'fade_in',
                            duration: 1.0
                        }
                    }
                ]
            },
            {
                id: 'scene-2',
                background: '#e1f5fe', // Light blue
                duration: 3,
                transition: {
                    type: 'slide_left',
                    duration: 1.0
                },
                layers: [
                    {
                        id: 'text-2',
                        type: 'text',
                        position: { x: 400, y: 300 },
                        textConfig: {
                            text: 'Scene 2: Slide Left',
                            fontSize: 48,
                            color: '#0288d1'
                        },
                        entrance_animation: {
                            type: 'fade_in',
                            duration: 1.0
                        }
                    }
                ]
            },
            {
                id: 'scene-3',
                background: '#f1f8e9', // Light green
                duration: 3,
                transition: {
                    type: 'wipe',
                    duration: 1.0
                },
                layers: [
                    {
                        id: 'text-3',
                        type: 'text',
                        position: { x: 400, y: 300 },
                        textConfig: {
                            text: 'Scene 3: Wipe Transition',
                            fontSize: 48,
                            color: '#689f38'
                        },
                        entrance_animation: {
                            type: 'fade_in',
                            duration: 1.0
                        }
                    }
                ]
            },
            {
                id: 'scene-4',
                background: '#fce4ec', // Light pink
                duration: 2,
                layers: [
                    {
                        id: 'text-4',
                        type: 'text',
                        position: { x: 400, y: 300 },
                        textConfig: {
                            text: 'Scene 4: The End',
                            fontSize: 48,
                            color: '#c2185b'
                        },
                        entrance_animation: {
                            type: 'fade_in',
                            duration: 1.0
                        }
                    }
                ]
            }
        ]
    };

    console.log('🚀 Starting ServerWhiteboard Test');
    const whiteboard = new ServerWhiteboard(config, 1920, 1080);

    const outputPath = path.join(outputDir, 'whiteboard_animation.mp4');
    await whiteboard.renderToVideo(outputPath, {
        fps: 30,
        tempDir: path.join(outputDir, 'temp_frames')
    });

    console.log('\n✨ Whiteboard test complete! Check the output directory for results.');
}

runTest().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});

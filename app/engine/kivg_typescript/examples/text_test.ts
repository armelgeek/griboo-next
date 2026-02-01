import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types';
import * as path from 'path';

async function runTextTest() {
    const config: WhiteboardConfig = {
        width: 1920,
        height: 1080,
        scenes: [
            {
                id: 'text_showcase',
                background: { color: '#1a1a2e' },
                layers: [
                    // Title with typewriter effect
                    {
                        id: 'title',
                        type: 'text',
                        position: { x: 960, y: 150 },
                        textConfig: {
                            text: 'Text Layer Showcase',
                            fontSize: 64,
                            fontFamily: 'Arial',
                            color: '#eee',
                            textAlign: 'center'
                        },
                        entrance_animation: {
                            type: 'typewriter',
                            duration: 2.5,
                            delay: 0
                        }
                    },

                    // Left-aligned text with typewriter
                    {
                        id: 'left_text',
                        type: 'text',
                        position: { x: 200, y: 300 },
                        textConfig: {
                            text: 'Left aligned text',
                            fontSize: 36,
                            fontFamily: 'Arial',
                            color: '#ff6b6b',
                            textAlign: 'left'
                        },
                        entrance_animation: {
                            type: 'typewriter',
                            duration: 1.5,
                            delay: 2.5
                        }
                    },

                    // Center-aligned text with fade in
                    {
                        id: 'center_text',
                        type: 'text',
                        position: { x: 960, y: 400 },
                        textConfig: {
                            text: 'Center aligned with fade',
                            fontSize: 42,
                            fontFamily: 'Arial',
                            color: '#4ecdc4',
                            textAlign: 'center'
                        },
                        entrance_animation: {
                            type: 'fade_in',
                            duration: 1.5,
                            delay: 4
                        }
                    },

                    // Right-aligned text
                    {
                        id: 'right_text',
                        type: 'text',
                        position: { x: 1720, y: 500 },
                        textConfig: {
                            text: 'Right aligned text',
                            fontSize: 36,
                            fontFamily: 'Arial',
                            color: '#ffe66d',
                            textAlign: 'right'
                        },
                        entrance_animation: {
                            type: 'typewriter',
                            duration: 1.5,
                            delay: 5.5
                        }
                    },

                    // Small text
                    {
                        id: 'small_text',
                        type: 'text',
                        position: { x: 960, y: 650 },
                        textConfig: {
                            text: 'Small font size (24px)',
                            fontSize: 24,
                            fontFamily: 'Arial',
                            color: '#a8dadc',
                            textAlign: 'center'
                        },
                        entrance_animation: {
                            type: 'typewriter',
                            duration: 1.2,
                            delay: 7
                        }
                    },

                    // Large text
                    {
                        id: 'large_text',
                        type: 'text',
                        position: { x: 960, y: 800 },
                        textConfig: {
                            text: 'LARGE TEXT',
                            fontSize: 72,
                            fontFamily: 'Arial',
                            color: '#f1faee',
                            textAlign: 'center'
                        },
                        entrance_animation: {
                            type: 'fade_in',
                            duration: 1.0,
                            delay: 8.5
                        }
                    },

                    // Multi-word typewriter
                    {
                        id: 'multi_word',
                        type: 'text',
                        position: { x: 960, y: 950 },
                        textConfig: {
                            text: 'The quick brown fox jumps over the lazy dog',
                            fontSize: 32,
                            fontFamily: 'Arial',
                            color: '#e76f51',
                            textAlign: 'center'
                        },
                        entrance_animation: {
                            type: 'typewriter',
                            duration: 3.0,
                            delay: 9
                        }
                    }
                ]
            }
        ]
    };

    const whiteboard = new ServerWhiteboard(config);
    await whiteboard.prepare();

    const outputPath = path.join(__dirname, 'text_test.mp4');
    console.log(`Rendering text test to ${outputPath}...`);

    await whiteboard.renderToVideo(outputPath, {
        fps: 30
    });

    console.log('Text test complete!');
}

runTextTest().catch(console.error);

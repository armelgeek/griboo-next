import { ServerWhiteboard } from '../src/server/core/whiteboard';
import * as path from 'path';
import * as fs from 'fs';

async function runCompleteExample() {
    console.log('🚀 Starting Complete Whiteboard Example...');

    const outputDir = path.join(process.cwd(), 'output', 'whiteboard_complete');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const whiteboard = new ServerWhiteboard({
        width: 1280,
        height: 720
    }, 1920, 1080);

    // --- Scene 1: Introduction ---
    whiteboard.addScene({
        id: 'scene-intro',
        layers: [
            {
                id: 'intro-text',
                type: 'text',
                position: { x: 640, y: 300 },
                scale: 2.0,
                textConfig: {
                    text: 'Griboo Engine',
                    fontSize: 80,
                    color: '#3357FF',
                    strokeAnimation: {
                        mode: 'typewriter',
                        duration: 3
                    }
                },
                handOverlay: {
                    enabled: true,
                    scale: 0.8
                }
            },
            {
                id: 'intro-subtext',
                type: 'text',
                position: { x: 640, y: 450 },
                scale: 1.2,
                textConfig: {
                    text: 'Hybrid Animator Server',
                    fontSize: 40,
                    color: '#3357FF',
                    strokeAnimation: {
                        mode: 'typewriter',
                        duration: 1.5
                    }
                },
                handOverlay: {
                    enabled: true,
                    scale: 0.8
                },
                pauseDuration: 1.0
            }
        ],
        transition: {
            type: 'fade',
            duration: 1.0
        }
    } as any);

    // --- Scene 2: SVG Animation ---
    whiteboard.addScene({
        id: 'scene-svg',
        layers: [
            {
                id: 'svg-icon',
                type: 'kivg',
                position: { x: 640, y: 360 },
                scale: 1.5,
                width: 300,
                height: 300,
                svg_path: 'assets/icons/typescript.svg',
                entrance_animation: {
                    type: 'draw',
                    duration: 3
                },
                handOverlay: {
                    enabled: true,
                    scale: 0.9
                }
            }
        ],
        transition: {
            type: 'slide_left',
            duration: 1.0
        }
    } as any);

    // --- Scene 3: Image and Shapes ---
    whiteboard.addScene({
        id: 'scene-shapes',
        layers: [
            {
                id: 'bg-image',
                type: 'hybrid',
                position: { x: 640, y: 360 },
                scale: 0.5,
                width: 400,
                height: 400,
                imageUrl: path.join(process.cwd(), 'test-images/sample.png'),
                entrance_animation: {
                    type: 'draw',
                    duration: 3.0
                },
                handOverlay: {
                    enabled: true,
                    scale: 0.8
                }
            },
            {
                id: 'rect-shape',
                type: 'shape',
                position: { x: 300, y: 360 },
                width: 200,
                height: 200,
                shapeConfig: {
                    type: 'rect',
                    fill: '#3357FF',
                    stroke: '#3357FF',
                    strokeWidth: 5
                },
                entrance_animation: {
                    type: 'draw',
                    duration: 1.5
                },
                handOverlay: {
                    enabled: true,
                    scale: 0.8
                }
            },
            {
                id: 'circle-shape',
                type: 'shape',
                position: { x: 980, y: 360 },
                width: 200,
                height: 200,
                shapeConfig: {
                    type: 'circle',
                    fill: '#3357FF',
                    stroke: '#3357FF',
                    strokeWidth: 5
                },
                entrance_animation: {
                    type: 'draw',
                    duration: 1.5
                },
                pauseDuration: 1.0,
                handOverlay: {
                    enabled: true,
                    scale: 0.8
                }
            }
        ],
        transition: {
            type: 'wipe_down',
            duration: 1.0
        }
    } as any);

    // --- Scene 4: Conclusion ---
    whiteboard.addScene({
        id: 'scene-outro',
        layers: [
            {
                id: 'outro-text',
                type: 'text',
                position: { x: 640, y: 360 },
                scale: 2.5,
                textConfig: {
                    text: 'Thank You!',
                    fontSize: 100,
                    color: '#3357FF',
                    strokeAnimation: {
                        mode: 'typewriter',
                        duration: 3
                    }
                },
                handOverlay: {
                    enabled: true,
                    scale: 0.8
                },
                pauseDuration: 2.0
            }
        ]
    } as any);

    console.log('🎬 Rendering complete whiteboard video...');
    const videoPath = path.join(outputDir, 'whiteboard_complete.mp4');
    await whiteboard.renderToVideo(videoPath);

    console.log(`✨ Complete whiteboard example finished! Results in: ${outputDir}`);
    console.log(`✅ Video saved to ${videoPath}`);
}

runCompleteExample().catch(console.error);

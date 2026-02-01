import * as path from 'path';
import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig, SceneConfig, LayerConfig } from '../src/shared/types';

async function runCompleteShowcase() {
    const outputDir = path.join(__dirname, '../output/complete_showcase');
    const assetsDir = path.join(__dirname, '../assets');
    const testImagesDir = path.join(__dirname, '../test-images');

    // Ensure output directory exists
    const fs = require('fs');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('🚀 Starting Complete ServerWhiteboard Showcase');

    // --- Scene 1: Introduction (Text, Shapes, Audio) ---
    const scene1: SceneConfig = {
        id: 'intro',
        background: '#F0F8FF', // AliceBlue
        // backgroundMode: 'dot_grid', // This property might not exist on SceneConfig directly or handled differently
        audio: {
            background_music: {
                path: path.join(__dirname, 'background.mp3'),
                volume: 0.5,
                loop: true
            }
        },
        layers: [
            {
                id: 'intro-text',
                type: 'text',
                textConfig: {
                    text: 'Welcome to Griboo',
                    fontFamily: 'Arial',
                    fontSize: 80,
                    color: '#2C3E50',
                    textAlign: 'center'
                },
                position: { x: 960, y: 300 },
                entrance_animation: {
                    type: 'typewriter',
                    duration: 2.0
                },
                handOverlay: {
                    enabled: true,
                    imageUrl: path.join(assetsDir, 'hand/drawing-hand.png'),
                    scale: 0.5
                }
            } as LayerConfig,
            {
                id: 'intro-subtext',
                type: 'text',
                textConfig: {
                    text: 'The Ultimate Hybrid Animator',
                    fontFamily: 'Arial',
                    fontSize: 40,
                    color: '#7F8C8D',
                    textAlign: 'center'
                },
                position: { x: 960, y: 800 },
                entrance_animation: {
                    type: 'fade_in_up',
                    duration: 1.0
                }
            } as LayerConfig,

            {
                id: 'intro-circle',
                type: 'shape',
                shapeType: 'circle',
                width: 200,
                height: 200,
                position: { x: 960, y: 540 }, // Center
                fillColor: '#FF6B6B',
                strokeColor: '#EE5253',
                strokeWidth: 5,
                entrance_animation: {
                    type: 'bounce_in',
                    duration: 1.5
                }
            } as LayerConfig,
        ],
        transition: {
            type: 'slide_left',
            duration: 1.0
        }
    };

    // --- Scene 2: Hybrid Animation (Image + Strokes) ---
    const scene2: SceneConfig = {
        id: 'hybrid-demo',
        background: '#FFFFFF',
        layers: [
            {
                id: 'hybrid-image',
                type: 'hybrid',
                imageUrl: path.join(testImagesDir, 'sample.png'),
                width: 200,
                height: 200,
                position: { x: 960, y: 540 },
                entrance_animation: {
                    type: 'draw',
                    duration: 3.0
                },
                handOverlay: {
                    enabled: true,
                    imageUrl: path.join(assetsDir, 'hand/drawing-hand.png'),
                    scale: 0.5
                },
                hybridConfig: {
                    strokeDurationRatio: 0.7,
                    colorTolerance: 20
                }
            } as LayerConfig,
            {
                id: 'hybrid-caption',
                type: 'text',
                textConfig: {
                    text: 'Hybrid Image Animation',
                    fontSize: 50,
                    textAlign: 'center'
                },
                position: { x: 960, y: 300 },
                height: 300,
                entrance_animation: {
                    type: 'fade_in',
                    duration: 1.0
                }
            } as LayerConfig
        ],
        /**camera: {
            initial: { zoom: 1.0, position: { x: 0.5, y: 0.5 } },
            keyframes: [
                { zoom: 1.0, position: { x: 0.5, y: 0.5 }, duration: 0, transitionDuration: 0 },
                { zoom: 1.2, position: { x: 0.5, y: 0.5 }, duration: 3.0, transitionDuration: 2.0, easing: 'ease_in_out' }
            ]
        },**/
        transition: {
            type: 'fade',
            duration: 1.0
        }
    };

    // --- Scene 3: SVG & Morphing ---
    const scene3: SceneConfig = {
        id: 'morph-demo',
        background: '#F0FFF0', // Honeydew
        // backgroundMode: 'line_grid',
        layers: [
            {
                id: 'morph-shape',
                type: 'morph',
                // Triangle
                fromPath: [
                    { x: 960, y: 300 },
                    { x: 1160, y: 700 },
                    { x: 760, y: 700 }
                ],
                // Square
                toPath: [
                    { x: 760, y: 300 },
                    { x: 1160, y: 300 },
                    { x: 1160, y: 700 },
                    { x: 760, y: 700 }
                ],
                strokeColor: '#2ECC71',
                fillColor: 'rgba(46, 204, 113, 0.3)',
                strokeWidth: 8,
                entrance_animation: {
                    type: 'draw', // Morph layer animates by morphing, but entrance can be draw
                    duration: 3.0
                },
                handOverlay: {
                    enabled: true,
                    imageUrl: path.join(assetsDir, 'hand/drawing-hand.png'),
                    scale: 0.5
                }
            } as LayerConfig,
            {
                id: 'svg-star',
                type: 'kivg',
                // Simple Star Path
                pathData: 'M 960 200 L 1000 300 L 1100 300 L 1020 360 L 1050 460 L 960 400 L 870 460 L 900 360 L 820 300 L 920 300 Z',
                strokeColor: '#F1C40F',
                fillColor: 'rgba(241, 196, 15, 0.5)',
                strokeWidth: 4,
                entrance_animation: {
                    type: 'spin_in',
                    duration: 1.5
                },
                position: { x: 0, y: 0 } // Path coordinates are absolute
            } as LayerConfig
        ],
        transition: {
            type: 'zoom_in',
            duration: 1.0
        }
    };

    // --- Scene 4: Occlusion & Eraser ---
    const scene4: SceneConfig = {
        id: 'occlusion-demo',
        background: '#FFFFFF',
        layers: [
            {
                id: 'bg-image',
                type: 'image',
                imageUrl: path.join(testImagesDir, 'sample.png'),
                width: 100,
                height: 100,
                position: { x: 960, y: 540 },
                opacity: 0.5,
                entrance_animation: {
                    type: 'fade_in',
                    duration: 1.0
                }
            } as LayerConfig,
            {
                id: 'occlusion-text',
                type: 'text',
                textConfig: {
                    text: 'Occlusion Culling',
                    fontSize: 100,
                    color: '#E74C3C',
                    textAlign: 'center'
                },
                position: { x: 960, y: 540 },
                entrance_animation: {
                    type: 'typewriter',
                    duration: 2.0
                },
                occlusionCulling: true, // Erases background behind text
                occlusionMode: 'auto',
                handOverlay: {
                    enabled: true,
                    imageUrl: path.join(assetsDir, 'hand/drawing-hand.png'),
                    scale: 0.5
                }
            } as LayerConfig
        ],
        transition: {
            type: 'fade',
            duration: 1.0
        }
    };

    const config: WhiteboardConfig = {
        width: 1920,
        height: 1080,
        scenes: [scene1, scene2, scene3, scene4]
    };

    const whiteboard = new ServerWhiteboard(config, 1920, 1080);

    console.log('📦 Preparing whiteboard...');
    await whiteboard.prepare();

    const outputPath = path.join(outputDir, 'complete_showcase.mp4');
    console.log(`🎥 Rendering to ${outputPath}...`);

    await whiteboard.renderToVideo(outputPath, {
        fps: 60,
        parallelism: 7,
        tempDir: path.join(outputDir, 'temp')
    });

    console.log('✨ Showcase complete!');
}

runCompleteShowcase().catch(console.error);

import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig, SceneConfig, ShapeLayerConfig } from '../src/shared/types';
import * as path from 'path';
import * as fs from 'fs';

async function runWhiteboardExample() {
    const width = 800;
    const height = 600;
    const fps = 30;
    const outputDir = path.join(__dirname, '../output/whiteboard_shapes');
    const videoPath = path.join(outputDir, 'whiteboard_shapes.mp4');

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('🚀 Starting Whiteboard Shapes Example');

    // Scene 1: Star and Circle
    const scene1: SceneConfig = {
        id: 'scene-1',
        duration: 4, // 4 seconds
        layers: [
            {
                id: 'star-layer',
                type: 'shape',
                shape: 'star',
                width: 200,
                height: 200,
                position: { x: 200, y: 300 },
                strokeColor: '#FFD700', // Gold
                strokeWidth: 4,
                fillColor: 'rgba(255, 215, 0, 0.3)',
                entrance_animation: {
                    type: 'draw',
                    duration: 2
                },
                handOverlay: {
                    enabled: true,
                    imageUrl: path.join(__dirname, '../assets/hand/drawing-hand.png'),
                    scale: 0.5,
                    offset: [0, 0]
                }
            } as ShapeLayerConfig,
            {
                id: 'circle-layer',
                type: 'shape',
                shape: 'circle',
                width: 150,
                height: 150,
                position: { x: 600, y: 300 },
                strokeColor: '#FF4500', // Orange Red
                strokeWidth: 4,
                fillColor: 'rgba(255, 69, 0, 0.3)',
                entrance_animation: {
                    type: 'draw',
                    duration: 2
                },
                handOverlay: {
                    enabled: true,
                    imageUrl: path.join(__dirname, '../assets/hand/drawing-hand.png'),
                    scale: 0.5,
                    offset: [0, 0]
                }
            } as ShapeLayerConfig
        ],
        transition: {
            type: 'slide_left',
            duration: 1.0
        }
    };

    // Scene 2: Hexagon and Rectangle
    const scene2: SceneConfig = {
        id: 'scene-2',
        duration: 4,
        layers: [
            {
                id: 'hex-layer',
                type: 'shape',
                shape: 'hexagon',
                width: 180,
                height: 180,
                position: { x: 400, y: 300 },
                strokeColor: '#32CD32', // Lime Green
                strokeWidth: 4,
                fillColor: 'rgba(50, 205, 50, 0.3)',
                entrance_animation: {
                    type: 'draw',
                    duration: 2
                },
                handOverlay: {
                    enabled: true,
                    imageUrl: path.join(__dirname, '../assets/hand/drawing-hand.png'),
                    scale: 0.5,
                    offset: [0, 0]
                }
            } as ShapeLayerConfig,
            {
                id: 'rect-layer',
                type: 'shape',
                shape: 'rectangle',
                width: 700,
                height: 500,
                position: { x: 400, y: 300 }, // Centered frame
                strokeColor: '#4169E1', // Royal Blue
                strokeWidth: 8,
                fillColor: 'none',
                entrance_animation: {
                    type: 'draw',
                    duration: 3
                },
                handOverlay: {
                    enabled: true,
                    imageUrl: path.join(__dirname, '../assets/hand/drawing-hand.png'),
                    scale: 0.5,
                    offset: [0, 0]
                }
            } as ShapeLayerConfig
        ]
    };

    const whiteboardConfig: WhiteboardConfig = {
        width,
        height,
        scenes: [scene1, scene2]
    };

    const whiteboard = new ServerWhiteboard(whiteboardConfig, width, height);

    console.log('Rendering to video...');
    await whiteboard.renderToVideo(videoPath, {
        fps,
        tempDir: path.join(outputDir, 'temp_frames'),
        keepTemp: false
    });

    console.log(`✅ Done! Video saved to ${videoPath}`);
}

runWhiteboardExample().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});

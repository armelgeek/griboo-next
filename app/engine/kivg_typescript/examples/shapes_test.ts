import { ServerScene } from '../src/server/core/scene';
import { ServerShapeLayer } from '../src/server/layers/shape_layer';
import { VideoExporter } from '../src/server/video_exporter';
import * as path from 'path';
import * as fs from 'fs';

async function runTest() {
    const width = 1920;
    const height = 1080;
    const fps = 30;
    const duration = 5; // seconds

    const sceneConfig = {
        id: 'shapes-test-scene',
        width: width,
        height: height,
        duration: duration,
        layers: []
    };
    const scene = new ServerScene(sceneConfig, width, height);

    // 1. Star Shape
    const starLayer = new ServerShapeLayer({
        id: 'star-1',
        type: 'shape',
        shape: 'star',
        width: 300,
        height: 300,
        position: { x: 400, y: 540 },
        strokeColor: '#FF0000',
        strokeWidth: 5,
        fillColor: 'rgba(255, 0, 0, 0.2)',
        entrance_animation: {
            type: 'draw',
            duration: 2000
        },
        handOverlay: {
            enabled: true,
            imageUrl: path.join(__dirname, '../assets/hand/drawing-hand.png'),
            scale: 0.5,
            offset: [0, 0]
        }
    });
    scene.addLayer(starLayer);

    // 2. Hexagon Shape
    const hexLayer = new ServerShapeLayer({
        id: 'hex-1',
        type: 'shape',
        shape: 'hexagon',
        width: 300,
        height: 300,
        position: { x: 960, y: 540 },
        strokeColor: '#00FF00',
        strokeWidth: 5,
        fillColor: 'rgba(0, 255, 0, 0.2)',
        entrance_animation: {
            type: 'draw',
            duration: 2000
        },
        handOverlay: {
            enabled: true,
            imageUrl: path.join(__dirname, '../assets/hand/drawing-hand.png'),
            scale: 0.5,
            offset: [0, 0]
        }
    });
    scene.addLayer(hexLayer);

    // 3. Circle Shape
    const circleLayer = new ServerShapeLayer({
        id: 'circle-1',
        type: 'shape',
        shape: 'circle',
        width: 300,
        height: 300,
        position: { x: 1520, y: 540 },
        strokeColor: '#0000FF',
        strokeWidth: 5,
        fillColor: 'rgba(0, 0, 255, 0.2)',
        entrance_animation: {
            type: 'draw',
            duration: 2000
        },
        handOverlay: {
            enabled: true,
            imageUrl: path.join(__dirname, '../assets/hand/drawing-hand.png'),
            scale: 0.5,
            offset: [0, 0]
        }
    });
    scene.addLayer(circleLayer);

    // Prepare scene
    console.log('Preparing scene...');
    await scene.prepare();

    // Render frames
    const outputDir = path.join(__dirname, '../output/shapes_test');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const tempFramesDir = path.join(outputDir, 'temp_frames');
    if (!fs.existsSync(tempFramesDir)) {
        fs.mkdirSync(tempFramesDir, { recursive: true });
    }

    const totalFrames = duration * fps;
    console.log(`Rendering ${totalFrames} frames...`);

    for (let i = 0; i < totalFrames; i++) {
        const time = i / fps;
        const frameBuffer = await scene.renderFrame(time);
        const framePath = path.join(tempFramesDir, `frame_${String(i).padStart(5, '0')}.png`);
        fs.writeFileSync(framePath, frameBuffer);

        if (i % 10 === 0) {
            process.stdout.write(`\rRendered frame ${i}/${totalFrames}`);
        }
    }
    console.log('\nRendering complete.');

    // Export video
    console.log('Exporting video...');
    const videoPath = path.join(outputDir, 'shapes.mp4');
    const framePattern = path.join(tempFramesDir, 'frame_%05d.png');
    await VideoExporter.exportFromFrames(framePattern, videoPath, { fps });
    console.log(`Video saved to ${videoPath}`);
}

runTest().catch(console.error);

import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { VideoExporter } from '../src/server/video_exporter';
import * as path from 'path';
import * as fs from 'fs';

async function runTest() {
    const outputDir = path.join(process.cwd(), 'output_test');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const whiteboard = new ServerWhiteboard({}, 1280, 720);

    // Test 1: Filled text with 'end' fill mode (default)
    whiteboard.addScene({
        id: 'scene_end_fill',
        duration: 4,
        layers: [
            {
                id: 'text_end',
                type: 'text',
                position: { x: 40, y: 200 },
                textConfig: {
                    text: 'The cause was that the layer was being prepared multiple time',
                    fontSize: 24,
                    fontFamily: 'Caveat',
                    color: '#FF5733',
                    strokeAnimation: {
                        mode: 'draw',
                        fillMode: 'end',
                        duration: 3
                    }
                },
                handOverlay: {
                    enabled: true,
                    scale: 0.8
                }
            }
        ]
    });

    // Test 2: Filled text with 'start' fill mode
    whiteboard.addScene({
        id: 'scene_start_fill',
        duration: 4,
        layers: [
            {
                id: 'text_start',
                type: 'text',
                position: { x: 40, y: 350 },
                textConfig: {
                    text: 'The cause was that the layer was being prepared multiple time',
                    fontSize: 24,
                    fontFamily: 'Caveat',
                    color: '#33FF57',
                    strokeAnimation: {
                        mode: 'draw',
                        fillMode: 'start',
                        duration: 3
                    }
                },
                handOverlay: {
                    enabled: true,
                    scale: 0.8
                }
            }
        ]
    });

    // Test 3: Typewriter mode (filled from start)
    whiteboard.addScene({
        id: 'scene_typewriter',
        duration: 4,
        layers: [
            {
                id: 'text_typewriter',
                type: 'text',
                position: { x: 40, y: 500 },
                textConfig: {
                    text: 'The cause was that the layer was being prepared multiple time',
                    fontSize: 24,
                    fontFamily: 'Caveat',
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
            }
        ]
    });

    console.log('Preparing whiteboard...');
    await whiteboard.prepare();

    const videoPath = path.join(outputDir, 'test_text_svg_filled.mp4');
    console.log(`Rendering and exporting video to ${videoPath}...`);

    await whiteboard.renderToVideo(videoPath, {
        fps: 30,
        tempDir: path.join(outputDir, 'temp_frames'),
        keepTemp: true
    });

    console.log('Done!');
}

runTest().catch(console.error);

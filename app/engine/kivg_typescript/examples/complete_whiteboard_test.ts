import * as path from 'path';
import * as fs from 'fs';
import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types';

async function runCompleteTest() {
    const outputDir = path.join(process.cwd(), 'output/complete_whiteboard_test');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const handConfig = {
        enabled: true,
        imageUrl: path.join(process.cwd(), 'assets/hand/drawing-hand.png'),
        scale: 0.5,
        offset: [0, 0] as [number, number]
    };

    const complexSvg = `
<svg width="400" height="400" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <path d="M 50 200 C 50 100, 150 100, 150 200 S 250 300, 250 200" stroke="blue" fill="none" stroke-width="5" />
  <path d="M 300 200 A 50 50 0 1 1 300 100" stroke="red" fill="none" stroke-width="5" />
  <rect x="50" y="50" width="60" height="60" rx="10" ry="10" fill="green" stroke="black" stroke-width="2" />
  <circle cx="200" cy="75" r="30" fill="yellow" stroke="orange" stroke-width="3" />
  <polygon points="200,300 250,380 150,380" fill="cyan" stroke="darkcyan" stroke-width="2" />
</svg>
    `;

    const config: WhiteboardConfig = {
        width: 1280,
        height: 720,
        scenes: [
            {
                id: 'scene-1-shapes-text',
                background: '#f5f5f5',
                duration: 5,
                transition: { type: 'fade', duration: 1.0 },
                layers: [
                    {
                        id: 'text-title',
                        type: 'text',
                        position: { x: 640, y: 100 },
                        textConfig: { text: 'Complete Whiteboard Test', fontSize: 60, color: '#333', fontFamily: 'Caveat' },
                        entrance_animation: { type: 'fade_in', duration: 1.0 }
                    },
                    {
                        id: 'shape-rect',
                        type: 'shape',
                        position: { x: 300, y: 400 },
                        width: 200,
                        height: 200,
                        shape: 'rectangle',
                        fillColor: '#e74c3c',
                        entrance_animation: { type: 'zoom_in', duration: 2.0, delay: 1.0 },
                        handOverlay: handConfig
                    },
                    {
                        id: 'shape-circle',
                        type: 'shape',
                        position: { x: 980, y: 400 },
                        width: 200,
                        height: 200,
                        shape: 'circle',
                        fillColor: '#2ecc71',
                        entrance_animation: { type: 'bounce_in', duration: 2.0, delay: 2.0 },
                        handOverlay: handConfig
                    }
                ]
            },
            {
                id: 'scene-2-hybrid',
                background: '#2c3e50',
                duration: 5,
                transition: { type: 'slide_left', duration: 1.0 },
                layers: [
                    {
                        id: 'hybrid-layer',
                        type: 'hybrid',
                        position: { x: 640, y: 360 },
                        width: 400,
                        height: 400,
                        imageUrl: path.join(process.cwd(), 'test-images/sample.png'),
                        entrance_animation: { type: 'draw', duration: 4.0 },
                        handOverlay: handConfig
                    }
                ]
            },
            {
                id: 'scene-3-morph-kivg',
                background: '#ffffff',
                duration: 8,
                transition: { type: 'wipe', duration: 1.0 },
                layers: [
                    {
                        id: 'morph-layer',
                        type: 'morph',
                        position: { x: 320, y: 360 },
                        fromPath: [
                            { x: -100, y: -100 }, { x: 100, y: -100 }, { x: 100, y: 100 }, { x: -100, y: 100 }, { x: -100, y: -100 }
                        ],
                        toPath: [
                            { x: 0, y: -150 }, { x: 150, y: 0 }, { x: 0, y: 150 }, { x: -150, y: 0 }, { x: 0, y: -150 }
                        ],
                        strokeColor: '#3498db',
                        fillColor: 'rgba(52, 152, 219, 0.3)',
                        strokeWidth: 5,
                        entrance_animation: { type: 'draw', duration: 3.0 },
                        handOverlay: handConfig
                    },
                    {
                        id: 'kivg-layer',
                        type: 'kivg',
                        position: { x: 960, y: 360 },
                        width: 400,
                        height: 400,
                        svgContent: complexSvg,
                        entrance_animation: { type: 'draw', duration: 6.0, delay: 1.0 },
                        handOverlay: handConfig
                    }
                ]
            }
        ]
    };

    console.log('🚀 Starting Complete Whiteboard Test');
    const whiteboard = new ServerWhiteboard(config);
    await whiteboard.prepare();

    const outputPath = path.join(outputDir, 'complete_test.mp4');
    console.log(`Rendering to ${outputPath}...`);

    await whiteboard.renderToVideo(outputPath, {
        fps: 30,
        tempDir: path.join(outputDir, 'temp_frames')
    });

    console.log('\n✨ Complete whiteboard test finished! Results in:', outputDir);
}

runCompleteTest().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});

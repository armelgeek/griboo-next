import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types';
import * as path from 'path';

async function runCaptionTest() {
    const config: WhiteboardConfig = {
        width: 1920,
        height: 1080,
        scenes: [
            {
                id: 'scene1',
                background: { color: '#1a1a2e' },
                duration: 4,
                layers: []
            },
            {
                id: 'scene2',
                background: { color: '#16213e' },
                duration: 3,
                layers: []
            }
        ],
        subtitles: {
            enabled: true,
            position: 'bottom',
            offset: { x: 0, y: 0 },
            style: {
                fontSize: 36,
                fontFamily: 'Arial',
                fontWeight: 'bold',
                color: '#ffffff',
                backgroundColor: '#000000',
                backgroundOpacity: 0.8,
                padding: 20,
                borderRadius: 12,
                alignment: 'center',
                maxWidth: 1400,
                stroke: {
                    color: '#000000',
                    width: 2
                },
                shadow: {
                    color: 'rgba(0, 0, 0, 0.5)',
                    blur: 4,
                    offsetX: 2,
                    offsetY: 2
                }
            },
            segments: [
                {
                    id: 'sub1',
                    text: 'Welcome to global subtitle test!',
                    startTime: 0,      // 0ms = 0s
                    endTime: 2000      // 2000ms = 2s
                },
                {
                    id: 'sub2',
                    text: 'This subtitle appears in the first scene',
                    startTime: 2000,   // 2s
                    endTime: 4000      // 4s (end of scene 1)
                },
                {
                    id: 'sub3',
                    text: 'Now in the second scene! 🎬',
                    startTime: 4000,   // 4s (start of scene 2)
                    endTime: 6500      // 6.5s
                },
                {
                    id: 'sub4',
                    text: 'Subtitles persist across scenes! ✨',
                    startTime: 6500,   // 6.5s
                    endTime: 7000      // 7s (end of scene 2)
                }
            ]
        }
    };

    console.log('Creating server whiteboard for caption test...');
    const whiteboard = new ServerWhiteboard(config);

    console.log('Preparing whiteboard...');
    await whiteboard.prepare();

    const outputPath = path.join(__dirname, 'caption_test.mp4');
    console.log('Exporting video to:', outputPath);

    await whiteboard.renderToVideo(outputPath, {
        fps: 30
    });

    console.log('Caption test complete! Video saved to:', outputPath);
}

runCaptionTest().catch(error => {
    console.error('Error during caption test:', error);
    process.exit(1);
});

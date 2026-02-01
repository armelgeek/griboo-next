import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types';
import * as path from 'path';

async function runAudioTest() {
    const bgPath = path.join(__dirname, 'background.mp3');
    const sfxPath = path.join(__dirname, 'sfx.mp3');

    const config: WhiteboardConfig = {
        width: 1280,
        height: 720,
        scenes: [
            {
                id: 'scene1',
                duration: 5,
                background: { color: '#3498db' },
                audio: {
                    background_music: {
                        path: bgPath,
                        volume: 0.5,
                        loop: true
                    },
                    sound_effects: [
                        {
                            path: sfxPath,
                            start_time: 1,
                            volume: 1.0
                        },
                        {
                            path: sfxPath,
                            start_time: 3,
                            volume: 1.0
                        }
                    ]
                },
                layers: [
                    {
                        id: 'text1',
                        type: 'text',
                        position: { x: 640, y: 360 },
                        textConfig: {
                            text: 'Audio Test: BG Music + 2 Beeps',
                            fontSize: 60,
                            color: '#ffffff',
                            textAlign: 'center'
                        }
                    }
                ]
            }
        ]
    };

    const whiteboard = new ServerWhiteboard(config);
    await whiteboard.prepare();

    const outputPath = path.join(__dirname, 'audio_test.mp4');
    console.log(`Rendering audio test to ${outputPath}...`);

    await whiteboard.renderToVideo(outputPath, {
        fps: 30
    });

    console.log('Audio test complete!');
}

runAudioTest().catch(console.error);

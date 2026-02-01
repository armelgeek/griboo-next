import * as path from 'path';
import * as fs from 'fs';
import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { WhiteboardConfig } from '../src/shared/types';
import { Logger } from '../src/shared/infra/logger';

async function verifyBackgrounds() {
    const outputDir = path.join(__dirname, '../output/verify_backgrounds');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const config: WhiteboardConfig = {
        scenes: [
            {
                id: 'hex_gradient',
                duration: 5,
                background: {
                    gradient: {
                        type: 'linear',
                        angle: 45,
                        stops: [
                            { offset: 0, color: '#1a2a6c' },
                            { offset: 0.5, color: '#b21f1f' },
                            { offset: 1, color: '#fdbb2d' }
                        ]
                    },
                    grid: {
                        type: 'hexagonal',
                        size: 30,
                        color: 'rgba(255, 255, 255, 0.2)',
                        lineWidth: 2
                    }
                },
                layers: []
            },
            {
                id: 'iso_animation',
                duration: 5,
                background: {
                    color: '#2c3e50',
                    grid: {
                        type: 'isometric',
                        size: 40,
                        color: '#34495e',
                        lineWidth: 1
                    },
                    animation: {
                        type: 'scroll',
                        speedX: 50,
                        speedY: 20
                    }
                },
                layers: []
            },
            {
                id: 'radial_pulse',
                duration: 5,
                background: {
                    gradient: {
                        type: 'radial',
                        stops: [
                            { offset: 0, color: '#4facfe' },
                            { offset: 1, color: '#00f2fe' }
                        ]
                    },
                    animation: {
                        type: 'pulse',
                        pulseIntensity: 0.2,
                        pulseFrequency: 0.5
                    }
                },
                layers: []
            },
            {
                id: 'effects_blur',
                duration: 5,
                background: {
                    color: '#e67e22',
                    grid: {
                        type: 'squares',
                        size: 50,
                        color: 'rgba(0,0,0,0.1)'
                    },
                    effects: {
                        blur: 5,
                        grayscale: 0.5
                    }
                },
                layers: []
            }
        ]
    };

    const whiteboard = new ServerWhiteboard(config, 1280, 720);
    const outputPath = path.join(outputDir, 'background_test.mp4');

    Logger.info('🚀 Starting background verification export...');
    await whiteboard.renderToVideo(outputPath, {
        fps: 30,
        resolution: '720p',
        parallelism: 1
    });

    Logger.info(`✨ Verification video generated: ${outputPath}`);
}

verifyBackgrounds().catch(err => {
    Logger.error('❌ Verification failed:', err);
    process.exit(1);
});

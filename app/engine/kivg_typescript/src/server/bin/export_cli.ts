import * as fs from 'fs';
import * as path from 'path';
import { ServerWhiteboard } from '../core/whiteboard';
import { WhiteboardConfig } from '../../shared/types';

/**
 * Kivg Export CLI
 * 
 * Usage: npx ts-node src/server/bin/export_cli.ts --input <path> --output <path> [options]
 */

async function main() {
    const args = process.argv.slice(2);
    const options: any = {
        input: '',
        output: '',
        fps: 30,
        parallelism: 'auto',
        normalize: false,
        resolution: '720p'
    };

    // Simple argument parser
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--input' || arg === '-i') options.input = args[++i];
        else if (arg === '--output' || arg === '-o') options.output = args[++i];
        else if (arg === '--fps') options.fps = parseInt(args[++i]);
        else if (arg === '--parallelism' || arg === '-p') {
            const val = args[++i];
            options.parallelism = val === 'auto' ? 'auto' : parseInt(val);
        }
        else if (arg === '--normalize' || arg === '-n') options.normalize = true;
        else if (arg === '--resolution' || arg === '-r') options.resolution = args[++i];
        else if (arg === '--help' || arg === '-h') {
            printHelp();
            process.exit(0);
        }
    }

    if (!options.input || !options.output) {
        console.error('❌ Error: Input and output paths are required.');
        printHelp();
        process.exit(1);
    }

    const inputPath = path.resolve(options.input);
    const outputPath = path.resolve(options.output);

    if (!fs.existsSync(inputPath)) {
        console.error(`❌ Error: Input file not found: ${inputPath}`);
        process.exit(1);
    }

    console.log(`🚀 Loading configuration from: ${inputPath}`);
    let config: WhiteboardConfig;
    try {
        const content = fs.readFileSync(inputPath, 'utf8');
        config = JSON.parse(content);
    } catch (error) {
        console.error(`❌ Error: Failed to parse configuration file:`, error);
        process.exit(1);
    }

    console.log(`🎨 Initializing Kivg Engine...`);
    try {
        const whiteboard = new ServerWhiteboard(config);

        console.log(`🎬 Starting export to: ${outputPath}`);
        const startTime = Date.now();

        await whiteboard.renderToVideo(outputPath, {
            fps: options.fps,
            resolution: options.resolution,
            parallelism: options.parallelism,
            normalizeAudio: options.normalize,
            onProgress: (progress, eta, fps) => {
                const percent = (progress * 100).toFixed(1);
                process.stdout.write(`\r   Progress: ${percent}% | ETA: ${Math.ceil(eta)}s | Speed: ${fps} fps   `);
            }
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n✨ Export completed in ${duration}s!`);
    } catch (error) {
        console.error(`\n❌ Export failed:`, error);
        process.exit(1);
    }
}

function printHelp() {
    console.log(`
Kivg Export CLI v1.0
--------------------
Usage:
  npx ts-node src/server/bin/export_cli.ts --input <path> --output <path> [options]

Options:
  --input, -i       Path to the JSON configuration file (required)
  --output, -o      Path for the output video file (required)
  --fps             Frames per second (default: 30)
  --resolution, -r  Preset (360p, 480p, 720p, 1080p) or "custom" (default: 720p)
  --parallelism, -p Number of workers or "auto" (default: auto)
  --normalize, -n   Enable audio normalization
  --help, -h        Show this help message
`);
}

main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});

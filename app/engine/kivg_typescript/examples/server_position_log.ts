import { ServerWhiteboard } from '../src/server/core/whiteboard';
import { SHARED_CONFIG } from './shared_config';
import * as path from 'path';
import * as fs from 'fs';

async function runServerPositionLog() {
    const outputDir = path.join(__dirname, '../output/server_logs');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const logOutputPath = path.join(outputDir, 'server_positions.json');

    console.log('🚀 Starting Server-side Position Logging');
    console.log(`  Output Log: ${logOutputPath}`);

    // Resolve paths for server
    const resolvedConfig = JSON.parse(JSON.stringify(SHARED_CONFIG));
    const projectRoot = path.join(__dirname, '..');

    if (resolvedConfig.hands) {
        if (resolvedConfig.hands.draw) resolvedConfig.hands.draw.imageUrl = path.join(projectRoot, resolvedConfig.hands.draw.imageUrl);
        if (resolvedConfig.hands.erase) resolvedConfig.hands.erase.imageUrl = path.join(projectRoot, resolvedConfig.hands.erase.imageUrl);
        if (resolvedConfig.hands.push) resolvedConfig.hands.push.imageUrl = path.join(projectRoot, resolvedConfig.hands.push.imageUrl);
    }

    resolvedConfig.scenes.forEach((scene: any) => {
        scene.layers.forEach((layer: any) => {
            if (layer.pushConfig && layer.pushConfig.imageUrl) {
                layer.pushConfig.imageUrl = path.join(projectRoot, layer.pushConfig.imageUrl);
            }
            if (layer.imageUrl) {
                layer.imageUrl = path.join(projectRoot, layer.imageUrl);
            }
        });
    });

    const whiteboard = new ServerWhiteboard(resolvedConfig, 800, 450);

    await whiteboard.prepare();

    const scene = whiteboard.getScene("reveal_scene");
    if (!scene) {
        console.error("Scene not found");
        return;
    }

    const logs: any[] = [];
    const fps = 30;
    const duration = scene.getDuration();
    const totalFrames = Math.ceil(duration * fps);

    console.log(`  Simulating ${totalFrames} frames...`);

    for (let f = 0; f <= totalFrames; f++) {
        const time = f / fps;
        const layers = scene.getLayers();

        for (const layer of layers) {
            const pos = layer.getCurrentPosition(time);
            const handPos = layer.getHandPosition(time);
            let screenHandPos = null;

            if (handPos && whiteboard.getScene("reveal_scene")?.getCameraController()) {
                const camera = whiteboard.getScene("reveal_scene")!.getCameraController()!;
                screenHandPos = camera.transformPoint(handPos, time, layers);
            }

            logs.push({
                time: parseFloat(time.toFixed(3)),
                layerId: layer.getConfig().id,
                x: parseFloat(pos.x.toFixed(2)),
                y: parseFloat(pos.y.toFixed(2)),
                hand: handPos ? {
                    x: parseFloat(handPos.x.toFixed(2)),
                    y: parseFloat(handPos.y.toFixed(2)),
                    screenX: screenHandPos ? parseFloat(screenHandPos.x.toFixed(2)) : null,
                    screenY: screenHandPos ? parseFloat(screenHandPos.y.toFixed(2)) : null
                } : null
            });
        }
    }

    fs.writeFileSync(logOutputPath, JSON.stringify(logs, null, 2));
    console.log('✅ Logs written to server_positions.json');
}

runServerPositionLog().catch(err => {
    console.error('❌ Logging failed:', err);
    process.exit(1);
});

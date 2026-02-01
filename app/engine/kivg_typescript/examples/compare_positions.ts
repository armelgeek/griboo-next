import * as fs from 'fs';
import * as path from 'path';

function comparePositions() {
    const serverLogPath = path.join(__dirname, '../output/server_logs/server_positions.json');
    const frontendLogPath = path.join(__dirname, '../output/frontend_logs/frontend_positions.json');

    if (!fs.existsSync(serverLogPath)) {
        console.error(`❌ Server log not found at ${serverLogPath}`);
        return;
    }
    if (!fs.existsSync(frontendLogPath)) {
        console.error(`❌ Frontend log not found at ${frontendLogPath}`);
        return;
    }

    const serverLogs = JSON.parse(fs.readFileSync(serverLogPath, 'utf8'));
    const frontendLogs = JSON.parse(fs.readFileSync(frontendLogPath, 'utf8'));

    console.log(`📊 Comparing ${serverLogs.length} server frames with ${frontendLogs.length} frontend frames`);

    const discrepancies: any[] = [];
    const tolerance = 0.5; // Allow 0.5 pixel difference due to rounding/interpolation

    // Create a map for faster lookup
    const frontendMap = new Map();
    for (const log of frontendLogs) {
        const key = `${log.time}_${log.layerId}`;
        frontendMap.set(key, log);
    }

    for (const sLog of serverLogs) {
        const key = `${sLog.time}_${sLog.layerId}`;
        const fLog = frontendMap.get(key);

        if (!fLog) {
            discrepancies.push({
                time: sLog.time,
                layerId: sLog.layerId,
                issue: 'Missing in frontend'
            });
            continue;
        }

        const dx = Math.abs(sLog.x - fLog.x);
        const dy = Math.abs(sLog.y - fLog.y);

        if (dx > tolerance || dy > tolerance) {
            discrepancies.push({
                time: sLog.time,
                layerId: sLog.layerId,
                server: { x: sLog.x, y: sLog.y },
                frontend: { x: fLog.x, y: fLog.y },
                diff: { x: dx.toFixed(2), y: dy.toFixed(2) }
            });
        }
    }

    if (discrepancies.length === 0) {
        console.log('✅ ALL POSITIONS MATCH! (within tolerance)');
    } else {
        console.log(`❌ Found ${discrepancies.length} discrepancies`);

        // Group by layer for better reporting
        const byLayer: any = {};
        for (const d of discrepancies) {
            if (!byLayer[d.layerId]) byLayer[d.layerId] = [];
            byLayer[d.layerId].push(d);
        }

        for (const layerId in byLayer) {
            const first = byLayer[layerId][0];
            console.log(`\nLayer: ${layerId}`);
            console.log(`  Total discrepancies: ${byLayer[layerId].length}`);
            console.log(`  First discrepancy at t=${first.time}:`);
            console.log(`    Server:   (${first.server?.x}, ${first.server?.y})`);
            console.log(`    Frontend: (${first.frontend?.x}, ${first.frontend?.y})`);
            console.log(`    Diff:     (${first.diff?.x}, ${first.diff?.y})`);
        }
    }
}

comparePositions();

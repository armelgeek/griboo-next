import * as fs from 'fs';
import * as path from 'path';
import { ServerAudioManager } from '../src/server/core/audio';

async function testAudioCore() {
    console.log('🚀 Testing Server Audio Core...');

    const tempDir = path.join(__dirname, 'temp_audio_test');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const audioManager = new ServerAudioManager(30);
    audioManager.setTotalDuration(10); // 10 seconds

    // 1. Test Procedural Generation
    console.log('Generating procedural sounds...');
    await audioManager.generateTypewriterSound(1.0, 20, 0.1, 0.5); // Typewriter at 1s
    await audioManager.generateDrawingSound(4.0, 3.0, 0.4);      // Drawing at 4s for 3s

    // 2. Test Config Processing
    console.log('Processing mock config...');
    await audioManager.processAudioConfig({
        background_music: {
            path: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
            volume: 0.2,
            loop: true
        },
        sound_effects: [
            { path: 'assets/sfx/pop.wav', start_time: 2.0, volume: 0.8 }
        ]
    }, 0);

    // 3. Verify Tracks
    const tracks = await audioManager.getProcessedTracks(tempDir);
    console.log(`✅ Total tracks processed: ${tracks.length}`);

    tracks.forEach((track, i) => {
        console.log(`   Track ${i}: path=${track.path}, start=${track.startTime}s, volume=${track.volume}`);
    });

    // 4. Check if procedural WAVs were created
    const proceduralWavs = fs.readdirSync(tempDir).filter(f => f.startsWith('proc_audio_'));
    console.log(`✅ Procedural WAVs created: ${proceduralWavs.length}`);

    if (proceduralWavs.length === 2) {
        console.log('✨ SUCCESS: Audio core is working correctly.');
    } else {
        console.error('❌ FAILURE: Not all procedural WAVs were created.');
    }

    // Cleanup
    // fs.rmSync(tempDir, { recursive: true, force: true });
    console.log(`\nNote: Temp files kept in ${tempDir} for inspection.`);
}

testAudioCore().catch(console.error);

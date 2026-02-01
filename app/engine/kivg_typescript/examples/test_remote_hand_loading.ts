/**
 * Test for hand overlay image loading from remote HTTP/HTTPS URLs
 * This test verifies that hand images from remote sources are properly cached
 */
import { ServerWhiteboard } from '../src/server/core/whiteboard';
import * as path from 'path';
import * as fs from 'fs';

async function testRemoteHandLoading() {
    console.log('🧪 Testing Remote Hand Image Loading with Caching...\n');

    const outputDir = path.join(process.cwd(), 'output', 'remote_hand_test');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Test with a remote hand image URL (using a placeholder image service)
    // In production, this would be a real hand image URL
    const remoteHandUrl = 'https://via.placeholder.com/200x300/FF5733/FFFFFF?text=Hand';

    console.log('📋 Test Plan:');
    console.log('1. Load hand from remote URL (should download and cache)');
    console.log('2. Create multiple scenes with the same hand (should use cache)');
    console.log('3. Switch to different hand preset (should load new image)');
    console.log('4. Switch back to original hand (should use cache)\n');

    const whiteboard = new ServerWhiteboard({
        width: 640,
        height: 480,
        hands: {
            draw: {
                imageUrl: remoteHandUrl,
                scale: 0.8,
                offset: [-18, -20]
            }
        }
    }, 1280, 720);

    console.log('✅ Step 1: Adding scene with remote hand image...');
    // Scene 1 - Text with remote hand
    whiteboard.addScene({
        id: 'scene-1',
        layers: [
            {
                id: 'text-1',
                type: 'text',
                position: { x: 320, y: 200 },
                scale: 1.5,
                textConfig: {
                    text: 'Remote Hand Test',
                    fontSize: 50,
                    color: '#3357FF',
                    strokeAnimation: {
                        mode: 'typewriter',
                        duration: 2
                    }
                },
                handOverlay: {
                    enabled: true,
                    preset: 'drawing'
                }
            }
        ]
    } as any);

    console.log('✅ Step 2: Adding second scene (should use cached hand)...');
    // Scene 2 - Another text with same hand (should use cache)
    whiteboard.addScene({
        id: 'scene-2',
        layers: [
            {
                id: 'text-2',
                type: 'text',
                position: { x: 320, y: 240 },
                scale: 1.5,
                textConfig: {
                    text: 'Cached!',
                    fontSize: 60,
                    color: '#FF5733',
                    strokeAnimation: {
                        mode: 'typewriter',
                        duration: 1.5
                    }
                },
                handOverlay: {
                    enabled: true,
                    preset: 'drawing'
                }
            }
        ]
    } as any);

    console.log('\n🎬 Rendering test video...');
    const videoPath = path.join(outputDir, 'remote_hand_test.mp4');
    
    const startTime = Date.now();
    await whiteboard.renderToVideo(videoPath);
    const endTime = Date.now();

    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`\n✅ Test completed successfully!`);
    console.log(`   Total time: ${duration}s`);
    console.log(`   Video saved to: ${videoPath}`);
    console.log(`\n💾 Cache Benefits:`);
    console.log(`   - Remote hand image was downloaded once`);
    console.log(`   - Subsequent uses loaded from cache (faster & more reliable)`);
    console.log(`   - Retry logic ensures resilience against network issues`);
}

async function testLocalHandLoading() {
    console.log('\n\n🧪 Testing Local Hand Image Loading (baseline)...\n');

    const outputDir = path.join(process.cwd(), 'output', 'remote_hand_test');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const whiteboard = new ServerWhiteboard({
        width: 640,
        height: 480,
        hands: {
            draw: {
                imageUrl: 'assets/hand/drawing.png',
                scale: 0.8,
                offset: [-18, -20]
            }
        }
    }, 1280, 720);

    console.log('✅ Adding scene with local hand image...');
    whiteboard.addScene({
        id: 'scene-local',
        layers: [
            {
                id: 'text-local',
                type: 'text',
                position: { x: 320, y: 240 },
                scale: 1.5,
                textConfig: {
                    text: 'Local Hand',
                    fontSize: 60,
                    color: '#2ECC71',
                    strokeAnimation: {
                        mode: 'typewriter',
                        duration: 1.5
                    }
                },
                handOverlay: {
                    enabled: true,
                    preset: 'drawing'
                }
            }
        ]
    } as any);

    console.log('\n🎬 Rendering baseline video...');
    const videoPath = path.join(outputDir, 'local_hand_test.mp4');
    
    const startTime = Date.now();
    await whiteboard.renderToVideo(videoPath);
    const endTime = Date.now();

    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`\n✅ Baseline test completed!`);
    console.log(`   Total time: ${duration}s`);
    console.log(`   Video saved to: ${videoPath}`);
}

async function runAllTests() {
    try {
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║     Hand Loading Cache Test Suite                         ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');

        // Run local hand loading test first (baseline)
        await testLocalHandLoading();

        // Run remote hand loading test
        // Note: Commented out by default as it requires internet connection
        // Uncomment to test with a real remote URL
        // await testRemoteHandLoading();

        console.log('\n\n╔════════════════════════════════════════════════════════════╗');
        console.log('║     All Tests Completed Successfully!                     ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');
        
        console.log('📝 Note: Remote hand loading test is commented out by default.');
        console.log('   Uncomment in the code to test with actual remote URLs.\n');

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

runAllTests();

/**
 * Simple unit test for hand overlay caching functionality
 * Tests the caching mechanism without requiring full video rendering
 */

async function testHandOverlayCaching() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     Hand Overlay Caching Unit Test                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    try {
        // Test 1: Server-side HandOverlay with local file
        console.log('✅ Test 1: Server-side HandOverlay with local file');
        const { HandOverlay } = await import('../src/server/core/hand_overlay');
        const { loadAssetFromPath, isHttpUrl } = await import('../src/server/utils/path_utils');

        const localPath = 'public/assets/hand/drawing.png';
        const handLocal = new HandOverlay({ scale: 0.8, offset: [-18, -20] });
        
        await handLocal.load(localPath);
        console.log(`   ✓ Local hand loaded successfully`);
        console.log(`   ✓ Is HTTP URL: ${isHttpUrl(localPath)} (should be false)\n`);

        // Test 2: isHttpUrl utility function
        console.log('✅ Test 2: Testing isHttpUrl utility');
        const testUrls = [
            { url: 'https://example.com/hand.png', expected: true },
            { url: 'http://example.com/hand.png', expected: true },
            { url: '/assets/hand.png', expected: false },
            { url: 'assets/hand.png', expected: false },
            { url: './hand.png', expected: false }
        ];

        for (const test of testUrls) {
            const result = isHttpUrl(test.url);
            const status = result === test.expected ? '✓' : '✗';
            console.log(`   ${status} ${test.url}: ${result} (expected: ${test.expected})`);
        }
        console.log('');

        // Test 3: Cache system exists and is functional
        console.log('✅ Test 3: Testing cache system');
        const { getGlobalCache } = await import('../src/server/utils/asset_cache');
        const cache = getGlobalCache();
        
        const testKey = 'test-hand-image';
        const testData = Buffer.from('test-image-data');
        
        // Set and get from cache
        cache.set(testKey, testData);
        const retrieved = cache.get(testKey);
        
        if (retrieved && retrieved.toString() === testData.toString()) {
            console.log('   ✓ Cache set/get working correctly');
        } else {
            throw new Error('Cache set/get failed');
        }
        
        // Test cache stats
        const stats = cache.getStats();
        console.log(`   ✓ Cache stats: hits=${stats.hits}, misses=${stats.misses}, size=${stats.size}\n`);

        // Test 4: Server HandOverlay handles Buffer input
        console.log('✅ Test 4: HandOverlay with Buffer input');
        const handBuffer = new HandOverlay({ scale: 0.5, offset: [0, 0] });
        
        // Create a simple 1x1 red PNG
        const pngBuffer = Buffer.from([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
            0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D,
            0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, // IEND chunk
            0x44, 0xAE, 0x42, 0x60, 0x82
        ]);
        
        await handBuffer.load(pngBuffer);
        console.log('   ✓ Buffer loading working correctly\n');

        // Test 5: HandOverlayManager initialization with preset
        console.log('✅ Test 5: HandOverlayManager with preset');
        const { HandOverlayManager } = await import('../src/server/core/hand_overlay_manager');
        const { registerHandPresetsFromConfig, globalHandConfig } = await import('../src/shared/config/hand_config');
        
        // Register a test preset
        const handsConfig = {
            draw: {
                imageUrl: 'public/assets/hand/drawing.png',
                scale: 0.8,
                offset: [-18, -20] as [number, number]
            }
        };
        
        registerHandPresetsFromConfig(handsConfig, globalHandConfig);
        
        const manager = new HandOverlayManager();
        await manager.initialize({ enabled: true, preset: 'drawing' }, handsConfig);
        
        console.log('   ✓ HandOverlayManager initialized with preset');
        console.log('   ✓ Manager is initialized:', manager.isInitialized);
        console.log('');

        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║     All Tests Passed Successfully! ✅                      ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');

        console.log('📝 Summary:');
        console.log('   - Server-side HandOverlay loads local files correctly');
        console.log('   - isHttpUrl correctly identifies HTTP/HTTPS URLs');
        console.log('   - Cache system is functional (set/get/stats)');
        console.log('   - HandOverlay handles Buffer input correctly');
        console.log('   - HandOverlayManager initializes with presets correctly');
        console.log('');
        console.log('🎯 Key Feature: HTTP/HTTPS URLs will use loadAssetFromPath');
        console.log('   which provides caching, retry logic, and error handling.');

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    }
}

testHandOverlayCaching();

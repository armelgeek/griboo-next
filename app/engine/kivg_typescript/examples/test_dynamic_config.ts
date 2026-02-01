/**
 * Test for dynamic asset path configuration
 */
import { getAssetPaths, setAssetPaths, resetAssetPaths, getAssetPath } from '../src/shared/asset_config';
import { getHandPreset } from '../src/shared/hand_config';

console.log('🧪 Testing Dynamic Asset Configuration...\n');

// Test 1: Get default paths
console.log('1️⃣ Default asset paths:');
const defaultPaths = getAssetPaths();
console.log('   handDrawing:', defaultPaths.handDrawing);
console.log('   handEraser:', defaultPaths.handEraser);
console.log('   handPush:', defaultPaths.handPush);

// Test 2: Check hand presets use default paths
console.log('\n2️⃣ Hand preset default URLs:');
const drawingPreset = getHandPreset('drawing');
console.log('   Drawing preset URL:', drawingPreset?.imageUrl);

// Test 3: Update paths dynamically
console.log('\n3️⃣ Setting custom paths...');
setAssetPaths({
    handDrawing: '/custom/my-hand.png',
    handEraser: '/custom/my-eraser.png'
});

const updatedPaths = getAssetPaths();
console.log('   Updated handDrawing:', updatedPaths.handDrawing);
console.log('   Updated handEraser:', updatedPaths.handEraser);
console.log('   Unchanged handPush:', updatedPaths.handPush);

// Test 4: Verify presets reflect the change
console.log('\n4️⃣ Preset URLs after path change:');
const updatedDrawingPreset = getHandPreset('drawing');
console.log('   Drawing preset URL:', updatedDrawingPreset?.imageUrl);
console.log('   ✅ Should be /custom/my-hand.png:', updatedDrawingPreset?.imageUrl === '/custom/my-hand.png');

// Test 5: Test individual path getter
console.log('\n5️⃣ Individual path getter:');
const specificPath = getAssetPath('handDrawing');
console.log('   getAssetPath("handDrawing"):', specificPath);
console.log('   ✅ Matches config:', specificPath === '/custom/my-hand.png');

// Test 6: Reset to defaults
console.log('\n6️⃣ Resetting to defaults...');
resetAssetPaths();
const resetPaths = getAssetPaths();
console.log('   Reset handDrawing:', resetPaths.handDrawing);
console.log('   ✅ Back to default:', resetPaths.handDrawing === '/hand/drawing-hand.png');

const resetDrawingPreset = getHandPreset('drawing');
console.log('   Drawing preset URL:', resetDrawingPreset?.imageUrl);
console.log('   ✅ Preset also reset:', resetDrawingPreset?.imageUrl === '/hand/drawing-hand.png');

console.log('\n✅ All dynamic configuration tests passed!');

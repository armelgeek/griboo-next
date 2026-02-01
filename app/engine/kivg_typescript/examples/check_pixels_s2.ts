import { createCanvas, loadImage } from 'canvas';
import * as path from 'path';

async function checkFramePixels() {
    const framePath = path.join(process.cwd(), 'output', 'debug_flash', 's2_t-0.001.png');
    console.log(`🧐 Checking pixels of ${framePath}...`);

    const image = await loadImage(framePath);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let nonWhitePixels = 0;
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Check if pixel is not white (assuming white background [255, 255, 255, 255])
        if (r !== 255 || g !== 255 || b !== 255 || a !== 255) {
            nonWhitePixels++;
        }
    }

    console.log(`📊 Total pixels: ${canvas.width * canvas.height}`);
    console.log(`📊 Non-white pixels: ${nonWhitePixels}`);

    if (nonWhitePixels > 0) {
        console.log('🚨 FLASH DETECTED! The first frame of Scene 2 is not empty.');
    } else {
        console.log('✅ First frame of Scene 2 is empty.');
    }
}

checkFramePixels().catch(console.error);

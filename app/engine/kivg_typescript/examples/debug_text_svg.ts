import { ServerTextSvgLayer } from '../src/server/layers/text_svg_layer';
import { LayerConfig } from '../src/shared/types';
import * as fs from 'fs';

async function debug() {
    const config: LayerConfig = {
        id: 'test',
        type: 'text',
        textConfig: {
            text: 'Hello World',
            fontSize: 50,
            fontFamily: 'Patrick Hand',
            strokeAnimation: {
                mode: 'typewriter',
                duration: 3
            }
        }
    };

    const layer = new ServerTextSvgLayer(config);
    await layer.prepare();

    const svgContent = (config as any).svgContent;
    console.log('Generated SVG Content:');
    console.log(svgContent);

    fs.writeFileSync('debug_text.svg', svgContent);
}

debug().catch(console.error);

import { ServerLayer } from './layer';
import { ServerSimpleImageLayer } from '../layers/simple_image_layer';
import { ServerImageLayer } from '../layers/image_layer';
import { ServerShapeLayer } from '../layers/shape_layer';
import { ServerPathLayer } from '../layers/path_layer';
import { ServerEraserLayer } from '../layers/eraser_layer';
import { ServerMorphLayer } from '../layers/morph_layer';
import { ServerTextLayer } from '../layers/text_layer';
import { ServerPushLayer } from '../layers/push_layer';
import { ServerWritingLayer } from '../layers/writing_layer';
import { ServerRubberLayer } from '../layers/rubber_layer';
import { ServerOcclusionLayer } from '../layers/occlusion_layer';
import { ServerCaptionLayer } from '../layers/caption_layer';
import { ServerSvgLayer } from './svg_layer';


/**
 * Factory for creating server-side layers based on config type
 */
export class ServerLayerFactory {
    private static registry = new Map<string, new (config: any, handsConfig?: any) => ServerLayer>([
        ['image', ServerImageLayer],
        ['simple_image', ServerSimpleImageLayer],
        ['kivg', ServerSvgLayer],
        ['kivgplayer', ServerSvgLayer],
        ['text', ServerTextLayer],
        ['hybrid', ServerImageLayer],
        ['shape', ServerShapeLayer],
        ['path', ServerPathLayer],
        ['eraser', ServerEraserLayer],
        ['morph', ServerMorphLayer],
        ['push', ServerPushLayer],
        ['writing', ServerWritingLayer],
        ['rubber', ServerRubberLayer],
        ['occlusion', ServerOcclusionLayer],
        ['caption', ServerCaptionLayer]
    ]);

    static register(type: string, layerClass: new (config: any, handsConfig?: any) => ServerLayer): void {
        this.registry.set(type.toLowerCase(), layerClass);
    }

    static create(config: any, handsConfig?: any): ServerLayer {
        const type = config.type?.toLowerCase() || 'image';
        const LayerClass = this.registry.get(type);

        if (!LayerClass) {
            console.warn(`Unknown layer type: ${type}, falling back to ImageLayer`);
            return new ServerImageLayer(config, handsConfig);
        }

        return new LayerClass(config, handsConfig);
    }
}

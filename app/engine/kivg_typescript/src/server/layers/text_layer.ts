import { ServerSvgPathLayer } from './svg_path_layer';
import { LayerConfig, WhiteboardConfig } from '../../shared/types';
import { SVGGeneratorCore, FontLoader } from '../../shared/text/text-to-svg';
import { normalizeColorToHex } from '../../shared/utils/color_utils';
import { loadAssetFromPath, resolveAssetPath, isHttpUrl } from '../utils/path_utils';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../shared/infra/logger';

class ServerFontLoader implements FontLoader {
    private cacheDir: string;
    private static activeDownloads: Map<string, Promise<ArrayBuffer>> = new Map();

    constructor() {
        this.cacheDir = path.join(process.cwd(), '.font_cache');
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }

    async loadFont(family: string, variant: string, url: string): Promise<ArrayBuffer> {
        const fileName = `${family}-${variant}.ttf`.replace(/\s+/g, '_').toLowerCase();
        const filePath = path.join(this.cacheDir, fileName);

        // Check disk cache first
        if (fs.existsSync(filePath)) {
            const buffer = fs.readFileSync(filePath);
            const ab = buffer.buffer;
            if (ab instanceof ArrayBuffer) {
                return ab.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
            }
            // If it's a SharedArrayBuffer, we need to copy it to a regular ArrayBuffer
            return new Uint8Array(buffer).slice().buffer;
        }

        // Check if already downloading
        if (ServerFontLoader.activeDownloads.has(filePath)) {
            return ServerFontLoader.activeDownloads.get(filePath)!;
        }
        const downloadPromise = (async () => {
            try {
                Logger.info(`[ServerFontLoader] Downloading font ${family} (${variant})`, { url });

                // Use our HTTP loader with cache and retry logic
                const resolvedUrl = resolveAssetPath(url);
                try {
                    const buffer = await loadAssetFromPath(resolvedUrl, 'font');
                    const ab = buffer.buffer;
                    let arrayBuffer: ArrayBuffer;
                    if (ab instanceof ArrayBuffer) {
                        arrayBuffer = ab.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
                    } else {
                        arrayBuffer = new Uint8Array(buffer).slice().buffer;
                    }

                    // Save to disk cache
                    fs.writeFileSync(filePath, buffer);
                    return arrayBuffer;
                } catch (error) {
                    Logger.warn(`[ServerFontLoader] Failed to download font ${family} (${variant}), trying fallback...`, {
                        url,
                        error: (error as Error).message
                    });
                    // Generic fallback to Roboto if the versioned one fails
                    const fallbackUrl = 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.ttf';
                    if (url !== fallbackUrl) {
                        return this.loadFont('Roboto', 'regular', fallbackUrl);
                    }
                    throw error;
                }
            } finally {
                ServerFontLoader.activeDownloads.delete(filePath);
            }
        })();

        ServerFontLoader.activeDownloads.set(filePath, downloadPromise);
        return downloadPromise;
    }
}

export class ServerTextLayer extends ServerSvgPathLayer {
    private generator: SVGGeneratorCore;
    private static fontLoader = new ServerFontLoader();

    constructor(config: LayerConfig, handsConfig?: WhiteboardConfig['hands']) {
        super(config, handsConfig);
        this.generator = new SVGGeneratorCore(ServerTextLayer.fontLoader);
    }

    protected async doPrepare(): Promise<void> {
        const textConfig = (this.config as any).textConfig || {};
        const text = textConfig.text || 'Hello';
        const fontSize = textConfig.fontSize || 100;
        const fontFamily = textConfig.fontFamily || 'Roboto';
        const fontVariant = textConfig.fontVariant || 'regular';
        const textAlign = textConfig.textAlign || 'left';

        // Normalize color to hex string
        const color = normalizeColorToHex(textConfig.color || '#000000');
        const strokeAnimation = textConfig.strokeAnimation || {};
        const strokeColor = normalizeColorToHex(strokeAnimation.strokeColor || color);

        // Update generator settings
        this.generator.updateSettings({
            text,
            size: fontSize,
            fontFamily,
            variant: fontVariant,
            align: textAlign,
            color
        });

        // Generate SVG
        const svgContent = await this.generator.render();

        // Inject SVG content into config for ServerKivgLayer to pick up
        (this.config as any).svgContent = svgContent;

        // Pass kivgConfig settings
        const isTypewriter = strokeAnimation.mode === 'typewriter';
        (this.config as any).kivgConfig = {
            strokeColor: isTypewriter ? 'none' : strokeColor,
            strokeWidth: isTypewriter ? 0 : (strokeAnimation.strokeWidth || 2),
            fillColor: color,
            fillMode: strokeAnimation.fillMode || (isTypewriter ? 'start' : 'end'),
            charDelay: strokeAnimation.charDelay || 0
        };

        // If typewriter or draw mode is set in strokeAnimation, update entrance_animation type
        if (strokeAnimation.mode === 'typewriter' || strokeAnimation.mode === 'draw' || strokeAnimation.mode === 'stroke') {
            const animType = strokeAnimation.mode === 'stroke' ? 'draw' : strokeAnimation.mode;
            if (!this.config.entrance_animation) {
                this.config.entrance_animation = { type: animType as any, duration: (strokeAnimation.duration || 3) };
            } else {
                this.config.entrance_animation.type = animType as any;
                if (strokeAnimation.duration) {
                    this.config.entrance_animation.duration = strokeAnimation.duration;
                }
            }
        }

        // Call super.prepare() which will parse the generated SVG
        await super.doPrepare();
    }
}
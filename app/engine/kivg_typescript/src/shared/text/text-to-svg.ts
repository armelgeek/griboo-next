import * as makerjs from 'makerjs';
import * as opentype from 'opentype.js';
import { Font, FONTS } from "./fonts";

export interface FontLoader {
    loadFont(family: string, variant: string, url: string): Promise<ArrayBuffer>;
}

interface Config {
    defaultFont: string;
    defaultVariant: string;
    defaultText: string;
    defaultSize: number;
    fonts: Font[];
}

interface Settings {
    text: string;
    size: number;
    fontUploadedFile: ArrayBuffer | null;
    reversePath?: boolean;
    lineHeight?: number;
    letterSpacing?: number;
    align?: 'left' | 'center' | 'right';
    color?: string;
}

export interface AppState {
    settings: Settings;
    currentFontFamily: string;
    currentVariant: string;
    svg: string | null;
    initialized: boolean;
}

export interface UpdateOptions {
    text?: string;
    size?: number;
    fontFamily?: string;
    variant?: string;
    reversePath?: boolean;
    lineHeight?: number;
    letterSpacing?: number;
    align?: 'left' | 'center' | 'right';
    color?: string;
}

const GENERIC_FONT_FALLBACKS: { [key: string]: string } = {
    'sans-serif': 'Caveat',
    'serif': 'Times New Roman',
    'monospace': 'Courier New',
    'cursive': 'Pacifico',
    'fantasy': 'Bebas Neue',
    'system-ui': 'Caveat',
    'arial': 'Arial',
    'helvetica': 'Arial',
    'times new roman': 'Times New Roman',
    'georgia': 'Georgia',
    'courier new': 'Courier New',
    'verdana': 'Verdana'
};

const CONFIG: Config = {
    defaultFont: 'Caveat',
    defaultVariant: 'regular',
    defaultText: 'Hello World',
    defaultSize: 100,
    fonts: FONTS
};

export class SVGGeneratorCore {
    private fonts: Font[];
    private state: AppState;
    private fontLoader?: FontLoader;

    constructor(fontLoader?: FontLoader, initialState?: Partial<AppState>) {
        this.fonts = CONFIG.fonts;
        this.fontLoader = fontLoader;

        const defaultSettings: Settings = {
            text: CONFIG.defaultText,
            size: CONFIG.defaultSize,
            fontUploadedFile: null,
            lineHeight: 1.2,
            letterSpacing: 0,
            align: 'left',
            color: '#000000'
        };

        this.state = {
            settings: { ...defaultSettings, ...(initialState?.settings || {}) },
            currentFontFamily: initialState?.currentFontFamily || CONFIG.defaultFont,
            currentVariant: initialState?.currentVariant || CONFIG.defaultVariant,
            svg: initialState?.svg || null,
            initialized: true
        };
    }

    private getFontByFamily(fontFamily: string): Font | undefined {
        let font = this.fonts.find(f => f.family.toLowerCase() === fontFamily.toLowerCase());

        const normalizedFamily = fontFamily.toLowerCase();
        if (!font && GENERIC_FONT_FALLBACKS[normalizedFamily]) {
            const fallbackFamily = GENERIC_FONT_FALLBACKS[normalizedFamily];
            font = this.fonts.find(f => f.family === fallbackFamily);
        }

        return font;
    }

    private generateSVG(font: opentype.Font): string {
        const { text, size, lineHeight = 1.2, letterSpacing = 0, align = 'left', color = '#000000' } = this.state.settings;
        const union: boolean = true;
        const separate: boolean = true;
        const bezierAccuracy: number | undefined = undefined;

        const lines = text.split('\n');
        const mainModel: makerjs.IModel = { models: {} };
        const lineHeightPx = size * lineHeight;

        lines.forEach((line, lineIdx) => {
            let lineModel: makerjs.IModel;

            if (letterSpacing !== 0) {
                lineModel = { models: {} };
                let currentX = 0;
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    if (char === ' ') {
                        currentX += size * 0.3;
                        continue;
                    }
                    const charModel = new makerjs.models.Text(font, char, size, union, false, bezierAccuracy);
                    makerjs.model.move(charModel, [currentX, 0]);
                    lineModel.models![`char_${i}`] = charModel;

                    const bounds = makerjs.measure.modelExtents(charModel);
                    if (bounds) {
                        currentX += (bounds.high[0] - bounds.low[0]) + letterSpacing;
                    } else {
                        currentX += size * 0.5;
                    }
                }
            } else {
                lineModel = new makerjs.models.Text(font, line, size, union, false, bezierAccuracy);
            }

            const lineBounds = makerjs.measure.modelExtents(lineModel);
            let offsetX = 0;
            if (lineBounds) {
                const lineWidth = lineBounds.high[0] - lineBounds.low[0];
                if (align === 'center') offsetX = -lineWidth / 2;
                else if (align === 'right') offsetX = -lineWidth;
            }

            makerjs.model.move(lineModel, [offsetX, -lineIdx * lineHeightPx]);
            mainModel.models![`line_${lineIdx}`] = lineModel;
        });

        if (separate && mainModel.models) {
            let counter = 0;
            for (let lineId in mainModel.models) {
                const lineModel = mainModel.models[lineId];
                if (lineModel.models) {
                    for (let charId in lineModel.models) {
                        lineModel.models[charId].layer = (counter++).toString();
                    }
                } else {
                    lineModel.layer = (counter++).toString();
                }
            }
        }

        if (this.state.settings.reversePath) {
            const reversePathGeometry = (path: makerjs.IPath) => {
                if (path.type === 'line') {
                    const line = path as makerjs.paths.Line;
                    const temp = line.origin;
                    line.origin = line.end;
                    line.end = temp;
                } else if (path.type === 'bezierSeed') {
                    const bezier = path as any;
                    const temp = bezier.origin;
                    bezier.origin = bezier.end;
                    bezier.end = temp;
                    if (bezier.controls) {
                        bezier.controls.reverse();
                    }
                }
            };

            const reverseModelPaths = (model: makerjs.IModel) => {
                if (model.paths) {
                    for (let id in model.paths) {
                        reversePathGeometry(model.paths[id]);
                    }
                }
                if (model.models) {
                    for (let id in model.models) {
                        reverseModelPaths(model.models[id]);
                    }
                }
            };

            reverseModelPaths(mainModel);
        }

        const svg: string = makerjs.exporter.toSVG(mainModel, {
            annotate: false,
            fill: color,
            stroke: color,
            viewBox: true
        });
        this.state.svg = svg;
        return svg;
    }

    public async render(options?: UpdateOptions): Promise<string> {
        if (options) {
            this.updateSettings(options);
        }

        const { fontUploadedFile } = this.state.settings;

        if (fontUploadedFile) {
            try {
                const font: opentype.Font = opentype.parse(fontUploadedFile);
                return this.generateSVG(font);
            } catch (e) {
                throw new Error('Erreur de parsing de la police.');
            }
        } else {
            const fontConfig: Font | undefined = this.getFontByFamily(this.state.currentFontFamily);

            if (!fontConfig) {
                throw new Error(`Police non trouvée: ${this.state.currentFontFamily}`);
            }

            const url: string | undefined = fontConfig.files[this.state.currentVariant];
            if (!url) {
                throw new Error(`Variante '${this.state.currentVariant}' non trouvée pour '${this.state.currentFontFamily}'.`);
            }

            if (!this.fontLoader) {
                throw new Error('Font loader not provided.');
            }

            const buffer = await this.fontLoader.loadFont(
                this.state.currentFontFamily,
                this.state.currentVariant,
                url
            );

            try {
                const loadedFont = opentype.parse(buffer);
                return this.generateSVG(loadedFont);
            } catch (e) {
                const originalError = e instanceof Error ? e : new Error(String(e));
                throw new Error(`Erreur lors de la génération du SVG: ${originalError.message}`);
            }
        }
    }

    public updateSettings(options: UpdateOptions): void {
        let needsFontUpdate = false;

        if (options.reversePath !== undefined) {
            this.state.settings.reversePath = options.reversePath;
        }
        if (options.text !== undefined) {
            this.state.settings.text = options.text;
        }
        if (options.size !== undefined) {
            this.state.settings.size = options.size;
        }
        if (options.lineHeight !== undefined) {
            this.state.settings.lineHeight = options.lineHeight;
        }
        if (options.letterSpacing !== undefined) {
            this.state.settings.letterSpacing = options.letterSpacing;
        }
        if (options.align !== undefined) {
            this.state.settings.align = options.align;
        }
        if (options.color !== undefined) {
            this.state.settings.color = options.color;
        }

        if (options.fontFamily !== undefined) {
            const fontConfig = this.getFontByFamily(options.fontFamily);
            if (!fontConfig) {
                const defaultFontConfig = this.getFontByFamily(CONFIG.defaultFont);
                if (defaultFontConfig) {
                    this.state.currentFontFamily = defaultFontConfig.family;
                } else {
                    throw new Error(`Default font "${CONFIG.defaultFont}" not found in configuration`);
                }
            } else {
                this.state.currentFontFamily = fontConfig.family;
            }
            needsFontUpdate = true;
        }

        if (options.variant !== undefined) {
            this.state.currentVariant = options.variant;
            needsFontUpdate = true;
        }

        if (needsFontUpdate) {
            this.state.settings.fontUploadedFile = null;
        }
    }

    public uploadFont(fileBuffer: ArrayBuffer): void {
        this.state.settings.fontUploadedFile = fileBuffer;
        this.state.currentFontFamily = 'Uploaded';
        this.state.currentVariant = 'Custom';
    }

    public getAvailableFonts(): Font[] {
        return this.fonts;
    }

    public getState(): AppState {
        return { ...this.state };
    }
}

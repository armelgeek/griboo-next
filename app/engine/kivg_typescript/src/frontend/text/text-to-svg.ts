import { fontCacheService } from '../../shared/infra/font-cache-service';
import { SVGGeneratorCore as SharedSVGGeneratorCore, FontLoader } from '../../shared/text/text-to-svg';
import { AppState } from '../../shared/text/text-to-svg';

class FrontendFontLoader implements FontLoader {
    async loadFont(family: string, variant: string, url: string): Promise<ArrayBuffer> {
        return fontCacheService.loadFont(family, variant, url);
    }
}

export class SVGGeneratorCore extends SharedSVGGeneratorCore {
    constructor(initialState?: Partial<AppState>) {
        super(new FrontendFontLoader(), initialState);
    }
}
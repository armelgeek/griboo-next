export enum ErrorCode {
    ASSET_NOT_FOUND = 'ASSET_NOT_FOUND',
    ASSET_LOAD_FAILED = 'ASSET_LOAD_FAILED',
    NETWORK_ERROR = 'NETWORK_ERROR',
    RENDER_ERROR = 'RENDER_ERROR',
    CONFIG_ERROR = 'CONFIG_ERROR',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class EngineError extends Error {
    constructor(
        public readonly code: ErrorCode,
        message: string,
        public readonly metadata?: Record<string, any>
    ) {
        super(message);
        this.name = 'EngineError';
        Object.setPrototypeOf(this, EngineError.prototype);
    }
}

export class AssetError extends EngineError {
    constructor(
        code: ErrorCode,
        message: string,
        public readonly assetUrl: string,
        metadata?: Record<string, any>
    ) {
        super(code, message, { ...metadata, assetUrl });
        this.name = 'AssetError';
        Object.setPrototypeOf(this, AssetError.prototype);
    }
}

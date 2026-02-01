import { isDebugEnabled } from "../config/debug_config";

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
}

export interface LogMetadata {
    [key: string]: any;
}

export class Logger {
    private static level: LogLevel = LogLevel.INFO;

    static setLevel(level: LogLevel): void {
        this.level = level;
    }

    static debug(message: string, meta?: LogMetadata): void {
        if (this.shouldLog(LogLevel.DEBUG)) {
            this.log('DEBUG', message, meta);
        }
    }

    static info(message: string, meta?: LogMetadata): void {
        if (this.shouldLog(LogLevel.INFO)) {
            this.log('INFO', message, meta);
        }
    }

    static warn(message: string, meta?: LogMetadata): void {
        if (this.shouldLog(LogLevel.WARN)) {
            this.log('WARN', message, meta);
        }
    }

    static error(message: string, error?: Error | unknown, meta?: LogMetadata): void {
        if (this.shouldLog(LogLevel.ERROR)) {
            const errorMeta = error instanceof Error
                ? { error: error.message, stack: error.stack, ...meta }
                : { error: String(error), ...meta };
            this.log('ERROR', message, errorMeta);
        }
    }

    private static shouldLog(level: LogLevel): boolean {
        if (level === LogLevel.DEBUG && !isDebugEnabled()) {
            return false;
        }
        return level >= this.level;
    }

    private static log(level: string, message: string, meta?: LogMetadata): void {
        const timestamp = new Date().toISOString();
        const metaString = meta ? ` ${JSON.stringify(meta)}` : '';

        const formattedMessage = `[${timestamp}] [${level}] ${message}${metaString}`;

        switch (level) {
            case 'DEBUG':
                console.debug(formattedMessage);
                break;
            case 'INFO':
                console.info(formattedMessage);
                break;
            case 'WARN':
                console.warn(formattedMessage);
                break;
            case 'ERROR':
                console.error(formattedMessage);
                break;
            default:
                console.log(formattedMessage);
        }
    }
}

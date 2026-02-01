declare module 'svg-path-parser' {
    export function parseSVG(d: string): any[];
    export function makeAbsolute(commands: any[]): any[];
}

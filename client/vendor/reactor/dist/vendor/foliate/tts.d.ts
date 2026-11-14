export class TTS {
    constructor(doc: any, textWalker: any, highlight: any, granularity: any);
    doc: any;
    highlight: any;
    start(): string | undefined;
    resume(): string | undefined;
    prev(paused: any): string | undefined;
    next(paused: any): string | undefined;
    from(range: any): string | undefined;
    setMark(mark: any): void;
    #private;
}

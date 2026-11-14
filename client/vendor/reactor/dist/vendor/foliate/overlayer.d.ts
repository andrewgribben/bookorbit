export class Overlayer {
    static underline(rects: any, options?: {}): any;
    static strikethrough(rects: any, options?: {}): any;
    static squiggly(rects: any, options?: {}): any;
    static highlight(rects: any, options?: {}): any;
    static outline(rects: any, options?: {}): any;
    static copyImage([rect]: [any], options?: {}): any;
    get element(): any;
    add(key: any, range: any, draw: any, options: any): void;
    remove(key: any): void;
    redraw(): void;
    hitTest({ x, y }: {
        x: any;
        y: any;
    }): any[];
    #private;
}

export interface Rect {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
}
export type DrawOptions = {
    color?: string;
};
export type DrawFn = (rects: Rect[] | ArrayLike<Rect>, opts?: DrawOptions) => SVGGElement;
export declare function getDrawFunction(style: string | undefined): DrawFn;

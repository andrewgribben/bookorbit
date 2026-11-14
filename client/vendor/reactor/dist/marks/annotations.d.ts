import { type DrawFn } from './draw.js';
export interface AnnotationStyle {
    color: string;
    style: string;
}
export interface AnnotationInput {
    cfi: string;
    color: string;
    style: string;
}
export interface AnnotationHooks {
    draw(cfi: string): void;
    erase(cfi: string): void;
}
/** cfi -> { color, style } for every highlight currently drawn, owned per open book. */
export declare class AnnotationManager {
    private styles;
    getStyle(cfi: string): AnnotationStyle | undefined;
    getDrawFunctionFor(cfi: string): DrawFn | null;
    keys(): string[];
    reset(): void;
    /** Erases removed CFIs, (re)draws new or changed ones. Unchanged CFIs are left alone - this
     * is the behaviour that makes `setAnnotations` safe to call on every host-side edit without
     * redrawing the whole set each time. */
    setAnnotations(items: AnnotationInput[] | null | undefined, hooks: AnnotationHooks): void;
}

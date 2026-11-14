export type MarkStyleId = 'highlight' | 'underline' | 'strikethrough' | 'squiggly';
export interface AnnotationPopoverElements {
    root: HTMLElement;
    colorRow: HTMLElement;
    colorButtons: HTMLButtonElement[];
    styleRow: HTMLElement;
    styleButtons: Record<MarkStyleId, HTMLButtonElement>;
    noteToggleBtn: HTMLButtonElement;
    noteForm: HTMLElement;
    noteTextarea: HTMLTextAreaElement;
    noteSaveBtn: HTMLButtonElement;
    noteCancelBtn: HTMLButtonElement;
    deleteBtn: HTMLButtonElement;
    closeBtn: HTMLButtonElement;
    statusLabel: HTMLElement;
}
export declare function buildAnnotationPopover(doc: Document): AnnotationPopoverElements;

export interface FocusTrapHandle {
    activate(): void;
    deactivate(): void;
}
export declare function createFocusTrap(root: HTMLElement): FocusTrapHandle;

import type { ILWDialog, ILWDialogConfigParams } from './types';
declare type ActionType = 'copy' | 'paste';
declare class CopyPaste implements ILWDialog {
    readonly $copyPasteDialog: JQuery<HTMLElement>;
    readonly copyMsg: string;
    readonly pasteMsg: string;
    constructor({ writer, parentEl }: ILWDialogConfigParams);
    show({ modal, type }: {
        modal?: boolean;
        type: ActionType;
    }): void;
    destroy(): void;
}
export default CopyPaste;
//# sourceMappingURL=copyPaste.d.ts.map
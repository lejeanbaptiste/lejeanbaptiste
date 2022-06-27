import 'jquery-ui/ui/widgets/dialog';
import 'jquery-ui/ui/widgets/tooltip';
import '../lib/jquery/jquery.popup';
import type { SchemaDialog } from './dialogs/entities/types';
import type { ILWDialog } from './dialogs/types';
import Writer from './Writer';
interface IDefaultDialogConfig {
    dialogClass: any;
    type?: string;
}
/**
 * @class DialogManager
 * @param {Writer} writer
 */
declare class DialogManager {
    readonly writer: Writer;
    readonly $cwrcDialogWrapper: JQuery<HTMLElement>;
    readonly dialogs: Map<string, ILWDialog>;
    readonly schemaDialogs: Map<string, SchemaDialog>;
    constructor(writer: Writer);
    addDialog(name: string, { dialogClass, type }: IDefaultDialogConfig): any;
    getDialog(name: string): ILWDialog;
    getDialogWrapper(): JQuery<HTMLElement>;
    /**
     * Show the dialog specified by type.
     * @param {String} type The dialog type
     * @param {Object} [config] A configuration object to pass to the dialog
     */
    show(type: string, config?: object): void;
    confirm(config: object): void;
    destroy(): void;
    getDialogPref(name: string): any;
    setDialogPref(name: string, value: any): void;
    clearDialogPrefs(): void;
}
export default DialogManager;
//# sourceMappingURL=dialogManager.d.ts.map
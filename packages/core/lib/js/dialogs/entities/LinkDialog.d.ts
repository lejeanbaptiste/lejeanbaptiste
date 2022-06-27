import Entity from '../../../js/entities/Entity';
import type { EntityTypes } from '../../../js/schema/types';
import Writer from '../../../js/Writer';
import type { MappingID } from '../../../types';
import DialogForm from '../dialogForm/dialogForm';
import type { ILWDialogConfigParams } from '../types';
import type { SchemaDialog } from './types';
declare class LinkDialog implements SchemaDialog {
    readonly writer: Writer;
    readonly id: string;
    readonly dialog: DialogForm;
    readonly $el: JQuery<HTMLElement>;
    readonly mappingID: MappingID;
    entry?: Entity;
    selectedText?: string;
    type: EntityTypes;
    constructor({ writer, parentEl }: ILWDialogConfigParams);
    private selectedTextField;
    private updateTextField;
    private LinkField;
    private getSelection;
    show(config?: {
        [x: string]: any;
        entry: Entity;
    }): void;
    destroy(): void;
}
export default LinkDialog;
//# sourceMappingURL=LinkDialog.d.ts.map
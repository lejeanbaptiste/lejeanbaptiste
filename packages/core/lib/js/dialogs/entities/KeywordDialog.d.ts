import Entity from '../../../js/entities/Entity';
import type { EntityTypes } from '../../../js/schema/types';
import type { MappingID } from '../../../types';
import Writer from '../../Writer';
import DialogForm from '../dialogForm/dialogForm';
import type { ILWDialogConfigParams } from '../types';
import type { SchemaDialog } from './types';
declare class KeywordDialog implements SchemaDialog {
    readonly writer: Writer;
    readonly dialog: DialogForm;
    readonly mappingID: MappingID;
    forceSave: boolean;
    entry?: Entity;
    selectedText?: string;
    type: EntityTypes;
    constructor({ writer, parentEl }: ILWDialogConfigParams);
    private selectedTextField;
    private updateTextField;
    private noteContentField;
    private getSelection;
    show(config?: {
        [x: string]: any;
        entry: Entity;
    }): void;
    destroy(): void;
}
export default KeywordDialog;
//# sourceMappingURL=KeywordDialog.d.ts.map
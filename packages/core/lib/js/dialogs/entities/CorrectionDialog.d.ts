import Entity from '../../../js/entities/Entity';
import type { EntityTypes } from '../../../js/schema/types';
import Writer from '../../../js/Writer';
import type { MappingID } from '../../../types';
import DialogForm from '../dialogForm/dialogForm';
import type { ILWDialogConfigParams } from '../types';
import type { SchemaDialog } from './types';
declare class DateDialog implements SchemaDialog {
    readonly writer: Writer;
    readonly dialog: DialogForm;
    readonly mappingID: MappingID;
    entry?: Entity;
    selectedText?: string;
    type: EntityTypes;
    constructor({ writer, parentEl }: ILWDialogConfigParams);
    private selectedTextField;
    private updateTextField;
    private correctionField;
    private getSelection;
    show(config?: {
        [x: string]: any;
        entry: Entity;
    }): void;
    destroy(): void;
}
export default DateDialog;
//# sourceMappingURL=CorrectionDialog.d.ts.map
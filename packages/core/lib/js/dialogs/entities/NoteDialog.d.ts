import Entity from '../../../js/entities/Entity';
import type { EntityTypes } from '../../../js/schema/types';
import type { MappingID } from '../../../types';
import Writer from '../../Writer';
import DialogForm from '../dialogForm/dialogForm';
import type { ILWDialogConfigParams } from '../types';
import type { SchemaDialog } from './types';
declare class NoteDialog implements SchemaDialog {
    readonly writer: Writer;
    readonly dialog: DialogForm;
    readonly id: string;
    readonly mappingID: MappingID;
    readonly typeAtt: any;
    entry?: Entity;
    selectedText?: string;
    type: EntityTypes;
    constructor({ writer, parentEl }: ILWDialogConfigParams);
    private selectedTextField;
    private updateTextField;
    private generateTypeOptions;
    private toggleOtherTypeTextField;
    private setTypeOptions;
    private typeDataMapping;
    private typeRequired;
    private noteTypeField;
    private otherTypeField;
    private noteTextField;
    private getSelection;
    show(config?: {
        [x: string]: any;
        entry: Entity;
    }): void;
    destroy(): void;
}
export default NoteDialog;
//# sourceMappingURL=NoteDialog.d.ts.map
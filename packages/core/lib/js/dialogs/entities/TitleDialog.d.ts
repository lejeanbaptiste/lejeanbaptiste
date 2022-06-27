import Entity from '../../../js/entities/Entity';
import type { EntityTypes } from '../../../js/schema/types';
import Writer from '../../../js/Writer';
import type { MappingID } from '../../../types';
import DialogForm from '../dialogForm/dialogForm';
import type { ILWDialogConfigParams } from '../types';
import type { SchemaDialog } from './types';
declare class TitleDialog implements SchemaDialog {
    readonly writer: Writer;
    readonly dialog: DialogForm;
    readonly mappingID: MappingID;
    entry?: Entity;
    selectedText?: string;
    type: EntityTypes;
    constructor({ writer, parentEl }: ILWDialogConfigParams);
    private updateLink;
    private updateTagAs;
    private selectedTextField;
    private updateTextField;
    private tagAsField;
    private certaintyField;
    private titleLevelField;
    show(config: {
        [x: string]: any;
        entry: Entity;
        query: string;
    }): void;
    destroy(): void;
}
export default TitleDialog;
//# sourceMappingURL=TitleDialog.d.ts.map
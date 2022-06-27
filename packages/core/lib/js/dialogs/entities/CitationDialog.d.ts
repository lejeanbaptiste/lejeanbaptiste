import Entity from '../../../js/entities/Entity';
import type { EntityTypes } from '../../../js/schema/types';
import Writer from '../../../js/Writer';
import DialogForm from '../dialogForm/dialogForm';
import type { ILWDialogConfigParams } from '../types';
import { SchemaDialog } from './types';
declare class CitationDialog implements SchemaDialog {
    readonly writer: Writer;
    readonly dialog: DialogForm;
    entry?: Entity;
    selectedText?: string;
    type: EntityTypes;
    constructor({ writer, parentEl }: ILWDialogConfigParams);
    private updateLink;
    private updateTagAs;
    private selectedTextField;
    private updateTextField;
    private selectedSourceField;
    private citatonTextField;
    show(config: {
        [x: string]: any;
        entry: Entity;
        query: string;
    }): void;
    destroy(): void;
}
export default CitationDialog;
//# sourceMappingURL=CitationDialog.d.ts.map
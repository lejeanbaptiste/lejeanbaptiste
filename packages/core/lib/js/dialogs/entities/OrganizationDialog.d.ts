import 'jquery-ui/ui/widgets/button';
import Entity from '../../../js/entities/Entity';
import type { EntityTypes } from '../../../js/schema/types';
import Writer from '../../../js/Writer';
import type { MappingID } from '../../../types';
import DialogForm from '../dialogForm/dialogForm';
import type { ILWDialogConfigParams } from '../types';
import type { SchemaDialog } from './types';
declare class OrgDialog implements SchemaDialog {
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
    private orgTypeField;
    show(config: {
        [x: string]: any;
        entry: Entity;
        query: string;
    }): void;
    destroy(): void;
}
export default OrgDialog;
//# sourceMappingURL=OrganizationDialog.d.ts.map
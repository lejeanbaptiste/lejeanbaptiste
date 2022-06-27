import 'jquery-ui/ui/widgets/selectmenu';
import Entity from '../../../js/entities/Entity';
import type { EntityTypes } from '../../../js/schema/types';
import Writer from '../../../js/Writer';
import DialogForm from '../dialogForm/dialogForm';
import type { ILWDialogConfigParams } from '../types';
import type { SchemaDialog } from './types';
declare class RsDialog implements SchemaDialog {
    readonly writer: Writer;
    readonly dialog: DialogForm;
    readonly $el: JQuery<HTMLElement>;
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
    private rsTypeField;
    private otherTypeField;
    show(config: {
        [x: string]: any;
        entry: Entity;
        query: string;
    }): void;
    destroy(): void;
}
export default RsDialog;
//# sourceMappingURL=RsDialog.d.ts.map
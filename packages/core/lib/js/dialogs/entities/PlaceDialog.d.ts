import 'jquery-ui/ui/widgets/button';
import Entity from '../../../js/entities/Entity';
import type { EntityTypes } from '../../../js/schema/types';
import Writer from '../../../js/Writer';
import DialogForm from '../dialogForm/dialogForm';
import type { ILWDialogConfigParams } from '../types';
import type { SchemaDialog } from './types';
declare class PlaceDialog implements SchemaDialog {
    readonly writer: Writer;
    readonly dialog: DialogForm;
    entry?: Entity;
    selectedText?: string;
    type: EntityTypes;
    constructor({ writer, parentEl }: ILWDialogConfigParams);
    private updateLink;
    private selectedTextField;
    private updateTagAs;
    private updateTextField;
    private tagAsField;
    private certaintyField;
    private precisionField;
    private placeTypeField;
    show(config: {
        [x: string]: any;
        entry: Entity;
        query: string;
    }): void;
    destroy(): void;
}
export default PlaceDialog;
//# sourceMappingURL=PlaceDialog.d.ts.map
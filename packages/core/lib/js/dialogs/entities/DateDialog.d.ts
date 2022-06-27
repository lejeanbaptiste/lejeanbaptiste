import 'jquery-ui/ui/widgets/button';
import 'jquery-ui/ui/widgets/datepicker';
import Entity from '../../../js/entities/Entity';
import type { EntityTypes } from '../../../js/schema/types';
import type { MappingID } from '../../../types';
import Writer from '../../Writer';
import DialogForm from '../dialogForm/dialogForm';
import type { ILWDialogConfigParams } from '../types';
import type { SchemaDialog } from './types';
declare class DateDialog implements SchemaDialog {
    readonly writer: Writer;
    readonly dialog: DialogForm;
    readonly $dateInput: JQuery<HTMLElement>;
    readonly mappingID: MappingID;
    readonly DATE_DATA_FIELD: 'when' | 'VALUE';
    readonly FROM_DATA_FIELD: 'from' | 'FROM';
    readonly TO_DATA_FIELD: 'to' | 'TO';
    entry?: Entity;
    selectedText?: string;
    type: EntityTypes;
    dateRange: any;
    constructor({ writer, parentEl }: ILWDialogConfigParams);
    private selectedTextField;
    private updateTextField;
    private dateTypeField;
    private dateField;
    private rangeField;
    private certaintyField;
    private calendarField;
    private schemaMappingMatch;
    private getSelection;
    show(config?: {
        [x: string]: any;
        entry: Entity;
    }): void;
    destroy(): void;
}
export default DateDialog;
//# sourceMappingURL=DateDialog.d.ts.map
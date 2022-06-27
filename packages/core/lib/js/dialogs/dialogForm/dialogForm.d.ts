import 'jquery-ui/ui/widgets/button';
import 'jquery-ui/ui/widgets/controlgroup';
import 'jquery-ui/ui/widgets/dialog';
import 'jquery-ui/ui/widgets/selectmenu';
import Entity from '../../../js/entities/Entity';
import Writer from '../../Writer';
import AttributeWidget from '../attributeWidget/attributeWidget';
declare type DialogType = 'person' | 'citation' | 'correction' | 'date' | 'keyword' | 'link' | 'organization' | 'place' | 'title' | 'note' | 'rs';
interface IDialogFormConfig {
    writer: Writer;
    $el: JQuery<HTMLElement>;
    title: string;
    height?: number;
    width?: number;
    cwrcWriterConfig?: any;
    type: DialogType;
}
interface IDialogFormShowConfig {
    [x: string]: any;
    entry?: Entity;
}
interface IcurrentData {
    attributes: any;
    properties: any;
    customValues: any;
}
declare class DialogForm {
    static ADD: 0;
    static EDIT: 1;
    readonly writer: Writer;
    readonly $el: JQuery<HTMLElement>;
    showConfig?: IDialogFormShowConfig;
    cwrcWriter?: any;
    isValid: boolean;
    type: DialogType;
    mode: 0 | 1 | null;
    currentId: string | null;
    currentData: IcurrentData;
    attributesWidget?: AttributeWidget;
    attWidgetInit: boolean;
    static processForm(dialogInstance: DialogForm): void;
    static populateForm(dialogInstance: DialogForm): void;
    constructor(config: IDialogFormConfig);
    private initAttributeWidget;
    show(config?: IDialogFormShowConfig): void;
    save(): void;
    destroy(): void;
}
export default DialogForm;
//# sourceMappingURL=dialogForm.d.ts.map
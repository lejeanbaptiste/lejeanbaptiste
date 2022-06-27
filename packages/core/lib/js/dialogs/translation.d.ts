import 'jquery-ui/ui/widgets/dialog';
import Writer from '../Writer';
import AttributeWidget from './attributeWidget/attributeWidget';
import type { ILWDialog, ILWDialogConfigParams } from './types';
declare class Translation implements ILWDialog {
    readonly writer: Writer;
    readonly $el: JQuery<HTMLElement>;
    readonly id: string;
    readonly attributesWidget: AttributeWidget;
    readonly tagName: string;
    readonly textParentTagName: string;
    readonly langAttribute: string;
    readonly respAttribute: string;
    constructor({ writer, parentEl }: ILWDialogConfigParams);
    private languageSelectField;
    private responsabilityField;
    private translationField;
    private formResult;
    show(): void;
    destroy(): void;
}
export default Translation;
//# sourceMappingURL=translation.d.ts.map
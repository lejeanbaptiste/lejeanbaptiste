import Writer from '../../Writer';
import AttributeWidget from '../attributeWidget/attributeWidget';
import type { ILWDialog, ILWDialogConfigParams } from '../types';
declare class AttributesEditor implements ILWDialog {
    readonly writer: Writer;
    readonly $schemaDialog: JQuery<HTMLElement>;
    readonly attributesWidget: AttributeWidget;
    currentCallback: Function | null;
    constructor({ writer, parentEl }: ILWDialogConfigParams);
    private hintComponent;
    private toggleHintComponent;
    private warningAlertComponent;
    private formResult;
    private cancel;
    private doShow;
    /**
     * Show the attributes editor
     * @param {String} tagName The tag name
     * @param {String} tagName The tag fullname
     * @param {String} tagPath The xpath for the tag
     * @param {Object} attributes Attributes previously added to tag (for use when editing)
     * @param {Function} callback Callback function. Called with attributes object, or null if cancelled.
     */
    show({ attributes, callback, tagFullname, tagName, tagPath, }: {
        attributes: object;
        callback: Function;
        tagFullname?: string;
        tagName: string;
        tagPath: string;
    }): void;
    destroy(): void;
}
export default AttributesEditor;
//# sourceMappingURL=attributesEditor.d.ts.map
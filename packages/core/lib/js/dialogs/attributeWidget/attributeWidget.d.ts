import 'css-tooltip';
import Writer from '../../Writer';
interface IAttributeWidgetConfig {
    writer: Writer;
    $el: JQuery<HTMLElement>;
    $parent?: JQuery<HTMLElement>;
    showSchemaHelp?: boolean;
}
declare class AttributeWidget {
    static readonly ADD = 0;
    static readonly EDIT = 1;
    readonly writer: Writer;
    readonly $el: JQuery<HTMLElement>;
    readonly $parent?: JQuery<HTMLElement>;
    readonly showSchemaHelp: boolean;
    mode: 0 | 1;
    isDirty: boolean;
    constructor({ writer, $el, $parent, showSchemaHelp }: IAttributeWidgetConfig);
    buildWidget(atts: any[], initialVals?: any, tag?: string): void;
    private sortAttributes;
    private addHelpButton;
    private addSelectInput;
    private addTextInput;
    private createAttributeField;
    private createAttributeSelector;
    reset(): void;
    /**
     * Sets the attribute data for the widget.
     * @param {Object} data A map of attribute name / value pairs
     * @returns {Boolean} True if data was set
     */
    setData(data: object): boolean;
    /**
     * Set a single attribute value for the widget.
     * If the value is undefined or null then it is removed.
     * @param {String} name Attribute name
     * @param {String} value Attribute value
     * @returns {Boolean} True if data was set
     */
    setAttribute(name: string, value?: string): boolean;
    /**
     * Collects the data from the attribute widget and performs validation.
     * @returns {Object|undefined} Returns undefined if invalid
     */
    getData(): object;
    destroy(): void;
}
export default AttributeWidget;
//# sourceMappingURL=attributeWidget.d.ts.map
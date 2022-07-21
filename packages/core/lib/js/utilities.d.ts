/// <reference types="jquery" />
import Writer from './Writer';
export declare const capitalizeFirstLetter: (string: string) => string;
/**
 * @class Utilities
 * @param {Writer} writer
 */
declare class Utilities {
    readonly writer: Writer;
    $entitiesConverter?: JQuery<HTMLElement>;
    constructor(writer: Writer);
    xmlToString(xmlData: Node): string;
    stringToXML(string: string): Document;
    xmlToJSON(xml: string | Element | Document): any;
    sendSchemaToworkerValidator(): Promise<void>;
    /**j
     * Converts HTML entities to unicode, while preserving those that must be escaped as entities.
     * @param {String} text The text to convert
     * @param {Boolean} [isAttributeValue] Is this an attribute value? Defaults to false
     * @returns {String} The converted text
     */
    convertTextForExport(text: string, isAttributeValue?: boolean): string;
    addCSS(cssHref: string): void;
    /**
     * @param content
     * @returns {String}
     */
    getTitleFromContent(content: string): string;
    getCamelCase(str: string): string;
    escapeHTMLString(value: string | any): any;
    unescapeHTMLString(value: string | any): any;
    getPreviousTextNode(node: Node, skipWhitespace?: boolean): Node;
    getNextTextNode(node: Node, skipWhitespace?: boolean): Node;
    /**
     * Selects an element in the editor
     * @param id The id of the element to select
     * @param selectContentsOnly Whether to select only the contents of the element (defaults to false)
     */
    selectElementById: (id: string | string[], selectContentsOnly?: boolean) => void;
    getRootTag: () => JQuery<HTMLElement>;
    /**
     * Get the XPath for an element, using the nodeName or cwrc _tag attribute as appropriate.
     * Adapted from the firebug source.
     * @param {Element} element The (cwrc) element to get the XPath for
     * @param {String} [tagAttribute] The name of the attribute to use as the tag
     * @returns {String|null}
     */
    getElementXPath(element: Element, tagAttribute?: string): string;
    /**
     * Returns the result of the specified xpath on the specified context node.
     * Can detect and convert an XML xpath for use with the leaf-writer format.
     * Adds support for default namespace.
     * @param {Document|Element} contextNode
     * @param {String} xpath
     * @returns {XPathResult|null} The result or null
     */
    evaluateXPath(contextNode: Document | Element, xpath: string): string | number | boolean | Node;
    /**
     * Used to processes a large array incrementally, in order to not freeze the browser.
     * @param {Array} array An array of values
     * @param {Function} processFunc The function that accepts a value from the array
     * @param {Number} [refreshRate]  How often to break (in milliseconds). Default is 250.
     * @returns {Promise} A jQuery promise
     */
    processArray(array: any[], processFunc: Function, refreshRate?: number): any;
    createGuid(): string;
    /**
     * Get the offset position of an element, relative to the parent (default is leaf-writer container).
     * @param {Element} element The element
     * @param {Element} parent The offset parent. Default is the leaf-writer container.
     * @returns {JQuery.Coordinates} position An object container top and left properties
     */
    getOffsetPosition: (element: Element, parent?: Element) => JQuery.Coordinates;
    /**
     * Constrain a value. Useful when positioning an element within another element.
     * @param {Number} value The x or y value of the element
     * @param {Number} max The max to constrain within
     * @param {Number} size The size of the element
     * @returns {Number} value The constrained value
     */
    constrain(value: number, max: number, size: number): number;
    destroy(): void;
}
export default Utilities;
//# sourceMappingURL=utilities.d.ts.map
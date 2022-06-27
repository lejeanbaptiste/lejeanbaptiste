import Writer from '../Writer';
/**
 * @class XML2CWRC
 * @param {Writer} writer
 */
declare class XML2CWRC {
    readonly writer: Writer;
    _isLegacyDocument?: boolean;
    constructor(writer: Writer);
    /**
     * Processes a document and loads it into the editor.
     * @fires Writer#processingDocument
     * @fires Writer#documentLoaded
     * @param {Document} doc An XML DOM
     * @param {String} [schemaIdOverride] An optional schemaId to override the one from the document
     */
    processDocument(doc: Document, schemaIdOverride?: string): void;
    /**
     * Takes a document node and returns a string representation of its contents, compatible with the editor.
     * For an async version see buildEditorStringDeferred.
     * @param {Element} node An (X)HTML element
     * @param {Boolean} [includeComments] True to include comments in the output
     * @returns {String}
     */
    buildEditorString(node: Element, includeComments?: boolean): string;
    /**
     * Get the schema URLs in the specified document.
     * @param {Document} doc
     * @returns {Object} urls
     */
    private getSchemaUrls;
    /**
     * Check to see if the document uses the older "custom" TEI format.
     * @param {Document} doc
     * @returns {Boolean}
     */
    private isLegacyDocument;
    private doBasicProcessing;
    private doProcessing;
    /**
     * Get entities from the RDF and then remove all related elements from the document.
     * @param {Document} doc
     * @returns {Boolean} hasRDF
     */
    private processRDF;
    /**
     * Traverse the DOM tree and return an array of nodes in traversal order, with depth info.
     * Includes text nodes but not attribute nodes.
     * @param {Element} parentNode
     * @returns {Array} nodeArray
     */
    private getNodeArray;
    /**
     * Get the opening and closing tag strings for the specified node.
     * @param {Element} node
     * @returns {Array} The array of opening and closing tag strings
     */
    private getTagStringsForNode;
    private buildEditorStringDeferred;
    private buildDocumentAndInsertEntities;
    private insertEntities;
    private getTextNodeFromParentAndOffset;
    private showMessage;
}
export default XML2CWRC;
//# sourceMappingURL=xml2cwrc.d.ts.map
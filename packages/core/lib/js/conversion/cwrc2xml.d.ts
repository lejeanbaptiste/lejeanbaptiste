import Writer from '../Writer';
/**
 * @class CWRC2XML
 * @param {Writer} writer
 */
declare class CWRC2XML {
    readonly writer: Writer;
    constructor(writer: Writer);
    /**
     * Gets the content of the document, converted from internal format to the schema format
     * @param {boolean} includeRDF True to include RDF in the header
     * @param {Function} callback Callback is called with the stringified document contents
     */
    getDocumentContent(includeRDF: boolean): Promise<string>;
    /**
     * Converts the editor node and its contents into an XML string suitable for export.
     * @param {Element} node
     * @param {Boolean} [identifyEntities] If true, adds cwrcTempId to entity elements. Default is false.
     * @returns {String}
     */
    buildXMLString(node: any, identifyEntities?: boolean): string;
    /**
     * For debug
     */
    getEntityOffsets(): any[];
    /**
     * Process HTML entities and overlapping entities
     * @param {jQuery} body The text body
     */
    private prepareText;
    /**
     * Determine and set the range objects for each entity.
     * Used later to construct the RDF.
     * @param {Document} doc The XML document
     */
    private setEntityRanges;
    /**
     * Determines the range that an entity spans, using xpath and character offset.
     * @param {String} entityId The id for the entity
     * @returns {JSON} The range object
     */
    private getRangesForEntity;
    /**
     * Get character offsets for a node.
     * @param {Node} parent The node to start calculating offsets from.
     * @returns Array
     */
    private getNodeOffsetsFromParent;
    private determineOffsetRelationships;
}
export default CWRC2XML;
//# sourceMappingURL=cwrc2xml.d.ts.map
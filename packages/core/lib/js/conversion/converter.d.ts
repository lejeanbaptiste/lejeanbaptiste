import Writer from '../Writer';
import CWRC2XML from './cwrc2xml';
import XML2CWRC from './xml2cwrc';
/**
 * @class Converter
 * @param {Writer} writer
 */
declare class Converter {
    readonly writer: Writer;
    readonly xml2cwrc: XML2CWRC;
    readonly cwrc2xml: CWRC2XML;
    constructor(writer: Writer);
    processDocument(doc: XMLDocument, schemaIdOverride?: string): void;
    buildEditorString(node: Element, includeComments?: boolean): string;
    getDocumentContent(includeRDF?: boolean): Promise<string>;
    buildXMLString(node: Element, identifyEntities?: boolean): string;
    loadDocumentURL(docUrl: string): Promise<void>;
    loadDocumentXML(docXml: XMLDocument | string): boolean;
    getDocument(asString: boolean, callback?: Function): Promise<any>;
    setDocument(document: XMLDocument | string): void;
}
export default Converter;
//# sourceMappingURL=converter.d.ts.map
import axios from 'axios';
import Writer from '../Writer';
import CWRC2XML from './cwrc2xml';
import XML2CWRC from './xml2cwrc';

/**
 * @class Converter
 * @param {Writer} writer
 */
class Converter {
  readonly writer: Writer;
  readonly xml2cwrc: XML2CWRC;
  readonly cwrc2xml: CWRC2XML;

  constructor(writer: Writer) {
    this.writer = writer;

    this.xml2cwrc = new XML2CWRC(writer);
    this.cwrc2xml = new CWRC2XML(writer);
  }

  processDocument(doc: XMLDocument, schemaIdOverride?: string) {
    return this.xml2cwrc.processDocument(doc, schemaIdOverride);
  }

  buildEditorString(node: Element, includeComments?: boolean) {
    return this.xml2cwrc.buildEditorString(node, includeComments);
  }

  getDocumentContent(includeRDF = false) {
    return this.cwrc2xml.getDocumentContent(includeRDF);
  }

  buildXMLString(node: Element, identifyEntities = false) {
    return this.cwrc2xml.buildXMLString(node, identifyEntities);
  }

  // convenience methods

  async loadDocumentURL(docUrl: string) {
    this.writer.currentDocId = docUrl;
    this.writer.event('loadingDocument').publish();

    const response = await axios.get(docUrl);

    if (!response.data) {
      this.writer.currentDocId = null;
      this.writer.dialogManager.show('message', {
        title: 'Error',
        msg: `An error occurred and ${docUrl} was not loaded.`,
        type: 'error',
      });
      this.writer.event('documentLoaded').publish(false, null);
      return;
    }

    this.processDocument(response.data);
  }

  loadDocumentXML(docXml: XMLDocument | string) {
    let xml: XMLDocument | Document | null;

    this.writer.event('loadingDocument').publish();

    if (typeof docXml === 'string') {
      xml = this.writer.utilities.stringToXML(docXml);
      if (!xml) {
        this.writer.event('documentLoaded').publish(false, null);
        this.writer.dialogManager.show('message', {
          title: 'Error',
          msg: 'The document you are trying to upload is not well-formed. Check that it has the xml extension and that it follows <a href="https://wwthis.writer.w3resource.com/xml/well-formed.php" target="_blank" rel="noopener noreferrer">propper xml grammar</a>.',
          type: 'error',
        });
        return false;
      }
    } else {
      xml = docXml;
    }

    this.processDocument(xml);
  }

  async getDocument(asString: boolean, callback?: Function): Promise<string|null> {
    const docString = await this.getDocumentContent(true);
    if (!docString) return null;

    if (asString === true) {
      if (callback) callback.call(this, docString);
      return docString;
    }

    let doc = null;
    try {
      const parser = new DOMParser();
      doc = parser.parseFromString(docString, 'application/xml');
    } catch (error) {
      this.writer.dialogManager.show('message', {
        title: 'Error',
        msg: `There was an error getting the document:${error}`,
        type: 'error',
      });
    }

    if (callback) callback.call(this, doc);

    return doc;
  }

  setDocument(document: XMLDocument | string) {
    if (typeof document === 'string' && document.indexOf('http') === 0) {
      this.loadDocumentURL(document);
    } else {
      this.loadDocumentXML(document);
    }
  }
}

export default Converter;

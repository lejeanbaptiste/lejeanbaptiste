import $ from 'jquery';
import { log } from '../../utilities';
import { isValidHttpURL } from '../../utilities/string';
import { EntityConfig } from '../entities/Entity';
import { RESERVED_ATTRIBUTES } from '../schema/mapper';
import Writer from '../Writer';
import { openEditorModeDialog, openProcessIssueDialog, type ProcessSchemaProps } from './prompts';

/**
 * @class XML2CWRC
 * @param {Writer} writer
 */
class XML2CWRC {
  readonly writer: Writer;

  // tracks whether we're processing a legacy document
  _isLegacyDocument?: boolean = false;

  constructor(writer: Writer) {
    this.writer = writer;
  }

  private async clearDocument() {
    return new Promise((resolve) => {
      if (!this.writer.editor) return;
      $(this.writer.editor.getBody()).empty();
      setTimeout(resolve, 0);
    });
  }

  /**
   * Processes a document and loads it into the editor.
   * @fires Writer#processingDocument
   * @fires Writer#documentLoaded
   * @param {Document} doc An XML DOM
   */
  async processDocument(doc: XMLDocument) {
    // clear current doc
    await this.clearDocument();

    const { overmindActions, schemaManager } = this.writer;
    const schemaProcess: ProcessSchemaProps = { doc, writer: this.writer };

    //* store and remove standOff tags
    const standOffTags = doc.querySelectorAll('standOff');
    if (standOffTags.length > 0) {
      const tagsString = Array.from(standOffTags).map((tag) => tag.outerHTML);
      overmindActions.document.storeStandOffTags(tagsString);
      standOffTags.forEach((tag) => tag.remove());
    }

    // * IS ROOT ELEMENT SUPPORTED?
    schemaProcess.rootName = doc.firstElementChild?.nodeName;
    schemaProcess.rootIsSupported = schemaManager.isRootSupported(schemaProcess.rootName ?? '');
    if (!schemaProcess.rootIsSupported) return openProcessIssueDialog(schemaProcess);

    overmindActions.document.setRootname(schemaProcess.rootName);

    // * HAS SCHEMA?
    schemaProcess.docSchema = this.getSchemaUrls(doc);
    schemaProcess.schemaFound = !!schemaProcess.docSchema.rng;
    if (!schemaProcess.schemaFound || !schemaProcess.docSchema.rng)
      return openProcessIssueDialog(schemaProcess);

    // * IS SCHEMA SUPPORTED?
    schemaProcess.schemaId = schemaManager.getSchemaIdFromUrl(schemaProcess.docSchema.rng);
    schemaProcess.schemaSupported = !!schemaProcess.schemaId;
    if (!schemaProcess.schemaSupported) return openProcessIssueDialog(schemaProcess);

    schemaManager.setDocumentSchemaUrl(schemaProcess.docSchema.rng);
    if (schemaProcess.docSchema.css) schemaManager.setDocumentCssUrl(schemaProcess.docSchema.css);

    if (schemaProcess.schemaId !== schemaManager.schemaId) {
      const { schemaId, docSchema } = schemaProcess;
      if (!schemaId) return openProcessIssueDialog(schemaProcess);

      schemaProcess.schemaLoaded = await schemaManager.loadSchema(schemaId, docSchema.css);

      // * IS SCHEMA LOADED
      if (!schemaProcess.schemaLoaded) {
        openProcessIssueDialog(schemaProcess);
        return;
      }

      this.doProcessing(doc);
      return;
    }

    const { docSchema } = schemaProcess;
    if (docSchema.css && docSchema.css !== schemaManager.getCss()) {
      const currentSchema = schemaManager.getCurrentSchema();
      const matchCsss = currentSchema?.css.some((url: string) => url === docSchema.css);
      if (!matchCsss) await schemaManager.loadSchemaCSS(docSchema.css);
    }

    this.doProcessing(schemaProcess.doc);
  }

  /**
   * Takes a document node and returns a string representation of its contents, compatible with the editor.
   * For an async version see buildEditorStringDeferred.
   * @param {Element} node An (X)HTML element
   * @param {Boolean} [includeComments] True to include comments in the output
   * @returns {String}
   */
  buildEditorString(node: Element, includeComments?: boolean) {
    let editorString = '';

    const doBuild = (node: Element) => {
      const tagStrings = this.getTagStringsForNode(node);
      editorString += tagStrings[0];

      for (let i = 0; i < node.childNodes.length; i++) {
        doBuild(node.childNodes[i] as Element);
      }

      editorString += tagStrings[1];
    };

    doBuild(node);

    return editorString;
  }

  /**
   * Get the schema URLs in the specified document.
   * @param {Document} doc
   * @returns {Object} urls
   */
  private getSchemaUrls(doc: Document) {
    let rng: string | undefined;
    let css: string | undefined;

    const parseData = (nodeData: string) => {
      const attributes = Object.assign(
        {},
        ...nodeData // treat as an array of key/value pairs
          .replaceAll(/(\r\n|\n|\r)/g, '') // remove page breaks
          .replaceAll(/"|'/g, '') // remove quotes
          .split(' ') // split the variables
          .map((s) => s.split('=')) // split keys from values
          //@ts-ignore
          .map(([k, v]) => ({ [k]: v })), // create an objects
      );

      if (!('href' in attributes)) return;

      const url: string = attributes.href;
      if (!isValidHttpURL(url)) return;

      return url;
    };

    doc.childNodes.forEach((node) => {
      if (node.nodeName === 'xml-model') {
        //@ts-ignore
        const nodeData = node.data as string;
        rng = parseData(nodeData);
      } else if (node.nodeName === 'xml-stylesheet') {
        //@ts-ignore
        const nodeData = node.data as string;
        css = parseData(nodeData);
      }
    });

    return { rng, css };
  }

  /**
   * Check to see if the document uses the older "custom" TEI format.
   * @param {Document} doc
   * @returns {Boolean}
   */
  private isLegacyDocument(doc: Document) {
    const hasRdf = $(doc).find('teiHeader > xenoData').find('rdf\\:RDF, RDF').length > 0;
    const hasOldAnnotationIds = $(doc).find('*[annotationId], *[offsetId]').length > 0;
    const hasOldRdfParent =
      this.writer.utilities.evaluateXPath(
        doc,
        this.writer.schemaManager.mapper.getRdfParentSelector(),
      ) === null;
    return hasRdf && (hasOldAnnotationIds || hasOldRdfParent);
  }

  // ? Apparently, this function is only called when there is no schema.
  // ! Deprecated -> remove in next iterations
  doBasicProcessing(doc: Document) {
    this.writer.event('processingDocument').publish();

    $(doc).find('rdf\\:RDF, RDF').remove();
    const root = doc.documentElement;
    const editorString = this.buildEditorString(root, !this.writer.isReadOnly);
    this.writer.editor?.setContent(editorString, { format: 'raw' });

    this.writer.event('documentLoaded').publish(false, this.writer.editor?.getBody());
  }

  doProcessing(doc: Document) {
    this.writer.event('processingDocument').publish();

    this._isLegacyDocument = this.isLegacyDocument(doc);

    const hasRDF = this.processRDF(doc);

    this.buildDocumentAndInsertEntities(doc).then(() => {
      // we need loading indicator to close before showing another modal dialog, so publish event before showMessage
      this.writer.event('documentLoaded').publish(true, this.writer.editor?.getBody());

      if (this.writer.isReadOnly) return;
      openEditorModeDialog(this.writer);
    });
  }

  /**
   * Get entities from the RDF and then remove all related elements from the document.
   * @param {Document} doc
   * @returns {Boolean} hasRDF
   */
  private processRDF(doc: Document) {
    const rootName: string = this.writer.overmindState.document.rootName ?? 'TEI';

    // let query = 'teiHeader > xenoData > rdf\\:RDF > Description';
    let query = 'teiHeader > xenoData > RDF > Description';

    if (rootName === 'TEI') query = 'teiHeader > xenoData > RDF > Description';
    if (rootName === 'ENTRY' || rootName === 'EVENT') {
      query = 'ORLANDOHEADER > XENODATA > RDF > Description';
    }
    if (rootName === 'CWRC') query = 'RDF > Description';

    const rdfs = doc.querySelectorAll(query);

    if (!rdfs.length) return false;

    rdfs.forEach((rdf) => {
      let entityConfig = this.writer.annotationsManager.getEntityConfigFromAnnotation(rdf);
      if (!entityConfig) return;

      const isOverlapping = entityConfig.range?.endXPath !== undefined;

      if (!isOverlapping) {
        // find the associated element and do additional processing
        const startXPath = entityConfig.range?.startXPath;
        if (!startXPath) {
          log.warn(`xml2cwrc.processRDF: no matching entity element for ${entityConfig}`);
          return;
        }

        const entityEl = this.writer.utilities.evaluateXPath(doc, startXPath);
        if (!entityEl) {
          log.warn(`xml2cwrc.processRDF: no matching entity element for ${entityConfig}`);
          return;
        }

        const mappingInfo = this.writer.schemaManager.mapper.getReverseMapping(
          entityEl as Element,
          true,
        );

        if (mappingInfo.type !== entityConfig.type) {
          log.warn(
            `xml2cwrc.processRDF: entity type mismatch. RDF = ${entityConfig.type}. Element = ${mappingInfo.type}.`,
          );
        }
        entityConfig = { ...entityConfig, ...mappingInfo };
      } else {
        // TODO review overlapping entities
      }

      if (this._isLegacyDocument) {
        // remove legacy attributes
        if (entityConfig.attributes) {
          delete entityConfig.attributes.annotationId;
          delete entityConfig.attributes.offsetId;
        }

        // replace annotationId with xpath
        if (entityConfig.range?.startXPath) {
          const entityEl = this.writer.utilities.evaluateXPath(
            doc,
            entityConfig.range.startXPath,
          ) as Element;
          const startXPath = this.writer.utilities.getElementXPath(entityEl);
          if (startXPath) entityConfig.range.startXPath = startXPath;
        }

        if (isOverlapping && entityConfig.range?.endXPath) {
          const entityElEnd = this.writer.utilities.evaluateXPath(
            doc,
            entityConfig.range.endXPath,
          ) as Element;
          const endXPath = this.writer.utilities.getElementXPath(entityElEnd);
          if (endXPath) entityConfig.range.endXPath = endXPath;
        }
      }

      this.writer.entitiesManager.addEntity(entityConfig as EntityConfig);
    });

    rdfs.forEach((rdf) => rdf.remove());

    // remove all the nodes between the root or header and the rdf parent (including the rdf parent)
    const rdfParentXpath = this.writer.utilities.evaluateXPath(
      doc,
      this.writer.schemaManager.mapper.getRdfParentSelector(),
    );

    let rdfParent =
      rdfParentXpath &&
      typeof rdfParentXpath !== 'string' &&
      typeof rdfParentXpath !== 'number' &&
      typeof rdfParentXpath !== 'boolean'
        ? $(rdfParentXpath)
        : null;

    if (rdfParent?.length === 1) {
      let currNode = rdfParent[0]?.nodeName;
      while (
        currNode !== this.writer.schemaManager.getHeader() &&
        currNode !== this.writer.schemaManager.getRoot()
      ) {
        rdfParent = rdfParent.parent();
        if (rdfParent.length === 0) {
          log.warn('xml2cwrc: went beyond doc root');
          break;
        }
        rdfParent.children(currNode).remove();
        currNode = rdfParent[0]?.nodeName;
      }
    } else {
      log.warn("xml2cwrc: couldn't find the rdfParent");
    }

    return true;
  }

  /**
   * Traverse the DOM tree and return an array of nodes in traversal order, with depth info.
   * Includes text nodes but not attribute nodes.
   * @param {Element} parentNode
   * @returns {Array} nodeArray
   */
  private getNodeArray(parentNode: Element) {
    const nodeArray: { node: Element; depth: number }[] = [];

    const traverse = (node: Element, depth: number) => {
      nodeArray.push({ node, depth });
      for (let i = 0; i < node.childNodes.length; i++) {
        traverse(node.childNodes[i] as Element, depth + 1);
      }
    };

    traverse(parentNode, 0);

    return nodeArray;
  }

  /**
   * Get the opening and closing tag strings for the specified node.
   * @param {Element} node
   * @returns {Array} The array of opening and closing tag strings
   */
  private getTagStringsForNode(node: Element) {
    let openingTagString = '';
    let closingTagString = '';

    if (node.nodeType === Node.ELEMENT_NODE) {
      const nodeName = node.nodeName;
      let htmlTag;

      if (node.parentElement === null) {
        // ensure that the root is always block level.
        // needed in the case where the doc has a schema mismatch and so getTagForEditor would always return the inline tag.
        htmlTag = this.writer.schemaManager.getBlockTag();
      } else {
        htmlTag = this.writer.schemaManager.getTagForEditor(nodeName);
      }

      if (node.hasAttribute('id')) {
        log.warn(`xml2cwrc.buildEditorString: node already had an ID! ${node.getAttribute('id')}`);
        node.removeAttribute('id');
      }

      const id = this.writer.getUniqueId('dom_');
      const canContainText = this.writer.schemaManager.canTagContainText(nodeName);

      openingTagString = `<${htmlTag} _tag="${nodeName}" id="${id}" _textallowed="${canContainText}"`;

      if (node.hasAttributes()) {
        const jsonAttrs: Record<string, any> = {};
        const attrs = node.attributes;

        for (let i = 0; i < attrs.length; i++) {
          const attName = attrs[i]?.name;
          const attValue = attrs[i]?.value;

          if ((this._isLegacyDocument && attName === 'annotationId') || attName === 'offsetId') {
            continue;
          }

          //@ts-ignore
          jsonAttrs[attName] = attValue;

          // if (Mapper.reservedAttributes[attName] === true) {
          //   continue;
          // }

          //@ts-ignore
          if (RESERVED_ATTRIBUTES.has(attName)) continue;

          openingTagString += ` ${attName}="${attValue}"`;
        }

        let jsonAttrsString = JSON.stringify(jsonAttrs);
        jsonAttrsString = jsonAttrsString.replace(/"/g, '&quot;');
        openingTagString += ' _attributes="' + jsonAttrsString + '"';
      }

      if (node.childNodes.length === 0) {
        openingTagString += '>';
        closingTagString = `\uFEFF</${htmlTag}>`;
      } else {
        openingTagString += '>';
        closingTagString = `</${htmlTag}>`;
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      //@ts-ignore
      const content = node.data.replace(/</g, '&lt;').replace(/>/g, '&gt;'); // prevent tags from accidentally being created
      openingTagString = content;
    } else if (node.nodeType === Node.COMMENT_NODE) {
      // preserve comment
      //@ts-ignore
      openingTagString += `<!--${node.data}`;
      closingTagString = '-->';
    } else {
      log.warn(`xml2cwrc.buildEditorString: unsupported node type: ${node.nodeType}`);
    }

    return [openingTagString, closingTagString];
  }

  private buildEditorStringDeferred(parentNode: Element) {
    //@ts-ignore
    const dfd = new $.Deferred();

    const li = this.writer.dialogManager.getDialog('loadingindicator');
    li?.show();
    li?.setText?.('Building Document');

    let editorString = '';
    // keeps track of closing tags so we can add them to the editorString when we move up a level in the tree
    const closingStack: { string: string; depth: number }[] = [];
    const nodeArray = this.getNodeArray(parentNode);

    const processNode = (nodeData: { node: Element; depth: number }, prevDepth: number) => {
      const node: Element = nodeData.node;
      const depth = nodeData.depth;

      const tagStrings = this.getTagStringsForNode(node);

      const openingTagString = tagStrings[0];
      const closingTag = { string: tagStrings[1], depth: depth };

      // we're no longer moving down/into the tree, so close open tags
      if (depth <= prevDepth) {
        let stackEntry: any = closingStack.pop();
        if (stackEntry) {
          while (
            stackEntry !== null &&
            stackEntry.depth <= prevDepth &&
            stackEntry.depth >= depth
          ) {
            editorString += stackEntry.string;
            if (closingStack.length > 0) {
              // peek at next
              //@ts-ignore
              const nextDepth = closingStack[closingStack.length - 1].depth;
              if (nextDepth <= prevDepth && nextDepth >= depth) {
                stackEntry = closingStack.pop();
              } else {
                stackEntry = null;
              }
            } else {
              stackEntry = null;
            }
          }
        }
      }

      editorString += openingTagString;
      //@ts-ignore
      closingStack.push(closingTag);

      return depth;
    };

    const startingLength = nodeArray.length;
    let time1 = new Date().getTime();
    const refreshRate = 250;
    let depth = 0;

    const parentFunc = () => {
      while (nodeArray.length > 0) {
        const entry = nodeArray.shift();
        //@ts-ignore
        depth = processNode(entry, depth);

        const time2 = new Date().getTime();
        if (time2 - time1 > refreshRate) break;
      }

      const percent = (Math.abs(nodeArray.length - startingLength) / startingLength) * 100;
      li?.setValue?.(percent);

      if (nodeArray.length > 0) {
        time1 = new Date().getTime();
        setTimeout(parentFunc, 10);
      } else {
        while (closingStack.length > 0) {
          const stackEntry = closingStack.pop();
          if (stackEntry) editorString += stackEntry.string;
        }

        dfd.resolve(editorString);
      }
    };

    parentFunc();

    return dfd.promise();
  }

  private buildDocumentAndInsertEntities(doc: Document) {
    //@ts-ignore
    const dfd = new $.Deferred();

    this.buildEditorStringDeferred(doc.documentElement)
      .then((editorString: string) => {
        this.writer.editor?.setContent(editorString, { format: 'raw' }); // format is raw to prevent html parser and serializer from messing up whitespace

        return this.insertEntities();
      })
      .then(() => {
        this.writer.tagger.addNoteWrappersForEntities();

        if (this.writer.entitiesManager.doEntitiesOverlap()) {
          this.writer.allowOverlap = true;
        } else {
          this.writer.allowOverlap = false;
        }

        dfd.resolve();
      });

    return dfd.promise();
  }

  private insertEntities() {
    if (!this.writer.editor) return;

    const entObj = this.writer.entitiesManager.getEntities();
    const entities = Object.keys(entObj).map((key) => entObj[key]);

    if (entities.length === 0) {
      //@ts-ignore
      const dfd = new $.Deferred();
      dfd.resolve();
      return dfd.promise();
    }

    const li = this.writer.dialogManager.getDialog('loadingindicator');
    li?.setText?.('Inserting Entities');

    // editor needs focus in order for entities to be properly inserted
    this.writer.editor?.focus();

    const docRoot = $(
      `[_tag="${this.writer.schemaManager.getRoot()}"]`,
      this.writer.editor?.getBody(),
    )[0];

    if (!docRoot) return;

    // insert entities
    const insertEntity = (entry: any) => {
      let startNode = null;
      let endNode = null;
      let startOffset = 0;
      let endOffset = 0;

      const range = entry.getRange();

      // just rdf, no markup
      if (range.endXPath) {
        let parent = this.writer.utilities.evaluateXPath(docRoot, range.startXPath) as Element;
        let result = this.getTextNodeFromParentAndOffset(parent, range.startOffset);
        startNode = result.textNode;
        startOffset = result.offset;
        parent = this.writer.utilities.evaluateXPath(docRoot, range.endXPath) as Element;
        result = this.getTextNodeFromParentAndOffset(parent, range.endOffset);
        endNode = result.textNode;
        endOffset = result.offset;

        try {
          //@ts-ignore
          const selRange = this.writer.editor.selection.getRng();
          //@ts-ignore
          selRange.setStart(startNode, startOffset);
          //@ts-ignore
          selRange.setEnd(endNode, endOffset);
          this.writer.tagger.addEntityTag(entry, selRange);

          if (entry.getContent() === undefined) {
            this.writer.entitiesManager.highlightEntity(); // remove highlight
            this.writer.entitiesManager.highlightEntity(entry.getId());
            const content = $('.entityHighlight', docRoot).text();
            this.writer.entitiesManager.highlightEntity();
          }
        } catch (error) {
          log.warn(`xml2cwrc: error adding overlapping entity ${error}`);
        }
        // markup
      } else if (range.startXPath) {
        const entityNode = this.writer.utilities.evaluateXPath(docRoot, range.startXPath) as Node;
        if (entityNode !== null) {
          const type = entry.getType();

          // then tag already exists
          $(entityNode).attr({
            _entity: true,
            _type: type,
            class: `entity start end ${type}`,
            name: entry.getId(),
            id: entry.getId(),
          });

          if (entry.getContent() === undefined || entry.getContent() === '') {
            entry.setContent($(entityNode).text());
          }

          if (
            entry.isNote() &&
            (entry.getNoteContent() === undefined || entry.getNoteContent() === '')
          ) {
            entry.setNoteContent($(entityNode).html());
          }
        } else {
          log.warn('xml2cwrc.insertEntities: cannot find entity tag for', range.startXPath);
        }
      }
    };

    return this.writer.utilities.processArray(entities, insertEntity);
  }

  private getTextNodeFromParentAndOffset(parent: Element, offset: number) {
    let currentOffset = 0;
    let textNode: Element | Text | Comment | Document | null = null;

    const getTextNode = (parent: Element | Text | Comment | Document) => {
      let ret = true;

      $(parent)
        .contents()
        //@ts-ignore
        .each((index, element) => {
          // Not sure why the &nbsp; text nodes would not be counted but as long
          // as we are consistent in both the saving and loading it should be
          // fine.
          //@ts-ignore
          if (element.nodeType === Node.TEXT_NODE && element.data !== ' ') {
            // Count all the text!
            //@ts-ignore
            currentOffset += element.length;
            if (currentOffset >= offset) {
              //@ts-ignore
              currentOffset = offset - (currentOffset - element.length);
              textNode = element;
              ret = false;
              return ret;
            }
          }
          // An Tag or an Entity that is not the one we're looking for.
          else {
            // We must use all intermediate node's text to ensure an accurate text
            // count. As the order in which entities are wrapped in spans when the
            // document is loaded will not be guarantee to be in an order in which
            // replicates the state the document was in at the time it was saved.
            ret = getTextNode(element);
            return ret;
          }
        });
      return ret;
    };

    getTextNode(parent);

    return { textNode, offset: currentOffset };
  }
}

export default XML2CWRC;

import $ from 'jquery';
// import Mapper from '../schema/mapper';
import Writer from '../Writer';
import { RESERVED_ATTRIBUTES } from '../schema/mapper';

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

  /**
   * Processes a document and loads it into the editor.
   * @fires Writer#processingDocument
   * @fires Writer#documentLoaded
   * @param {Document} doc An XML DOM
   * @param {String} [schemaIdOverride] An optional schemaId to override the one from the document
   */
  processDocument(doc: Document, schemaIdOverride?: string) {
    // clear current doc
    $(this.writer.editor.getBody()).empty();

    // setTimeout to make sure doc clears first
    setTimeout(async () => {
      let schemaId: string;
      let loadSchemaCss: boolean;

      let { xmlUrl, cssUrl } = this.getSchemaUrls(doc);
      this.writer.schemaManager.setCurrentDocumentSchemaUrl(xmlUrl);
      this.writer.schemaManager.setCurrentDocumentCSSUrl(cssUrl);

      if (schemaIdOverride !== undefined) {
        schemaId = schemaIdOverride;
        loadSchemaCss = true;
      } else {
        schemaId = this.writer.schemaManager.getSchemaIdFromUrl(xmlUrl);
        loadSchemaCss = cssUrl === undefined; // load schema css if none was found in the document
      }

      if (xmlUrl === undefined && schemaId === undefined) {
        this.writer.dialogManager.confirm({
          title: 'Missing Schema',
          msg: `
            <p>There is no schema associated with your document.
            Should CWRC-Writer try to determine the schema by examining the document root?</p>
          `,
          type: 'error',
          callback: (doIt: boolean) => {
            if (!doIt) {
              this.writer.event('documentLoaded').publish(false, null);
              this.writer.showLoadDialog();
              return;
            }

            const rootName = doc.firstElementChild?.nodeName;
            schemaId = this.writer.schemaManager.getSchemaIdFromRoot(rootName);

            if (schemaId === undefined) {
              this.writer.dialogManager.show('message', {
                title: 'Warning',
                msg: `<p>CWRC-Writer could not determine the schema for: ${rootName}</p>`,
                type: 'error',
                callback: () => {
                  this.writer.event('documentLoaded').publish(false, null);
                  this.writer.showLoadDialog();
                },
              });
              return;
            }

            this.writer.dialogManager.show('message', {
              title: 'Schema',
              msg: `<p>CWRC-Writer determined the schema to be: ${schemaId}</p>`,
              type: 'info',
              callback: async () => {
                if (schemaId === this.writer.schemaManager.schemaId) {
                  this.doProcessing(doc);
                  return;
                }
                const res = await this.writer.schemaManager.loadSchema(schemaId, true);
                res.success ? this.doProcessing(doc) : this.doBasicProcessing(doc);
              },
            });
          },
        });

        return;
      }

      if (schemaId === undefined) {
        this.writer.dialogManager.confirm({
          title: 'Warning',
          msg: `<p>The document you are loading is not fully supported by CWRC-Writer.
            You may not be able to use the ribbon to tag named entities.</p>
            <p>Load document anyways?</p>`,
          type: 'error',
          callback: async (doIt: boolean) => {
            if (!doIt) {
              this.writer.event('documentLoaded').publish(false, null);
              this.writer.showLoadDialog();
              return;
            }

            if (cssUrl !== undefined) await this.writer.schemaManager.loadSchemaCSS([cssUrl]);

            if (xmlUrl === undefined) {
              this.doBasicProcessing(doc);
              return;
            }

            const customSchemaId = this.writer.schemaManager.addSchema({
              name: 'Custom Schema',
              xmlUrl: [xmlUrl],
              cssUrl: [cssUrl],
            });

            const res = await this.writer.schemaManager.loadSchema(customSchemaId, loadSchemaCss);
            if (res.success) {
              this.doProcessing(doc);
              return;
            }

            // close schema error dialog
            const schemaErrDialog = this.writer.dialogManager
              .getDialog('message')
              .getOpenDialogs()
              .pop();

            if (schemaErrDialog) schemaErrDialog.dialog('close');

            this.writer.dialogManager.confirm({
              title: 'Error Loading Schema',
              msg: `
                <p>The schema associated with your document could not be loaded.
                Should CWRC-Writer try to determine the schema by examining the document root?</p>
              `,
              type: 'error',
              callback: (doIt: boolean) => {
                if (!doIt) {
                  this.writer.event('documentLoaded').publish(false, null);
                  this.writer.showLoadDialog();
                  return;
                }

                const rootName = doc.firstElementChild?.nodeName;
                if (rootName) {
                  const schemaIdFromRoot = this.writer.schemaManager.getSchemaIdFromRoot(rootName);
                  if (schemaIdFromRoot) schemaId = schemaIdFromRoot;
                }

                if (schemaId === undefined) {
                  this.writer.dialogManager.show('message', {
                    title: 'Warning',
                    msg: `<p>CWRC-Writer could not determine the schema for: ${rootName}</p>`,
                    type: 'error',
                    callback: () => {
                      this.writer.event('documentLoaded').publish(false, null);
                      this.writer.showLoadDialog();
                    },
                  });
                  return;
                }

                this.writer.dialogManager.show('message', {
                  title: 'Schema',
                  msg: `<p>CWRC-Writer determined the schema to be: ${schemaId}</p>`,
                  type: 'info',
                  callback: async () => {
                    if (schemaId === this.writer.schemaManager.schemaId) {
                      this.doProcessing(doc);
                      return;
                    }

                    const res = await this.writer.schemaManager.loadSchema(schemaId, true);
                    res.success ? this.doProcessing(doc) : this.doBasicProcessing(doc);
                  },
                });
              },
            });
          },
        });

        return;
      }

      if (schemaId !== this.writer.schemaManager.schemaId) {
        if (cssUrl !== undefined) await this.writer.schemaManager.loadSchemaCSS([cssUrl]);
        const res = await this.writer.schemaManager.loadSchema(schemaId, loadSchemaCss);
        res.success ? this.doProcessing(doc) : this.doBasicProcessing(doc);
        return;
      }

      if (cssUrl !== undefined && cssUrl !== this.writer.schemaManager.getCSSUrl()) {
        const currentSchema = this.writer.schemaManager.getCurrentSchema();
        const matchCSSUrl = currentSchema.cssUrl.find((url: string) => url === cssUrl);
        if (matchCSSUrl === null) await this.writer.schemaManager.loadSchemaCSS([cssUrl]);
      }

      this.doProcessing(doc);
    }, 0);
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
    let xmlUrl: string = '';
    let cssUrl: string = '';

    //extract url from element's attribute wrapped with double or single quote ('|")"
    const urlRegex = /href=('|")([^('|")]*)('|")/;

    for (let i = 0; i < doc.childNodes.length; i++) {
      const node = doc.childNodes[i];

      if (node.nodeName === 'xml-model') {
        //@ts-ignore
        const xmlModelData = node.data;
        xmlUrl = xmlModelData.match(urlRegex);
        xmlUrl = xmlUrl[2];
      } else if (node.nodeName === 'xml-stylesheet') {
        //@ts-ignore
        const xmlStylesheetData = node.data;
        cssUrl = xmlStylesheetData.match(urlRegex);
        cssUrl = cssUrl[2];
      }
    }

    return { xmlUrl, cssUrl };
  }

  /**
   * Check to see if the document uses the older "custom" TEI format.
   * @param {Document} doc
   * @returns {Boolean}
   */
  private isLegacyDocument(doc: Document) {
    const hasRdf = $(doc).find('rdf\\:RDF, RDF').length > 0;
    const hasOldAnnotationIds = $(doc).find('*[annotationId], *[offsetId]').length > 0;
    const hasOldRdfParent =
      this.writer.utilities.evaluateXPath(
        doc,
        this.writer.schemaManager.mapper.getRdfParentSelector()
      ) === null;
    return hasRdf && (hasOldAnnotationIds || hasOldRdfParent);
  }

  private doBasicProcessing(doc: Document) {
    this.writer.event('processingDocument').publish();

    $(doc).find('rdf\\:RDF, RDF').remove();
    const root = doc.documentElement;
    const editorString = this.buildEditorString(root, !this.writer.isReadOnly);
    this.writer.editor.setContent(editorString, { format: 'raw' });

    this.writer.event('documentLoaded').publish(false, this.writer.editor.getBody());
  }

  private doProcessing(doc: Document) {
    this.writer.event('processingDocument').publish();

    this._isLegacyDocument = this.isLegacyDocument(doc);

    const hasRDF = this.processRDF(doc);

    this.buildDocumentAndInsertEntities(doc).then(() => {
      // we need loading indicator to close before showing another modal dialog, so publish event before showMessage
      this.writer.event('documentLoaded').publish(true, this.writer.editor.getBody());
      this.showMessage(doc);
    });
  }

  /**
   * Get entities from the RDF and then remove all related elements from the document.
   * @param {Document} doc
   * @returns {Boolean} hasRDF
   */
  private processRDF(doc: Document) {
    const $rdfs = $(doc).find('rdf\\:RDF, RDF');
    if (!$rdfs.length) return false;

    $rdfs.children().each((index, el) => {
      let entityConfig = this.writer.annotationsManager.getEntityConfigFromAnnotation(el);
      if (!entityConfig) return;

      const isOverlapping = entityConfig.range?.endXPath !== undefined;

      if (!isOverlapping) {
        // find the associated element and do additional processing
        const startXPath = entityConfig.range?.startXPath;
        if (!startXPath) {
          console.warn(`xml2cwrc.processRDF: no matching entity element for ${entityConfig}`);
          return;
        }

        const entityEl = this.writer.utilities.evaluateXPath(doc, startXPath);
        if (!entityEl) {
          console.warn(`xml2cwrc.processRDF: no matching entity element for ${entityConfig}`);
          return;
        }

        const mappingInfo = this.writer.schemaManager.mapper.getReverseMapping(
          entityEl as Element,
          true
        );

        if (mappingInfo.type !== entityConfig.type) {
          console.warn(
            `xml2cwrc.processRDF: entity type mismatch. RDF = ${entityConfig.type}. Element = ${mappingInfo.type}.`
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
        const entityEl = this.writer.utilities.evaluateXPath(doc, entityConfig.range.startXPath);
        entityConfig.range.startXPath = this.writer.utilities.getElementXPath(entityEl);

        if (isOverlapping) {
          const entityElEnd = this.writer.utilities.evaluateXPath(doc, entityConfig.range.endXPath);
          entityConfig.range.endXPath = this.writer.utilities.getElementXPath(entityElEnd);
        }
      }

      this.writer.entitiesManager.addEntity(entityConfig);
    });

    $rdfs.remove();

    // remove all the nodes between the root or header and the rdf parent (including the rdf parent)
    const rdfParentXpath = this.writer.utilities.evaluateXPath(
      doc,
      this.writer.schemaManager.mapper.getRdfParentSelector()
    );

    let rdfParent =
      rdfParentXpath &&
      typeof rdfParentXpath !== 'string' &&
      typeof rdfParentXpath !== 'number' &&
      typeof rdfParentXpath !== 'boolean'
        ? $(rdfParentXpath)
        : null;

    if (rdfParent?.length === 1) {
      let currNode = rdfParent[0].nodeName;
      while (
        currNode !== this.writer.schemaManager.getHeader() &&
        currNode !== this.writer.schemaManager.getRoot()
      ) {
        rdfParent = rdfParent.parent();
        if (rdfParent.length === 0) {
          console.warn('xml2cwrc: went beyond doc root');
          break;
        }
        rdfParent.children(currNode).remove();
        currNode = rdfParent[0].nodeName;
      }
    } else {
      console.warn("xml2cwrc: couldn't find the rdfParent");
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
        console.warn(
          `xml2cwrc.buildEditorString: node already had an ID! ${node.getAttribute('id')}`
        );
        node.removeAttribute('id');
      }

      const id = this.writer.getUniqueId('dom_');
      const canContainText = this.writer.schemaManager.canTagContainText(nodeName);

      openingTagString = `<${htmlTag} _tag="${nodeName}" id="${id}" _textallowed="${canContainText}"`;

      if (node.hasAttributes()) {
        const jsonAttrs: { [x: string]: any } = {};
        const attrs = node.attributes;

        for (let i = 0; i < attrs.length; i++) {
          const attName = attrs[i].name;
          const attValue = attrs[i].value;

          if ((this._isLegacyDocument && attName === 'annotationId') || attName === 'offsetId') {
            continue;
          }

          jsonAttrs[attName] = attValue;

          // if (Mapper.reservedAttributes[attName] === true) {
          //   continue;
          // }

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
      console.warn(`xml2cwrc.buildEditorString: unsupported node type: ${node.nodeType}`);
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
        this.writer.editor.setContent(editorString, { format: 'raw' }); // format is raw to prevent html parser and serializer from messing up whitespace

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
    this.writer.editor.focus();

    const docRoot = $(
      `[_tag="${this.writer.schemaManager.getRoot()}"]`,
      this.writer.editor.getBody()
    )[0];

    // insert entities
    const insertEntity = (entry: any) => {
      let startNode = null;
      let endNode = null;
      let startOffset = 0;
      let endOffset = 0;

      const range = entry.getRange();

      // just rdf, no markup
      if (range.endXPath) {
        let parent = this.writer.utilities.evaluateXPath(docRoot, range.startXPath);
        let result = this.getTextNodeFromParentAndOffset(parent, range.startOffset);
        startNode = result.textNode;
        startOffset = result.offset;
        parent = this.writer.utilities.evaluateXPath(docRoot, range.endXPath);
        result = this.getTextNodeFromParentAndOffset(parent, range.endOffset);
        endNode = result.textNode;
        endOffset = result.offset;

        try {
          const selRange = this.writer.editor.selection.getRng(true);
          selRange.setStart(startNode, startOffset);
          selRange.setEnd(endNode, endOffset);
          this.writer.tagger.addEntityTag(entry, selRange);

          if (entry.getContent() === undefined) {
            this.writer.entitiesManager.highlightEntity(); // remove highlight
            this.writer.entitiesManager.highlightEntity(entry.getId());
            const content = $('.entityHighlight', docRoot).text();
            this.writer.entitiesManager.highlightEntity();
          }
        } catch (error) {
          console.warn(`xml2cwrc: error adding overlapping entity ${error}`);
        }
        // markup
      } else if (range.startXPath) {
        const entityNode = this.writer.utilities.evaluateXPath(docRoot, range.startXPath);
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
          console.warn('xml2cwrc.insertEntities: cannot find entity tag for', range.startXPath);
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

  private showMessage(doc: Document) {
    if (this.writer.isReadOnly) return;

    const rootEl = doc.documentElement;
    if (rootEl.nodeName.toLowerCase() !== this.writer.schemaManager.getRoot().toLowerCase()) {
      this.writer.dialogManager.show('message', {
        title: 'Schema Mismatch',
        msg: `
          The wrong schema is specified.<br/>Schema root: ${this.writer.schemaManager.getRoot()}<br/>
          Document root: ${rootEl.nodeName}<br/><br/>
          Go to <b>Settings</b> to change the schema association.
        `,
        type: 'error',
      });
    }

    let msg = '';

    if (this.writer.mode === this.writer.XML) {
      msg = `
        <b>XML only</b><br/>
        Only XML tags and no RDF/Semantic Web annotations will be created.
      `;
    } else {
      if (this.writer.allowOverlap) {
        msg = `
          <b>XML and RDF (overlap)</b><br/>
          XML tags and RDF/Semantic Web annotations equivalent to the XML tags will be created,
          to the extent that the hierarchy of the XML schema allows.
          Annotations that overlap will be created in RDF only, with no equivalent XML tags.
        `;
      } else {
        msg = `
          <b>XML and RDF (no overlap)</b><br/>
          XML tags and RDF/Semantic Web annotations equivalent to the XML tags will be created,
          consistent with the hierarchy of the XML schema,
          so annotations will not be allowed to overlap.
        `;
      }
    }

    this.writer.dialogManager.show('message', {
      title: 'CWRC-Writer Mode',
      msg: msg,
      type: 'info',
    });
  }
}

export default XML2CWRC;

import $ from 'jquery';
import Entity, { type AnnotationRange } from '../entities/Entity';
import Writer from '../Writer';
import { log } from './../../utilities';

/**
 * @class CWRC2XML
 * @param {Writer} writer
 */
class CWRC2XML {
  readonly writer: Writer;

  constructor(writer: Writer) {
    this.writer = writer;
  }

  /**
   * Gets the content of the document, converted from internal format to the schema format
   * @param {boolean} includeRDF True to include RDF in the header
   * @param {Function} callback Callback is called with the stringified document contents
   */
  async getDocumentContent(includeRDF: boolean) {
    if (includeRDF && this.writer.mode === this.writer.XML) includeRDF = false;

    // remove highlights
    this.writer.entitiesManager.highlightEntity();

    if (!this.writer.editor) return;

    const $body = $(this.writer.editor.getBody()).clone(false);

    this.prepareText($body);

    // XML

    const root = this.writer.schemaManager.getRoot();
    let $rootEl = $body.children(`[_tag=${root}]`);

    if ($rootEl.length === 0) {
      log.warn('converter: no root found for', root);
      $rootEl = $body.find('[_tag]:eq(0)'); // fallback
    }

    // remove previous namespaces
    //@ts-ignore
    const rootAttributes = this.writer.tagger.getAttributesForTag($rootEl[0]);
    for (const attributeName in rootAttributes) {
      if (attributeName.indexOf('xmlns') === 0) {
        delete rootAttributes[attributeName];
      }
    }

    // namespaces
    const schemaNamespace = this.writer.schemaManager.mapper.getNamespace();
    if (schemaNamespace) rootAttributes['xmlns'] = schemaNamespace;
    if (includeRDF) rootAttributes['xmlns:rdf'] = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';

    //@ts-ignore
    this.writer.tagger.setAttributesForTag($rootEl[0], rootAttributes);

    let xmlString = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xmlString += `<?xml-model href="${this.writer.schemaManager.getCurrentDocumentSchemaUrl()}" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>\n`;
    xmlString += `<?xml-stylesheet type="text/css" href="${this.writer.schemaManager.getDocumentCssUrl()}"?>\n`;

    // if (logEnabledFor('DEBUG')) console.time('buildXMLString');
    xmlString += this.buildXMLString($rootEl, includeRDF);
    // if (logEnabledFor('DEBUG')) console.timeEnd('buildXMLString');

    xmlString = xmlString.replace(/&(?!amp;)/g, '&amp;'); //replace all '&' with '&amp;' allowing html/xml to validate.

    // RDF

    if (!includeRDF) {
      xmlString = xmlString.replace(/\uFEFF/g, ''); // remove characters inserted by node selecting
      return xmlString;
    }

    // if (logEnabledFor('DEBUG'))console.time('stringToXML');
    const xmlDoc = this.writer.utilities.stringToXML(xmlString);
    // if (logEnabledFor('DEBUG'))console.timeEnd('stringToXML');

    // parse error in document
    if (!xmlDoc) return null;

    // if (logEnabledFor('DEBUG'))console.time('setEntityRanges');
    this.setEntityRanges(xmlDoc);
    // if (logEnabledFor('DEBUG'))console.timeEnd('setEntityRanges');

    // if (logEnabledFor('DEBUG')) console.time('cleanUp');
    // clean up temp ids used by setEntityRanges
    $('[cwrcTempId]', xmlDoc).each((index, element) => {
      $(element).removeAttr('cwrcTempId');
    });
    // if (logEnabledFor('DEBUG')) console.timeEnd('cleanUp');

    const rdfmode = this.writer.annotationMode === this.writer.XML ? 'xml' : 'json';

    const entities: Entity[] = [];
    this.writer.entitiesManager.eachEntity((id: string, entity: Entity) => entities.push(entity));

    const rdfString = await this.writer.annotationsManager.getAnnotations(entities, rdfmode);
    // parse the selector and find the relevant node
    const $docEl = $(xmlDoc.documentElement);
    const selector = this.writer.schemaManager.mapper.getRdfParentSelector();
    const selectorTags = selector.split('/');
    let $currNode: JQuery<Element> = $docEl;

    for (let tag of selectorTags) {
      if (tag === '') continue;

      if (tag.indexOf('::') === -1) {
        if ($currNode[0]?.nodeName === tag) continue;

        const $nextNode = $currNode.children(tag).first();
        if ($nextNode.length === 1) {
          $currNode = $nextNode;
        } else {
          // node doesn't exist so add it
          let namespace = $currNode[0]?.namespaceURI;
          //@ts-ignore
          let node = xmlDoc.createElementNS(namespace, tag);
          const child = $currNode[0]?.firstElementChild;

          $currNode = child
            ? //@ts-ignore
              $($currNode[0].insertBefore(node, child))
            : //@ts-ignore
              $($currNode[0].appendChild(node));
        }
      } else {
        // axis handling
        const parts = tag.split('::');
        const axis = parts[0];
        const tag_part1 = parts[1];

        let parent;
        let namespace: string;
        let node;
        let sibling;

        switch (axis) {
          case 'preceding-sibling':
            parent = $currNode[0]?.parentNode;
            if (!parent) break;

            //@ts-ignore
            namespace = parent.namespaceURI;
            //@ts-ignore
            node = xmlDoc.createElementNS(namespace, tag_part1);
            //@ts-ignore
            $currNode = $(parent.insertBefore(node, $currNode[0]));
            break;

          case 'following-sibling':
            parent = $currNode[0]?.parentNode;
            if (!parent) break;

            //@ts-ignore
            namespace = parent.namespaceURI;
            //@ts-ignore
            node = xmlDoc.createElementNS(namespace, tag_part1);
            sibling = $currNode[0]?.nextElementSibling;

            $currNode = sibling
              ? $(parent.insertBefore(node, sibling))
              : $(parent.appendChild(node));

            break;

          default:
            log.warn('cwrc2xml: axis', axis, 'not supported');
            break;
        }
      }
    }

    if ($currNode !== $docEl) {
      $currNode.append(rdfString);
    } else {
      log.warn("cwrc2xml: couldn't find rdfParent for", selector);
    }

    // if (logEnabledFor('DEBUG')) console.time('xmlToString');
    xmlString = this.writer.utilities.xmlToString(xmlDoc);
    // if (logEnabledFor('DEBUG'))console.timeEnd('xmlToString');

    xmlString = xmlString.replace(/\uFEFF/g, ''); // remove characters inserted by node selecting

    return xmlString;
  }

  /**
   * Converts the editor node and its contents into an XML string suitable for export.
   * @param {Element} node
   * @param {Boolean} [identifyEntities] If true, adds cwrcTempId to entity elements. Default is false.
   * @returns {String}
   */
  buildXMLString(node: any, identifyEntities: boolean = false) {
    const _this = this;
    let xmlString = '';

    function _nodeToStringArray(currNode: JQuery<any>) {
      // let array: [string, string] = ['', ''];
      let array = [];

      const tag = currNode.attr('_tag');
      if (!tag) return ['', ''];

      const id = currNode.attr('id');
      const isEntity = currNode.attr('_entity') === 'true';

      if (isEntity && id) {
        const entityEntry = _this.writer.entitiesManager.getEntity(id);
        if (entityEntry) {
          array = _this.writer.schemaManager.mapper.getMapping(entityEntry);
          if (identifyEntities) {
            // add temp id so we can target it later in setEntityRanges
            if (array[0] !== '') {
              //@ts-ignore
              array[0] = array[0]?.replace(/([\s>])/, ` cwrcTempId="${id}"$&`);
            } else {
              //@ts-ignore
              array[1] = array[1]?.replace(/([\s>])/, ` cwrcTempId="${id}"$&`);
            }
          }
        } else {
          // TODO this occurs if the selection panel is open and we're finalizing an entity
          log.warn('cwrc2xml.buildXMLString: no entity entry for', id);
          array = ['', ''];
        }
      } else {
        let openingTag = `<${tag}`;
        const attributes = _this.writer.tagger.getAttributesForTag(currNode[0]);
        for (const attName in attributes) {
          const attValue = attributes[attName];
          // attValue = this.writer.utilities.convertTextForExport(attValue); TODO is this necessary?
          openingTag += ` ${attName}="${attValue}"`;
        }

        const isEmpty =
          currNode[0].childNodes.length === 0 ||
          (currNode[0].childNodes.length === 1 &&
            currNode[0].childNodes[0].nodeType === 3 &&
            currNode[0].childNodes[0].textContent === '\uFEFF');

        if (isEmpty) {
          openingTag += '/>';
          array.push(openingTag);
        } else {
          openingTag += '>';
          array.push(openingTag);
          array.push(`</${tag}>`);
        }
      }

      return array;
    }

    function doBuild(currentNode: JQuery<any>) {
      const tags = _nodeToStringArray(currentNode);
      xmlString += tags[0];

      if (tags.length > 1) {
        currentNode.contents().each((index, element) => {
          if (element.nodeType === Node.ELEMENT_NODE) {
            doBuild($(element));
          } else if (element.nodeType === Node.TEXT_NODE) {
            xmlString += element.data;
          } else if (element.nodeType === Node.COMMENT_NODE) {
            xmlString += `<!--${element.data}-->`;
          }
        });
        xmlString += tags[1];
      }
    }

    doBuild($(node));
    return xmlString;
  }

  /**
   * For debug
   */
  getEntityOffsets() {
    if (!this.writer.editor) return;
    const body = $(this.writer.editor.getBody());
    const offsets = this.getNodeOffsetsFromParent(body);
    const ents = [];

    for (let i = 0; i < offsets.length; i++) {
      const o = offsets[i];
      if (o?.entity) ents.push(o);
    }
    return ents;
  }

  /**
   * Process HTML entities and overlapping entities
   * @param {jQuery} body The text body
   */
  private prepareText(body: JQuery<any>) {
    const _this = this;
    // Convert HTML entities to unicode, while preserving those that must be escaped as entities.

    function recursiveTextConversion(parentNode: JQuery<any>) {
      const contents = $(parentNode).contents();
      contents.each((index, element) => {
        if (element.nodeType == Node.TEXT_NODE) {
          element.nodeValue = _this.writer.utilities.convertTextForExport(element.nodeValue);
        } else if (element.nodeType == Node.ELEMENT_NODE) {
          recursiveTextConversion(element);
        }
      });
    }
    recursiveTextConversion(body);

    // Handle overlapping entities

    // get the overlapping entity IDs, in the order that they appear in the document.
    const overlappingEntNodes = $('[_entity][class~="start"]', body).not('[_tag]').not('[_note]');
    const overlappingEntIds = $.map(overlappingEntNodes, (val, index) => {
      //@ts-ignore
      return $(val).attr('name');
    });

    // get ranges for overlapping entities, set offsetIds
    // then remove the associated nodes
    $(overlappingEntIds).each((index, id) => {
      const entry = this.writer.entitiesManager.getEntity(id);
      entry?.setRange(_this.getRangesForEntity(id) as AnnotationRange);
      $(`[name="${id}"]`, body).each((index, element) => {
        $(element).contents().unwrap();
      });
    });
  }

  /**
   * Determine and set the range objects for each entity.
   * Used later to construct the RDF.
   * @param {Document} doc The XML document
   */
  private setEntityRanges(doc: Document) {
    this.writer.entitiesManager.eachEntity((entityId: string, entry: Entity) => {
      const $entity = $(`[cwrcTempId="${entityId}"]`, doc);
      if ($entity.length === 1) {
        //@ts-ignore
        const startXPath = this.writer.utilities.getElementXPath($entity[0]);
        if (startXPath) entry.setRange({ startXPath });
      }
    });
  }

  /**
   * Determines the range that an entity spans, using xpath and character offset.
   * @param {String} entityId The id for the entity
   * @returns {JSON} The range object
   */
  private getRangesForEntity(entityId: string) {
    // const _this = this;

    const getOffsetFromParentForEntity = (
      id: string,
      parent: JQuery<HTMLElement>,
      isEnd: boolean
    ) => {
      let offset = 0;

      // Recursive function counts the number of characters in the offset,
      // recurses down overlapping entities and counts their characters as well.
      // Since entity tags are created when a document is loaded we must count
      // the characters inside of them. We can ignore _tag elements though in the
      // count as they will be present when the document is loaded.
      const getOffset = (parent: JQuery<any>) => {
        // To allow this function to exit recursion it must be able to return false.
        let ret: boolean = true;

        //@ts-ignore
        parent.contents().each((index, element) => {
          const $el = $(element);
          let start: boolean;
          let end: boolean;
          let finished: boolean;

          if ($el.attr('name') === id) {
            // Some tags are not the start or the end, they are used for
            // highlighting the entity.
            start = $el.hasClass('start');
            end = $el.hasClass('end');
            finished = (start && !isEnd) || (end && isEnd);
            // Always count the content length if looking for the end.
            if (isEnd) offset += $el.text().length;

            if (finished) {
              ret = false;
              return ret;
            }
          }
          // Not sure why the &nbsp; text nodes would not be counted but as long
          // as we are consistent in both the saving and loading it should be
          // fine.
          else if (element.nodeType === Node.TEXT_NODE && element.data !== ' ') {
            // Count all the text!
            offset += element.length;
          }
          // An Tag or an Entity that is not the one we're looking for.
          else {
            // We must use all intermediate node's text to ensure an accurate
            // text count. As the order in which entities are wrapped in spans
            // when the document is loaded will not be guarantee to be in an
            // order in which replicates the state the document was in at the
            // time it was saved.
            ret = getOffset($el);
            return ret;
          }
        });

        return ret;
      };

      getOffset(parent);
      return offset;
    };

    const doRangeGet = ($element: JQuery<HTMLElement>, isEnd: boolean) => {
      const parent = $element.parents('[_tag]').first();
      //@ts-ignore
      const xpath = this.writer.utilities.getElementXPath(parent[0]);
      const offset = getOffsetFromParentForEntity(entityId, parent, isEnd);

      return { xpath, offset };
    };

    const entitySpans = $(`[name="${entityId}"]`, this.writer.editor?.getBody());
    const entityStart = entitySpans.first();
    const entityEnd = entitySpans.last();

    const infoStart = doRangeGet(entityStart, false);
    const infoEnd = doRangeGet(entityEnd, true);

    const range = {
      startXPath: infoStart.xpath,
      startOffset: infoStart.offset,
      endXPath: infoEnd.xpath,
      endOffset: infoEnd.offset,
    };

    return range;
  }

  /**
   * Get character offsets for a node.
   * @param {Node} parent The node to start calculating offsets from.
   * @returns Array
   */
  private getNodeOffsetsFromParent(parent: JQuery<any>) {
    const _this = this;

    let currentOffset = 0;
    const offsets: {
      id: string | undefined;
      offset: number;
      length: number;
      entity: boolean;
    }[] = [];

    function getOffsets(parent: JQuery<any>) {
      parent.contents().each((index, element) => {
        const $el = $(element);

        if (element.nodeType == Node.TEXT_NODE && element.data !== ' ') {
          currentOffset += element.length;
          return;
        }

        if ($el.attr('_tag')) {
          const id = $el.attr('id');
          offsets.push({
            id,
            offset: currentOffset,
            length: $el.text().length,
            entity: $el.attr('_entity') !== undefined,
          });

          getOffsets($el);
          return;
        }

        if ($el.attr('_entity') && $el.hasClass('start')) {
          const id = $el.attr('name');
          if (!id) return;

          //@ts-ignore
          const entityContentLength = _this.writer.entitiesManager
            .getEntity(id)
            .getContent()?.length;
          if (!entityContentLength) return;

          offsets.push({
            id,
            offset: currentOffset,
            length: entityContentLength,
            entity: true,
          });
          return;
        }
      });
    }

    getOffsets(parent);
    return offsets;
  }

  //! deprecated?
  private determineOffsetRelationships(offsets: any[]) {
    const entityOffsets: any[] = [];
    const relationships: {
      [x: string]: {
        contains: string[];
        overlaps: string[];
      };
    } = {};

    for (let i = 0; i < offsets.length; i++) {
      const o = offsets[i];
      if (o.entity) {
        entityOffsets.push(o);
        relationships[o.id] = {
          contains: [],
          overlaps: [],
        };
      }
    }

    const ol = entityOffsets.length;
    for (let i = 0; i < ol; i++) {
      const o1 = entityOffsets[i];
      const span1 = o1.offset + o1.length;
      const r = relationships[o1.id];

      for (let j = 0; j < ol; j++) {
        const o2 = entityOffsets[j];
        const span2 = o2.offset + o2.length;

        if (o1.offset < o2.offset && span1 > span2) {
          r?.contains.push(o2.id);
        } else if (o1.offset < o2.offset && span1 > o2.offset && span1 < span2) {
          r?.overlaps.push(o2.id);
        } else if (o1.offset > o2.offset && span1 > span2 && span2 > o1.offset) {
          r?.overlaps.push(o2.id);
        } else if (o1.offset < o2.offset && span1 < span2 && span1 > o2.offset) {
          r?.overlaps.push(o2.id);
        }
      }
    }

    return relationships;
  }
}

export default CWRC2XML;

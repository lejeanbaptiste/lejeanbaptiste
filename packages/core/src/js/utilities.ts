import $ from 'jquery';
import ObjTree from '../lib/objtree/ObjTree';
import * as DOMUtilities from '../utilities/DOM';
import { isElement, log } from './../utilities';
import Writer from './Writer';

export const capitalizeFirstLetter = (string: string) => {
  if (typeof string !== 'string') return string;
  return `${string.charAt(0).toUpperCase()}${string.slice(1)}`;
};

type SelectNodeParams = {
  id?: string;
  nodeIndex?: number;
  parentId?: string;
  xpath?: string;
};

/**
 * @class Utilities
 * @param {Writer} writer
 */
class Utilities {
  readonly writer: Writer;

  // created in and used by convertTextForExport
  $entitiesConverter?: JQuery<HTMLElement>;

  constructor(writer: Writer) {
    this.writer = writer;
  }

  xmlToString(xmlData: Node) {
    let xmlString = '';
    try {
      xmlString = new XMLSerializer().serializeToString(xmlData);
    } catch (error) {
      log.warn(error);
    }
    return xmlString;
  }

  stringToXML(string: string) {
    const doc: XMLDocument = new DOMParser().parseFromString(string, 'text/xml');
    const parsererror = doc.querySelector('parsererror');
    if (parsererror) {
      //@ts-ignore
      log.error(`utilities.stringToXML parse error: ${parsererror.innerText}`);
      return null;
    }
    return doc;
  }

  xmlToJSON(xml: string | Element | Document) {
    if (typeof xml === 'string') {
      const stringToXml = this.stringToXML(xml);
      if (stringToXml === null) return null;
      xml = stringToXml;
    }

    const xotree = new ObjTree();
    xotree.attr_prefix = '@';
    const json = xotree.parseDOM(xml);

    return json;
  }

  //? Load schema using Salve
  async sendSchemaToworkerValidator() {
    await this.writer.overmindActions.validator.initialize();
  }

  /**j
   * Converts HTML entities to unicode, while preserving those that must be escaped as entities.
   * @param {String} text The text to convert
   * @param {Boolean} [isAttributeValue] Is this an attribute value? Defaults to false
   * @returns {String} The converted text
   */
  convertTextForExport(text: string, isAttributeValue = false) {
    if (!this.$entitiesConverter) {
      const container = this.writer.layoutManager.getContainer();
      if (!container) return;

      this.$entitiesConverter = $('<div style="display: none;"></div>').appendTo(container);
    }

    let newText = text;
    if (newText.match(/&.+?;/gim)) {
      // match all entities
      //@ts-ignore
      this.$entitiesConverter[0].innerHTML = newText;

      //@ts-ignore
      newText =
        //@ts-ignore
        this.$entitiesConverter[0].innerText || this.$entitiesConverter[0].firstChild.nodeValue;
    }

    // the following characters must be escaped
    newText = newText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (isAttributeValue) newText = newText.replace(/"/g, '&quot;');

    return newText;
  }

  addCSS(cssHref: string) {
    const fullHref = this.writer.baseUrl + cssHref;
    if (document.querySelector(`link[rel=stylesheet][href="${fullHref}"]`)) return;

    $(document.head).append(`<link type="text/css" rel="stylesheet" href="${fullHref}" />`);
  }

  getCamelCase(str: string) {
    return str.replace(/(?:^|\s)\w/g, (match) => match.toUpperCase());
  }

  escapeHTMLString(value: string | any) {
    if (typeof value === 'string') {
      return value
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    } else {
      return value;
    }
  }

  unescapeHTMLString(value: string | any) {
    if (typeof value == 'string') {
      return value
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
    } else {
      return value;
    }
  }

  getPreviousTextNode(node: Node, skipWhitespace = false) {
    const walker = node.ownerDocument?.createTreeWalker(node.ownerDocument, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        // whitespace match does not include \uFEFF since we use that to prevent empty tags
        if (
          skipWhitespace === false ||
          (skipWhitespace &&
            node.textContent?.match(
              /^[\f\n\r\t\v\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]*$/
            ) === null)
        ) {
          return NodeFilter.FILTER_ACCEPT;
        } else {
          return NodeFilter.FILTER_SKIP;
        }
      },
    });

    if (!walker) return null;

    walker.currentNode = node;
    const prevTextNode = walker.previousNode();

    return prevTextNode;
  }

  getNextTextNode(node: Node, skipWhitespace = false) {
    const walker = node.ownerDocument?.createTreeWalker(node.ownerDocument, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        // whitespace match does not include \uFEFF since we use that to prevent empty tags
        if (
          skipWhitespace === false ||
          (skipWhitespace &&
            node.textContent?.match(
              /^[\f\n\r\t\v\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]*$/
            ) === null)
        ) {
          return NodeFilter.FILTER_ACCEPT;
        } else {
          return NodeFilter.FILTER_SKIP;
        }
      },
    });
    if (!walker) return null;

    walker.currentNode = node;
    const nextTextNode = walker.nextNode();

    return nextTextNode;
  }

  /**
   * It selects a node in the editor
   * @param {SelectNodeParams} selectedNode - a SelectNodeParams which includes
   * - id?: string;
   * - nodeIndex?: number;
   * - parentId?: string;
   * - xpath?: string;
   * @param {boolean} [selectContentsOnly=false] - boolean = false
   * @returns The node that is being returned is the node that is being selected.
   */
  selectNode(selectedNode: SelectNodeParams, selectContentsOnly: boolean = false) {
    if (!this.writer.editor) return;

    const { editor, entitiesManager } = this.writer;
    entitiesManager.removeHighlights();

    //* Get node
    const node = this.getNode(selectedNode);
    if (!node) return;

    //* Handle Note: show the element if it's inside a note
    if (isElement(node)) {
      DOMUtilities.getParents(node, '.noteWrapper').forEach((parent) => {
        if (isElement(parent)) parent.classList.remove('hide');
      });
    }

    //* Create Selection
    const rng = editor.dom.createRng();
    if (isElement(node)) {
      if (selectContentsOnly) {
        //@ts-ignore
        if (tinymce?.isWebKit && node.firstChild == null) node.append('\uFEFF');
        rng.selectNodeContents(node);
      } else {
        if (isElement(node.parentNode)) node.parentNode.classList.remove('[data-mce-bogus]');
        rng.selectNode(node);
      }
    } else {
      rng.selectNode(node);
    }

    //* Apply Selection
    this.writer.editor.selection.setRng(rng);
    this.writer.editor.currentBookmark = editor.selection.getBookmark(1);

    //* Scroll Node into view
    const startScrollElement = isElement(node) ? node : node.parentElement;
    if (startScrollElement) this.scrollIntoView(startScrollElement);

    //* Focus and public Event
    // need focus to happen after timeout, otherwise it doesn't always work (in FF)
    window.setTimeout(() => {
      this.writer.editor?.focus();
      this.writer.event('tagSelected').publish(selectedNode);
    }, 0);
  }

  /**
   * It selects a range of nodes in the editor
   * @param {[SelectNodeParams, SelectNodeParams]} [selectedNode, selectedNode]
   * - A Tuple of SelectNodeParams which includes:
   * - id?: string;
   * - nodeIndex?: number;
   * - parentId?: string;
   * - xpath?: string;
   */
  selectAdjacentNodes([startNode, endNode]: [SelectNodeParams, SelectNodeParams]) {
    if (!this.writer.editor) return;
    const { editor, entitiesManager } = this.writer;
    entitiesManager.removeHighlights();

    //* Get first and last node
    const firstElement = this.getNode(startNode);
    const lastElement = this.getNode(endNode);
    if (!firstElement || !lastElement) return;

    //* Create Selection
    const rng = editor.dom.createRng();
    rng.setStartBefore(firstElement);
    rng.setEndAfter(lastElement);

    //* Apply Selection
    this.writer.editor.selection.setRng(rng);
    this.writer.editor.currentBookmark = editor.selection.getBookmark(1);

    //* Scroll Node into view
    const startScrollElement = isElement(firstElement) ? firstElement : firstElement.parentElement;
    if (startScrollElement) this.scrollIntoView(startScrollElement);

    //* Focus and public Event
    // need focus to happen after timeout, otherwise it doesn't always work (in FF)
    window.setTimeout(() => {
      this.writer.editor?.focus();
      this.writer.event('tagSelected').publish([startNode, endNode]);
    }, 0);
  }

  /**
   * Selects an element in the editor
   * @param id The id of the element to select
   * @param selectContentsOnly Whether to select only the contents of the element (defaults to false)
   */
  selectElementById(id: string, selectContentsOnly = false) {
    if (!this.writer.editor) return;
    const { editor, entitiesManager } = this.writer;
    entitiesManager.removeHighlights();

    //* Get node
    const element = editor.getBody().querySelector(`#${id}`);
    if (!element) return;

    //* Handle Note: show the element if it's inside a note
    DOMUtilities.getParents(element, '.noteWrapper').forEach((parent) => {
      if (isElement(parent)) parent.classList.remove('hide');
    });

    //* Create Selection
    const rng = editor.dom.createRng();
    if (selectContentsOnly) {
      //@ts-ignore
      if (tinymce.isWebKit && element.firstChild == null) element.append('\uFEFF');
      rng.selectNodeContents(element);
    } else {
      if (isElement(element.parentNode)) element.parentNode.classList.remove('[data-mce-bogus]');
      rng.selectNode(element);
    }

    //* Apply Selection
    this.writer.editor.selection.setRng(rng);
    this.writer.editor.currentBookmark = editor.selection.getBookmark(1);

    //* Scroll Node into view
    this.scrollIntoView(element);

    //* Focus and public Event
    // need focus to happen after timeout, otherwise it doesn't always work (in FF)
    window.setTimeout(() => {
      this.writer.editor?.focus();
      this.writer.event('tagSelected').publish(id, selectContentsOnly);
    }, 0);
  }

  getRootTag = () => {
    return $('[_tag]:first', this.writer.editor?.getBody());
  };

  /**
   * It returns the xpath of a node by going up the tree and counting the number of siblings with the
   * same name
   * @param {Node} node - The node to get the xpath for.
   * @returns The xpath of the node
   */
  getNodeXpath(node: Node) {
    if (!this.writer.editor) return;

    const getNodeIndex = (_node: Node, nodeName: string) => {
      let index = 1;
      for (let sibling = _node.previousSibling; sibling; sibling = sibling.previousSibling) {
        if (sibling.nodeType === Node.DOCUMENT_TYPE_NODE) continue; // Ignore document type declaration.
        const siblingName = isElement(sibling) ? sibling.getAttribute('_tag') : sibling.nodeName;
        if (nodeName === siblingName) ++index;
      }
      return index;
    };

    let xpath: string[] = [];

    // * go down the tree
    let _node: Node | null = node;
    for (; _node; _node = _node.parentNode) {
      //Stop when reach the document root
      if (_node === this.writer.editor.getBody()) break;

      // * skip if the node is not a TAG (ELEMENT that is not part of the document - i.e. do not has attr '_tag')
      if (isElement(_node) && !_node.getAttribute('_tag')) continue;

      const nodeName = isElement(_node) ? _node.getAttribute('_tag') ?? '' : _node.nodeName;
      const pathName = _node.nodeType === Node.TEXT_NODE ? 'text()' : nodeName;

      const index = getNodeIndex(_node, nodeName);
      const pathIndex = _node.nodeType === Node.TEXT_NODE || index > 1 ? `[${index}]` : '';
      xpath = [`${pathName}${pathIndex}`, ...xpath];
    }

    return xpath.join('/');
  }

  /**
   * Get the XPath for an element, using the nodeName or lw _tag attribute as appropriate.
   * Adapted from the firebug source.
   * @param {Element} element The (lw) element to get the XPath for
   * @param {String} [tagAttribute] The name of the attribute to use as the tag
   * @returns {String|null}
   */
  getElementXPath(element: Element, tagAttribute?: string) {
    // if (!element) return null;

    let tagAtt: string | null = null;

    if (tagAttribute) {
      tagAtt = tagAttribute;
    } else if (element.getAttribute('_tag') !== null) {
      tagAtt = '_tag'; // leaf-writer format
    }

    const paths: string[] = [];

    // Use nodeName (instead of localName) so namespace prefix is included (if any).
    //@ts-ignore
    for (; element && element.nodeType == 1; element = element.parentNode) {
      let index = 0;

      for (let sibling = element.previousSibling; sibling; sibling = sibling.previousSibling) {
        // Ignore document type declaration.
        if (sibling.nodeType === Node.DOCUMENT_TYPE_NODE) continue;

        //@ts-ignore
        if (tagAtt && sibling.getAttribute !== undefined) {
          //@ts-ignore
          if (sibling.getAttribute(tagAtt) == element.getAttribute(tagAtt)) {
            ++index;
          }
        } else {
          if (sibling.nodeName == element.nodeName) {
            ++index;
          }
        }
      }

      const tagName = tagAtt ? element.getAttribute(tagAtt) : element.nodeName;

      if (tagName) {
        const pathIndex = index ? `[${index + 1}]` : '';
        paths.splice(0, 0, tagName + pathIndex);
      }
    }

    return paths.length ? paths.join('/') : null;
  }

  /**
   * Returns the result of the specified xpath on the specified context node.
   * Can detect and convert an XML xpath for use with the leaf-writer format.
   * Adds support for default namespace.
   * @param {Document|Element} contextNode
   * @param {String} xpath
   * @returns {XPathResult|null} The result or null
   */
  evaluateXPath(contextNode: Document | Element, xpath: string) {
    const doc = contextNode.ownerDocument ? contextNode.ownerDocument : contextNode; // then the contextNode is a doc

    const isCWRC = doc === this.writer.editor?.getDoc();

    // grouped matches: 1 separator, 2 axis, 3 namespace, 4 element name or attribute name or function, 5 predicate
    const regex = /(\/{0,2})([\w-]+::|@)?(\w+?:)?([\w-(\.\*)]+)(\[.+?\])?/g;

    let nsResolver = null;
    const defaultNamespace =
      doc instanceof Document ? doc.documentElement.getAttribute('xmlns') : null;

    // TODO should doc.documentElement.namespaceURI also be checked? it will return http://wwthis.writer.w3.org/1999/xhtml for the editor doc
    if (!isCWRC && doc instanceof Document) {
      const nsr = doc.createNSResolver(doc.documentElement);
      //@ts-ignore
      nsResolver = (prefix) => nsr.lookupNamespaceURI(prefix) || defaultNamespace;

      // default namespace hack (http://stackoverflothis.writer.com/questions/9621679/javascript-xpath-and-default-namespaces)
      if (defaultNamespace !== null) {
        // add foo namespace to the element name
        xpath = xpath.replace(regex, (match, p1, p2, p3, p4, p5) => {
          if (p3 !== undefined) {
            // already has a namespace
            return match;
          } else {
            if (
              // it's an attribute and therefore doesn't need a default namespace
              (p2 !== undefined && (p2.indexOf('attribute') === 0 || p2.indexOf('@') === 0)) ||
              // it's a function not an element name
              p4.match(/\(.*?\)/) !== null
            ) {
              return [p1, p2, p3, p4, p5].join('');
            } else {
              return [p1, p2, 'foo:', p4, p5].join('');
            }
          }
        });
      }
    }

    if (defaultNamespace === null) {
      // remove all namespaces from the xpath
      xpath = xpath.replace(regex, (match, p1, p2, p3, p4, p5) => {
        return [p1, p2, p4, p5].join('');
      });
    }

    if (isCWRC) {
      if (doc === contextNode) contextNode = doc.documentElement;
      // if the context node is the schema root then we need to make sure the xpath starts with "//"
      if (
        //@ts-ignore
        contextNode.getAttribute('_tag') === this.writer.schemaManager.getRoot() &&
        xpath.charAt(0) !== '@'
      ) {
        if (xpath.charAt(1) !== '/') {
          xpath = `/${xpath}`;
          if (xpath.charAt(1) !== '/') {
            xpath = `/${xpath}`;
          }
        }
      }

      xpath = xpath.replace(regex, (match, p1, p2, p3, p4, p5) => {
        if (
          // it's an attribute and therefore doesn't need a default namespace
          (p2 !== undefined && (p2.indexOf('attribute') === 0 || p2.indexOf('@') === 0)) ||
          // it's a function not an element name
          // p4.indexOf(/\(.*?\)/) !== -1
          p4.match(/\(.*?\)/) !== null
        ) {
          return [p1, p2, p3, p4, p5].join('');
        } else {
          return [p1, p2, p3, '*[@_tag="' + p4 + '"]', p5].join('');
        }
      });
    }

    let evalResult: XPathResult;
    try {
      evalResult = doc.evaluate(xpath, contextNode, nsResolver, XPathResult.ANY_TYPE, null);
    } catch (error) {
      log.warn(`utilities.evaluateXPath: there was an error evaluating the xpath ${error}`);
      return null;
    }

    let result: number | string | boolean | Node | null = null;

    switch (evalResult.resultType) {
      case XPathResult.NUMBER_TYPE:
        result = evalResult.numberValue;
        break;
      case XPathResult.STRING_TYPE:
        result = evalResult.stringValue;
        break;
      case XPathResult.BOOLEAN_TYPE:
        result = evalResult.booleanValue;
        break;
      case XPathResult.UNORDERED_NODE_ITERATOR_TYPE:
      case XPathResult.ORDERED_NODE_ITERATOR_TYPE:
        result = evalResult.iterateNext();
        break;
      case XPathResult.ANY_UNORDERED_NODE_TYPE:
      case XPathResult.FIRST_ORDERED_NODE_TYPE:
        result = evalResult.singleNodeValue;
        break;
    }

    return result;
  }

  /**
   * Used to processes a large array incrementally, in order to not freeze the browser.
   * @param {Array} array An array of values
   * @param {Function} processFunc The function that accepts a value from the array
   * @param {Number} [refreshRate]  How often to break (in milliseconds). Default is 250.
   * @returns {Promise} A jQuery promise
   */
  processArray(array: any[], processFunc: Function, refreshRate = 250) {
    //@ts-ignore
    const dfd = new $.Deferred();

    const li = this.writer.dialogManager.getDialog('loadingindicator');

    const startingLength = array.length;
    let time1 = new Date().getTime();

    const parentFunc = function () {
      while (array.length > 0) {
        const entry = array.shift();

        //@ts-ignore
        processFunc.call(this, entry);

        const time2 = new Date().getTime();
        if (time2 - time1 > refreshRate) {
          break;
        }
      }

      const percent = (Math.abs(array.length - startingLength) / startingLength) * 100;
      li?.setValue?.(percent);

      if (array.length > 0) {
        time1 = new Date().getTime();
        setTimeout(parentFunc, 10);
      } else {
        dfd.resolve();
      }
    };

    parentFunc();

    return dfd.promise();
  }

  createGuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0,
        v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Get the offset position of an element, relative to the parent (default is leaf-writer container).
   * @param {Element} element The element
   * @param {Element} parent The offset parent. Default is the leaf-writer container.
   * @returns {JQuery.Coordinates} position An object container top and left properties
   */
  getOffsetPosition = (element: Element, parent?: Element) => {
    const $parent = parent === undefined ? this.writer.layoutManager.getContainer() : $(parent);

    const $el = $(element);
    const position = $el.position();

    if (!$parent) return position;

    let offP = $el.offsetParent();
    //@ts-ignore
    while ($parent.find(offP[0]).length === 1) {
      const pos = offP.position();
      position.top += pos.top;
      position.left += pos.left;

      offP = offP.offsetParent();
    }

    return position;
  };

  /**
   * Constrain a value. Useful when positioning an element within another element.
   * @param {Number} value The x or y value of the element
   * @param {Number} max The max to constrain within
   * @param {Number} size The size of the element
   * @returns {Number} value The constrained value
   */
  constrain(value: number, max: number, size: number) {
    if (value < 0) return 0;

    if (value + size > max) {
      value = max - size;
      return value < 0 ? 0 : value;
    }

    return value;
  }

  destroy() {
    if (this.$entitiesConverter) this.$entitiesConverter.remove();
  }

  private scrollIntoView(element: Element) {
    if (!this.writer.editor) return;
    // scroll node into view
    let elementTop = DOMUtilities.getElementPosition(element).top;

    //! It is not clear why this is here and it is not working.
    // if (node.matches(':hidden')) {
    //   node.style.display = '';
    //   nodeTop = getElementPosition(node).top;
    //   node.style.display = 'none';
    // }

    const editorContentAreaContainer = this.writer.editor.getContentAreaContainer();
    const containerHeight = editorContentAreaContainer.getBoundingClientRect().height * 0.25; //? Magic Number
    const newScrollTop = elementTop - containerHeight;

    element.ownerDocument.scrollingElement?.scrollTo({ top: newScrollTop, behavior: 'smooth' });
  }

  private getNode({ id, parentId, nodeIndex, xpath }: SelectNodeParams) {
    if (id) {
      const element = this.getElementById(id);
      if (element) return element;
    }
    if (xpath) {
      const Node = this.getNodeByXpath(xpath);
      if (Node) return Node;
    }
    if (parentId) {
      const Node = this.getNodeByParentChildIndex(parentId, nodeIndex);
      if (Node) return Node;
    }
  }

  private getElementById(id: string) {
    if (!this.writer.editor) return;
    const selector = `#${id}`;
    if (!DOMUtilities.isValidCSSSelector(selector)) return;
    return this.writer.editor.getBody().querySelector(selector);
  }

  private getNodeByXpath(xpath: string) {
    if (!this.writer.editor) return;
    const node = this.evaluateXPath(this.writer.editor.getBody(), xpath);
    if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
      return;
    }
    return node;
  }

  private getNodeByParentChildIndex(parentId: string, nodeIndex: number = 0) {
    if (!this.writer.editor) return;
    const parent = this.writer.editor.getBody().querySelector(`#${parentId}`);
    return parent?.childNodes.item(nodeIndex);
  }
}

export default Utilities;

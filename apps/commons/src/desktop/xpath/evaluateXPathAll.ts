const xpathSegmentRegex = /(\/{0,2})([\w-]+::|@)?(\w+?:)?([\w-(\.\*)]+)(\[.+?\])?/g;

const isElement = (node: Node): node is Element => node.nodeType === Node.ELEMENT_NODE;

export const getXPathForElement = (el: Node | null, xml: Document): string => {
  let xpath = '';
  let pos: number;
  let tempitem: Node | null;

  while (el && el !== xml.documentElement && el.nodeName !== '#document') {
    pos = 0;
    tempitem = el;
    while (tempitem) {
      if (tempitem.nodeType === 1 && tempitem.nodeName === el.nodeName) {
        pos += 1;
      }
      tempitem = tempitem.previousSibling;
    }

    xpath = `${el.nodeName}[${pos}]/${xpath}`;

    if (el.nodeType === 2) {
      el = (el as Attr).ownerElement;
    } else {
      el = el.parentNode;
    }
  }

  xpath = `/${xml.documentElement.nodeName}/${xpath}`;
  return xpath.replace(/\/$/, '');
};

export const evaluateXPathAll = (contextNode: Document | Element, xpath: string): Node[] => {
  const doc = contextNode.ownerDocument ? contextNode.ownerDocument : contextNode;

  let nsResolver: XPathNSResolver | null = null;
  const defaultNamespace =
    doc instanceof Document ? doc.documentElement?.getAttribute('xmlns') : null;

  if (doc instanceof Document && doc.documentElement) {
    const nsr = doc.createNSResolver(doc.documentElement);
    nsResolver = (prefix) => nsr.lookupNamespaceURI(prefix) || defaultNamespace;

    if (defaultNamespace !== null) {
      xpath = xpath.replace(xpathSegmentRegex, (match, p1, p2, p3, p4, p5) => {
        if (p3 !== undefined) return match;
        if (
          (p2 !== undefined && (p2.indexOf('attribute') === 0 || p2.indexOf('@') === 0)) ||
          p4.match(/\(.*?\)/) !== null
        ) {
          return [p1, p2, p3, p4, p5].join('');
        }
        return [p1, p2, 'foo:', p4, p5].join('');
      });
    }
  }

  if (defaultNamespace === null) {
    xpath = xpath.replace(xpathSegmentRegex, (match, p1, p2, p3, p4, p5) => {
      return [p1, p2, p4, p5].join('');
    });
  }

  let evalResult: XPathResult;
  try {
    evalResult = doc.evaluate(
      xpath,
      contextNode,
      nsResolver,
      XPathResult.ORDERED_NODE_ITERATOR_TYPE,
      null,
    );
  } catch {
    return [];
  }

  const nodes: Node[] = [];
  let node = evalResult.iterateNext();
  while (node) {
    nodes.push(node);
    node = evalResult.iterateNext();
  }

  return nodes;
};

export const getNodeLabel = (node: Node): string => {
  if (isElement(node)) {
    return node.getAttribute('_tag') ?? node.nodeName;
  }
  return node.nodeName;
};

export const getNodeId = (node: Node): string | undefined => {
  if (isElement(node)) {
    return node.getAttribute('id') ?? undefined;
  }
  return undefined;
};

export const parseXmlDocument = (content: string): Document | null => {
  const doc = new DOMParser().parseFromString(content, 'text/xml');
  if (doc.querySelector('parsererror')) return null;
  if (!doc.documentElement) return null;
  return doc;
};

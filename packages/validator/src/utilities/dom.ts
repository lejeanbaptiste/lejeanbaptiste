const XPathResult = {
  ANY_TYPE: 0,
  NUMBER_TYPE: 1,
  STRING_TYPE: 2,
  BOOLEAN_TYPE: 3,
  UNORDERED_NODE_ITERATOR_TYPE: 4,
  ORDERED_NODE_ITERATOR_TYPE: 5,
  UNORDERED_NODE_SNAPSHOT_TYPE: 6,
  ORDERED_NODE_SNAPSHOT_TYPE: 7,
  ANY_UNORDERED_NODE_TYPE: 8,
  FIRST_ORDERED_NODE_TYPE: 9,
};

export const evaluateXPath = (xpath: string, docXML: Document) => {
  const evalResult = window.document.evaluate(xpath, docXML, null, XPathResult.ANY_TYPE, null);

  let result: number | string | boolean | Node | null | undefined;

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

  if (
    typeof result === 'boolean' ||
    typeof result === 'number' ||
    typeof result === 'string' ||
    result === null
  ) {
    return;
  }

  return result;
};

export const getXPathForElement = (el: Node | null, xml: Document) => {
  let xpath = '';
  let pos: number;
  let tempitem: Node | null;

  while (el && el !== xml.documentElement && el.nodeName !== '#document') {
    pos = 0;
    tempitem = el;
    while (tempitem) {
      if (tempitem.nodeType === 1 && tempitem.nodeName === el.nodeName) {
        // If it is ELEMENT_NODE of the same name
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
  xpath = xpath.replace(/\/$/, '');
  return xpath;
};

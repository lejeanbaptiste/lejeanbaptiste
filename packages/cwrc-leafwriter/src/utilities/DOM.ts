export const getParents = (node: Node, selector: string) => {
  const parents: Node[] = [];
  let _node: Node | null = node;

  while (_node && (_node = _node.parentNode) && _node !== document) {
    if (!selector || (isElement(_node) && _node.matches(selector))) parents.push(_node);
  }

  return parents;
};

export const isElement = (param: unknown): param is Element => {
  return (param as Element).getAttribute !== undefined;
};

export const isValidCSSSelector = ((dummyElement) => (selector: string) => {
  try {
    dummyElement.querySelector(selector);
  } catch {
    return false;
  }
  return true;
})(document.createDocumentFragment());

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

/** Open http(s) links in the system browser; works in Electron and web. */
export const openExternalUrl = (url: string): void => {
  if (!url) return;
  const electron = (window as Window & { electronAPI?: { openExternalUrl?: (url: string) => Promise<boolean> } })
    .electronAPI;
  if (electron?.openExternalUrl) {
    void electron.openExternalUrl(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
};

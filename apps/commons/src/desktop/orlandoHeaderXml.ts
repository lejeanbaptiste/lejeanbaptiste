const findChildByLocalName = (parent: Element, name: string): Element | null => {
  for (let i = 0; i < parent.children.length; i += 1) {
    const child = parent.children[i];
    if (child.localName === name || child.tagName === name) return child;
  }
  return null;
};

export const findOrlandoHeader = (doc: Document): Element | null => {
  const root = doc.documentElement;
  if (!root) return null;
  if (root.localName === 'ORLANDOHEADER' || root.tagName === 'ORLANDOHEADER') return root;
  return (
    doc.getElementsByTagName('ORLANDOHEADER')[0] ??
    doc.getElementsByTagName('OrlandoHeader')[0] ??
    null
  );
};

const ensurePath = (root: Element, parts: string[]): Element => {
  let current: Element = root;
  for (const part of parts) {
    let child = findChildByLocalName(current, part);
    if (!child) {
      child = root.ownerDocument!.createElement(part);
      current.appendChild(child);
    }
    current = child;
  }
  return current;
};

export const getOrlandoHeaderPathValue = (header: Element, headerPath: string): string => {
  const parts = headerPath.split('/').filter(Boolean);
  const leaf = parts.pop();
  if (!leaf) return '';

  let current: Element = header;
  for (const part of parts) {
    const next = findChildByLocalName(current, part);
    if (!next) return '';
    current = next;
  }

  const node = findChildByLocalName(current, leaf);
  return node?.textContent ?? '';
};

export const setOrlandoHeaderPathValue = (
  header: Element,
  headerPath: string,
  value: string,
) => {
  const parts = headerPath.split('/').filter(Boolean);
  const leaf = parts.pop();
  if (!leaf) return;
  const parent = parts.length ? ensurePath(header, parts) : header;
  let node = findChildByLocalName(parent, leaf);
  if (!node) {
    node = header.ownerDocument!.createElement(leaf);
    parent.appendChild(node);
  }
  if (leaf === 'RESPONSIBILITY') {
    if (!node.getAttribute('RESP')) node.setAttribute('RESP', 'IMG');
    if (!node.getAttribute('WORKSTATUS')) node.setAttribute('WORKSTATUS', 'SUB');
    if (!node.getAttribute('WORKVALUE')) node.setAttribute('WORKVALUE', 'I');
    if (!findChildByLocalName(node, 'DATE')) {
      const date = header.ownerDocument!.createElement('DATE');
      date.textContent = new Date().getFullYear().toString();
      node.appendChild(date);
    }
  }
  node.textContent = value;
};

export const clearOrlandoHeaderPath = (header: Element, headerPath: string) => {
  const parts = headerPath.split('/').filter(Boolean);
  const leaf = parts.pop();
  if (!leaf) return;
  let current: Element = header;
  for (const part of parts) {
    const next = findChildByLocalName(current, part);
    if (!next) return;
    current = next;
  }
  const node = findChildByLocalName(current, leaf);
  node?.parentNode?.removeChild(node);
};

export const applyOrlandoHeaderPathUpdates = (
  xml: string,
  updates: Array<{ path: string; value: string }>,
  options?: { clearPaths?: string[]; skipPaths?: Set<string> },
): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) return xml;

  const header = findOrlandoHeader(doc);
  if (!header) return xml;

  const skipPaths = options?.skipPaths;

  for (const { path, value } of updates) {
    if (skipPaths?.has(path)) continue;
    const relativePath = path.startsWith('ORLANDOHEADER/')
      ? path.slice('ORLANDOHEADER/'.length)
      : path;
    if (value.trim()) {
      setOrlandoHeaderPathValue(header, relativePath, value.trim());
    } else {
      clearOrlandoHeaderPath(header, relativePath);
    }
  }

  for (const path of options?.clearPaths ?? []) {
    if (skipPaths?.has(path)) continue;
    const relativePath = path.startsWith('ORLANDOHEADER/')
      ? path.slice('ORLANDOHEADER/'.length)
      : path;
    clearOrlandoHeaderPath(header, relativePath);
  }

  return new XMLSerializer().serializeToString(doc);
};

export const readOrlandoHeaderPathValues = (
  xml: string,
  paths: string[],
): Record<string, string> => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) {
    return Object.fromEntries(paths.map((path) => [path, '']));
  }

  const header = findOrlandoHeader(doc);
  if (!header) {
    return Object.fromEntries(paths.map((path) => [path, '']));
  }

  const values: Record<string, string> = {};
  for (const path of paths) {
    const relativePath = path.startsWith('ORLANDOHEADER/')
      ? path.slice('ORLANDOHEADER/'.length)
      : path;
    values[path] = getOrlandoHeaderPathValue(header, relativePath);
  }
  return values;
};

export const hasOrlandoHeader = (xml: string): boolean => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) return false;
  return Boolean(findOrlandoHeader(doc));
};

export const TEI_NS = 'http://www.tei-c.org/ns/1.0';

export const findTeiHeader = (doc: Document): Element | null => {
  const tei = doc.documentElement;
  if (!tei) return null;
  const header =
    tei.getElementsByTagNameNS(TEI_NS, 'teiHeader')[0] ??
    tei.getElementsByTagName('teiHeader')[0];
  return header ?? null;
};

export const ensurePath = (root: Element, parts: string[]): Element => {
  let current: Element = root;
  for (const part of parts) {
    let child =
      current.getElementsByTagNameNS(TEI_NS, part)[0] ??
      current.getElementsByTagName(part)[0];
    if (!child) {
      child = root.ownerDocument!.createElementNS(TEI_NS, part);
      current.appendChild(child);
    }
    current = child;
  }
  return current;
};

export const getHeaderPathValue = (header: Element, teiPath: string): string => {
  const parts = teiPath.split('/').filter(Boolean);
  const leaf = parts.pop();
  if (!leaf) return '';

  let current: Element = header;
  for (const part of parts) {
    const next =
      current.getElementsByTagNameNS(TEI_NS, part)[0] ??
      current.getElementsByTagName(part)[0];
    if (!next) return '';
    current = next;
  }

  const node =
    current.getElementsByTagNameNS(TEI_NS, leaf)[0] ??
    current.getElementsByTagName(leaf)[0];
  return node?.textContent ?? '';
};

export const setHeaderPathValue = (header: Element, teiPath: string, value: string) => {
  const parts = teiPath.split('/').filter(Boolean);
  const leaf = parts.pop();
  if (!leaf) return;
  const parent = parts.length ? ensurePath(header, parts) : header;
  let node =
    parent.getElementsByTagNameNS(TEI_NS, leaf)[0] ??
    parent.getElementsByTagName(leaf)[0];
  if (!node) {
    node = header.ownerDocument!.createElementNS(TEI_NS, leaf);
    parent.appendChild(node);
  }
  node.textContent = value;
};

export const clearHeaderPath = (header: Element, teiPath: string) => {
  const parts = teiPath.split('/').filter(Boolean);
  const leaf = parts.pop();
  if (!leaf) return;
  let current: Element = header;
  for (const part of parts) {
    const next =
      current.getElementsByTagNameNS(TEI_NS, part)[0] ??
      current.getElementsByTagName(part)[0];
    if (!next) return;
    current = next;
  }
  const node =
    current.getElementsByTagNameNS(TEI_NS, leaf)[0] ??
    current.getElementsByTagName(leaf)[0];
  node?.parentNode?.removeChild(node);
};

export const applyHeaderPathUpdates = (
  xml: string,
  updates: Array<{ path: string; value: string }>,
  options?: { clearPaths?: string[]; skipPaths?: Set<string> },
): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) return xml;

  const header = findTeiHeader(doc);
  if (!header) return xml;

  const skipPaths = options?.skipPaths;

  for (const { path, value } of updates) {
    if (skipPaths?.has(path)) continue;
    if (value.trim()) {
      setHeaderPathValue(header, path, value.trim());
    } else {
      clearHeaderPath(header, path);
    }
  }

  for (const path of options?.clearPaths ?? []) {
    if (skipPaths?.has(path)) continue;
    clearHeaderPath(header, path);
  }

  return new XMLSerializer().serializeToString(doc);
};

export const readHeaderPathValues = (
  xml: string,
  paths: string[],
): Record<string, string> => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) {
    return Object.fromEntries(paths.map((path) => [path, '']));
  }

  const header = findTeiHeader(doc);
  if (!header) {
    return Object.fromEntries(paths.map((path) => [path, '']));
  }

  const values: Record<string, string> = {};
  for (const path of paths) {
    values[path] = getHeaderPathValue(header, path);
  }
  return values;
};

export const hasTeiHeader = (xml: string): boolean => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) return false;
  return Boolean(findTeiHeader(doc));
};

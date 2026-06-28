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

const findTeiText = (tei: Element): Element | null =>
  tei.getElementsByTagNameNS(TEI_NS, 'text')[0] ??
  tei.getElementsByTagName('text')[0] ??
  null;

/** Loose text nodes directly under header elements that forbid raw text (e.g. publicationStmt). */
export const inspectHeaderLooseText = (
  xml: string,
): { hasHeader: boolean; publicationStmt: boolean; sourceDesc: boolean } => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) {
    return { hasHeader: false, publicationStmt: false, sourceDesc: false };
  }

  const header = findTeiHeader(doc);
  if (!header) {
    return { hasHeader: false, publicationStmt: false, sourceDesc: false };
  }

  const hasLooseText = (localName: string): boolean => {
    const el =
      header!.getElementsByTagNameNS(TEI_NS, localName)[0] ??
      header!.getElementsByTagName(localName)[0];
    if (!el) return false;
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim().length > 0) {
        return true;
      }
    }
    return false;
  };

  return {
    hasHeader: true,
    publicationStmt: hasLooseText('publicationStmt'),
    sourceDesc: hasLooseText('sourceDesc'),
  };
};

/** Remove teiHeader from TEI XML before loading into the WYSIWYG editor (header stays file-only). */
export const stripTeiHeaderForVisualEditor = (xml: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) return xml;

  const header = findTeiHeader(doc);
  if (!header) return xml;

  header.parentNode?.removeChild(header);

  return new XMLSerializer().serializeToString(doc);
};

/** Remove encodingDesc from teiHeader (save stamp is not edited in WYSIWYG). */
export const stripEncodingDescFromHeader = (xml: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) return xml;

  const header = findTeiHeader(doc);
  if (!header) return xml;

  const encodingDesc =
    header.getElementsByTagNameNS(TEI_NS, 'encodingDesc')[0] ??
    header.getElementsByTagName('encodingDesc')[0];
  encodingDesc?.parentNode?.removeChild(encodingDesc);

  return new XMLSerializer().serializeToString(doc);
};

/** @deprecated Use stripTeiHeaderForVisualEditor */
export const stripEncodingDescFromTeiXml = stripEncodingDescFromHeader;

/** Merge WYSIWYG body edits with the stored file header (metadata + revision stamp). */
export const mergeEditorBodyWithStoredHeader = (
  editorXml: string,
  storedXml: string,
): string => {
  const parser = new DOMParser();
  const editorDoc = parser.parseFromString(editorXml, 'application/xml');
  const storedDoc = parser.parseFromString(storedXml, 'application/xml');
  if (editorDoc.querySelector('parsererror')) return storedXml || editorXml;
  if (storedDoc.querySelector('parsererror')) return editorXml;

  const storedTei = storedDoc.documentElement;
  const editorTei = editorDoc.documentElement;
  if (!storedTei || !editorTei) return editorXml;

  const editorText = findTeiText(editorTei);
  const storedText = findTeiText(storedTei);

  if (editorText && storedText) {
    storedTei.replaceChild(storedDoc.importNode(editorText, true), storedText);
  } else if (editorText && !storedText) {
    storedTei.appendChild(storedDoc.importNode(editorText, true));
  }

  return new XMLSerializer().serializeToString(storedDoc);
};

/** Reattach stored file header so RelaxNG validation matches the on-disk document. */
export const mergeStoredHeaderForValidation = (
  editorXml: string,
  storedXml: string,
): string => {
  if (!storedXml || !/<teiHeader[\s>]/i.test(storedXml)) return editorXml;
  const editorBody = stripTeiHeaderForVisualEditor(editorXml);
  const merged = mergeEditorBodyWithStoredHeader(editorBody, storedXml);
  return stripEncodingDescFromHeader(merged);
};

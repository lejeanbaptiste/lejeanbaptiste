export const TEI_NS = 'http://www.tei-c.org/ns/1.0';

/** Header leaf paths stored as attributes rather than text content (TEI P5). */
const HEADER_ATTRIBUTE_PATHS: Record<string, string> = {
  'profileDesc/langUsage/language': 'ident',
};

const LANGUAGE_NAME_TO_IDENT: Record<string, string> = {
  english: 'eng',
  french: 'fre',
  fran: 'fre',
  german: 'deu',
  deutsch: 'deu',
  spanish: 'spa',
  italian: 'ita',
  latin: 'lat',
  greek: 'grc',
  arabic: 'ara',
  chinese: 'chi',
  japanese: 'jpn',
  portuguese: 'por',
  dutch: 'nld',
  russian: 'rus',
};

export const normalizeLanguageIdent = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (/^[a-z]{2,3}$/i.test(trimmed)) return trimmed.toLowerCase();

  // BCP-47 tags with subtags (zh-Hant, en-US, …): keep whole, canonical case.
  if (/^[a-z]{2,3}(-[a-z0-9]{2,8})+$/i.test(trimmed)) {
    return trimmed
      .split('-')
      .map((subtag, i) => {
        if (i === 0) return subtag.toLowerCase();
        if (subtag.length === 4) return subtag[0].toUpperCase() + subtag.slice(1).toLowerCase();
        if (subtag.length === 2) return subtag.toUpperCase();
        return subtag.toLowerCase();
      })
      .join('-');
  }

  const mapped = LANGUAGE_NAME_TO_IDENT[trimmed.toLowerCase()];
  if (mapped) return mapped;

  return trimmed.toLowerCase().slice(0, 3);
};

export const findTeiHeader = (doc: Document): Element | null => {
  const tei = doc.documentElement;
  if (!tei) return null;
  const header =
    tei.getElementsByTagNameNS(TEI_NS, 'teiHeader')[0] ?? tei.getElementsByTagName('teiHeader')[0];
  return header ?? null;
};

/** TEI fileDesc paths — stored relative to teiHeader for UI/metadata. */
const FILE_DESC_CONTAINER_PATHS = new Set(['titleStmt', 'sourceDesc', 'publicationStmt']);

/** Leaf paths that must stay as an empty <p/> rather than being removed when cleared. */
const TEI_PARAGRAPH_PATHS = new Set([
  'sourceDesc/p',
  'publicationStmt/p',
  'encodingDesc/projectDesc/p',
]);

const findFileDesc = (header: Element): Element | null =>
  header.getElementsByTagNameNS(TEI_NS, 'fileDesc')[0] ??
  header.getElementsByTagName('fileDesc')[0] ??
  null;

const findDirectChild = (parent: Element, localName: string): Element | null => {
  for (const child of Array.from(parent.children)) {
    if (child.localName === localName || child.nodeName === localName) return child;
  }
  return null;
};

export const ensurePath = (root: Element, parts: string[]): Element => {
  let current: Element = root;
  if (parts.length > 0 && FILE_DESC_CONTAINER_PATHS.has(parts[0]!)) {
    const fileDesc = findFileDesc(root);
    if (fileDesc) current = fileDesc;
  }

  for (const part of parts) {
    let child = findDirectChild(current, part);
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
      current.getElementsByTagNameNS(TEI_NS, part)[0] ?? current.getElementsByTagName(part)[0];
    if (!next) return '';
    current = next;
  }

  const node =
    current.getElementsByTagNameNS(TEI_NS, leaf)[0] ?? current.getElementsByTagName(leaf)[0];
  if (!node) return '';

  const attrName = HEADER_ATTRIBUTE_PATHS[teiPath];
  if (attrName) {
    return node.getAttribute(attrName) ?? '';
  }

  return node.textContent ?? '';
};

export const setHeaderPathValue = (header: Element, teiPath: string, value: string) => {
  const parts = teiPath.split('/').filter(Boolean);
  const leaf = parts.pop();
  if (!leaf) return;
  const parent = parts.length ? ensurePath(header, parts) : header;
  let node = parent.getElementsByTagNameNS(TEI_NS, leaf)[0] ?? parent.getElementsByTagName(leaf)[0];
  if (!node) {
    node = header.ownerDocument!.createElementNS(TEI_NS, leaf);
    parent.appendChild(node);
  }

  const attrName = HEADER_ATTRIBUTE_PATHS[teiPath];
  if (attrName) {
    const attrValue =
      teiPath === 'profileDesc/langUsage/language' ? normalizeLanguageIdent(value) : value.trim();
    if (attrValue) {
      node.setAttribute(attrName, attrValue);
    } else {
      node.removeAttribute(attrName);
    }
    node.textContent = '';
    return;
  }

  node.textContent = value;
};

const PUBLICATION_STMT_AGENCY_ORDER = ['publisher', 'distributor', 'authority'];
const PUBLICATION_STMT_DETAIL_ORDER = ['address', 'date', 'pubPlace', 'idno', 'availability'];
const PUBLICATION_STMT_ORDER = [...PUBLICATION_STMT_AGENCY_ORDER, ...PUBLICATION_STMT_DETAIL_ORDER];

const getPublicationStmtSortIndex = (element: Element): number => {
  const index = PUBLICATION_STMT_ORDER.indexOf(element.localName);
  return index === -1 ? PUBLICATION_STMT_ORDER.length : index;
};

export const normalizeLanguageElementsInHeader = (header: Element) => {
  const languages = [
    ...header.getElementsByTagNameNS(TEI_NS, 'language'),
    ...header.getElementsByTagName('language'),
  ];

  for (const lang of languages) {
    const text = lang.textContent?.trim() ?? '';
    const ident = lang.getAttribute('ident');
    if (!text || ident) continue;
    lang.setAttribute('ident', normalizeLanguageIdent(text));
    lang.textContent = '';
  }
};

const isPublicationStmtAgency = (localName: string): boolean =>
  PUBLICATION_STMT_AGENCY_ORDER.includes(localName);

const isPublicationStmtDetail = (localName: string): boolean =>
  PUBLICATION_STMT_DETAIL_ORDER.includes(localName);

const ensurePublicationStmtAgency = (publicationStmt: Element) => {
  const children = Array.from(publicationStmt.children);
  const hasAgency = children.some((child) => isPublicationStmtAgency(child.localName));
  const hasDetail = children.some((child) => isPublicationStmtDetail(child.localName));
  if (hasDetail && !hasAgency) {
    publicationStmt.insertBefore(
      publicationStmt.ownerDocument!.createElementNS(TEI_NS, 'publisher'),
      publicationStmt.firstChild,
    );
  }
};

const normalizePublicationStmtChildren = (publicationStmt: Element) => {
  const elementChildren = Array.from(publicationStmt.children);
  const paragraphs = elementChildren.filter((child) => child.localName === 'p');
  const structured = elementChildren.filter((child) => child.localName !== 'p');
  const hasParagraphContent = paragraphs.some((child) => (child.textContent ?? '').trim());

  if (hasParagraphContent) {
    for (const child of structured) {
      publicationStmt.removeChild(child);
    }
    return;
  }

  for (const child of paragraphs) {
    publicationStmt.removeChild(child);
  }

  ensurePublicationStmtAgency(publicationStmt);

  const orderedChildren = Array.from(publicationStmt.children).sort(
    (a, b) => getPublicationStmtSortIndex(a) - getPublicationStmtSortIndex(b),
  );

  for (const child of orderedChildren) {
    publicationStmt.appendChild(child);
  }
};

/** TEI sourceDesc/publicationStmt cannot contain raw text — wrap in <p> and keep a valid empty <p/>. */
export const normalizeParagraphContainersInHeader = (header: Element) => {
  for (const name of ['sourceDesc', 'publicationStmt'] as const) {
    const container =
      header.getElementsByTagNameNS(TEI_NS, name)[0] ?? header.getElementsByTagName(name)[0];
    if (!container) continue;

    const looseParts: string[] = [];
    const textNodesToRemove: Node[] = [];
    for (const child of Array.from(container.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent?.trim();
        if (text) looseParts.push(text);
        textNodesToRemove.push(child);
      }
    }
    for (const node of textNodesToRemove) {
      container.removeChild(node);
    }

    const hasStructuredPublicationChild =
      name === 'publicationStmt' &&
      Array.from(container.children).some((child) => isPublicationStmtAgency(child.localName));

    if (looseParts.length > 0 && !hasStructuredPublicationChild) {
      let paragraph =
        container.getElementsByTagNameNS(TEI_NS, 'p')[0] ?? container.getElementsByTagName('p')[0];
      if (!paragraph) {
        paragraph = header.ownerDocument!.createElementNS(TEI_NS, 'p');
        container.appendChild(paragraph);
      }
      const existing = paragraph.textContent?.trim() ?? '';
      paragraph.textContent = [existing, ...looseParts].filter(Boolean).join(' ').trim();
    }

    if (name === 'publicationStmt') {
      normalizePublicationStmtChildren(container);
    }

    const hasElementChild = Array.from(container.childNodes).some(
      (node) => node.nodeType === Node.ELEMENT_NODE,
    );
    if (!hasElementChild) {
      const placeholder = name === 'publicationStmt' ? 'publisher' : 'p';
      container.appendChild(header.ownerDocument!.createElementNS(TEI_NS, placeholder));
    }
  }
};

export const normalizeTeiHeaderElementsInHeader = (header: Element) => {
  normalizeLanguageElementsInHeader(header);
  normalizeParagraphContainersInHeader(header);
};

export const normalizeTeiHeaderLanguageElements = (xml: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) return xml;

  const header = findTeiHeader(doc);
  if (!header) return xml;

  normalizeTeiHeaderElementsInHeader(header);
  return new XMLSerializer().serializeToString(doc);
};

export const clearHeaderPath = (header: Element, teiPath: string) => {
  const parts = teiPath.split('/').filter(Boolean);
  const leaf = parts.pop();
  if (!leaf) return;
  let current: Element = header;
  for (const part of parts) {
    const next =
      current.getElementsByTagNameNS(TEI_NS, part)[0] ?? current.getElementsByTagName(part)[0];
    if (!next) return;
    current = next;
  }
  const node =
    current.getElementsByTagNameNS(TEI_NS, leaf)[0] ?? current.getElementsByTagName(leaf)[0];
  node?.parentNode?.removeChild(node);
};

export const applyHeaderPathUpdates = (
  xml: string,
  updates: { path: string; value: string }[],
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
    } else if (TEI_PARAGRAPH_PATHS.has(path)) {
      setHeaderPathValue(header, path, '');
    } else {
      clearHeaderPath(header, path);
    }
  }

  for (const path of options?.clearPaths ?? []) {
    if (skipPaths?.has(path)) continue;
    if (TEI_PARAGRAPH_PATHS.has(path)) {
      setHeaderPathValue(header, path, '');
    } else {
      clearHeaderPath(header, path);
    }
  }

  normalizeTeiHeaderElementsInHeader(header);

  return new XMLSerializer().serializeToString(doc);
};

export const readHeaderPathValues = (xml: string, paths: string[]): Record<string, string> => {
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
  tei.getElementsByTagNameNS(TEI_NS, 'text')[0] ?? tei.getElementsByTagName('text')[0] ?? null;

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
export const mergeEditorBodyWithStoredHeader = (editorXml: string, storedXml: string): string => {
  const parser = new DOMParser();
  const editorDoc = parser.parseFromString(editorXml, 'application/xml');
  const storedDoc = parser.parseFromString(storedXml, 'application/xml');
  if (editorDoc.querySelector('parsererror')) return editorXml;
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
export const mergeStoredHeaderForValidation = (editorXml: string, storedXml: string): string => {
  if (!storedXml || !/<teiHeader[\s>]/i.test(storedXml)) return editorXml;
  const editorBody = stripTeiHeaderForVisualEditor(editorXml);
  const merged = mergeEditorBodyWithStoredHeader(editorBody, storedXml);
  return normalizeTeiHeaderLanguageElements(stripEncodingDescFromHeader(merged));
};

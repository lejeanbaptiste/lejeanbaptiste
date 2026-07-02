import type { BiblEntry, CitationRef, CslJsonItem } from './types';

/**
 * Manages the <standOff><listBibl type="zotero"> block in a translation companion
 * document. Each cited work is stored once, keyed by its Zotero item key, carrying the
 * canonical Zotero URI and a full CSL-JSON snapshot so citations can be reconstituted
 * (e.g. as live Zotero fields on Word export) without Zotero running.
 *
 * Footnote content references entries via <bibl type="zotero-ref" corresp="#zbib-KEY">;
 * the rendered citation text lives there, not here, since it varies by locator.
 */

const ZOTERO_REF_TYPE = 'zotero-ref';
const BIBL_ID_PREFIX = 'zbib-';

/** Extracts the Zotero item key from a Zotero item URI (last path segment). */
export const zoteroKeyFromUri = (uri: string): string => {
  const segment = uri.replace(/\/+$/, '').split('/').pop() ?? '';
  // xml:id must be an NCName; Zotero keys are [A-Z0-9]{8} but guard anyway.
  return segment.replace(/[^A-Za-z0-9_.-]/g, '_');
};

export const biblIdForUri = (uri: string): string => `${BIBL_ID_PREFIX}${zoteroKeyFromUri(uri)}`;

/**
 * Writes a JSON payload into an element as CDATA. A single CDATA section cannot contain
 * the sequence `]]>`, so the payload is split across sections at each occurrence; reading
 * back via textContent transparently concatenates them.
 */
export const writeJsonPayload = (element: Element, payload: unknown): void => {
  const doc = element.ownerDocument;
  while (element.firstChild) element.removeChild(element.firstChild);
  const text = JSON.stringify(payload);
  const parts = text.split(']]>');
  parts.forEach((part, index) => {
    // Re-attach the split delimiter across the section boundary: `]]` ends one
    // section, `>` starts the next, so concatenated textContent is unchanged.
    const chunk = (index > 0 ? '>' : '') + part + (index < parts.length - 1 ? ']]' : '');
    if (chunk) element.appendChild(doc.createCDATASection(chunk));
  });
};

export const readJsonPayload = (element: Element): unknown => {
  const text = element.textContent ?? '';
  return text.trim() ? JSON.parse(text) : undefined;
};

const getDirectChild = (parent: Element, localName: string): Element | undefined =>
  Array.from(parent.children).find((child) => child.localName === localName);

/** Returns the standOff/listBibl element, creating it (as first child of the root) if missing. */
export const ensureStandOffListBibl = (doc: Document): Element => {
  const root = doc.documentElement;
  let standOff = getDirectChild(root, 'standOff');
  if (!standOff) {
    standOff = doc.createElement('standOff');
    root.insertBefore(standOff, root.firstChild);
  }
  let listBibl = getDirectChild(standOff, 'listBibl');
  if (!listBibl) {
    listBibl = doc.createElement('listBibl');
    listBibl.setAttribute('type', 'zotero');
    standOff.appendChild(listBibl);
  }
  return listBibl;
};

const findStandOffListBibl = (doc: Document): Element | undefined => {
  const standOff = getDirectChild(doc.documentElement, 'standOff');
  return standOff ? getDirectChild(standOff, 'listBibl') : undefined;
};

/**
 * Adds or updates the bibliography entry for a Zotero item. Entries are keyed by the
 * item key derived from the URI; re-citing the same work updates the CSL snapshot
 * (freshest metadata wins) and reuses the id. Returns the entry's xml:id.
 */
export const upsertBiblEntry = (doc: Document, item: CslJsonItem, uri: string): string => {
  const listBibl = ensureStandOffListBibl(doc);
  const id = biblIdForUri(uri);

  let bibl = Array.from(listBibl.children).find(
    (child) => child.localName === 'bibl' && child.getAttribute('xml:id') === id,
  );
  if (!bibl) {
    bibl = doc.createElement('bibl');
    bibl.setAttribute('xml:id', id);
    listBibl.appendChild(bibl);
  }
  bibl.setAttribute('corresp', uri);

  let note = getDirectChild(bibl, 'note');
  if (!note) {
    note = doc.createElement('note');
    note.setAttribute('type', 'csl-json');
    note.setAttribute('resp', 'zotero');
    bibl.appendChild(note);
  }
  writeJsonPayload(note, item);

  return id;
};

/** Reads all bibliography entries, keyed by xml:id. Entries with unparsable JSON are skipped. */
export const readBiblEntries = (doc: Document): Map<string, BiblEntry> => {
  const entries = new Map<string, BiblEntry>();
  const listBibl = findStandOffListBibl(doc);
  if (!listBibl) return entries;

  for (const bibl of Array.from(listBibl.children)) {
    if (bibl.localName !== 'bibl') continue;
    const id = bibl.getAttribute('xml:id');
    const uri = bibl.getAttribute('corresp');
    const note = getDirectChild(bibl, 'note');
    if (!id || !uri || !note) continue;
    try {
      const csl = readJsonPayload(note) as CslJsonItem;
      if (csl) entries.set(id, { id, uri, csl });
    } catch {
      // Corrupt snapshot: leave the entry in the file but don't surface it.
    }
  }
  return entries;
};

/** Finds all citation references (<bibl type="zotero-ref">) under the given root. */
export const collectCitationRefs = (root: Element | Document): CitationRef[] => {
  const refs: CitationRef[] = [];
  for (const element of Array.from(root.getElementsByTagName('bibl'))) {
    if (element.getAttribute('type') !== ZOTERO_REF_TYPE) continue;
    const corresp = element.getAttribute('corresp') ?? '';
    if (!corresp.startsWith('#')) continue;
    refs.push({
      biblId: corresp.slice(1),
      locator: element.getAttribute('data-locator') ?? undefined,
      locatorType: element.getAttribute('data-locator-type') ?? undefined,
      prefix: element.getAttribute('data-prefix') ?? undefined,
      suffix: element.getAttribute('data-suffix') ?? undefined,
      element,
    });
  }
  return refs;
};

/**
 * Removes bibliography entries that no citation in the document references anymore
 * (e.g. after the last footnote citing a work was deleted). An empty listBibl/standOff
 * is removed entirely so untouched files stay byte-identical.
 */
export const garbageCollectBibl = (doc: Document): void => {
  const listBibl = findStandOffListBibl(doc);
  if (!listBibl) return;

  const referenced = new Set(collectCitationRefs(doc).map((ref) => ref.biblId));
  for (const bibl of Array.from(listBibl.children)) {
    if (bibl.localName !== 'bibl') continue;
    const id = bibl.getAttribute('xml:id');
    if (id && !referenced.has(id)) bibl.remove();
  }

  if (listBibl.children.length === 0) {
    const standOff = listBibl.parentElement;
    listBibl.remove();
    if (standOff && standOff.children.length === 0) standOff.remove();
  }
};

/**
 * Copies the <standOff> block from an existing companion document into a freshly built
 * shell (as first child of the root). Used by the reindex flow, which otherwise rebuilds
 * the shell from the source and would drop the bibliography.
 */
export const carryOverStandOff = (fromDoc: Document, toDoc: Document): void => {
  const standOff = getDirectChild(fromDoc.documentElement, 'standOff');
  if (!standOff) return;
  const imported = toDoc.importNode(standOff, true);
  toDoc.documentElement.insertBefore(imported, toDoc.documentElement.firstChild);
};

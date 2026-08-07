/**
 * Collect `<note>` spans from serialized source-unit XML and blind them for
 * the AI translation pass — same collect/blind pattern as sourceUnitDates.ts,
 * but each note is translated independently and re-inserted as a footnote
 * rather than reconstituted from structured data.
 */

const TEI_NS = 'http://www.tei-c.org/ns/1.0';

export interface SourceUnitNoteHit {
  /** 0-based index in document order within the unit — matches {{note:N}}. */
  index: number;
  /** Serialized inner XML (children only) of the note, before any blinding. */
  innerXml: string;
}

const elementsByLocalName = (root: Document | Element, localName: string): Element[] => {
  const namespaced =
    'getElementsByTagNameNS' in root
      ? Array.from(root.getElementsByTagNameNS(TEI_NS, localName))
      : [];
  const plain = Array.from(root.getElementsByTagName(localName));
  const seen = new Set<Element>();
  const result: Element[] = [];
  for (const el of [...namespaced, ...plain]) {
    if (!seen.has(el)) {
      seen.add(el);
      result.push(el);
    }
  }
  return result;
};

/** True when `el` is nested inside another `<note>` — nested notes are flattened, not split out. */
const isInsideAnotherNote = (el: Element): boolean => {
  let cur = el.parentElement;
  while (cur) {
    const tag = cur.localName || cur.tagName.toLowerCase();
    if (tag === 'note') return true;
    cur = cur.parentElement;
  }
  return false;
};

const serializeChildren = (el: Element): string =>
  Array.from(el.childNodes)
    .map((node) => new XMLSerializer().serializeToString(node))
    .join('');

/**
 * Collect top-level `<note>` elements from serialized source-unit XML, in
 * document order. A note nested inside another note is left alone — its
 * content stays as part of the parent note's own `innerXml` and is
 * translated as plain prose along with it (nested notes are a non-goal).
 */
export const collectNotesFromSourceUnitXml = (sourceUnitXml: string): SourceUnitNoteHit[] => {
  if (!sourceUnitXml.trim() || !sourceUnitXml.includes('<note')) return [];
  const doc = new DOMParser().parseFromString(sourceUnitXml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return [];

  const notes = elementsByLocalName(doc, 'note').filter((el) => !isInsideAnotherNote(el));
  return notes.map((el, index) => ({
    index,
    innerXml: serializeChildren(el),
  }));
};

/**
 * Replace every top-level `<note>…</note>` in the source unit with a bare
 * `{{note:N}}` text node (document order, matching
 * `collectNotesFromSourceUnitXml`'s indices). The model then never sees note
 * prose mixed into the main text — it can only copy the placeholder through.
 *
 * Returns the rewritten XML, or the original string if parsing fails / no notes.
 */
export const replaceNotesWithPlaceholdersInSourceXml = (sourceUnitXml: string): string => {
  if (!sourceUnitXml.trim() || !sourceUnitXml.includes('<note')) return sourceUnitXml;
  const doc = new DOMParser().parseFromString(sourceUnitXml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return sourceUnitXml;

  const notes = elementsByLocalName(doc, 'note').filter((el) => !isInsideAnotherNote(el));
  if (notes.length === 0) return sourceUnitXml;

  notes.forEach((el, index) => {
    const placeholder = doc.createTextNode(`{{note:${index}}}`);
    el.parentNode?.replaceChild(placeholder, el);
  });

  // serializeToString on the document element keeps the unit root (p/div).
  const root = doc.documentElement;
  if (!root) return sourceUnitXml;
  return new XMLSerializer().serializeToString(root);
};

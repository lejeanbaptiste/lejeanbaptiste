import { carryOverStandOff, garbageCollectBibl } from './citations/zoteroBibliography';
import { TEI_NS } from './teiHeaderXml';

/** Matches elements by local name whether the document is TEI-namespaced or plain (e.g. Orlando). */
const getElementsByLocalName = (root: Document | Element, localName: string): Element[] => {
  const namespaced = Array.from(root.getElementsByTagNameNS(TEI_NS, localName));
  const plain = Array.from(root.getElementsByTagName(localName));
  const seen = new Set<Element>();
  const result: Element[] = [];
  for (const element of [...namespaced, ...plain]) {
    if (!seen.has(element)) {
      seen.add(element);
      result.push(element);
    }
  }
  return result;
};

const getAllElements = (doc: Document): Element[] => Array.from(doc.getElementsByTagName('*'));

/** Header content (teiHeader, Orlando ORLANDOHEADER) is metadata, not translatable text —
 * its <p>/<div> elements must never be treated as alignment units. */
const isInsideHeader = (element: Element): boolean => {
  let current: Element | null = element;
  while (current) {
    const name = current.localName.toLowerCase();
    if (name === 'teiheader' || name === 'orlandoheader') return true;
    current = current.parentElement;
  }
  return false;
};

/** Alignment-unit elements eligible for translation: at the configured level, outside the header. */
export const getTranslatableUnits = (doc: Document, alignmentUnit: 'div' | 'p'): Element[] =>
  getElementsByLocalName(doc, alignmentUnit).filter((element) => !isInsideHeader(element));

/** Whitespace-collapsed text content used for hashing and previews. */
export const normalizeUnitText = (element: Element): string =>
  (element.textContent ?? '').replace(/\s+/g, ' ').trim();

/**
 * Content hash used as the birth value of an alignment unit's xml:id (and stored in the
 * recovery snapshot). Deliberately never recomputed once an id exists — the id must stay
 * stable across content edits; the hash only makes assignment idempotent when an id is
 * missing and the content is unchanged.
 */
export const hashUnitContent = async (element: Element): Promise<string> => {
  const data = new TextEncoder().encode(normalizeUnitText(element));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest).slice(0, 8))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const findAlignmentUnitsMissingIds = (
  doc: Document,
  alignmentUnit: 'div' | 'p',
): Element[] =>
  getTranslatableUnits(doc, alignmentUnit).filter((element) => !element.getAttribute('xml:id'));

const collectExistingIds = (doc: Document): Set<string> => {
  const ids = new Set<string>();
  for (const element of getAllElements(doc)) {
    const id = element.getAttribute('xml:id');
    if (id) ids.add(id);
  }
  return ids;
};

export interface AssignedId {
  id: string;
  element: Element;
}

/**
 * Assigns collision-safe xml:id values to the given elements, mutating them in place.
 * Ids are content-hash-at-birth (`twu-<hash16>`): re-running over an unchanged paragraph
 * whose id was lost regenerates the identical id, so companion-file links self-heal.
 * Identical content gets an occurrence suffix (`-2`, `-3`…) in document order.
 */
export const assignMissingIds = async (
  doc: Document,
  elements: Element[],
  idPrefix = 'twu',
): Promise<AssignedId[]> => {
  const existingIds = collectExistingIds(doc);
  const assigned: AssignedId[] = [];

  for (const element of elements) {
    const hash = await hashUnitContent(element);
    const base = `${idPrefix}-${hash}`;
    let candidate = base;
    for (let occurrence = 2; existingIds.has(candidate); occurrence += 1) {
      candidate = `${base}-${occurrence}`;
    }
    element.setAttribute('xml:id', candidate);
    existingIds.add(candidate);
    assigned.push({ id: candidate, element });
  }

  return assigned;
};

export interface DuplicateIdGroup {
  id: string;
  /** All elements sharing this id, in document order. The first keeps the id on reindex. */
  elements: Element[];
}

/** Elements that share the same xml:id at the alignment-unit level — e.g. after an editor
 * split copied the original element's attributes (including xml:id) onto both halves. */
export const findDuplicateAlignmentUnitIds = (
  doc: Document,
  alignmentUnit: 'div' | 'p',
): DuplicateIdGroup[] => {
  const byId = new Map<string, Element[]>();
  for (const unit of getTranslatableUnits(doc, alignmentUnit)) {
    const id = unit.getAttribute('xml:id');
    if (!id) continue;
    const list = byId.get(id) ?? [];
    list.push(unit);
    byId.set(id, list);
  }
  return Array.from(byId.entries())
    .filter(([, elements]) => elements.length > 1)
    .map(([id, elements]) => ({ id, elements }));
};

export interface ReindexResult {
  /** Elements that lost a duplicated id and were assigned a fresh one. */
  reassigned: AssignedId[];
  /** Elements that had no id at all and were assigned one. */
  newlyAssigned: AssignedId[];
}

/**
 * Fixes alignment-unit ids in the source document: when a duplicate id is found (e.g. from
 * splitting a paragraph in the editor, which copies xml:id onto both halves), the first
 * occurrence keeps the id and the rest are cleared and reassigned a fresh one — same
 * collision-safe assignment as the initial bootstrap. Also assigns ids to any units that
 * never had one. Mutates doc in place.
 */
export const reindexAlignmentUnits = async (
  doc: Document,
  alignmentUnit: 'div' | 'p',
  idPrefix = 'twu',
): Promise<ReindexResult> => {
  const duplicates = findDuplicateAlignmentUnitIds(doc, alignmentUnit);
  const toReassign = new Set<Element>();
  for (const group of duplicates) {
    for (const element of group.elements.slice(1)) {
      element.removeAttribute('xml:id');
      toReassign.add(element);
    }
  }

  const missing = findAlignmentUnitsMissingIds(doc, alignmentUnit);
  const assigned = await assignMissingIds(doc, missing, idPrefix);

  return {
    reassigned: assigned.filter((a) => toReassign.has(a.element)),
    newlyAssigned: assigned.filter((a) => !toReassign.has(a.element)),
  };
};

/**
 * Clones the structural shell of the source document (all ancestors of each alignment-unit
 * element, e.g. divs/sections/headings) down to and including the alignment-unit elements
 * themselves, stamping @corresp on each aligned unit and clearing its content for free-form
 * translation authoring. Elements not on the path to an alignment unit (and content nested
 * inside an alignment unit) are not copied.
 */
export const createTranslationShell = (
  sourceDoc: Document,
  sourceFileName: string,
  lang: string,
  alignmentUnit: 'div' | 'p',
): Document => {
  const alignmentUnits = getTranslatableUnits(sourceDoc, alignmentUnit).filter((element) =>
    element.getAttribute('xml:id'),
  );

  const translationDoc = document.implementation.createDocument(null, 'translation', null);
  const root = translationDoc.documentElement;
  root.setAttribute('xml:lang', lang);
  root.setAttribute('corresp', sourceFileName);

  const cloneCache = new Map<Element, Element>();

  const cloneShellFor = (sourceElement: Element): Element => {
    const cached = cloneCache.get(sourceElement);
    if (cached) return cached;

    const clone = translationDoc.createElement(sourceElement.tagName);
    for (const attr of Array.from(sourceElement.attributes)) {
      if (attr.name === 'xml:id') continue;
      clone.setAttribute(attr.name, attr.value);
    }
    cloneCache.set(sourceElement, clone);

    const parent = sourceElement.parentElement;
    if (parent && parent !== sourceDoc.documentElement) {
      const parentClone = cloneShellFor(parent);
      parentClone.appendChild(clone);
    } else {
      root.appendChild(clone);
    }

    return clone;
  };

  for (const unit of alignmentUnits) {
    const unitId = unit.getAttribute('xml:id');
    const unitClone = cloneShellFor(unit);
    unitClone.setAttribute('corresp', `${sourceFileName}#${unitId}`);
  }

  return translationDoc;
};

/**
 * Rebuilds the translation shell against the current (post-reindex) source structure,
 * migrating existing translated content across by matching @corresp ids. Units whose id
 * survived reindexing keep their translated content; units that are newly split off (a
 * fresh id with no matching prior content) start empty, ready to be translated separately
 * rather than inheriting a copy of the paragraph they were split from.
 */
export const resyncTranslationShell = (
  sourceDoc: Document,
  existingTranslationDoc: Document,
  sourceFileName: string,
  lang: string,
  alignmentUnit: 'div' | 'p',
): Document => {
  const freshShell = createTranslationShell(sourceDoc, sourceFileName, lang, alignmentUnit);

  const existingContentByCorresp = new Map<string, string>();
  for (const unit of getElementsByLocalName(existingTranslationDoc, alignmentUnit)) {
    const corresp = unit.getAttribute('corresp');
    if (corresp && unit.innerHTML.trim()) {
      existingContentByCorresp.set(corresp, unit.innerHTML);
    }
  }

  for (const unit of getElementsByLocalName(freshShell, alignmentUnit)) {
    const corresp = unit.getAttribute('corresp');
    const existingContent = corresp ? existingContentByCorresp.get(corresp) : undefined;
    if (existingContent) unit.innerHTML = existingContent;
  }

  // The fresh shell is built from the source only, so document-level content like the
  // citation bibliography must be migrated explicitly; GC drops entries whose citing
  // footnotes did not survive the resync.
  carryOverStandOff(existingTranslationDoc, freshShell);
  garbageCollectBibl(freshShell);

  return freshShell;
};

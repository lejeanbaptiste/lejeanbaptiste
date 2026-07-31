import { DOMParser } from '@xmldom/xmldom';
import fs from 'fs/promises';
import path from 'path';
import {
  ENTITY_KINDS,
  entityElementMatchesKind,
  getDatabaseId,
  isEntityDatabase,
  parseIsoYear,
  type EntityKind,
} from '../../../../packages/cwrc-leafwriter/src/autoTagging/entities';

/**
 * Read-only mirror of a few `entities.ts` helpers that assume `Element.children`
 * (element-only child access). `@xmldom/xmldom` — the DOM implementation available
 * in this plain Node process, unlike the browser/jsdom environment `entities.ts`
 * normally runs in — only implements `childNodes` (all node types), so those
 * helpers can't be reused as-is here. Kept intentionally small: this is the only
 * bit of entities.ts's traversal logic that needed a Node-safe rewrite.
 */
const elementChildren = (node: Element): Element[] =>
  Array.from(node.childNodes).filter((n): n is Element => n.nodeType === 1);

/** `@xmldom/xmldom` returns `""` (not `null`) for a missing attribute, unlike a browser's DOMParser — normalize so `?? fallback` chains behave as intended. */
const attr = (el: Element, name: string): string | null => el.getAttribute(name) || null;

const listMatchesKind = (list: Element, kind: EntityKind): boolean => {
  const config = ENTITY_KINDS[kind];
  if (list.localName !== config.list) return false;
  const type = attr(list, 'type');
  return config.listType ? type === config.listType : !type;
};

const entityElements = (doc: Document, kind: EntityKind): Element[] => {
  const config = ENTITY_KINDS[kind];
  const lists = Array.from(doc.getElementsByTagName(config.list)).filter((list) =>
    listMatchesKind(list, kind),
  );
  return lists.flatMap((list) =>
    elementChildren(list).filter((item) => entityElementMatchesKind(item, kind)),
  );
};

/**
 * Raw, un-localized precision marker exactly as entityOps.ts's
 * `setUserEntityDate`/`DatePrecision` stores it (`'b.'`, `'b. ca.'`, `'fl.'`,
 * `'d.'`, `'d. ca.'`, `'active'`, `'active ca.'`, `'active to'`,
 * `'active to ca.'`, or null). Left as the stored string rather than a typed
 * enum here — display-side localization (English vs. other languages) is the
 * client's job, not this read layer's.
 */
export interface EntityDates {
  startYear: number | null;
  endYear: number | null;
  startPrecision: string | null;
  endPrecision: string | null;
}

export interface EntitySummary {
  id: string;
  kind: EntityKind;
  /** All name/title elements found on the entity, in document order. */
  names: { lang: string | null; text: string }[];
  primaryName: string | null;
  romanizedName: string | null;
  description: string | null;
  dates: EntityDates | null;
  familyName: string | null;
  authorityIds: { type: string | null; value: string }[];
}

const textOf = (el: Element | undefined): string | null => {
  const text = el?.textContent?.trim();
  return text ? text : null;
};

/**
 * Person entities store birth/death as separate elements, each with its own
 * `@precision` (entityOps.ts's `setUserEntityDate`). Place/org/work have no
 * birth/death in TEI, so they keep years in a single `note[type=dates]` with
 * `@from`/`@to` (or `@notBefore`/`@notAfter`, or `"START/END"` text) and
 * `@fromPrecision`/`@toPrecision`/`@precision` — mirrors entityOps.ts's
 * `activeWorkDate`.
 */
const readEntityDates = (children: Element[]): EntityDates | null => {
  const birthEl = children.find((c) => c.localName === 'birth');
  const deathEl = children.find((c) => c.localName === 'death');
  if (birthEl || deathEl) {
    return {
      startYear: parseIsoYear(birthEl && attr(birthEl, 'when')),
      endYear: parseIsoYear(deathEl && attr(deathEl, 'when')),
      startPrecision: birthEl ? attr(birthEl, 'precision') : null,
      endPrecision: deathEl ? attr(deathEl, 'precision') : null,
    };
  }

  const datesNote = children.find(
    (c) => c.localName === 'note' && attr(c, 'type') === 'dates',
  );
  if (!datesNote) return null;

  const precision = attr(datesNote, 'precision');
  const startPrecision = attr(datesNote, 'fromPrecision') ?? precision;
  const endPrecision = attr(datesNote, 'toPrecision') ?? precision;

  const when = attr(datesNote, 'when');
  if (when) {
    return { startYear: parseIsoYear(when), endYear: null, startPrecision, endPrecision: null };
  }

  const parts = (datesNote.textContent ?? '').trim().split('/');
  const startRaw = attr(datesNote, 'from') ?? attr(datesNote, 'notBefore') ?? parts[0];
  const endRaw = attr(datesNote, 'to') ?? attr(datesNote, 'notAfter') ?? parts[1];
  const startYear = parseIsoYear(startRaw);
  const endYear = parseIsoYear(endRaw);
  if (startYear == null && endYear == null) return null;
  return { startYear, endYear, startPrecision, endPrecision };
};

const buildEntitySummary = (el: Element, kind: EntityKind): EntitySummary => {
  const config = ENTITY_KINDS[kind];
  const children = elementChildren(el);

  const nameEls = children.filter((c) => c.localName === config.name);
  const names = nameEls
    .map((n) => ({ lang: attr(n, 'xml:lang'), text: (n.textContent ?? '').trim() }))
    .filter((n) => n.text);
  const primaryEl = nameEls.find((n) => attr(n, 'type') === 'primary') ?? nameEls[0];
  const romanizedEl = nameEls.find((n) => (attr(n, 'xml:lang') ?? '').endsWith('-Latn'));

  const notes = children.filter((c) => c.localName === 'note');
  const descriptionNote =
    notes.find((n) => attr(n, 'type') === 'description') ?? notes.find((n) => !attr(n, 'type'));
  const familyNameNote = notes.find((n) => attr(n, 'type') === 'familyName');

  const dates = readEntityDates(children);

  const authorityIds = children
    .filter((c) => c.localName === 'idno')
    .map((idno) => ({
      type: attr(idno, 'type'),
      value: (idno.textContent ?? '').trim(),
    }));

  return {
    id: attr(el, 'xml:id') ?? '',
    kind,
    names,
    primaryName: textOf(primaryEl),
    romanizedName: textOf(romanizedEl),
    description: textOf(descriptionNote),
    dates,
    familyName: textOf(familyNameNote),
    authorityIds,
  };
};

const stripDiacritics = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Diacritic-, case-, and space-insensitive, per the candidate window's search rules. */
const normalizeForSearch = (value: string): string =>
  stripDiacritics(value).toLowerCase().replace(/\s+/g, '');

export const ALL_ENTITY_KINDS = Object.keys(ENTITY_KINDS) as EntityKind[];

export const isEntityKind = (value: string): value is EntityKind =>
  (ALL_ENTITY_KINDS as string[]).includes(value);

export class ProjectEntitiesUnavailableError extends Error {}

const readEntitiesDocument = async (projectRoot: string): Promise<Document> => {
  const entitiesPath = path.join(projectRoot, 'entities.xml');
  let xml: string;
  try {
    xml = await fs.readFile(entitiesPath, 'utf8');
  } catch {
    throw new ProjectEntitiesUnavailableError(`No entities.xml found at ${entitiesPath}`);
  }
  const doc = new DOMParser().parseFromString(xml, 'text/xml') as unknown as Document;
  if (!isEntityDatabase(doc)) {
    throw new ProjectEntitiesUnavailableError('entities.xml is not a valid LJB entity database');
  }
  return doc;
};

export interface ProjectStatus {
  entitiesFound: boolean;
  databaseId: string | null;
}

/**
 * Reads whichever of `roots` have an `entities.xml`, skipping any that
 * don't rather than failing outright — a project not being open, or the
 * central database not yet existing, are both normal, expected states here,
 * not errors.
 */
const readAvailableEntitiesDocuments = async (
  roots: string[],
): Promise<{ root: string; doc: Document }[]> => {
  const docs: { root: string; doc: Document }[] = [];
  for (const root of roots) {
    try {
      docs.push({ root, doc: await readEntitiesDocument(root) });
    } catch (error) {
      if (error instanceof ProjectEntitiesUnavailableError) continue;
      throw error;
    }
  }
  return docs;
};

/** Reports the first available root's info — `roots` is expected in priority order (project before central). */
export const readCombinedStatus = async (roots: string[]): Promise<ProjectStatus> => {
  const [found] = await readAvailableEntitiesDocuments(roots);
  if (!found) return { entitiesFound: false, databaseId: null };
  return { entitiesFound: true, databaseId: getDatabaseId(found.doc) };
};

/** Searches every available root (project + central), de-duplicating by id — an entity synced to both isn't shown twice. */
export const searchEntities = async (
  roots: string[],
  query: string,
  kinds: EntityKind[],
  limit: number,
): Promise<EntitySummary[]> => {
  const docs = await readAvailableEntitiesDocuments(roots);
  const needle = normalizeForSearch(query);
  const out: EntitySummary[] = [];
  const seenIds = new Set<string>();

  for (const { doc } of docs) {
    for (const kind of kinds) {
      for (const el of entityElements(doc, kind)) {
        const summary = buildEntitySummary(el, kind);
        if (seenIds.has(summary.id)) continue;
        const haystack = [...summary.names.map((n) => n.text), summary.description ?? '']
          .map(normalizeForSearch)
          .join(' ');
        if (haystack.includes(needle)) {
          seenIds.add(summary.id);
          out.push(summary);
          if (out.length >= limit) return out;
        }
      }
    }
  }
  return out;
};

/** Checks every available root (project + central) for a matching id — project takes priority on order. */
export const getEntityById = async (
  roots: string[],
  id: string,
): Promise<EntitySummary | null> => {
  const docs = await readAvailableEntitiesDocuments(roots);
  for (const { doc } of docs) {
    for (const kind of ALL_ENTITY_KINDS) {
      for (const el of entityElements(doc, kind)) {
        if (el.getAttribute('xml:id') === id) return buildEntitySummary(el, kind);
      }
    }
  }
  return null;
};

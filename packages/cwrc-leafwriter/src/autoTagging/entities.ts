/**
 * Model for the entity database `entities.xml` (Phase 3): a TEI standoff
 * personography/placeography that holds disambiguated entities with typed local
 * ids and authority `<idno>`s. Mentions point in with a bare `@key`.
 */

import { latnLangFor } from '../utilities/languageCodes';
import type { NameTypeId } from './nameTypes';

const TEI_NS = 'http://www.tei-c.org/ns/1.0';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';

export const DATABASE_IDNO_TYPE = 'ljb-entity-database';
export const LJB_AUTOTAG_RESP = '#ljb-autotag';
export const LJB_RESP = 'le-jean-baptiste';

/** `<note type>` that records an entity's last-modified timestamp (for CEDB↔PEDB sync). */
export const CHANGED_NOTE_TYPE = 'ljb-changed';

/** @deprecated Use LJB_AUTOTAG_RESP */
export const LEAFWRITER_AUTOTAG_RESP = LJB_AUTOTAG_RESP;

export type EntityKind = 'person' | 'place' | 'org' | 'work' | 'office';

interface KindConfig {
  /** Containing TEI list element. */
  list: string;
  /** Entity item element. */
  item: string;
  /** Name element written from the surface form. */
  name: string;
  /** xml:id prefix and the id-scan pattern. */
  idPrefix: string;
  /** Distinguishes multiple TEI lists with the same element name. */
  listType?: string;
  /** Distinguishes application kinds sharing the same TEI item element. */
  itemType?: string;
}

export const ENTITY_KINDS: Record<EntityKind, KindConfig> = {
  person: { list: 'listPerson', item: 'person', name: 'persName', idPrefix: 'person' },
  place: { list: 'listPlace', item: 'place', name: 'placeName', idPrefix: 'place' },
  org: { list: 'listOrg', item: 'org', name: 'orgName', idPrefix: 'org' },
  work: { list: 'listBibl', item: 'bibl', name: 'title', idPrefix: 'work' },
  office: {
    list: 'listOrg',
    listType: 'offices',
    item: 'org',
    itemType: 'office',
    name: 'orgName',
    idPrefix: 'office',
  },
};

/** Mention tag name → entity kind. */
export const TAG_TO_KIND: Record<string, EntityKind> = {
  persName: 'person',
  placeName: 'place',
  orgName: 'org',
  title: 'work',
  bibl: 'work',
  roleName: 'office',
};

const ID_WIDTH = 6;

export interface AuthorityId {
  /** Canonical type, e.g. CBDB, Wikidata, VIAF, DILA, CHGIS, GeoNames. */
  type: string;
  value: string;
}

export interface NewEntity {
  /** Surface/display name for the entity. */
  name: string;
  /** xml:lang for the primary name (e.g. "zh-Hant"); omitted = no attribute (legacy behavior). */
  nameLang?: string;
  /** Latin-script name, written as a second name element with xml:lang "<primary>-Latn". */
  romanizedName?: string;
  /** Extra alternative names (e.g. the document surface form), deduped against name/romanizedName. */
  altNames?: { text: string; type?: NameTypeId; lang?: string }[];
  authorityIds?: AuthorityId[];
  /** Optional compact authority-cache payload, stored as a JSON note. */
  cache?: { source: string; data: unknown; when?: string };
  /** One-line human-written description, stored as `<note type="description">` for later disambiguation. */
  description?: string;
  /** Birth/founding year (signed; negative = BCE). Persons: `<birth when>`; others: `<note type="dates">`. */
  startYear?: number;
  /** Death/dissolution year (signed; negative = BCE). Persons: `<death when>`; others: `<note type="dates">`. */
  endYear?: number;
  /** Historical dynasties/states associated with a person. */
  nationality?: { id: string; canonicalId: string; label: string; sourceIds?: string[] }[];
  /** Source-scoped CBDB office classification nodes retained by reference. */
  officeTypeIds?: string[];
}

/** Format a signed year as an ISO/W3C `@when` year, e.g. -155 -> "-0155", 1990 -> "1990". */
export function isoYearString(year: number): string {
  const abs = String(Math.abs(year)).padStart(4, '0');
  return year < 0 ? `-${abs}` : abs;
}

/** Parse an ISO `@when` year back to a signed number, tolerating full dates ("1990-01-01"). */
export function parseIsoYear(when: string | null | undefined): number | null {
  if (!when) return null;
  const match = when.trim().match(/^(-?\d{1,4})(?:-|$)/);
  return match ? parseInt(match[1]!, 10) : null;
}

/** A random UUID (v4 when available), used for database fingerprints and entity ids. */
function randomUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 6)}`;
}

/** Mint a new database fingerprint id. */
export function newDatabaseId(): string {
  return randomUuid();
}

/**
 * Mint a fresh, collision-safe entity id: kind prefix + UUID
 * (e.g. `person-a1b2c3d4-…`). Kind-prefixing keeps the id a legal `xml:id`
 * (an NCName must not start with a digit) and human-debuggable. Used for both
 * central and project databases so two machines never mint the same id for
 * different people. Sequential ids minted by earlier versions are grandfathered
 * (see `nextEntityId`), not rewritten.
 */
export function mintEntityId(kind: EntityKind): string {
  return `${ENTITY_KINDS[kind].idPrefix}-${randomUuid()}`;
}

/** An empty entity file: TEI standoff with the four core lists. */
export function createEntitiesScaffold(databaseId: string = newDatabaseId()): string {
  const lists = Object.values(ENTITY_KINDS)
    .map((k) => `<${k.list}${k.listType ? ` type="${k.listType}"` : ''}/>`)
    .join('\n      ');
  return `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="${TEI_NS}">
  <teiHeader>
    <fileDesc>
      <titleStmt><title>Entity database</title></titleStmt>
      <publicationStmt>
        <p>Generated by Le Jean-Baptiste.</p>
        <idno type="${DATABASE_IDNO_TYPE}">${databaseId}</idno>
      </publicationStmt>
      <sourceDesc><p>Entity authority file.</p></sourceDesc>
    </fileDesc>
  </teiHeader>
  <standOff>
      ${lists}
  </standOff>
</TEI>`;
}

const parser = () => new DOMParser();

export function parseEntities(xml: string): Document {
  return parser().parseFromString(xml, 'application/xml');
}

export function serializeEntities(doc: Document): string {
  return new XMLSerializer().serializeToString(doc);
}

/** Read the database fingerprint from the TEI header. */
export function getDatabaseId(doc: Document): string | null {
  const idnos = doc.getElementsByTagName('idno');
  for (let i = 0; i < idnos.length; i++) {
    const el = idnos.item(i);
    if (el?.getAttribute('type') === DATABASE_IDNO_TYPE) {
      return el.textContent?.trim() || null;
    }
  }
  return null;
}

/** True when the document is a valid LJB entity database file. */
export function isEntityDatabase(doc: Document): boolean {
  if (!doc.documentElement || doc.documentElement.localName !== 'TEI') return false;
  if (!doc.getElementsByTagName('standOff')[0]) return false;
  return Boolean(getDatabaseId(doc));
}

/** Every xml:id currently in the document. */
function allIds(doc: Document): Set<string> {
  const ids = new Set<string>();
  const walker = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_ELEMENT);
  for (let node = walker.currentNode as Element | null; node; node = walker.nextNode() as Element | null) {
    const id = node.getAttribute('xml:id');
    if (id) ids.add(id);
  }
  return ids;
}

/**
 * Next unused id for a kind: scan existing ids of that type, take the highest
 * suffix + 1, and skip any id already present (collision-safe). Ids are never
 * derived from names.
 */
export function nextEntityId(doc: Document, kind: EntityKind): string {
  const { idPrefix } = ENTITY_KINDS[kind];
  const ids = allIds(doc);
  const re = new RegExp(`^${idPrefix}-(\\d+)$`);
  let max = 0;
  for (const id of ids) {
    const match = re.exec(id);
    if (match) max = Math.max(max, parseInt(match[1]!, 10));
  }
  let next = max + 1;
  let candidate = `${idPrefix}-${String(next).padStart(ID_WIDTH, '0')}`;
  while (ids.has(candidate)) {
    next += 1;
    candidate = `${idPrefix}-${String(next).padStart(ID_WIDTH, '0')}`;
  }
  return candidate;
}

/** The `<note type="ljb-changed">` child of an entity item, if present. */
function changedNote(item: Element): Element | null {
  for (const child of Array.from(item.children)) {
    if (child.localName === 'note' && child.getAttribute('type') === CHANGED_NOTE_TYPE) {
      return child;
    }
  }
  return null;
}

/** Read an entity element's last-modified ISO timestamp, or null when unstamped. */
export function getEntityChanged(item: Element): string | null {
  return changedNote(item)?.getAttribute('when')?.trim() || null;
}

/**
 * Stamp an entity element's last-modified timestamp (default: now), creating or
 * updating its `<note type="ljb-changed" when="…"/>`. The note is kept last so
 * it never displaces the first description/cache/dates note that other code
 * reads via `getElementsByTagName('note')[0]`.
 */
export function touchEntity(item: Element, when: string = new Date().toISOString()): void {
  const existing = changedNote(item);
  if (existing) {
    existing.setAttribute('when', when);
    return;
  }
  const note = item.ownerDocument.createElementNS(TEI_NS, 'note');
  note.setAttribute('type', CHANGED_NOTE_TYPE);
  note.setAttribute('when', when);
  item.appendChild(note);
}

/** Add or replace the authority-cache payload for an existing entity/source. */
export function setAuthorityCache(
  doc: Document,
  entityId: string,
  source: string,
  data: unknown,
  when: string = new Date().toISOString(),
): void {
  const item = findEntity(doc, entityId);
  if (!item) return;
  const existing = Array.from(item.children).find(
    (child) =>
      child.localName === 'note' &&
      child.getAttribute('type') === 'authority-cache' &&
      child.getAttribute('source') === source,
  );
  const note = existing ?? doc.createElementNS(TEI_NS, 'note');
  note.setAttribute('type', 'authority-cache');
  note.setAttribute('source', source);
  note.setAttribute('resp', LJB_RESP);
  note.setAttribute('when', when);
  note.textContent = JSON.stringify(data);
  if (!existing) item.appendChild(note);
}

/**
 * Stamp every entity that has no `changed` timestamp yet (default: now), so
 * records minted before this feature get a baseline for CEDB↔PEDB sync. Returns
 * how many were stamped.
 */
export function backfillEntityTimestamps(
  doc: Document,
  when: string = new Date().toISOString(),
): number {
  let count = 0;
  for (const kind of Object.keys(ENTITY_KINDS) as EntityKind[]) {
    for (const item of entityElements(doc, kind)) {
      if (!getEntityChanged(item)) {
        touchEntity(item, when);
        count += 1;
      }
    }
  }
  return count;
}

function listMatchesKind(list: Element, kind: EntityKind): boolean {
  const config = ENTITY_KINDS[kind];
  if (list.localName !== config.list) return false;
  const type = list.getAttribute('type');
  return config.listType ? type === config.listType : !type;
}

export function entityElementMatchesKind(item: Element, kind: EntityKind): boolean {
  const config = ENTITY_KINDS[kind];
  if (item.localName !== config.item) return false;
  const type = item.getAttribute('type');
  return config.itemType ? type === config.itemType : type !== 'office';
}

export function entityKindOfElement(item: Element): EntityKind | null {
  for (const kind of Object.keys(ENTITY_KINDS) as EntityKind[]) {
    if (entityElementMatchesKind(item, kind)) return kind;
  }
  return null;
}

/** Direct entity children in the kind-specific TEI list. */
export function entityElements(doc: Document, kind: EntityKind): Element[] {
  const config = ENTITY_KINDS[kind];
  const lists = Array.from(doc.getElementsByTagName(config.list))
    .filter((list) => listMatchesKind(list, kind));
  return lists.flatMap((list) =>
    Array.from(list.children).filter((item) => entityElementMatchesKind(item, kind)),
  );
}

/** Get (creating if needed) the list element for a kind. */
export function getEntityList(doc: Document, kind: EntityKind): Element {
  const config = ENTITY_KINDS[kind];
  const existing = Array.from(doc.getElementsByTagName(config.list))
    .find((list) => listMatchesKind(list, kind));
  if (existing) return existing;
  const standOff =
    doc.getElementsByTagName('standOff')[0] ?? doc.documentElement;
  const el = doc.createElementNS(TEI_NS, config.list);
  if (config.listType) el.setAttribute('type', config.listType);
  standOff.appendChild(el);
  return el;
}

/**
 * Add an entity to the file and return its new local id. `resp` marks
 * provenance (e.g. "#ljb-autotag" for machine auto-resolution).
 */
export function addEntity(
  doc: Document,
  kind: EntityKind,
  entity: NewEntity,
  resp?: string,
): { id: string; element: Element } {
  const config = ENTITY_KINDS[kind];
  const id = mintEntityId(kind);

  const item = doc.createElementNS(TEI_NS, config.item);
  item.setAttributeNS(XML_NS, 'xml:id', id);
  if (config.itemType) item.setAttribute('type', config.itemType);
  if (resp) item.setAttribute('resp', resp);

  const name = doc.createElementNS(TEI_NS, config.name);
  name.textContent = entity.name;
  if (entity.nameLang) {
    name.setAttributeNS(XML_NS, 'xml:lang', entity.nameLang);
    name.setAttribute('type', 'primary');
  }
  item.appendChild(name);

  const writtenNames = new Set<string>([entity.name.normalize('NFC').trim()]);

  const romanized = entity.romanizedName?.normalize('NFC').trim();
  if (romanized && !writtenNames.has(romanized)) {
    const el = doc.createElementNS(TEI_NS, config.name);
    el.textContent = romanized;
    el.setAttributeNS(XML_NS, 'xml:lang', latnLangFor(entity.nameLang));
    item.appendChild(el);
    writtenNames.add(romanized);
  }

  for (const alt of entity.altNames ?? []) {
    const text = alt.text.normalize('NFC').trim();
    if (!text || writtenNames.has(text)) continue;
    const el = doc.createElementNS(TEI_NS, config.name);
    el.textContent = text;
    if (alt.type) el.setAttribute('type', alt.type);
    if (alt.lang) el.setAttributeNS(XML_NS, 'xml:lang', alt.lang);
    item.appendChild(el);
    writtenNames.add(text);
  }

  for (const authority of entity.authorityIds ?? []) {
    const idno = doc.createElementNS(TEI_NS, 'idno');
    idno.setAttribute('type', authority.type);
    idno.textContent = authority.value;
    item.appendChild(idno);
  }

  if (entity.cache) {
    const note = doc.createElementNS(TEI_NS, 'note');
    note.setAttribute('type', 'authority-cache');
    note.setAttribute('source', entity.cache.source);
    note.setAttribute('resp', LJB_RESP);
    note.setAttribute('when', entity.cache.when ?? new Date().toISOString());
    note.textContent = JSON.stringify(entity.cache.data);
    item.appendChild(note);
  }

  if (entity.description) {
    const note = doc.createElementNS(TEI_NS, 'note');
    note.setAttribute('type', 'description');
    note.textContent = entity.description;
    item.appendChild(note);
  }

  if (kind === 'person') {
    for (const value of entity.nationality ?? []) {
      const nationality = value.label.trim();
      if (!nationality) continue;
      const el = doc.createElementNS(TEI_NS, 'nationality');
      el.textContent = nationality;
      el.setAttribute('ref', value.canonicalId);
      item.appendChild(el);
    }
  }

  if (kind === 'office') {
    for (const officeTypeId of entity.officeTypeIds ?? []) {
      const state = doc.createElementNS(TEI_NS, 'state');
      state.setAttribute('type', 'office-classification');
      state.setAttribute('ref', officeTypeId);
      item.appendChild(state);
    }
  }

  if (entity.startYear != null || entity.endYear != null) {
    if (kind === 'person') {
      if (entity.startYear != null) {
        const birth = doc.createElementNS(TEI_NS, 'birth');
        birth.setAttribute('when', isoYearString(entity.startYear));
        item.appendChild(birth);
      }
      if (entity.endYear != null) {
        const death = doc.createElementNS(TEI_NS, 'death');
        death.setAttribute('when', isoYearString(entity.endYear));
        item.appendChild(death);
      }
    } else {
      // place/org/work have no birth/death in TEI — keep the years queryable in a typed note.
      const note = doc.createElementNS(TEI_NS, 'note');
      note.setAttribute('type', 'dates');
      note.textContent = [
        entity.startYear != null ? isoYearString(entity.startYear) : '',
        entity.endYear != null ? isoYearString(entity.endYear) : '',
      ].join('/');
      item.appendChild(note);
    }
  }

  touchEntity(item);
  getEntityList(doc, kind).appendChild(item);
  return { id, element: item };
}

export interface NewOfficeRelation {
  parentId: string;
  childId: string;
  source: string;
  rule: string;
  sourceIds?: string[];
  confidence?: 'asserted' | 'inferred';
}

export interface OfficeRelationRecord extends NewOfficeRelation {
  element: Element;
}

function officeRelationList(doc: Document): Element {
  const existing = Array.from(doc.getElementsByTagName('listRelation')).find(
    (list) => list.getAttribute('type') === 'office-hierarchy',
  );
  if (existing) return existing;
  const standOff = doc.getElementsByTagName('standOff')[0] ?? doc.documentElement;
  const list = doc.createElementNS(TEI_NS, 'listRelation');
  list.setAttribute('type', 'office-hierarchy');
  standOff.appendChild(list);
  return list;
}

const relationTarget = (value: string | null) => value?.replace(/^#/, '') ?? '';

export function readOfficeRelations(doc: Document): OfficeRelationRecord[] {
  const list = Array.from(doc.getElementsByTagName('listRelation')).find(
    (candidate) => candidate.getAttribute('type') === 'office-hierarchy',
  );
  if (!list) return [];
  return Array.from(list.children)
    .filter((element) => element.localName === 'relation' && element.getAttribute('name') === 'parentOf')
    .map((element) => ({
      parentId: relationTarget(element.getAttribute('active')),
      childId: relationTarget(element.getAttribute('passive')),
      source: element.getAttribute('resp')?.replace(/^#/, '') ?? '',
      rule: element.getAttribute('ana') ?? '',
      sourceIds: (element.getAttribute('corresp') ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .map((value) => decodeURIComponent(value.slice(value.lastIndexOf(':') + 1))),
      confidence: element.getAttribute('cert') === 'high' ? 'asserted' : 'inferred',
      element,
    }));
}

/** Add a deduplicated, provenance-bearing office hierarchy assertion. */
export function addOfficeRelation(
  doc: Document,
  relation: NewOfficeRelation,
): { created: boolean; element: Element } {
  const existing = readOfficeRelations(doc).find(
    (row) =>
      row.parentId === relation.parentId
      && row.childId === relation.childId
      && row.source === relation.source
      && row.rule === relation.rule,
  );
  if (existing) return { created: false, element: existing.element };

  const element = doc.createElementNS(TEI_NS, 'relation');
  element.setAttribute('name', 'parentOf');
  element.setAttribute('active', `#${relation.parentId}`);
  element.setAttribute('passive', `#${relation.childId}`);
  element.setAttribute('resp', `#${relation.source}`);
  element.setAttribute('ana', relation.rule);
  element.setAttribute('cert', relation.confidence === 'asserted' ? 'high' : 'low');
  if (relation.sourceIds?.length) {
    element.setAttribute(
      'corresp',
      relation.sourceIds
        .map((id) => `urn:ljb:authority:${encodeURIComponent(relation.source)}:${encodeURIComponent(id)}`)
        .join(' '),
    );
  }
  officeRelationList(doc).appendChild(element);
  return { created: true, element };
}

/** Append authority `<idno>`s to an existing entity element. */
export function appendAuthorityIdnos(doc: Document, element: Element, ids: AuthorityId[]): void {
  if (ids.length === 0) return;
  for (const authority of ids) {
    const idno = doc.createElementNS(TEI_NS, 'idno');
    idno.setAttribute('type', authority.type);
    idno.textContent = authority.value;
    element.appendChild(idno);
  }
  touchEntity(element);
}

/** Append person nationality labels without duplicating existing values. */
export function appendNationalities(doc: Document, element: Element, values: { id: string; canonicalId: string; label: string; sourceIds?: string[] }[]): void {
  const existing = new Set(
    Array.from(element.getElementsByTagName('nationality')).map(
      (el) => el.getAttribute('ref') || el.textContent?.trim(),
    ),
  );
  for (const value of values) {
    const label = value.label.trim();
    if (!label || existing.has(value.canonicalId)) continue;
    const el = doc.createElementNS(TEI_NS, 'nationality');
    el.textContent = label;
    el.setAttribute('ref', value.canonicalId);
    element.appendChild(el);
    existing.add(value.canonicalId);
  }
}

/** Find an entity element by its local id. */
export function findEntity(doc: Document, id: string): Element | null {
  const walker = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_ELEMENT);
  for (let node = walker.currentNode as Element | null; node; node = walker.nextNode() as Element | null) {
    if (node.getAttribute('xml:id') === id) return node;
  }
  return null;
}

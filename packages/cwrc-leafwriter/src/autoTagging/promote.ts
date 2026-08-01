/**
 * Bridge verbs **Link** and **Promote** (Absorb lives in `entityOps`/the order
 * log). Neither touches corpus `@key`s.
 *
 * Live promote uses {@link promoteToCentralSqlite}. The DOM helpers in this
 * file (`promoteToCentral`, index builders) remain for unit tests and as the
 * reference algorithm SQLite promote mirrors — they are not live authority
 * writes.
 */

import { getCentralId, setCentralMapping } from './concordance';
import { isLatinSurface, normalizeMatchString, stringsMatchExactly } from './disambiguationMatch';
import {
  addEntity,
  ENTITY_KINDS,
  entityElements,
  entityKindOfElement,
  findEntity,
  type EntityKind,
  type NewEntity,
} from './entities';
import { setFamilyName, setGivenName } from './entityOps';
import { normalizeNameType, type NameTypeId } from './nameTypes';
import { readFields, type EntityFields } from './reconcile';

const kindOf = entityKindOfElement;

const authorityKey = (kind: EntityKind, type: string, value: string): string =>
  `${kind}\t${type.toLowerCase()}\t${value.trim()}`;

/**
 * Bucket key for `byName`: two names collide here iff `stringsMatchExactly`
 * would consider them equal (NFC+trim, and case-folded when both are Latin).
 */
const nameKey = (kind: EntityKind, name: string): string => {
  const normalized = normalizeMatchString(name);
  return `${kind}\t${isLatinSurface(normalized) ? normalized.toLowerCase() : normalized}`;
};

/**
 * Incremental lookup state for bulk promotion (e.g. "Accept all" on hundreds
 * or thousands of proposals). `promoteToCentral`'s duplicate checks
 * (`findCentralByAuthority`/`findCentralByNameDates`) otherwise re-scan every
 * existing central entity of a kind on every single call — fine for a single
 * Promote, but O(n²) across a database-sized batch, since the central
 * database itself grows by one entity per call. Build this once per batch
 * with `buildCentralPromotionIndex`, and `promoteToCentral` keeps it current
 * as it adds entities.
 */
export interface CentralPromotionIndex {
  /** id -> element, across all kinds — lets `findEntity` skip its TreeWalker scan too. */
  byId: Map<string, Element>;
  /** `"kind\ttype\tvalue"` -> central id. */
  byAuthority: Map<string, string>;
  /**
   * `nameKey(kind, primaryName)` -> every central entity of that kind sharing
   * that (case-folded-if-Latin) primary name. `findCentralByNameDates` only
   * needs to compare within this bucket, not every entity of the kind —
   * without it, name/date matching alone stays O(current central size) per
   * call even with the rest of this index in place.
   */
  byName: Map<string, { id: string; fields: EntityFields }[]>;
}

/** Snapshot the given central document's entities once, for reuse across a whole promotion batch. */
export function buildCentralPromotionIndex(cedbDoc: Document): CentralPromotionIndex {
  const index: CentralPromotionIndex = { byId: new Map(), byAuthority: new Map(), byName: new Map() };
  for (const kind of Object.keys(ENTITY_KINDS) as EntityKind[]) {
    for (const item of entityElements(cedbDoc, kind)) {
      const id = item.getAttribute('xml:id');
      if (!id) continue;
      registerCentralEntity(index, kind, id, item, readFields(item));
    }
  }
  return index;
}

/** Register a just-added (or freshly scanned) central entity so later lookups in the same batch see it. */
function registerCentralEntity(
  index: CentralPromotionIndex,
  kind: EntityKind,
  id: string,
  element: Element,
  fields: EntityFields,
): void {
  index.byId.set(id, element);
  for (const authority of fields.authorities) {
    index.byAuthority.set(authorityKey(kind, authority.type, authority.value), id);
  }
  const primary = fields.names[0];
  if (primary) {
    const key = nameKey(kind, primary.text);
    const bucket = index.byName.get(key);
    if (bucket) bucket.push({ id, fields });
    else index.byName.set(key, [{ id, fields }]);
  }
}

/** Record a PEDB↔CEDB mapping for this user. Returns true when it changed. */
export function linkToCentral(pedbItem: Element, userStableId: string, centralId: string): boolean {
  return setCentralMapping(pedbItem, userStableId, centralId);
}

/**
 * First central entity id that shares an authority idno (same type+value) with
 * `authorities`, of the same kind — the high-confidence Link candidate.
 */
export function findCentralByAuthority(
  cedbDoc: Document,
  kind: EntityKind,
  authorities: { type: string; value: string }[],
  index?: CentralPromotionIndex,
): string | null {
  if (authorities.length === 0) return null;
  if (index) {
    for (const authority of authorities) {
      const id = index.byAuthority.get(authorityKey(kind, authority.type, authority.value));
      if (id) return id;
    }
    return null;
  }
  const wanted = new Set(authorities.map((a) => `${a.type.toLowerCase()}\t${a.value.trim()}`));
  for (const item of entityElements(cedbDoc, kind)) {
    for (const idno of Array.from(item.children).filter((c) => c.localName === 'idno')) {
      const type = idno.getAttribute('type');
      const value = idno.textContent?.trim();
      if (type && value && wanted.has(`${type.toLowerCase()}\t${value}`)) {
        return item.getAttribute('xml:id');
      }
    }
  }
  return null;
}

/**
 * The single central entity of `kind` whose primary name exactly matches
 * `name` (via `stringsMatchExactly`) and whose birth/death years, where both
 * sides have one, agree with `startYear`/`endYear` — the conservative
 * fallback Link candidate for entities with no shared authority id. A
 * missing date on either side is not disqualifying (avoids over-rejecting
 * sparsely-dated records), but *any* mismatched date is. Returns null when
 * zero or more than one central entity qualifies — this never guesses among
 * ambiguous candidates, it only links when there is exactly one.
 */
export function findCentralByNameDates(
  cedbDoc: Document,
  kind: EntityKind,
  name: string,
  startYear?: number,
  endYear?: number,
  index?: CentralPromotionIndex,
): string | null {
  const matches: string[] = [];
  const candidates = index
    ? (index.byName.get(nameKey(kind, name)) ?? [])
    : entityElements(cedbDoc, kind).map((item) => ({
        id: item.getAttribute('xml:id') ?? '',
        fields: readFields(item),
      }));
  for (const { id, fields } of candidates) {
    const primary = fields.names[0];
    if (!primary || !stringsMatchExactly(name, primary.text)) continue;
    if (startYear != null && fields.startYear != null && fields.startYear !== startYear) continue;
    if (endYear != null && fields.endYear != null && fields.endYear !== endYear) continue;
    if (id) matches.push(id);
  }
  return matches.length === 1 ? matches[0]! : null;
}

/** Reconstruct a `NewEntity` payload from an entity's fields (PEDB or CEDB item). */
export function toNewEntity(item: Element): { kind: EntityKind; entity: NewEntity; familyName: string | null; givenName: string | null } {
  const kind = kindOf(item);
  if (!kind) throw new Error(`promote: unknown entity kind for ${item.localName}`);
  const fields = readFields(item);
  const [primary, ...rest] = fields.names;
  if (!primary) throw new Error('promote: entity has no name');
  const entity: NewEntity = {
    name: primary.text,
    nameLang: primary.lang ?? undefined,
    altNames: rest.map((n) => ({
      text: n.text,
      lang: n.lang ?? undefined,
      type: (normalizeNameType(n.type) ?? undefined) as NameTypeId | undefined,
    })),
    authorityIds: fields.authorities,
    description: fields.description ?? undefined,
    startYear: fields.startYear ?? undefined,
    endYear: fields.endYear ?? undefined,
  };
  return { kind, entity, familyName: fields.familyName, givenName: fields.givenName };
}

export interface PromoteResult {
  centralId: string;
  /** True when a new central record was minted; false when an existing one was matched/linked. */
  created: boolean;
  /** True when the concordance row was written or changed. */
  linked: boolean;
}

/**
 * Ensure the project entity `pedbId` is represented in the central database and
 * linked for `userStableId`. Idempotent: an already-mapped entity returns its
 * existing central id.
 */
export function promoteToCentral(
  pedbDoc: Document,
  pedbId: string,
  cedbDoc: Document,
  userStableId: string,
  /**
   * Pre-built lookups for a bulk-promotion batch — see `CentralPromotionIndex`.
   * `pedbIndex` skips `findEntity`'s document-wide scan for `pedbId`; `centralIndex`
   * skips it for `cedbDoc` and turns the O(current central size) duplicate
   * checks into O(1)/O(matches). Kept current as entities are added, so later
   * calls in the same batch still see earlier ones. Omit for a one-off Promote.
   */
  pedbIndex?: ReadonlyMap<string, Element>,
  centralIndex?: CentralPromotionIndex,
): PromoteResult {
  const pedbItem = findEntity(pedbDoc, pedbId, pedbIndex);
  if (!pedbItem) throw new Error(`promote: entity not found: ${pedbId}`);

  const existingMapping = getCentralId(pedbItem, userStableId);
  if (existingMapping && findEntity(cedbDoc, existingMapping, centralIndex?.byId)) {
    return { centralId: existingMapping, created: false, linked: false };
  }

  const { kind, entity, familyName, givenName } = toNewEntity(pedbItem);

  const match =
    findCentralByAuthority(cedbDoc, kind, entity.authorityIds ?? [], centralIndex) ??
    findCentralByNameDates(cedbDoc, kind, entity.name, entity.startYear, entity.endYear, centralIndex);
  if (match) {
    const linked = linkToCentral(pedbItem, userStableId, match);
    return { centralId: match, created: false, linked };
  }

  const { id: centralId, element: centralItem } = addEntity(cedbDoc, kind, entity);
  const centralItemIndex = new Map([[centralId, centralItem]]);
  if (familyName) setFamilyName(cedbDoc, centralId, familyName, centralItemIndex);
  if (givenName) setGivenName(cedbDoc, centralId, givenName, centralItemIndex);
  const linked = linkToCentral(pedbItem, userStableId, centralId);
  if (centralIndex) {
    registerCentralEntity(centralIndex, kind, centralId, centralItem, {
      names: [
        { text: entity.name, lang: entity.nameLang ?? null, type: null },
        ...(entity.altNames ?? []).map((n) => ({
          text: n.text,
          lang: n.lang ?? null,
          type: n.type ?? null,
        })),
      ],
      authorities: entity.authorityIds ?? [],
      description: entity.description ?? null,
      familyName: familyName ?? null,
      givenName: givenName ?? null,
      startYear: entity.startYear ?? null,
      endYear: entity.endYear ?? null,
      changed: null,
    });
  }
  return { centralId, created: true, linked };
}

export interface AdoptResult {
  pedbId: string;
  /** True when a new project record was minted; false when an already-linked one was reused. */
  created: boolean;
}

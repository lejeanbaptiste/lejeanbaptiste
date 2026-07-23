/**
 * Bridge verbs **Link** and **Promote** (Absorb lives in `entityOps`/the order
 * log). Neither touches corpus `@key`s.
 *
 *   - **Link**: record that a project (PEDB) entity is the same person as an
 *     existing central (CEDB) entity, by writing the per-user `ljb-central`
 *     concordance row.
 *   - **Promote**: make a project entity known to the central database. Prefer
 *     an authority match (same CBDB/Wikidata/… id) so we Link to an existing
 *     central record instead of minting a duplicate; otherwise create a central
 *     record from the project entity's content, then Link.
 */

import { getCentralId, setCentralMapping } from './concordance';
import {
  addEntity,
  ENTITY_KINDS,
  findEntity,
  type EntityKind,
  type NewEntity,
} from './entities';
import { setFamilyName, setGivenName } from './entityOps';
import { normalizeNameType, type NameTypeId } from './nameTypes';
import { readFields } from './reconcile';

const ITEM_TO_KIND: Record<string, EntityKind> = Object.fromEntries(
  (Object.entries(ENTITY_KINDS) as [EntityKind, (typeof ENTITY_KINDS)[EntityKind]][]).map(
    ([kind, config]) => [config.item, kind],
  ),
);

const kindOf = (item: Element): EntityKind | null => ITEM_TO_KIND[item.localName] ?? null;

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
): string | null {
  if (authorities.length === 0) return null;
  const wanted = new Set(authorities.map((a) => `${a.type.toLowerCase()}\t${a.value.trim()}`));
  const list = cedbDoc.getElementsByTagName(ENTITY_KINDS[kind].list)[0];
  if (!list) return null;
  for (const item of Array.from(list.children)) {
    if (item.localName !== ENTITY_KINDS[kind].item) continue;
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
): PromoteResult {
  const pedbItem = findEntity(pedbDoc, pedbId);
  if (!pedbItem) throw new Error(`promote: entity not found: ${pedbId}`);

  const existingMapping = getCentralId(pedbItem, userStableId);
  if (existingMapping && findEntity(cedbDoc, existingMapping)) {
    return { centralId: existingMapping, created: false, linked: false };
  }

  const { kind, entity, familyName, givenName } = toNewEntity(pedbItem);

  const match = findCentralByAuthority(cedbDoc, kind, entity.authorityIds ?? []);
  if (match) {
    const linked = linkToCentral(pedbItem, userStableId, match);
    return { centralId: match, created: false, linked };
  }

  const { id: centralId } = addEntity(cedbDoc, kind, entity);
  if (familyName) setFamilyName(cedbDoc, centralId, familyName);
  if (givenName) setGivenName(cedbDoc, centralId, givenName);
  const linked = linkToCentral(pedbItem, userStableId, centralId);
  return { centralId, created: true, linked };
}

export interface AdoptResult {
  pedbId: string;
  /** True when a new project record was minted; false when an already-linked one was reused. */
  created: boolean;
}

/** The project entity (if any) this user has already linked to `centralId`. */
function findLinkedPedbEntity(pedbDoc: Document, kind: EntityKind, centralId: string, userStableId: string): string | null {
  const list = pedbDoc.getElementsByTagName(ENTITY_KINDS[kind].list)[0];
  if (!list) return null;
  for (const item of Array.from(list.children)) {
    if (item.localName !== ENTITY_KINDS[kind].item) continue;
    if (getCentralId(item, userStableId) === centralId) return item.getAttribute('xml:id');
  }
  return null;
}

/**
 * The reverse of `promoteToCentral`: ensure the central entity `centralId` is
 * represented in the project database and linked for `userStableId`.
 * Idempotent: an already-linked central entity returns its existing project id.
 */
export function adoptFromCentral(
  pedbDoc: Document,
  centralId: string,
  cedbDoc: Document,
  userStableId: string,
): AdoptResult {
  const cedbItem = findEntity(cedbDoc, centralId);
  if (!cedbItem) throw new Error(`adopt: central entity not found: ${centralId}`);

  const { kind, entity, familyName, givenName } = toNewEntity(cedbItem);

  const existingPedbId = findLinkedPedbEntity(pedbDoc, kind, centralId, userStableId);
  if (existingPedbId) return { pedbId: existingPedbId, created: false };

  const { id: pedbId, element: pedbItem } = addEntity(pedbDoc, kind, entity);
  if (familyName) setFamilyName(pedbDoc, pedbId, familyName);
  if (givenName) setGivenName(pedbDoc, pedbId, givenName);
  linkToCentral(pedbItem, userStableId, centralId);
  return { pedbId, created: true };
}

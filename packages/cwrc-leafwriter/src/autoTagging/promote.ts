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

/** Reconstruct a `NewEntity` payload from a project entity's fields. */
function toNewEntity(pedbItem: Element): { kind: EntityKind; entity: NewEntity; familyName: string | null; givenName: string | null } {
  const kind = kindOf(pedbItem);
  if (!kind) throw new Error(`promote: unknown entity kind for ${pedbItem.localName}`);
  const fields = readFields(pedbItem);
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

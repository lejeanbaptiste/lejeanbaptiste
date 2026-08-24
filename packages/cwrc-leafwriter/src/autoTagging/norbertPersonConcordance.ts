/**
 * Precompiled Norbert ↔ CBDB / DILA / Wikidata person links.
 *
 * Shipped as `norbert/concordance.ndjson` with the Chinese authority bundle.
 * Person packs may also carry the same pairs on `metadata.crosswalk`; this
 * sidecar is the reliable source when packs were rebuilt without re-running
 * concordance integration (and for already-imported Central entities).
 */

import type { AuthorityId } from './entities';
import type { EntityStore } from './entityStore';
import { formatNorbertAuthorityValue, norbertAuthorityLookupValues } from './norbertAuthorityId';
import { authorityPackLines, type AuthorityPackContent } from './packLoader';
import type { AuthorityPackId } from './packPaths';
import { authorityIdsFromPackCrosswalk, normalizeWikidataQid } from './viafWikidataConcordance';

/** Pack id for the shipped Norbert person concordance sidecar. */
export const NORBERT_PERSON_CONCORDANCE_PACK_ID: AuthorityPackId = 'norbert-concordance';

const MATCHED_SOURCE_TO_TYPE: Record<string, string> = {
  cbdb: 'CBDB',
  dila: 'DILA',
  wikidata: 'Wikidata',
};

export interface NorbertPersonConcordanceIndex {
  /** `${TYPE.toUpperCase()}\0${normalizedValue}` → linked authority ids. */
  byAuthority: Map<string, AuthorityId[]>;
}

export function emptyNorbertPersonConcordanceIndex(): NorbertPersonConcordanceIndex {
  return { byAuthority: new Map() };
}

function authorityKey(type: string, value: string): string {
  return `${type.trim().toUpperCase()}\0${value.trim()}`;
}

function pushLink(index: NorbertPersonConcordanceIndex, from: AuthorityId, to: AuthorityId): void {
  if (from.type.toUpperCase() === to.type.toUpperCase() && from.value === to.value) {
    return;
  }
  const key = authorityKey(from.type, from.value);
  const list = index.byAuthority.get(key) ?? [];
  if (list.some((id) => id.type.toUpperCase() === to.type.toUpperCase() && id.value === to.value)) {
    return;
  }
  list.push(to);
  index.byAuthority.set(key, list);
}

function matchedAuthorityId(source: string, authorityId: string): AuthorityId | null {
  const type = MATCHED_SOURCE_TO_TYPE[source.trim().toLowerCase()];
  if (!type) return null;
  const raw = String(authorityId).trim();
  if (!raw) return null;
  if (type === 'Wikidata') {
    const qid = normalizeWikidataQid(raw);
    return qid ? { type, value: qid } : null;
  }
  return { type, value: raw };
}

/**
 * Parse Norbert person-concordance NDJSON
 * (`metadata.norbert.authorityId` + `metadata.matched.{source,authorityId}`).
 */
export function parseNorbertPersonConcordance(
  content: AuthorityPackContent,
): NorbertPersonConcordanceIndex {
  const index = emptyNorbertPersonConcordanceIndex();
  for (const line of authorityPackLines(content)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let row: {
      metadata?: {
        norbert?: { authorityId?: unknown };
        matched?: { source?: unknown; authorityId?: unknown };
      };
    };
    try {
      row = JSON.parse(trimmed) as typeof row;
    } catch {
      continue;
    }
    const norbertRaw = row.metadata?.norbert?.authorityId;
    const matched = row.metadata?.matched;
    if (norbertRaw == null || !matched?.source || matched.authorityId == null) continue;

    const matchedId = matchedAuthorityId(String(matched.source), String(matched.authorityId));
    if (!matchedId) continue;

    const bare = String(norbertRaw).trim();
    if (!bare) continue;
    const norbertId: AuthorityId = {
      type: 'NORBERT',
      value: formatNorbertAuthorityValue('person', bare),
    };

    // Index under every Norbert lookup form (bare `5` and `person-5`).
    for (const key of norbertAuthorityLookupValues(norbertId.value)) {
      pushLink(index, { type: 'NORBERT', value: key }, matchedId);
    }
    // Reverse edge always points at the canonical person-prefixed Norbert id.
    pushLink(index, matchedId, norbertId);
  }
  return index;
}

/** Authority ids the concordance ties to this one idno (not including itself). */
export function idnosFromNorbertConcordance(
  index: NorbertPersonConcordanceIndex,
  type: string,
  value: string,
): AuthorityId[] {
  const out: AuthorityId[] = [];
  const seen = new Set<string>();
  const add = (id: AuthorityId) => {
    const key = authorityKey(id.type, id.value);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(id);
  };

  const upper = type.trim().toUpperCase();
  if (upper === 'NORBERT') {
    for (const key of norbertAuthorityLookupValues(value)) {
      for (const id of index.byAuthority.get(authorityKey('NORBERT', key)) ?? []) add(id);
    }
  } else {
    for (const id of index.byAuthority.get(authorityKey(type, value)) ?? []) add(id);
    if (upper === 'WIKIDATA') {
      const qid = normalizeWikidataQid(value);
      if (qid && qid !== value.trim()) {
        for (const id of index.byAuthority.get(authorityKey('WIKIDATA', qid)) ?? []) add(id);
      }
    }
  }
  return out;
}

/** Union concordance expansions onto an existing idno set. */
export function expandIdnosWithNorbertConcordance(
  idnos: readonly AuthorityId[],
  index: NorbertPersonConcordanceIndex,
): AuthorityId[] {
  if (index.byAuthority.size === 0) return [...idnos];
  const out: AuthorityId[] = [];
  const seen = new Set<string>();
  const add = (id: AuthorityId) => {
    const key = authorityKey(id.type, id.value);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(id);
  };
  for (const id of idnos) {
    add(id);
    for (const linked of idnosFromNorbertConcordance(index, id.type, id.value)) add(linked);
  }
  return out;
}

type ReadPack = (packId: AuthorityPackId) => Promise<AuthorityPackContent>;

let concordancePromise: Promise<NorbertPersonConcordanceIndex> | null = null;

/** Drop the session cache (pack reinstall / tests). */
export function clearNorbertPersonConcordanceCache(): void {
  concordancePromise = null;
}

/** @deprecated Prefer {@link clearNorbertPersonConcordanceCache}. */
export function clearNorbertPersonConcordanceCacheForTests(): void {
  clearNorbertPersonConcordanceCache();
}

/**
 * Load the dedicated concordance pack when installed. Missing pack → empty index.
 * Failed reads are not cached, so a later successful pack install can recover.
 */
export async function loadNorbertPersonConcordance(
  readPackFile: ReadPack,
): Promise<NorbertPersonConcordanceIndex> {
  if (!concordancePromise) {
    concordancePromise = (async () => {
      try {
        const content = await readPackFile(NORBERT_PERSON_CONCORDANCE_PACK_ID);
        return parseNorbertPersonConcordance(content);
      } catch {
        concordancePromise = null;
        return emptyNorbertPersonConcordanceIndex();
      }
    })();
  }
  return concordancePromise;
}

/**
 * Safe-to-attach idnos: skip already-present values, same-type conflicts, and
 * ids already claimed by a different person in this store.
 */
export async function filterAttachablePersonAuthorities(
  store: EntityStore,
  entityId: string,
  existing: readonly { type: string; value: string }[],
  candidates: readonly AuthorityId[],
): Promise<AuthorityId[]> {
  const out: AuthorityId[] = [];
  const owned = new Map(
    existing.map((auth) => [auth.type.trim().toUpperCase(), auth.value.trim()] as const),
  );

  for (const idno of candidates) {
    const type = idno.type.trim().toUpperCase();
    const value = idno.value.trim();
    if (!type || !value) continue;
    const have = owned.get(type);
    if (have === value) continue;
    if (have != null && have !== value) continue; // same-type conflict — leave for curation
    const claimed = await store.sqliteFindByAuthority('person', idno.type, idno.value);
    if (claimed && claimed !== entityId) continue;
    out.push({ type: idno.type, value: idno.value });
    owned.set(type, value);
  }
  return out;
}

export interface AttachCrosswalkConflict {
  authority: string;
  value: string;
  /** [this entity, the entity that already owns the authority]. */
  entityIds: [string, string];
}

export interface AttachCrosswalkResult {
  /** Idnos newly attached onto `entityId`. */
  attached: number;
  /** Norbert idnos copied onto the other card that already held CBDB/DILA/Wikidata. */
  reverseAttached: number;
  /** Keep-ids when this entity was merged away into a same-name duplicate. */
  mergedInto: string[];
  /** Bridge targets owned by a differently-named person — needs manual review. */
  conflicts: AttachCrosswalkConflict[];
}

function expandCrosswalkCandidates(
  authorities: readonly { type: string; value: string }[],
  options: {
    concordance?: NorbertPersonConcordanceIndex | null;
    packCrosswalks?: (Record<string, string | string[] | undefined> | undefined)[];
  },
): AuthorityId[] {
  const expanded: AuthorityId[] = [];
  if (options.concordance) {
    expanded.push(...expandIdnosWithNorbertConcordance([...authorities], options.concordance));
  } else {
    expanded.push(...authorities);
  }
  for (const crosswalk of options.packCrosswalks ?? []) {
    expanded.push(...authorityIdsFromPackCrosswalk(crosswalk, { norbertKind: 'person' }));
  }
  const seen = new Set<string>();
  return expanded.filter((id) => {
    const key = `${id.type.toUpperCase()}\0${id.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function primaryNameFromSummary(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const names = (raw as { names?: { text?: unknown; isPrimary?: unknown; nameType?: unknown }[] })
    .names;
  if (!Array.isArray(names) || names.length === 0) return null;
  const primary =
    names.find((name) => name.isPrimary === true) ??
    names.find((name) => String(name.nameType ?? '').toLowerCase() === 'primary') ??
    names[0];
  const text = String(primary?.text ?? '')
    .normalize('NFC')
    .trim();
  return text || null;
}

function namesMatchForBridgeMerge(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  return a.normalize('NFC').trim() === b.normalize('NFC').trim();
}

/**
 * Attach missing Norbert concordance + pack-crosswalk authorities onto a person.
 *
 * When a bridge target (CBDB/DILA/Wikidata) already lives on another person:
 * - same primary name → merge this card into that one (typical after importing
 *   all of Norbert alongside CBDB/Wikidata);
 * - different name → leave a conflict for curation (do not reverse-attach).
 */
export async function attachPersonCrosswalkAuthorities(
  store: EntityStore,
  entityId: string,
  authorities: readonly { type: string; value: string }[],
  options: {
    concordance?: NorbertPersonConcordanceIndex | null;
    /** Pack-row crosswalks already loaded for this entity's authorities. */
    packCrosswalks?: (Record<string, string | string[] | undefined> | undefined)[];
    /** Primary name of `entityId` (avoids an extra summary read when known). */
    primaryName?: string | null;
  } = {},
): Promise<AttachCrosswalkResult> {
  const result: AttachCrosswalkResult = {
    attached: 0,
    reverseAttached: 0,
    mergedInto: [],
    conflicts: [],
  };
  const expanded = expandCrosswalkCandidates(authorities, options);
  const owned = new Map(
    authorities.map((auth) => [auth.type.trim().toUpperCase(), auth.value.trim()] as const),
  );
  const ourName =
    options.primaryName?.normalize('NFC').trim() ||
    primaryNameFromSummary(await store.sqliteEntitySummary(entityId));
  const handledClaimants = new Set<string>();

  for (const idno of expanded) {
    const type = idno.type.trim().toUpperCase();
    const value = idno.value.trim();
    if (!type || !value) continue;
    const have = owned.get(type);
    if (have === value) continue;
    if (have != null && have !== value) continue;

    const claimed = await store.sqliteFindByAuthority('person', idno.type, idno.value);
    if (!claimed || claimed === entityId) {
      const ok = await store.sqliteAttachAuthority(entityId, idno.type, idno.value);
      if (ok) {
        result.attached++;
        owned.set(type, value);
      }
      continue;
    }

    // Bridge target already on another person — usually a dual-import duplicate.
    if (handledClaimants.has(claimed)) continue;
    handledClaimants.add(claimed);

    const theirName = primaryNameFromSummary(await store.sqliteEntitySummary(claimed));
    if (namesMatchForBridgeMerge(ourName, theirName)) {
      // Copy our Norbert ids onto the keep card, then merge us away into it.
      for (const auth of authorities) {
        if (auth.type.trim().toUpperCase() !== 'NORBERT') continue;
        const alreadyOnKeep = await store.sqliteFindByAuthority('person', auth.type, auth.value);
        if (alreadyOnKeep && alreadyOnKeep !== claimed) continue;
        const ok = await store.sqliteAttachAuthority(claimed, auth.type, auth.value);
        if (ok) result.reverseAttached++;
      }
      try {
        await store.sqliteMerge(claimed, [entityId]);
        result.mergedInto.push(claimed);
        return result;
      } catch {
        result.conflicts.push({
          authority: idno.type,
          value: idno.value,
          entityIds: [entityId, claimed],
        });
      }
      continue;
    }

    result.conflicts.push({
      authority: idno.type,
      value: idno.value,
      entityIds: [entityId, claimed],
    });
  }

  return result;
}

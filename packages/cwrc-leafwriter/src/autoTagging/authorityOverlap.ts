import type { AuthorityCandidate } from './authority';
import { haversineDistanceKm } from './geoCluster';
import { bareNorbertAuthorityValue } from './norbertAuthorityId';

/** CBDB ids are sometimes zero-padded in DILA crosswalks. */
export function normalizeCbdbId(id: string): string {
  const trimmed = id.trim();
  return trimmed.replace(/^0+/, '') || trimmed;
}

const PLACE_AUTHORITY_SOURCES = new Set(['CBDB', 'DILA', 'CHGIS']);

/**
 * Default proximity radius (km) for treating two same-named place hits from
 * different packs as the same physical place. See "placeProximityKm" in
 * disambiguationSettings.ts for the user-configurable version; this default
 * applies wherever a caller doesn't have settings context (e.g. seed.ts's
 * pack-index building, which runs ahead of any per-document settings read).
 */
export const DEFAULT_PLACE_PROXIMITY_KM = 5;

function placeChgisId(candidate: AuthorityCandidate): string | undefined {
  if (candidate.source === 'CHGIS') return candidate.authorityId;
  return candidate.metadata?.crosswalk?.chgis;
}

function placeDilaId(candidate: AuthorityCandidate): string | undefined {
  if (candidate.source === 'DILA' && candidate.kind === 'place') return candidate.authorityId;
  return candidate.metadata?.crosswalk?.dila;
}

function placeCbdbId(candidate: AuthorityCandidate): string | undefined {
  if (candidate.source === 'CBDB' && candidate.kind === 'place') {
    return normalizeCbdbId(candidate.authorityId);
  }
  const crosswalk = candidate.metadata?.crosswalk?.cbdb;
  return crosswalk ? normalizeCbdbId(crosswalk) : undefined;
}

/**
 * Whether two place-authority rows describe the same place when loaded from
 * different packs (DILA + CHGIS + CBDB). Crosswalk ids win (an explicit
 * cross-reference is never overridden by geography). Otherwise, same primary
 * name across place packs is treated as one index row *only if* neither side
 * carries coordinates (nothing to check) or both do and land within
 * `proximityKm` of each other — this is the fix for the "same name, different
 * place" collision (e.g. two places both named 臨川): a bare name match no
 * longer merges two authority hits that are geographically far apart.
 */
export function shouldMergePlacePackCandidates(
  a: AuthorityCandidate,
  b: AuthorityCandidate,
  proximityKm: number = DEFAULT_PLACE_PROXIMITY_KM,
): boolean {
  if (a.kind !== 'place' || b.kind !== 'place') return false;
  if (canonicalEntityKey(a) === canonicalEntityKey(b)) return true;

  const aChgis = placeChgisId(a);
  const bChgis = placeChgisId(b);
  if (aChgis && bChgis && aChgis === bChgis) return true;

  const aDila = placeDilaId(a);
  const bDila = placeDilaId(b);
  if (aDila && bDila && aDila === bDila) return true;

  const aCbdb = placeCbdbId(a);
  const bCbdb = placeCbdbId(b);
  if (aCbdb && bCbdb && aCbdb === bCbdb) return true;

  const sameName =
    PLACE_AUTHORITY_SOURCES.has(a.source) &&
    PLACE_AUTHORITY_SOURCES.has(b.source) &&
    a.primaryName.trim() === b.primaryName.trim();
  if (!sameName) return false;

  const aGeo = a.metadata?.geo;
  const bGeo = b.metadata?.geo;
  // No geo signal on one/both sides — fall back to name-only behavior (today's
  // pre-geo default), per the disambiguation-UI design's "no geo data" case.
  if (!aGeo || !bGeo) return true;

  return haversineDistanceKm(aGeo, bGeo) <= proximityKm;
}

function mergeIntoList(
  list: AuthorityCandidate[],
  candidate: AuthorityCandidate,
  proximityKm: number = DEFAULT_PLACE_PROXIMITY_KM,
): void {
  const keyIdx = list.findIndex((c) => canonicalEntityKey(c) === canonicalEntityKey(candidate));
  if (keyIdx >= 0) {
    list[keyIdx] = mergeAuthorityCandidates(list[keyIdx]!, candidate);
    return;
  }
  const personIdx = list.findIndex((c) => shouldMergePersonPackCandidates(c, candidate));
  if (personIdx >= 0) {
    list[personIdx] = mergeAuthorityCandidates(list[personIdx]!, candidate);
    return;
  }
  const mergeIdx = list.findIndex((c) => shouldMergePlacePackCandidates(c, candidate, proximityKm));
  if (mergeIdx >= 0) {
    list[mergeIdx] = mergeAuthorityCandidates(list[mergeIdx]!, candidate);
    return;
  }
  list.push(candidate);
}

/**
 * Canonical key for overlap merge. DILA persons with a CBDB crosswalk share
 * the same key as the matching CBDB row.
 */
export function canonicalEntityKey(candidate: AuthorityCandidate): string {
  if (candidate.kind === 'person' && candidate.metadata?.canonicalEntityId) {
    return candidate.metadata.canonicalEntityId;
  }
  const cbdbCrosswalk = candidate.metadata?.crosswalk?.cbdb;
  if (candidate.kind === 'person' && cbdbCrosswalk) {
    return `person:CBDB:${normalizeCbdbId(cbdbCrosswalk)}`;
  }
  if (candidate.kind === 'place' && cbdbCrosswalk) {
    return `place:CBDB:${normalizeCbdbId(cbdbCrosswalk)}`;
  }
  if (candidate.kind === 'office' && cbdbCrosswalk) {
    return `office:CBDB:${normalizeCbdbId(cbdbCrosswalk)}`;
  }
  const chgisCrosswalk = candidate.metadata?.crosswalk?.chgis;
  if (candidate.kind === 'place' && chgisCrosswalk) {
    return `place:CHGIS:${chgisCrosswalk}`;
  }
  if (candidate.source === 'CBDB') {
    return `${candidate.kind}:CBDB:${normalizeCbdbId(candidate.authorityId)}`;
  }
  if (candidate.source === 'CHGIS') {
    return `place:CHGIS:${candidate.authorityId}`;
  }
  return `${candidate.kind}:${candidate.source}:${candidate.authorityId}`;
}

function personCbdbId(candidate: AuthorityCandidate): string | undefined {
  if (candidate.kind !== 'person') return undefined;
  if (candidate.metadata?.crosswalk?.cbdb) {
    return normalizeCbdbId(candidate.metadata.crosswalk.cbdb);
  }
  if (candidate.source === 'CBDB') return normalizeCbdbId(candidate.authorityId);
  return undefined;
}

function personNorbertId(candidate: AuthorityCandidate): string | undefined {
  if (candidate.kind !== 'person') return undefined;
  if (candidate.metadata?.crosswalk?.norbert) {
    return bareNorbertAuthorityValue(String(candidate.metadata.crosswalk.norbert));
  }
  if (candidate.source === 'Norbert') {
    return bareNorbertAuthorityValue(candidate.authorityId);
  }
  return undefined;
}

function personDilaId(candidate: AuthorityCandidate): string | undefined {
  if (candidate.kind !== 'person') return undefined;
  if (candidate.metadata?.crosswalk?.dila) return String(candidate.metadata.crosswalk.dila);
  if (candidate.source === 'DILA') return candidate.authorityId;
  return undefined;
}

/**
 * Whether two person-authority rows describe the same person across packs
 * (Norbert ↔ CBDB ↔ DILA) via shared crosswalk or primary ids.
 */
export function shouldMergePersonPackCandidates(
  a: AuthorityCandidate,
  b: AuthorityCandidate,
): boolean {
  if (a.kind !== 'person' || b.kind !== 'person') return false;
  if (canonicalEntityKey(a) === canonicalEntityKey(b)) return true;

  const aCbdb = personCbdbId(a);
  const bCbdb = personCbdbId(b);
  if (aCbdb && bCbdb && aCbdb === bCbdb) return true;

  const aNorbert = personNorbertId(a);
  const bNorbert = personNorbertId(b);
  if (aNorbert && bNorbert && aNorbert === bNorbert) return true;

  const aDila = personDilaId(a);
  const bDila = personDilaId(b);
  if (aDila && bDila && aDila === bDila) return true;

  return false;
}

function minDefined(a?: number, b?: number): number | undefined {
  if (a == null) return b;
  if (b == null) return a;
  return Math.min(a, b);
}

function maxDefined(a?: number, b?: number): number | undefined {
  if (a == null) return b;
  if (b == null) return a;
  return Math.max(a, b);
}

/**
 * Merge two `+`-joined source labels into one, deduped token-by-token.
 * Trims each token before comparing — a stray space in one pack's `source`
 * field (e.g. "CBDB " vs "CBDB") must not survive as a second, visually
 * duplicate pill in the combined label.
 */
function combinedSource(a: string, b: string): string {
  const trimmedA = a.trim();
  const trimmedB = b.trim();
  if (trimmedA === trimmedB) return trimmedA;
  const tokens = [...trimmedA.split('+'), ...trimmedB.split('+')].map((token) => token.trim());
  const parts = [...new Set(tokens)].sort();
  return parts.join('+');
}

/** Merge two records that describe the same authority entity (CBDB↔DILA overlap). */
export function mergeAuthorityCandidates(
  existing: AuthorityCandidate,
  incoming: AuthorityCandidate,
): AuthorityCandidate {
  const searchStrings = [...new Set([...existing.searchStrings, ...incoming.searchStrings])];

  const descriptions = [existing.metadata?.description, incoming.metadata?.description].filter(
    (d): d is string => !!d?.trim(),
  );
  const uniqueDescriptions = [...new Set(descriptions)];
  const description =
    uniqueDescriptions.length <= 1
      ? uniqueDescriptions[0]
      : uniqueDescriptions.slice(0, 2).join(' | ');

  const crosswalk = {
    ...existing.metadata?.crosswalk,
    ...incoming.metadata?.crosswalk,
  };
  if (existing.source === 'CBDB') crosswalk.cbdb = normalizeCbdbId(existing.authorityId);
  if (incoming.source === 'CBDB') crosswalk.cbdb = normalizeCbdbId(incoming.authorityId);
  if (existing.source === 'CHGIS') crosswalk.chgis = existing.authorityId;
  if (incoming.source === 'CHGIS') crosswalk.chgis = incoming.authorityId;
  if (existing.source === 'DILA' && existing.kind === 'place') {
    crosswalk.dila = existing.authorityId;
  }
  if (incoming.source === 'DILA' && incoming.kind === 'place') {
    crosswalk.dila = incoming.authorityId;
  }
  if (existing.source === 'DILA' && existing.kind === 'person') {
    crosswalk.dila = existing.authorityId;
  }
  if (incoming.source === 'DILA' && incoming.kind === 'person') {
    crosswalk.dila = incoming.authorityId;
  }
  if (existing.source === 'Norbert') {
    crosswalk.norbert = existing.authorityId;
  }
  if (incoming.source === 'Norbert') {
    crosswalk.norbert = incoming.authorityId;
  }
  const appointments = [
    ...new Map(
      [...(existing.metadata?.appointments ?? []), ...(incoming.metadata?.appointments ?? [])].map(
        (appointment) => [`${appointment.source}:${appointment.authorityId}`, appointment],
      ),
    ).values(),
  ];

  return {
    ...existing,
    source: combinedSource(existing.source, incoming.source),
    primaryName: existing.primaryName || incoming.primaryName,
    searchStrings,
    metadata: {
      ...existing.metadata,
      ...incoming.metadata,
      description,
      crosswalk: Object.keys(crosswalk).length ? crosswalk : undefined,
      startYear: minDefined(existing.metadata?.startYear, incoming.metadata?.startYear),
      endYear: maxDefined(existing.metadata?.endYear, incoming.metadata?.endYear),
      appointments: appointments.length ? appointments : undefined,
    },
  };
}

/**
 * Collapse CBDB+DILA duplicates while keeping genuinely ambiguous names
 * separate. `proximityKm` — see {@link DEFAULT_PLACE_PROXIMITY_KM} — governs
 * whether two same-named place hits merge or surface as distinct candidates;
 * pass the project's `placeProximityKm` setting when available.
 */
export function collapseLinkedCandidates(
  candidates: AuthorityCandidate[],
  proximityKm: number = DEFAULT_PLACE_PROXIMITY_KM,
): AuthorityCandidate[] {
  if (candidates.length <= 1) return candidates;

  const merged: AuthorityCandidate[] = [];
  for (const candidate of candidates) {
    const keyIdx = merged.findIndex((c) => canonicalEntityKey(c) === canonicalEntityKey(candidate));
    if (keyIdx >= 0) {
      merged[keyIdx] = mergeAuthorityCandidates(merged[keyIdx]!, candidate);
      continue;
    }
    const personIdx = merged.findIndex((c) => shouldMergePersonPackCandidates(c, candidate));
    if (personIdx >= 0) {
      merged[personIdx] = mergeAuthorityCandidates(merged[personIdx]!, candidate);
      continue;
    }
    const packIdx = merged.findIndex((c) =>
      shouldMergePlacePackCandidates(c, candidate, proximityKm),
    );
    if (packIdx >= 0) {
      merged[packIdx] = mergeAuthorityCandidates(merged[packIdx]!, candidate);
      continue;
    }
    merged.push(candidate);
  }
  return merged;
}

export { mergeIntoList as mergeCandidateIntoLookupList };

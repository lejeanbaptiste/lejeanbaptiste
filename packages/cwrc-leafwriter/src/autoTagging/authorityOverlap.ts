import type { AuthorityCandidate } from './authority';

/** CBDB ids are sometimes zero-padded in DILA crosswalks. */
export function normalizeCbdbId(id: string): string {
  const trimmed = id.trim();
  return trimmed.replace(/^0+/, '') || trimmed;
}

const PLACE_AUTHORITY_SOURCES = new Set(['CBDB', 'DILA', 'CHGIS']);

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
 * different packs (DILA + CHGIS + CBDB). Crosswalk ids win; otherwise same
 * primary name across place packs is treated as one index row.
 */
export function shouldMergePlacePackCandidates(
  a: AuthorityCandidate,
  b: AuthorityCandidate,
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

  return (
    PLACE_AUTHORITY_SOURCES.has(a.source) &&
    PLACE_AUTHORITY_SOURCES.has(b.source) &&
    a.primaryName.trim() === b.primaryName.trim()
  );
}

function mergeIntoList(
  list: AuthorityCandidate[],
  candidate: AuthorityCandidate,
): void {
  const keyIdx = list.findIndex((c) => canonicalEntityKey(c) === canonicalEntityKey(candidate));
  if (keyIdx >= 0) {
    list[keyIdx] = mergeAuthorityCandidates(list[keyIdx]!, candidate);
    return;
  }
  const mergeIdx = list.findIndex((c) => shouldMergePlacePackCandidates(c, candidate));
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
  const cbdbCrosswalk = candidate.metadata?.crosswalk?.cbdb;
  if (candidate.kind === 'person' && cbdbCrosswalk) {
    return `person:CBDB:${normalizeCbdbId(cbdbCrosswalk)}`;
  }
  if (candidate.kind === 'place' && cbdbCrosswalk) {
    return `place:CBDB:${normalizeCbdbId(cbdbCrosswalk)}`;
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

function combinedSource(a: string, b: string): string {
  if (a === b) return a;
  const parts = [...new Set([...a.split('+'), ...b.split('+')])].sort();
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
    },
  };
}

/** Collapse CBDB+DILA duplicates while keeping genuinely ambiguous names separate. */
export function collapseLinkedCandidates(candidates: AuthorityCandidate[]): AuthorityCandidate[] {
  if (candidates.length <= 1) return candidates;

  const merged: AuthorityCandidate[] = [];
  for (const candidate of candidates) {
    const keyIdx = merged.findIndex((c) => canonicalEntityKey(c) === canonicalEntityKey(candidate));
    if (keyIdx >= 0) {
      merged[keyIdx] = mergeAuthorityCandidates(merged[keyIdx]!, candidate);
      continue;
    }
    const packIdx = merged.findIndex((c) => shouldMergePlacePackCandidates(c, candidate));
    if (packIdx >= 0) {
      merged[packIdx] = mergeAuthorityCandidates(merged[packIdx]!, candidate);
      continue;
    }
    merged.push(candidate);
  }
  return merged;
}

export { mergeIntoList as mergeCandidateIntoLookupList };

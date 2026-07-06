import type { AuthorityCandidate } from './authority';

/** CBDB ids are sometimes zero-padded in DILA crosswalks. */
export function normalizeCbdbId(id: string): string {
  const trimmed = id.trim();
  return trimmed.replace(/^0+/, '') || trimmed;
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
  if (candidate.source === 'CBDB') {
    return `${candidate.kind}:CBDB:${normalizeCbdbId(candidate.authorityId)}`;
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

  const byKey = new Map<string, AuthorityCandidate>();
  for (const candidate of candidates) {
    const key = canonicalEntityKey(candidate);
    const prior = byKey.get(key);
    byKey.set(key, prior ? mergeAuthorityCandidates(prior, candidate) : candidate);
  }
  return [...byKey.values()];
}

import type { AuthorityCandidate } from './authority';

export interface NobleTitleFilterIndex {
  /** Derived structural candidates keyed by source + exact surface. */
  bySourceSurface: Map<string, AuthorityCandidate[]>;
}

const sourceNames = (source: string): string[] =>
  source
    .split('+')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

const keyOf = (source: string, surface: string): string =>
  `${source.trim().toUpperCase()}\0${surface.normalize('NFC').trim()}`;

export function buildNobleTitleFilterIndex(
  candidates: Iterable<AuthorityCandidate>,
): NobleTitleFilterIndex {
  const bySourceSurface = new Map<string, AuthorityCandidate[]>();
  for (const candidate of candidates) {
    const filter = candidate.metadata?.nobleTitleFilter;
    if (!filter?.source) continue;
    for (const surface of candidate.searchStrings) {
      const key = keyOf(filter.source, surface);
      const list = bySourceSurface.get(key);
      if (list) list.push(candidate);
      else bySourceSurface.set(key, [candidate]);
    }
  }
  return { bySourceSurface };
}

/**
 * Remove approved title surfaces from an authority candidate while returning
 * the derived structural candidates that should replace them in the matcher.
 * The original authority record remains available for every other name.
 */
export function applyNobleTitleFilter(
  candidate: AuthorityCandidate,
  index: NobleTitleFilterIndex,
): { candidate: AuthorityCandidate | null; titleCandidates: AuthorityCandidate[] } {
  if (candidate.metadata?.nobleTitleFilter) return { candidate, titleCandidates: [] };
  const sources = sourceNames(candidate.source);
  const matched = new Map<string, AuthorityCandidate>();
  const isApproved = (surface: string): boolean => {
    let approved = false;
    for (const source of sources) {
      for (const replacement of index.bySourceSurface.get(keyOf(source, surface)) ?? []) {
        approved = true;
        matched.set(replacement.authorityId, replacement);
      }
    }
    return approved;
  };
  const searchStrings = candidate.searchStrings.filter((surface) => !isApproved(surface));
  const names = candidate.names?.filter((name) => !isApproved(name.text));
  const filtered = searchStrings.length === 0
    ? null
    : {
        ...candidate,
        searchStrings,
        ...(names ? { names } : {}),
      };
  return { candidate: filtered, titleCandidates: [...matched.values()] };
}

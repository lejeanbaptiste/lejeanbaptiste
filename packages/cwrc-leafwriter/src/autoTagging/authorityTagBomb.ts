import {
  candidatePassesDateFilter,
  iterateAuthorityNdjson,
  type DateRangeFilter,
} from './packLoader';
import {
  AUTHORITY_PACKS,
  authorityPackOrigin,
  expandAuthorityPackIds,
  type AuthorityPackId,
} from './packPaths';
import type { AuthorityCandidate } from './authority';

/** CBDB before DILA so overlap merge prefers CBDB metadata as the base. CHGIS before DILA for place dates. */
const PACK_LOAD_ORDER: AuthorityPackId[] = [
  'cbdb-persons',
  'cbdb-places',
  'cbdb-offices',
  'chgis-places',
  'dila-persons',
  'dila-places',
  'wikidata-persons-pre-ming',
  'wikidata-persons-ming',
  'wikidata-persons-qing',
  'wikidata-persons-ja',
  'wikidata-persons-bo',
  'wikidata-places-bo',
  'wikidata-orgs-zh-hant',
  'wikidata-orgs-ja',
  'wikidata-orgs-bo',
  'wikidata-works-zh-hant',
  'wikidata-works-ja',
  'ndl-persons',
  'ndl-places',
  'ndl-orgs',
  'ndl-works',
];

const sortPackIds = (packIds: AuthorityPackId[]): AuthorityPackId[] =>
  [...packIds].sort(
    (a, b) => PACK_LOAD_ORDER.indexOf(a) - PACK_LOAD_ORDER.indexOf(b),
  );
import {
  addCandidateToSeedIndex,
  createAuthoritySeedIndex,
  seedSuggestionsFromIndex,
  suggestionsFromSeedMatches,
} from './seed';
import { dedupeSuggestionsByLocation } from './suggestionFilters';
import type { Suggestion, WhitespacePolicy } from './types';

/** Review panel cap in the app; harness runs should omit this. */
export const MAX_AUTHORITY_SUGGESTIONS = 2000;

export interface AuthorityTagBombOptions {
  dateFilter?: DateRangeFilter;
  /** @deprecated Use {@link dateFilter}. */
  yearRange?: { start: number; end: number };
  /** @deprecated Use {@link dateFilter}. */
  hideUndated?: boolean;
  onProgress?: (message: string) => void;
  /** When set, cap suggestions (UI). Omit for full scoring in validation harness. */
  maxSuggestions?: number;
  /**
   * Pre-built candidates (e.g. from a PEDB/CEDB entities.xml, converted with
   * `candidatesFromEntityDatabase`) folded into the same seed index as the
   * NDJSON packs, subject to the same `dateFilter`. Grouped under `groupLabel`
   * in the returned `loaded` map (e.g. `'pedb-persons'`).
   */
  extraCandidates?: { groupLabel: string; candidates: AuthorityCandidate[] }[];
}

export interface AuthorityTagBombResult {
  suggestions: Suggestion[];
  candidateCount: number;
  matchCount: number;
  loaded: Partial<Record<AuthorityPackId, number>>;
  truncated: boolean;
}

/**
 * Tag bomb on a document: stream NDJSON packs, build matcher index, return
 * tag-stage suggestions. Used by AutoTaggingSession and the validation harness.
 */
export async function runAuthorityTagBombOnDocument(
  doc: Document,
  packIds: AuthorityPackId[],
  readPackFile: (packId: AuthorityPackId) => Promise<string>,
  policy: WhitespacePolicy,
  options: AuthorityTagBombOptions = {},
): Promise<AuthorityTagBombResult> {
  const dateFilter: DateRangeFilter | undefined =
    options.dateFilter ??
    (options.yearRange
      ? {
          mode: 'limit',
          start: options.yearRange.start,
          end: options.yearRange.end,
        }
      : undefined);

  const index = createAuthoritySeedIndex();
  const loaded: Partial<Record<AuthorityPackId, number>> = {};
  let candidateCount = 0;

  // Non-file origins (pedb/cedb/project/list) have no NDJSON to stream —
  // callers route those to `extraCandidates` instead.
  const filePackIds = expandAuthorityPackIds(packIds).filter((id) => {
    const spec = AUTHORITY_PACKS.find((p) => p.id === id);
    return spec ? authorityPackOrigin(spec) === 'file' : true;
  });

  for (const packId of sortPackIds(filePackIds)) {
    options.onProgress?.(`Loading ${packId}…`);
    let packCount = 0;
    const content = await readPackFile(packId);
    for (const candidate of iterateAuthorityNdjson(content)) {
      if (dateFilter && !candidatePassesDateFilter(candidate, dateFilter)) continue;
      addCandidateToSeedIndex(index, candidate);
      packCount += 1;
      candidateCount += 1;
    }
    loaded[packId] = packCount;
  }

  for (const group of options.extraCandidates ?? []) {
    let groupCount = 0;
    for (const candidate of group.candidates) {
      if (dateFilter && !candidatePassesDateFilter(candidate, dateFilter)) continue;
      addCandidateToSeedIndex(index, candidate);
      groupCount += 1;
      candidateCount += 1;
    }
    loaded[group.groupLabel as AuthorityPackId] = groupCount;
  }

  options.onProgress?.(`Matching ${candidateCount.toLocaleString()} authority entries…`);

  const matches = seedSuggestionsFromIndex(doc, index, policy);
  const allSuggestions = suggestionsFromSeedMatches(matches);

  // Deduplicate suggestions by location in case any slipped through
  const deduped = dedupeSuggestionsByLocation(allSuggestions);

  const cap = options.maxSuggestions;
  const truncated = cap != null && deduped.length > cap;
  const suggestions =
    truncated && cap != null ? deduped.slice(0, cap) : deduped;

  return {
    suggestions,
    candidateCount,
    matchCount: matches.length,
    loaded,
    truncated,
  };
}

/** One-line summary for the review panel after a tag bomb (pack counts + matches). */
export function formatAuthorityTagBombNotice(
  result: Pick<
    AuthorityTagBombResult,
    'candidateCount' | 'matchCount' | 'loaded' | 'truncated' | 'suggestions'
  >,
): string | undefined {
  const loadedParts = Object.entries(result.loaded)
    .map(([id, n]) => `${id}: ${(n ?? 0).toLocaleString()}`)
    .join(' · ');
  const parts = [
    `${result.candidateCount.toLocaleString()} entries loaded${loadedParts ? ` (${loadedParts})` : ''}`,
    `${result.matchCount.toLocaleString()} matches in document`,
  ];
  if (result.truncated) {
    parts.push(
      `showing first ${result.suggestions.length.toLocaleString()} suggestions — narrow packs or add a year filter`,
    );
  }
  return parts.join(' · ');
}

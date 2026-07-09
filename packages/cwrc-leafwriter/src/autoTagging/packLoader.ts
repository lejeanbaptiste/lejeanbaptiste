import type { AuthorityCandidate } from './authority';
import { teiTagForCandidate } from './authority';
import { DEFAULT_MIN_MATCH_LENGTH } from './dictionary';
import type { AuthorityPackId } from './packPaths';

export interface YearRangeFilter {
  start: number;
  end: number;
  hideUndated?: boolean;
}

export type DateFilterMode = 'none' | 'limit' | 'exclude';

/** Date filter for authority tag bombs and pack previews. */
export interface DateRangeFilter {
  mode: DateFilterMode;
  start: number;
  end: number;
}

export function normalizeDateRangeFilter(filter: DateRangeFilter): DateRangeFilter {
  return {
    mode: filter.mode,
    start: Math.min(filter.start, filter.end),
    end: Math.max(filter.start, filter.end),
  };
}

function candidateOverlapsYearRange(
  candidate: AuthorityCandidate,
  start: number,
  end: number,
): boolean {
  const meta = candidate.metadata;
  const yearStart = meta?.startYear;
  const yearEnd = meta?.endYear ?? meta?.startYear;
  if (yearStart == null && yearEnd == null) return false;
  const lo = yearStart ?? yearEnd!;
  const hi = yearEnd ?? yearStart!;
  return lo <= end && hi >= start;
}

/**
 * Limit — keep entries overlapping the range (undated excluded; undated DILA places always kept).
 * Exclude — drop entries overlapping the range (undated kept; undated DILA places always kept).
 */
export function candidatePassesDateFilter(
  candidate: AuthorityCandidate,
  filter?: DateRangeFilter,
): boolean {
  if (!filter || filter.mode === 'none') return true;

  const { start, end } = normalizeDateRangeFilter(filter);
  const meta = candidate.metadata;
  const yearStart = meta?.startYear;
  const yearEnd = meta?.endYear ?? meta?.startYear;
  const undated = yearStart == null && yearEnd == null;

  if (undated) {
    // Most DILA places have no date range in the authority file; still match in
    // text rather than being silently excluded by a date filter.
    if (candidate.kind === 'place' && candidate.source === 'DILA') return true;
    return filter.mode === 'exclude';
  }

  const overlaps = candidateOverlapsYearRange(candidate, start, end);
  return filter.mode === 'limit' ? overlaps : !overlaps;
}

/** Parse NDJSON text (one JSON object per line). Avoids split() on huge files. */
export function parseAuthorityNdjson(content: string): AuthorityCandidate[] {
  const out: AuthorityCandidate[] = [];
  for (const row of iterateAuthorityNdjson(content)) out.push(row);
  return out;
}

/** Stream-parse NDJSON without building one giant array (tag-bomb scale). */
export function* iterateAuthorityNdjson(content: string): Generator<AuthorityCandidate> {
  let lineStart = 0;
  while (lineStart <= content.length) {
    const lineEnd = content.indexOf('\n', lineStart);
    const sliceEnd = lineEnd === -1 ? content.length : lineEnd;
    const trimmed = content.slice(lineStart, sliceEnd).trim();
    lineStart = lineEnd === -1 ? content.length + 1 : lineEnd + 1;
    if (!trimmed) continue;
    const row = JSON.parse(trimmed) as AuthorityCandidate;
    if (row.source && row.authorityId && row.kind && row.primaryName && row.searchStrings?.length) {
      yield row;
    }
  }
}

/**
 * A candidate passes when its interval intersects the filter range.
 * Fallback chain: birth/death → start/end metadata → include if undated (unless hideUndated).
 */
export function candidateIntersectsYearRange(
  candidate: AuthorityCandidate,
  range: YearRangeFilter,
): boolean {
  const meta = candidate.metadata;
  const start = meta?.startYear;
  const end = meta?.endYear ?? meta?.startYear;

  if (start == null && end == null) {
    // DILA places have no lifespan in the authority file — still match in text;
    // temporal narrowing belongs in disambiguation, not seed exclusion.
    if (candidate.kind === 'place' && candidate.source === 'DILA') {
      return true;
    }
    return !range.hideUndated;
  }

  const lo = start ?? end!;
  const hi = end ?? start!;
  return lo <= range.end && hi >= range.start;
}

export function filterCandidatesByYear(
  candidates: AuthorityCandidate[],
  range?: YearRangeFilter,
): AuthorityCandidate[] {
  if (!range) return candidates;
  return candidates.filter((c) => candidateIntersectsYearRange(c, range));
}

export interface PackStringCount {
  /** Authority records after the year filter. */
  entities: number;
  /** Unique (tag, surface) pairs the tag bomb would index. */
  uniqueStrings: number;
}

/**
 * Count matchable strings in one NDJSON pack. Uses the same year filter and
 * minimum surface length as the authority tag bomb.
 */
export function countPackUniqueStrings(
  content: string,
  range?: DateRangeFilter | YearRangeFilter,
  minLength: number = DEFAULT_MIN_MATCH_LENGTH,
): PackStringCount {
  const strings = new Set<string>();
  let entities = 0;
  for (const candidate of iterateAuthorityNdjson(content)) {
    if (range && 'mode' in range) {
      if (!candidatePassesDateFilter(candidate, range)) continue;
    } else if (range && !candidateIntersectsYearRange(candidate, range)) {
      continue;
    }
    entities += 1;
    const tag = teiTagForCandidate(candidate);
    for (const surface of candidate.searchStrings) {
      if ([...surface].length < minLength) continue;
      strings.add(`${tag}\0${surface}`);
    }
  }
  return { entities, uniqueStrings: strings.size };
}

export interface LoadedAuthorityPacks {
  candidates: AuthorityCandidate[];
  loaded: Partial<Record<AuthorityPackId, number>>;
}

/** Merge candidates from multiple pack files (already parsed). */
export function mergePackCandidates(
  parts: { packId: AuthorityPackId; candidates: AuthorityCandidate[] }[],
  range?: YearRangeFilter,
): LoadedAuthorityPacks {
  const loaded: Partial<Record<AuthorityPackId, number>> = {};
  const candidates: AuthorityCandidate[] = [];

  for (const part of parts) {
    const filtered = filterCandidatesByYear(part.candidates, range);
    loaded[part.packId] = filtered.length;
    // Never push(...filtered) — large packs exceed the JS argument stack limit.
    for (const candidate of filtered) candidates.push(candidate);
  }

  return { candidates, loaded };
}

/** Clue line for review panel from attached candidates. */
function candidateClueLine(c: AuthorityCandidate): string {
  const base = c.metadata?.description ?? `${c.source} ${c.authorityId} — ${c.primaryName}`;
  const dis = c.metadata?.disambiguation?.trim();
  return dis ? `${base} · not ${dis}` : base;
}

export function rationaleForCandidates(candidates: AuthorityCandidate[]): string | undefined {
  if (candidates.length === 0) return undefined;
  const lines = [...new Set(candidates.map((c) => candidateClueLine(c)))];
  return lines.slice(0, 5).join(' | ');
}

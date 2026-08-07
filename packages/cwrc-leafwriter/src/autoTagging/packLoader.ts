import type { AuthorityCandidate } from './authority';
import { teiTagForCandidate } from './authority';
import { DEFAULT_MIN_MATCH_LENGTH } from './dictionary';
import type { AuthorityPackId } from './packPaths';
import { filterYearsFromMetadata } from './personDates';

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

/**
 * Extra years applied only at lookup time (tag bomb / disambiguation), not in
 * the UI slider. Keeps the visible cutoff honest while casting a wider net —
 * important now that import ignores floruit/index pack years as vitals.
 */
export const DATE_FILTER_LOOKUP_PAD_YEARS = 100;

/**
 * Widen a user-visible date filter for authority matching.
 * - `limit`: expand both ends by {@link DATE_FILTER_LOOKUP_PAD_YEARS}
 * - `exclude`: shift the exclude window later by that many years (so a work
 *   dated 500 still admits people active into the early 600s)
 */
export function dateFilterForLookup(
  filter: DateRangeFilter | undefined,
): DateRangeFilter | undefined {
  if (!filter || filter.mode === 'none') return filter;
  const { mode, start, end } = normalizeDateRangeFilter(filter);
  const pad = DATE_FILTER_LOOKUP_PAD_YEARS;
  if (mode === 'limit') {
    return { mode, start: start - pad, end: end + pad };
  }
  return { mode, start: start + pad, end };
}

/**
 * Exclusion for precise lifespans is anachronism-oriented rather than an
 * interval-overlap test: a person is too late if they were born after the
 * cutoff, or if their mean lifespan date is more than 60 years after it.
 */
export function preciseDateExceedsExcludeLimit(
  startYear: number | undefined,
  endYear: number | undefined,
  limit: number,
): boolean {
  if (startYear != null && startYear > limit) return true;
  if (startYear != null && endYear != null) {
    return (startYear + endYear) / 2 > limit + 60;
  }
  return false;
}

function candidateOverlapsYearRange(
  candidate: AuthorityCandidate,
  start: number,
  end: number,
): boolean {
  const { startYear, endYear } = filterYearsFromMetadata(candidate.metadata);
  if (startYear == null && endYear == null) return false;
  const lo = startYear ?? endYear!;
  const hi = endYear ?? startYear!;
  return lo <= end && hi >= start;
}

/**
 * Limit — keep entries overlapping the range (undated excluded; undated DILA places always kept).
 * Exclude — drop entries overlapping the range (undated kept; undated DILA places always kept).
 *
 * Person filter years include CBDB-style floruit/index anchors (`dateSource`), not only
 * fine birth/death — those anchors never become entity vitals, but they still drive the slider.
 */
export function candidatePassesDateFilter(
  candidate: AuthorityCandidate,
  filter?: DateRangeFilter,
): boolean {
  if (!filter || filter.mode === 'none') return true;

  const { start, end } = normalizeDateRangeFilter(filter);
  const years = filterYearsFromMetadata(candidate.metadata);
  const undated = years.startYear == null && years.endYear == null;

  if (undated) {
    // Most DILA places have no date range in the authority file; still match in
    // text rather than being silently excluded by a date filter.
    if (candidate.kind === 'place' && candidate.source === 'DILA') return true;
    return filter.mode === 'exclude';
  }

  const overlaps =
    filter.mode === 'exclude' && years.isFine
      ? preciseDateExceedsExcludeLimit(years.startYear, years.endYear, start)
      : candidateOverlapsYearRange(candidate, start, end);
  return filter.mode === 'limit' ? overlaps : !overlaps;
}

/**
 * A pack's NDJSON body as handed back by `readPackFile`: either the full text
 * (small packs, test fixtures) or a pre-split array of lines. The desktop
 * bridge always returns the array form — some packs (e.g. CBDB persons) are
 * large enough that joining them back into one string would exceed V8's hard
 * ~512MB single-string ceiling, so every consumer here accepts either shape.
 */
export type AuthorityPackContent = string | readonly string[];

/** Chinese numeral characters used as ordinal/enumeration junk in place/title packs. */
const CHINESE_NUMERAL_ONLY_RE = /^[一二三四五六七八九十百千萬]+$/;

export function isChineseNumeralOnlySurface(surface: string): boolean {
  const s = surface.normalize('NFC').replace(/\s+/g, ' ').trim();
  return s.length > 0 && CHINESE_NUMERAL_ONLY_RE.test(s);
}

/**
 * Drop numeral-only place/work/org/office headwords and search strings so
 * Chinese/Japanese packs cannot tag-bomb 一八 / 十二 as real names. Person
 * packs already exclude these at compile time via personStringPolicy.
 */
function sanitizeAuthorityCandidate(row: AuthorityCandidate): AuthorityCandidate | null {
  const kind = row.kind;
  const scrubPlacesAndTitles =
    kind === 'place' || kind === 'work' || kind === 'org' || kind === 'office';
  if (scrubPlacesAndTitles && isChineseNumeralOnlySurface(row.primaryName)) return null;
  const searchStrings = (row.searchStrings ?? []).filter(
    (surface) => !isChineseNumeralOnlySurface(surface),
  );
  if (!searchStrings.length) return null;
  if (searchStrings.length === row.searchStrings.length) return row;
  return { ...row, searchStrings };
}

/** Normalize pack content into a line array, only splitting when given raw text. */
export function authorityPackLines(content: AuthorityPackContent): readonly string[] {
  return Array.isArray(content) ? content : (content as string).split(/\r?\n/);
}

/** Parse NDJSON text (one JSON object per line). Avoids split() on huge files. */
export function parseAuthorityNdjson(content: AuthorityPackContent): AuthorityCandidate[] {
  const out: AuthorityCandidate[] = [];
  for (const row of iterateAuthorityNdjson(content)) out.push(row);
  return out;
}

/** Stream-parse NDJSON without building one giant array (tag-bomb scale). */
export function* iterateAuthorityNdjson(content: AuthorityPackContent): Generator<AuthorityCandidate> {
  if (Array.isArray(content)) {
    for (const rawLine of content) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;
      const row = JSON.parse(trimmed) as AuthorityCandidate;
      if (row.source && row.authorityId && row.kind && row.primaryName && row.searchStrings?.length) {
        const sanitized = sanitizeAuthorityCandidate(row);
        if (sanitized) yield sanitized;
      }
    }
    return;
  }

  const text = content as string;
  let lineStart = 0;
  while (lineStart <= text.length) {
    const lineEnd = text.indexOf('\n', lineStart);
    const sliceEnd = lineEnd === -1 ? text.length : lineEnd;
    const trimmed = text.slice(lineStart, sliceEnd).trim();
    lineStart = lineEnd === -1 ? text.length + 1 : lineEnd + 1;
    if (!trimmed) continue;
    const row = JSON.parse(trimmed) as AuthorityCandidate;
    if (row.source && row.authorityId && row.kind && row.primaryName && row.searchStrings?.length) {
      const sanitized = sanitizeAuthorityCandidate(row);
      if (sanitized) yield sanitized;
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
  const { startYear: start, endYear: end } = filterYearsFromMetadata(candidate.metadata);

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
 * Count matchable strings in an already-loaded set of candidates (e.g. a
 * PEDB/CEDB entities.xml converted via `candidatesFromEntityDatabase`). Uses
 * the same year filter and minimum surface length as the authority tag bomb.
 */
export function countCandidatesUniqueStrings(
  candidates: Iterable<AuthorityCandidate>,
  range?: DateRangeFilter | YearRangeFilter,
  minLength: number = DEFAULT_MIN_MATCH_LENGTH,
): PackStringCount {
  const strings = new Set<string>();
  let entities = 0;
  for (const candidate of candidates) {
    if (range && 'mode' in range) {
      if (!candidatePassesDateFilter(candidate, range)) continue;
    } else if (range && !candidateIntersectsYearRange(candidate, range)) {
      continue;
    }
    entities += 1;
    const tag = teiTagForCandidate(candidate);
    for (const surface of candidate.searchStrings) {
      if (isChineseNumeralOnlySurface(surface)) continue;
      if ([...surface].length < minLength) continue;
      strings.add(`${tag}\0${surface}`);
    }
  }
  return { entities, uniqueStrings: strings.size };
}

/**
 * Count matchable strings in one NDJSON pack. Uses the same year filter and
 * minimum surface length as the authority tag bomb.
 */
export function countPackUniqueStrings(
  content: AuthorityPackContent,
  range?: DateRangeFilter | YearRangeFilter,
  minLength: number = DEFAULT_MIN_MATCH_LENGTH,
): PackStringCount {
  return countCandidatesUniqueStrings(iterateAuthorityNdjson(content), range, minLength);
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

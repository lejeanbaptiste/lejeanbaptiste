import type { AuthorityCandidate } from './authority';
import type { AuthorityPackId } from './packPaths';

export interface YearRangeFilter {
  start: number;
  end: number;
  hideUndated?: boolean;
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
  if (candidates.length === 1) {
    return candidateClueLine(candidates[0]!);
  }
  return candidates
    .slice(0, 5)
    .map((c) => candidateClueLine(c))
    .join(' | ');
}

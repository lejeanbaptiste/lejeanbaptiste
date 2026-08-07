/**
 * Segregate real birth/death / floruit years from index-year filter anchors.
 *
 * Authority packs put temporal handles on `metadata.startYear`/`endYear` for the
 * date slider. Semantics:
 *   - fine → birth/death vitals (importable)
 *   - floruit → real floruit earliest/latest (store as dates + precision fl.)
 *   - index → CBDB mean/reference year only (filter; never show/store as fl.)
 *   - nationality → dynasty spans for filter fallback only
 *
 * Mirrors `authority extraction/shared/personDates.mjs`.
 */

export type PersonDateSource = 'fine' | 'floruit' | 'index' | 'nationality';

export interface PersonDateMetadata {
  dateSource?: PersonDateSource | string | null;
  startYear?: number | null;
  endYear?: number | null;
  nationality?: Array<{
    startYear?: number | null;
    endYear?: number | null;
  }> | null;
}

/** Treat CBDB/legacy sentinel `0` (and non-finite values) as missing. */
export function finiteBiographicalYear(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n === 0) return null;
  return n;
}

/**
 * Years safe to treat as birth/death vitals (entity import / TEI birth–death).
 * Floruit, index, nationality, and legacy undated packs return empty.
 */
export function biographicalYearsFromMetadata(
  meta: PersonDateMetadata | null | undefined,
): { startYear?: number; endYear?: number } {
  if (!meta || meta.dateSource !== 'fine') return {};
  const startYear = finiteBiographicalYear(meta.startYear);
  const endYear = finiteBiographicalYear(meta.endYear);
  return {
    ...(startYear != null ? { startYear } : {}),
    ...(endYear != null ? { endYear } : {}),
  };
}

/**
 * Real floruit earliest/latest from packs (`dateSource: 'floruit'`).
 * Stored as `date_kind=dates` + `start_precision=fl.`, never as birth/death.
 */
export function floruitYearsFromMetadata(
  meta: PersonDateMetadata | null | undefined,
): { startYear?: number; endYear?: number } {
  if (!meta || meta.dateSource !== 'floruit') return {};
  const startYear = finiteBiographicalYear(meta.startYear);
  const endYear = finiteBiographicalYear(meta.endYear) ?? startYear;
  const resolvedStart = startYear ?? endYear;
  if (resolvedStart == null) return {};
  return {
    startYear: resolvedStart,
    endYear: endYear ?? resolvedStart,
  };
}

/**
 * Whether startYear/endYear on the pack row are a filter interval (fine,
 * floruit, or index). Dynasty-only rows use nationality[] instead.
 */
export function hasFilterInterval(meta: PersonDateMetadata | null | undefined): boolean {
  if (!meta) return false;
  if (meta.dateSource === 'nationality') return false;
  // Legacy packs omitted dateSource but set years — treat as filter interval.
  if (meta.dateSource == null) {
    return meta.startYear != null || meta.endYear != null;
  }
  return meta.dateSource === 'fine' || meta.dateSource === 'floruit' || meta.dateSource === 'index';
}

/**
 * Years used by the Disambiguate / tag-bomb date filter.
 * Prefer pack start/end when they are a declared filter interval; otherwise fall
 * back to nationality dynasty spans (±60), matching the pre-dateSource behaviour.
 */
export function filterYearsFromMetadata(
  meta: PersonDateMetadata | null | undefined,
): { startYear?: number; endYear?: number; isFine: boolean } {
  if (!meta) return { isFine: false };

  if (hasFilterInterval(meta)) {
    const startYear = finiteBiographicalYear(meta.startYear);
    const endYear = finiteBiographicalYear(meta.endYear) ?? startYear;
    const resolvedStart = startYear ?? endYear;
    if (resolvedStart == null) return { isFine: false };
    return {
      startYear: resolvedStart,
      endYear: endYear ?? resolvedStart,
      isFine: meta.dateSource === 'fine' || meta.dateSource == null,
    };
  }

  const nationalityYears = (meta.nationality ?? []).flatMap((n) =>
    n.startYear != null || n.endYear != null
      ? [{ start: n.startYear ?? n.endYear!, end: n.endYear ?? n.startYear! }]
      : [],
  );
  if (!nationalityYears.length) return { isFine: false };
  return {
    startYear: Math.min(...nationalityYears.map((n) => n.start)) - 60,
    endYear: Math.max(...nationalityYears.map((n) => n.end)) + 60,
    isFine: false,
  };
}

/**
 * True when pack years are filter anchors only (never show/store as fl. or vitals).
 * Real floruit is NOT filter-only.
 */
export function isFilterOnlyDateSource(
  dateSource: PersonDateSource | string | null | undefined,
): boolean {
  return dateSource === 'index' || dateSource === 'nationality';
}

/**
 * Strip CBDB index-year clues that older packs mislabeled as `fl. YEAR`.
 * Only call when `dateSource === 'index'` — leave real floruit `fl. A–B` alone.
 */
export function scrubIndexYearFloruitClue(description: string | undefined | null): string | undefined {
  if (!description) return description ?? undefined;
  const scrubbed = description
    .replace(/(?:,\s*)?fl\.\s*[+-]?\d+(?:\s*[–\-~～]\s*[+-]?\d+)?/gi, '')
    .replace(/\(\s*,\s*/g, '(')
    .replace(/,\s*\)/g, ')')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return scrubbed || undefined;
}

/** @deprecated Use {@link scrubIndexYearFloruitClue}. */
export const scrubFilterOnlyFloruitClue = scrubIndexYearFloruitClue;

/** True when a stored year should never be preferred as a person lifespan. */
export function isSentinelOrMissingYear(value: unknown): boolean {
  return finiteBiographicalYear(value) == null;
}

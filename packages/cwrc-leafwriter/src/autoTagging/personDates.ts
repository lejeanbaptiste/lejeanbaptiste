/**
 * Segregate real birth/death years from tagging-pack filter anchors.
 *
 * Authority packs may put floruit / index / dynasty-adjacent intervals on
 * `metadata.startYear`/`endYear` for the date slider. Those must never become
 * TEI `<birth>`/`<death>` or PEDB/CEDB user ("Central") lifespan dates.
 *
 * Mirrors `authority extraction/shared/personDates.mjs`.
 */

export type PersonDateSource = 'fine' | 'floruit' | 'index' | 'nationality';

export interface PersonDateMetadata {
  dateSource?: PersonDateSource | string | null;
  startYear?: number | null;
  endYear?: number | null;
}

/** Treat CBDB/legacy sentinel `0` (and non-finite values) as missing. */
export function finiteBiographicalYear(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n === 0) return null;
  return n;
}

/**
 * Years safe to treat as biographical truth (entity import / TEI birth–death).
 * Filter-only anchors (floruit, index, nationality, legacy undated packs that
 * only carry a dynasty span) return empty.
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

/** True when a stored year should never be preferred as a person lifespan. */
export function isSentinelOrMissingYear(value: unknown): boolean {
  return finiteBiographicalYear(value) == null;
}

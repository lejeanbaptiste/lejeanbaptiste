import {
  biographicalYearsFromMetadata,
  filterYearsFromMetadata,
  floruitYearsFromMetadata,
  isFilterOnlyDateSource,
} from './personDates';

/**
 * A dynasty span is not a lifespan.
 *
 * Nationality/dynasty years are useful for *filtering* candidates by period, and
 * nothing here objects to that. What they must never become is a person's dates:
 * not stored as birth/death, not shown as the person's span on the disambiguation
 * panel. That holds for every authority — CBDB, DILA and Norbert alike — so these
 * cases are written per source rather than for the one that happened to fail.
 *
 * The regression that prompted this: 劉景素 (Norbert person-3841) has no dates of
 * his own, only `dynasties: [{ 劉宋, 420–479 }]`. He acquired birth 420 / death
 * 479, and the panel showed "360–539" — that span widened by the ±60 filter
 * window. Every guard that should have stopped it keys on `metadata.dateSource`,
 * and the Norbert pack sets that field on none of its 16,050 rows.
 */

/** Norbert: dynasty span only, and — as the real pack does — no `dateSource`. */
const norbertUnlabelled = {
  dynasty: '劉宋',
  dynasties: [{ id: 'dynasty:83', label: '劉宋', startYear: 420, endYear: 479 }],
  nationality: [{ id: 'Norbert:dynasty:83', label: '劉宋' }],
};

/** CBDB/DILA shape: the same derivation, but the pack does label it. */
const labelledNationality = {
  dateSource: 'nationality' as const,
  nationality: [{ label: '南齊', startYear: 479, endYear: 502 }],
};

describe('dynasty-derived years are filter anchors, never vitals', () => {
  it.each([
    ['Norbert (unlabelled)', norbertUnlabelled],
    ['CBDB/DILA (labelled nationality)', labelledNationality],
  ])('%s: yields a usable filter range', (_name, meta) => {
    const years = filterYearsFromMetadata(meta);
    expect(years.startYear).toBeDefined();
    expect(years.endYear).toBeDefined();
    expect(years.derivedFromDynasty).toBe(true);
  });

  it.each([
    ['Norbert (unlabelled)', norbertUnlabelled],
    ['CBDB/DILA (labelled nationality)', labelledNationality],
  ])('%s: never becomes birth/death', (_name, meta) => {
    expect(biographicalYearsFromMetadata(meta)).toEqual({});
  });

  it.each([
    ['Norbert (unlabelled)', norbertUnlabelled],
    ['CBDB/DILA (labelled nationality)', labelledNationality],
  ])('%s: never becomes a floruit', (_name, meta) => {
    expect(floruitYearsFromMetadata(meta)).toEqual({});
  });

  // `formatCandidatePeriod` prints the dynasty label instead of a year range for
  // these two sources, and the import path keys on the same predicate — so this is
  // what keeps the years off the panel and out of the database.
  it.each([
    ['Norbert (unlabelled)', norbertUnlabelled],
    ['CBDB/DILA (labelled nationality)', labelledNationality],
  ])('%s: resolves to a filter-only dateSource', (_name, meta) => {
    const derived = filterYearsFromMetadata(meta).derivedFromDynasty
      ? 'nationality'
      : (meta as { dateSource?: string }).dateSource;
    expect(isFilterOnlyDateSource(derived)).toBe(true);
  });

  it("leaves a person's own dates alone", () => {
    const ownDates = { dateSource: 'fine' as const, startYear: 452, endYear: 476 };
    expect(filterYearsFromMetadata(ownDates).derivedFromDynasty).toBeUndefined();
    expect(biographicalYearsFromMetadata(ownDates)).toEqual({ startYear: 452, endYear: 476 });
    expect(isFilterOnlyDateSource('fine')).toBe(false);
  });
});

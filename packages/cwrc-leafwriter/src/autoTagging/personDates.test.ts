import {
  biographicalYearsFromMetadata,
  filterYearsFromMetadata,
  finiteBiographicalYear,
  floruitYearsFromMetadata,
  hasFilterInterval,
  isFilterOnlyDateSource,
  scrubIndexYearFloruitClue,
} from './personDates';

describe('personDates', () => {
  it('imports only dateSource=fine years as birth/death vitals', () => {
    expect(
      biographicalYearsFromMetadata({ dateSource: 'fine', startYear: 78, endYear: 139 }),
    ).toEqual({ startYear: 78, endYear: 139 });
    expect(
      biographicalYearsFromMetadata({ dateSource: 'floruit', startYear: 479, endYear: 502 }),
    ).toEqual({});
    expect(
      biographicalYearsFromMetadata({ dateSource: 'index', startYear: 450, endYear: 510 }),
    ).toEqual({});
    expect(biographicalYearsFromMetadata({ startYear: 479, endYear: 502 })).toEqual({});
  });

  it('exposes floruit earliest/latest for storage as fl. ranges', () => {
    expect(
      floruitYearsFromMetadata({ dateSource: 'floruit', startYear: 479, endYear: 502 }),
    ).toEqual({ startYear: 479, endYear: 502 });
    expect(
      floruitYearsFromMetadata({ dateSource: 'index', startYear: 1035, endYear: 1095 }),
    ).toEqual({});
    expect(floruitYearsFromMetadata({ dateSource: 'fine', startYear: 78, endYear: 139 })).toEqual(
      {},
    );
  });

  it('treats year 0 as missing', () => {
    expect(finiteBiographicalYear(0)).toBeNull();
    expect(
      biographicalYearsFromMetadata({ dateSource: 'fine', startYear: 0, endYear: 522 }),
    ).toEqual({ endYear: 522 });
  });

  it('exposes floruit/index intervals for filtering; only index/nationality are filter-only', () => {
    expect(hasFilterInterval({ dateSource: 'floruit', startYear: 479, endYear: 502 })).toBe(true);
    expect(hasFilterInterval({ dateSource: 'index', startYear: 1035, endYear: 1095 })).toBe(true);
    expect(hasFilterInterval({ dateSource: 'nationality' })).toBe(false);
    expect(
      filterYearsFromMetadata({ dateSource: 'index', startYear: 1035, endYear: 1095 }),
    ).toEqual({
      startYear: 1035,
      endYear: 1095,
      isFine: false,
    });
    expect(filterYearsFromMetadata({ dateSource: 'fine', startYear: 78, endYear: 139 })).toEqual({
      startYear: 78,
      endYear: 139,
      isFine: true,
    });
    expect(isFilterOnlyDateSource('floruit')).toBe(false);
    expect(isFilterOnlyDateSource('index')).toBe(true);
    expect(isFilterOnlyDateSource('nationality')).toBe(true);
    expect(isFilterOnlyDateSource('fine')).toBe(false);
  });

  it('falls back to nationality spans when dateSource is nationality', () => {
    expect(
      filterYearsFromMetadata({
        dateSource: 'nationality',
        nationality: [{ startYear: 420, endYear: 479 }],
      }),
    ).toEqual({ startYear: 360, endYear: 539, isFine: false, derivedFromDynasty: true });
  });

  it('falls back to dynasties[] when nationality has labels but no years (Norbert)', () => {
    expect(
      filterYearsFromMetadata({
        dateSource: 'nationality',
        nationality: [{}],
        dynasties: [{ startYear: 557, endYear: 581 }],
      }),
    ).toEqual({ startYear: 497, endYear: 641, isFine: false, derivedFromDynasty: true });
  });

  // Regression: 劉景素 (Norbert person-3841) carries no dates of his own, only
  // `dynasties: [{ 劉宋, 420–479 }]`. Those years reached the entity as birth 420 /
  // death 479, and the ±60 filter window (360–539) was shown on the disambiguation
  // panel as his dates. Every guard that would have stopped it keys on
  // `dateSource`, which the Norbert pack never sets — so the years have to
  // announce their own provenance.
  it('marks dynasty-derived years as such even when the pack sets no dateSource', () => {
    const result = filterYearsFromMetadata({
      dynasties: [{ label: '劉宋', startYear: 420, endYear: 479 }],
    });
    expect(result.derivedFromDynasty).toBe(true);
    expect(result.isFine).toBe(false);
    // The window is a filter anchor, never a lifespan.
    expect(result).toMatchObject({ startYear: 360, endYear: 539 });
  });

  it("does not mark a person's own years as dynasty-derived", () => {
    expect(
      filterYearsFromMetadata({ dateSource: 'fine', startYear: 452, endYear: 476 })
        .derivedFromDynasty,
    ).toBeUndefined();
  });

  it('prefers nationality years over dynasties when both are present', () => {
    expect(
      filterYearsFromMetadata({
        dateSource: 'nationality',
        nationality: [{ startYear: 420, endYear: 479 }],
        dynasties: [{ startYear: 557, endYear: 581 }],
      }),
    ).toEqual({ startYear: 360, endYear: 539, isFine: false, derivedFromDynasty: true });
  });

  it('scrubs index-year fl. clues but leaves real floruit ranges when not scrubbing', () => {
    expect(scrubIndexYearFloruitClue('王安石 (Wang Anshi, fl. 1065, 宋 Song)')).toBe(
      '王安石 (Wang Anshi, 宋 Song)',
    );
    expect(scrubIndexYearFloruitClue('某人 (fl. 479–502)')).toBe('某人');
    expect(scrubIndexYearFloruitClue('張衡 (78–139)')).toBe('張衡 (78–139)');
  });
});

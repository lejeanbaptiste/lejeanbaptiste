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
    expect(floruitYearsFromMetadata({ dateSource: 'index', startYear: 1035, endYear: 1095 })).toEqual(
      {},
    );
    expect(floruitYearsFromMetadata({ dateSource: 'fine', startYear: 78, endYear: 139 })).toEqual({});
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
    expect(filterYearsFromMetadata({ dateSource: 'index', startYear: 1035, endYear: 1095 })).toEqual(
      {
        startYear: 1035,
        endYear: 1095,
        isFine: false,
      },
    );
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
    ).toEqual({ startYear: 360, endYear: 539, isFine: false });
  });

  it('falls back to dynasties[] when nationality has labels but no years (Norbert)', () => {
    expect(
      filterYearsFromMetadata({
        dateSource: 'nationality',
        nationality: [{}],
        dynasties: [{ startYear: 557, endYear: 581 }],
      }),
    ).toEqual({ startYear: 497, endYear: 641, isFine: false });
  });

  it('prefers nationality years over dynasties when both are present', () => {
    expect(
      filterYearsFromMetadata({
        dateSource: 'nationality',
        nationality: [{ startYear: 420, endYear: 479 }],
        dynasties: [{ startYear: 557, endYear: 581 }],
      }),
    ).toEqual({ startYear: 360, endYear: 539, isFine: false });
  });

  it('scrubs index-year fl. clues but leaves real floruit ranges when not scrubbing', () => {
    expect(scrubIndexYearFloruitClue('王安石 (Wang Anshi, fl. 1065, 宋 Song)')).toBe(
      '王安石 (Wang Anshi, 宋 Song)',
    );
    expect(scrubIndexYearFloruitClue('某人 (fl. 479–502)')).toBe('某人');
    expect(scrubIndexYearFloruitClue('張衡 (78–139)')).toBe('張衡 (78–139)');
  });
});

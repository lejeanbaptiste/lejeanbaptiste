import {
  biographicalYearsFromMetadata,
  finiteBiographicalYear,
} from './personDates';

describe('personDates', () => {
  it('imports only dateSource=fine years', () => {
    expect(
      biographicalYearsFromMetadata({ dateSource: 'fine', startYear: 78, endYear: 139 }),
    ).toEqual({ startYear: 78, endYear: 139 });
    expect(
      biographicalYearsFromMetadata({ dateSource: 'floruit', startYear: 479, endYear: 502 }),
    ).toEqual({});
    expect(
      biographicalYearsFromMetadata({ dateSource: 'index', startYear: 450, endYear: 510 }),
    ).toEqual({});
    expect(
      biographicalYearsFromMetadata({ startYear: 479, endYear: 502 }),
    ).toEqual({});
  });

  it('treats year 0 as missing', () => {
    expect(finiteBiographicalYear(0)).toBeNull();
    expect(
      biographicalYearsFromMetadata({ dateSource: 'fine', startYear: 0, endYear: 522 }),
    ).toEqual({ endYear: 522 });
  });
});

import {
  AUTHORITY_YEAR_MAX,
  DEFAULT_AUTHORITY_DATE_FILTER,
  DEFAULT_AUTHORITY_YEAR_RANGE,
  excludedNameTypesFromSettings,
  migrateDateFilter,
  uiStateFromSettings,
} from './authoritySettings';

describe('authoritySettings', () => {
  it('defaults to the Eastern Han preset when no work year is known', () => {
    expect(migrateDateFilter(undefined)).toBe(DEFAULT_AUTHORITY_DATE_FILTER);
    expect(uiStateFromSettings(undefined).yearRange).toEqual(DEFAULT_AUTHORITY_YEAR_RANGE);
  });

  it('defaults to excluding from the work year to the slider max once the active file has one', () => {
    expect(migrateDateFilter(undefined, 400)).toBe('exclude');
    expect(uiStateFromSettings(undefined, 400).dateFilter).toBe('exclude');
    expect(uiStateFromSettings(undefined, 400).yearRange).toEqual([400, AUTHORITY_YEAR_MAX]);
  });

  it('lets an explicit persisted setting override the work-year default', () => {
    expect(migrateDateFilter({ dateFilter: 'limit' }, 400)).toBe('limit');
    expect(migrateDateFilter({ yearFilterEnabled: false }, 400)).toBe('none');
    expect(uiStateFromSettings({ yearStart: 618, yearEnd: 907 }, 400).yearRange).toEqual([
      618, 907,
    ]);
  });

  it('excludes courtesy names from tagging by default, honoring persisted overrides', () => {
    expect(excludedNameTypesFromSettings(undefined)).toEqual(['courtesy']);
    expect(excludedNameTypesFromSettings({ excludedNameTypes: [] })).toEqual([]);
    expect(
      excludedNameTypesFromSettings({ excludedNameTypes: ['courtesy', 'art', 'bogus'] }),
    ).toEqual(['courtesy', 'art']);
  });
});

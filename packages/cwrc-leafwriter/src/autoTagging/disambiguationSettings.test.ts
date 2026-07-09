import {
  aiCurationFromSettings,
  dateFilterFromSettings,
  DEFAULT_DISAMBIGUATION_DATE_FILTER,
  DEFAULT_DISAMBIGUATION_YEAR_RANGE,
  yearRangeFromSettings,
} from './disambiguationSettings';

describe('disambiguationSettings', () => {
  it('defaults AI curation to on', () => {
    expect(aiCurationFromSettings(undefined)).toBe(true);
    expect(aiCurationFromSettings({})).toBe(true);
    expect(aiCurationFromSettings({ aiCuration: false })).toBe(false);
  });

  it('defaults the date filter to none, unlike the tag-bomb dialog', () => {
    expect(DEFAULT_DISAMBIGUATION_DATE_FILTER).toBe('none');
    expect(dateFilterFromSettings(undefined)).toBe('none');
    expect(dateFilterFromSettings({})).toBe('none');
    expect(dateFilterFromSettings({ dateFilter: 'limit' })).toBe('limit');
    expect(dateFilterFromSettings({ dateFilter: 'exclude' })).toBe('exclude');
  });

  it('reads back a persisted year range, normalized', () => {
    expect(yearRangeFromSettings(undefined)).toEqual(DEFAULT_DISAMBIGUATION_YEAR_RANGE);
    expect(yearRangeFromSettings({ yearStart: 618, yearEnd: 907 })).toEqual([618, 907]);
    expect(yearRangeFromSettings({ yearStart: 907, yearEnd: 618 })).toEqual([618, 907]);
  });

  it('defaults to excluding from the work year to 2000 once the active file has one', () => {
    expect(dateFilterFromSettings(undefined, 400)).toBe('exclude');
    expect(yearRangeFromSettings(undefined, 400)).toEqual([400, 2000]);
    // An explicit persisted override still wins over the work-year default.
    expect(dateFilterFromSettings({ dateFilter: 'limit' }, 400)).toBe('limit');
    expect(yearRangeFromSettings({ yearStart: 618, yearEnd: 907 }, 400)).toEqual([618, 907]);
  });
});

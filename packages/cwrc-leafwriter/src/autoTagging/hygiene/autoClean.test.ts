import {
  collapseRomanizationSpaces,
  isJoinableRomanizationDiff,
  scanJoinableRomanizations,
  scanOrphanShortNameSplits,
} from './autoClean';
import type { EntitySummary } from '../entityOps';

const basePerson = (overrides: Partial<EntitySummary> & { id?: string } = {}): EntitySummary => ({
  id: overrides.id ?? 'p1',
  kind: 'person',
  names: overrides.names ?? ['李淳風'],
  nameEntries: overrides.nameEntries ?? [{ text: '李淳風', lang: 'zh-Hant', type: 'primary' }],
  romanized: overrides.romanized ?? null,
  description: overrides.description ?? null,
  authorities: overrides.authorities ?? [],
  familyName: overrides.familyName ?? null,
  givenName: overrides.givenName ?? null,
  startYear: overrides.startYear ?? null,
  endYear: overrides.endYear ?? null,
  workDate: null,
  nationalities: overrides.nationalities ?? [],
  placesOfOrigin: overrides.placesOfOrigin ?? [],
  authors: [],
  nobleTitles: [],
  roles: [],
  origins: [],
  rejectedCount: 0,
  rejectedAssertions: [],
  rejectedConcordances: [],
  assertions: overrides.assertions ?? [],
});

describe('isJoinableRomanizationDiff', () => {
  it('treats spaced given-name parts as joinable when letters match', () => {
    expect(isJoinableRomanizationDiff('Li Chun Feng', 'Li Chunfeng')).toBe(true);
    expect(isJoinableRomanizationDiff('Tuoba Jian', 'Tuobajian')).toBe(true);
  });

  it('rejects letter mismatches', () => {
    expect(isJoinableRomanizationDiff('Yuan Jian', 'Tuoba Jian')).toBe(false);
    expect(collapseRomanizationSpaces('Li Chun Feng')).toBe('lichunfeng');
  });
});

describe('scanJoinableRomanizations', () => {
  it('proposes Li Chunfeng for Li Chun Feng', () => {
    const entity = basePerson({
      id: 'p3',
      familyName: '李',
      givenName: '淳風',
      romanized: 'Li Chun Feng',
    });
    const findings = scanJoinableRomanizations([entity], 'zh-Hant');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.proposal).toEqual({ action: 'setRomanized', text: 'Li Chunfeng' });
  });

  it('ignores letter-mismatched pinyin', () => {
    const entity = basePerson({
      familyName: '拓拔',
      givenName: '建',
      romanized: 'Yuan Jian',
    });
    expect(scanJoinableRomanizations([entity], 'zh-Hant')).toEqual([]);
  });
});

describe('scanOrphanShortNameSplits', () => {
  it('suggests a split for short orphan primaries', () => {
    const entity = basePerson({
      id: 'orphan',
      names: ['李淳風'],
      authorities: [],
      familyName: null,
      givenName: null,
    });
    const findings = scanOrphanShortNameSplits([entity], 'zh-Hant');
    expect(findings[0]?.proposal).toMatchObject({
      action: 'setFamilyGiven',
      familyName: '李',
      givenName: '淳風',
    });
  });

  it('skips authority-linked people', () => {
    const entity = basePerson({
      authorities: [{ type: 'norbert', value: 'person-1' }],
    });
    expect(scanOrphanShortNameSplits([entity], 'zh-Hant')).toEqual([]);
  });
});

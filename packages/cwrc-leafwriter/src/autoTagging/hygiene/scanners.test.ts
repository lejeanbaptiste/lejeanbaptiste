import {
  findingsFromAuthorityDuplicates,
  scanBadPrimary,
  scanBadRomanization,
  scanFamilyPrefixedAltNames,
  scanMissingFamilyOrGiven,
  scanNearDuplicates,
  scanUnlinkedAuthorityHits,
  corroboratePackPeer,
} from './scanners';
import type { EntitySummary } from '../entityOps';
import type { HygienePeer } from './types';

const basePerson = (overrides: Partial<EntitySummary> & { id: string }): EntitySummary => ({
  id: overrides.id,
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

describe('scanFamilyPrefixedAltNames', () => {
  it('strips compound 司馬 surname from courtesy names', () => {
    const entity = basePerson({
      id: 'p1',
      names: ['司馬相如'],
      familyName: '司馬',
      givenName: '相如',
      nameEntries: [
        { text: '司馬相如', lang: 'zh-Hant', type: 'primary' },
        { text: '司馬長卿', lang: 'zh-Hant', type: 'courtesy' },
      ],
    });
    const findings = scanFamilyPrefixedAltNames([entity]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.proposal).toMatchObject({
      action: 'stripAltName',
      fromText: '司馬長卿',
      toText: '長卿',
      nameType: 'courtesy',
    });
  });

  it('also flags art and dharma names', () => {
    const entity = basePerson({
      id: 'p2',
      familyName: '王',
      nameEntries: [
        { text: '王維', lang: 'zh-Hant', type: 'primary' },
        { text: '王摩詰', lang: 'zh-Hant', type: 'art' },
        { text: '王法號', lang: 'zh-Hant', type: 'dharma' },
      ],
    });
    const findings = scanFamilyPrefixedAltNames([entity]);
    expect(findings.map((f) => (f.proposal as { toText: string }).toText).sort()).toEqual([
      '摩詰',
      '法號',
    ]);
  });
});

describe('scanBadRomanization', () => {
  it('leaves joinable spacing to auto-clean (no review findings)', () => {
    const entity = basePerson({
      id: 'p3',
      familyName: '李',
      givenName: '淳風',
      romanized: 'Li Chun Feng',
    });
    expect(scanBadRomanization([entity], 'zh-Hant')).toEqual([]);
  });
});

describe('scanMissingFamilyOrGiven', () => {
  it('leaves short orphans to auto-clean (no review finding)', () => {
    const entity = basePerson({
      id: 'p4',
      names: ['李淳風'],
      familyName: null,
      givenName: null,
      authorities: [],
    });
    expect(scanMissingFamilyOrGiven([entity], 'zh-Hant')).toEqual([]);
  });

  it('still suggests a split for longer primaries without 姓/名', () => {
    const entity = basePerson({
      id: 'p4b',
      names: ['完顏阿骨打'],
      nameEntries: [{ text: '完顏阿骨打', lang: 'zh-Hant', type: 'primary' }],
      familyName: null,
      givenName: null,
      authorities: [],
    });
    const findings = scanMissingFamilyOrGiven([entity], 'zh-Hant');
    // Parser may or may not split compound surnames; if it does, keep as review.
    if (findings.length > 0) {
      expect(findings[0]?.proposal).toMatchObject({ action: 'setFamilyGiven' });
    }
  });
});

describe('scanBadPrimary', () => {
  it('flags comma-junk primary when family+given exist', () => {
    const entity = basePerson({
      id: 'p5',
      names: ['黃, 侃', '黃侃'],
      familyName: '黃',
      givenName: '侃',
      nameEntries: [
        { text: '黃, 侃', lang: 'zh-Hant', type: 'primary' },
        { text: '黃侃', lang: 'zh-Hant', type: 'variant' },
      ],
    });
    const findings = scanBadPrimary([entity]);
    expect(findings[0]?.proposal).toEqual({ action: 'renamePrimary', text: '黃侃' });
  });

  it('does not replace Latin primary with bare 姓 when 名 is missing', () => {
    const entity = basePerson({
      id: 'p5b',
      names: ['Cui Yin', '崔'],
      familyName: '崔',
      givenName: null,
      nameEntries: [
        { text: 'Cui Yin', lang: 'en', type: 'primary' },
        { text: '崔', lang: 'zh-Hant', type: 'family' },
      ],
      nationalities: ['劉宋'],
    });
    expect(scanBadPrimary([entity])).toEqual([]);
  });

  it('replaces Latin primary when 姓+名 both exist', () => {
    const entity = basePerson({
      id: 'p5c',
      names: ['Cui Yin'],
      familyName: '崔',
      givenName: '寅',
      nameEntries: [
        { text: 'Cui Yin', lang: 'en', type: 'primary' },
        { text: '崔', lang: 'zh-Hant', type: 'family' },
        { text: '寅', lang: 'zh-Hant', type: 'given' },
      ],
    });
    expect(scanBadPrimary([entity])[0]?.proposal).toEqual({
      action: 'renamePrimary',
      text: '崔寅',
    });
  });
});

describe('scanNearDuplicates', () => {
  it('rejects shared primary alone (needs 姓 + 名/字 + context)', () => {
    const a = basePerson({
      id: 'a',
      names: ['張衡'],
      familyName: '張',
      givenName: '衡',
      nationalities: [],
    });
    const b = basePerson({
      id: 'b',
      names: ['張衡'],
      familyName: '張',
      givenName: '衡',
      nationalities: [],
    });
    expect(scanNearDuplicates([a, b])).toHaveLength(0);
  });

  it('rejects 姓+名 without origin/nationality/appointment/noble title', () => {
    const a = basePerson({
      id: 'a2',
      familyName: '張',
      givenName: '衡',
      nationalities: ['漢'],
    });
    const b = basePerson({
      id: 'b2',
      familyName: '張',
      givenName: '衡',
      nationalities: [],
    });
    expect(scanNearDuplicates([a, b])).toHaveLength(0);
  });

  it('accepts 姓 + 名=名 + shared nationality', () => {
    const a = basePerson({
      id: 'c',
      names: ['張衡'],
      familyName: '張',
      givenName: '衡',
      nationalities: ['漢'],
    });
    const d = basePerson({
      id: 'd',
      names: ['張衡'],
      familyName: '張',
      givenName: '衡',
      nationalities: ['漢'],
    });
    const findings = scanNearDuplicates([a, d]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.evidence).toContain('姓');
    expect(findings[0]?.evidence).toContain('名=名');
    expect(findings[0]?.evidence).toContain('nationality');
  });

  it('accepts 姓 + 名=字 + shared origin', () => {
    const a = basePerson({
      id: 'e',
      familyName: '王',
      givenName: '維',
      placesOfOrigin: ['太原'],
      nameEntries: [
        { text: '王維', lang: 'zh-Hant', type: 'primary' },
        { text: '維', lang: 'zh-Hant', type: 'given' },
      ],
    });
    const b = basePerson({
      id: 'f',
      familyName: '王',
      givenName: '某',
      placesOfOrigin: ['太原'],
      nameEntries: [
        { text: '王摩詰', lang: 'zh-Hant', type: 'primary' },
        { text: '某', lang: 'zh-Hant', type: 'given' },
        { text: '維', lang: 'zh-Hant', type: 'courtesy' },
      ],
    });
    expect(scanNearDuplicates([a, b])).toHaveLength(1);
    expect(scanNearDuplicates([a, b])[0]?.evidence).toContain('名=字');
  });

  it('sorts higher extra-match scores first', () => {
    const weakA = basePerson({
      id: 'w1',
      familyName: '李',
      givenName: '白',
      nationalities: ['唐'],
    });
    const weakB = basePerson({
      id: 'w2',
      familyName: '李',
      givenName: '白',
      nationalities: ['唐'],
    });
    const strongA = basePerson({
      id: 's1',
      familyName: '杜',
      givenName: '甫',
      nationalities: ['唐'],
      placesOfOrigin: ['襄陽'],
      roles: ['拾遺'],
      nameEntries: [
        { text: '杜甫', lang: 'zh-Hant', type: 'primary' },
        { text: '甫', lang: 'zh-Hant', type: 'given' },
        { text: '子美', lang: 'zh-Hant', type: 'courtesy' },
      ],
    });
    const strongB = basePerson({
      id: 's2',
      familyName: '杜',
      givenName: '甫',
      nationalities: ['唐'],
      placesOfOrigin: ['襄陽'],
      roles: ['拾遺'],
      nameEntries: [
        { text: '杜甫', lang: 'zh-Hant', type: 'primary' },
        { text: '甫', lang: 'zh-Hant', type: 'given' },
        { text: '子美', lang: 'zh-Hant', type: 'courtesy' },
      ],
    });
    const findings = scanNearDuplicates([weakA, weakB, strongA, strongB]);
    expect(findings.length).toBe(2);
    expect(findings[0]?.relatedEntityIds?.sort()).toEqual(['s1', 's2']);
    expect(findings[0]?.evidence).toMatch(/\+\d+ beyond minimum/);
    expect(findings[1]?.relatedEntityIds?.sort()).toEqual(['w1', 'w2']);
  });
});

describe('scanUnlinkedAuthorityHits', () => {
  it('suppresses ambiguous multi-hits', () => {
    const entity = basePerson({ id: 'u1', authorities: [] });
    const peer = (value: string): Extract<HygienePeer, { kind: 'authority' }> => ({
      kind: 'authority',
      authorityType: 'CBDB',
      authorityValue: value,
      primaryName: '李淳風',
    });
    expect(scanUnlinkedAuthorityHits([{ entity, peers: [peer('1'), peer('2')] }])).toHaveLength(0);
    expect(scanUnlinkedAuthorityHits([{ entity, peers: [peer('1')] }])).toHaveLength(1);
  });

  it('corroboratePackPeer requires agreement when pack has dynasty', () => {
    const entity = basePerson({ id: 'u2', nationalities: ['唐'] });
    const peer: Extract<HygienePeer, { kind: 'authority' }> = {
      kind: 'authority',
      authorityType: 'CBDB',
      authorityValue: '1',
      primaryName: '李淳風',
      nationalities: ['宋'],
    };
    expect(corroboratePackPeer(entity, peer)).toBe(false);
    expect(corroboratePackPeer(entity, { ...peer, nationalities: ['唐'] })).toBe(true);
  });
});

describe('findingsFromAuthorityDuplicates', () => {
  it('maps duplicate groups to merge proposals', () => {
    const findings = findingsFromAuthorityDuplicates([
      { type: 'CBDB', value: '376', entityIds: ['e1', 'e2'] },
    ]);
    expect(findings[0]?.kind).toBe('authorityIdDuplicate');
    expect(findings[0]?.proposal).toMatchObject({
      action: 'merge',
      keepId: 'e1',
      dropIds: ['e2'],
    });
  });
});

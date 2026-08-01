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
  it('proposes Li Chunfeng for Li Chun Feng when 姓/名 exist', () => {
    const entity = basePerson({
      id: 'p3',
      familyName: '李',
      givenName: '淳風',
      romanized: 'Li Chun Feng',
    });
    const findings = scanBadRomanization([entity], 'zh-Hant');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.proposal).toEqual({ action: 'setRomanized', text: 'Li Chunfeng' });
  });
});

describe('scanMissingFamilyOrGiven', () => {
  it('suggests a split for Chinese primary without 姓/名', () => {
    const entity = basePerson({
      id: 'p4',
      names: ['李淳風'],
      familyName: null,
      givenName: null,
    });
    const findings = scanMissingFamilyOrGiven([entity], 'zh-Hant');
    expect(findings[0]?.proposal).toMatchObject({
      action: 'setFamilyGiven',
      familyName: '李',
      givenName: '淳風',
    });
  });
});

describe('scanBadPrimary', () => {
  it('flags comma-junk primary when family+given exist', () => {
    const entity = basePerson({
      id: 'p5',
      names: ['黃, 侃', '黃侃'],
      familyName: '黃',
      givenName: '侃',
    });
    const findings = scanBadPrimary([entity]);
    expect(findings[0]?.proposal).toEqual({ action: 'renamePrimary', text: '黃侃' });
  });
});

describe('scanNearDuplicates', () => {
  it('requires a second signal beyond a shared name', () => {
    const a = basePerson({ id: 'a', names: ['張衡'], nationalities: [] });
    const b = basePerson({ id: 'b', names: ['張衡'], nationalities: [] });
    expect(scanNearDuplicates([a, b])).toHaveLength(0);

    const c = basePerson({
      id: 'c',
      names: ['張衡'],
      nationalities: ['漢'],
      startYear: 78,
      endYear: 139,
    });
    const d = basePerson({
      id: 'd',
      names: ['張衡'],
      nationalities: ['漢'],
      startYear: 78,
      endYear: 139,
    });
    expect(scanNearDuplicates([c, d]).length).toBeGreaterThanOrEqual(1);
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
    expect(
      scanUnlinkedAuthorityHits([{ entity, peers: [peer('1'), peer('2')] }]),
    ).toHaveLength(0);
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

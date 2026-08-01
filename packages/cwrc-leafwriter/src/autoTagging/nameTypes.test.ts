import {
  DEFAULT_UNTAGGABLE_TYPES,
  isFamilyPrefixedCourtesyName,
  isTaggableNameType,
  normalizeNameType,
  normalizeTypedNamesForIntake,
  preferCanonicalFamilyGiven,
  stripFamilyPrefixFromCourtesyName,
} from './nameTypes';

describe('normalizeNameType', () => {
  it('passes canonical ids through', () => {
    expect(normalizeNameType('courtesy')).toBe('courtesy');
    expect(normalizeNameType('primary')).toBe('primary');
    expect(normalizeNameType('variant')).toBe('variant');
  });

  it('maps Wikidata name properties', () => {
    expect(normalizeNameType('P1782')).toBe('courtesy');
    expect(normalizeNameType('p1786')).toBe('posthumous');
    expect(normalizeNameType('P1785')).toBe('temple');
    expect(normalizeNameType('P1787')).toBe('art');
    expect(normalizeNameType('P1559')).toBe('primary');
    expect(normalizeNameType('P734')).toBe('family');
    expect(normalizeNameType('P735')).toBe('given');
    expect(normalizeNameType('P742')).toBe('pen');
    expect(normalizeNameType('P1449')).toBe('variant');
  });

  it('maps CJK category labels in traditional and simplified forms', () => {
    expect(normalizeNameType('姓')).toBe('family');
    expect(normalizeNameType('名')).toBe('given');
    expect(normalizeNameType('字')).toBe('courtesy');
    expect(normalizeNameType('號')).toBe('art');
    expect(normalizeNameType('号')).toBe('art');
    expect(normalizeNameType('諡號')).toBe('posthumous');
    expect(normalizeNameType('谥号')).toBe('posthumous');
    expect(normalizeNameType('廟號')).toBe('temple');
    expect(normalizeNameType('法名')).toBe('dharma');
    expect(normalizeNameType('筆名')).toBe('pen');
  });

  it('returns null for unknown or empty markers', () => {
    expect(normalizeNameType('P9999')).toBeNull();
    expect(normalizeNameType('something else')).toBeNull();
    expect(normalizeNameType('')).toBeNull();
    expect(normalizeNameType(null)).toBeNull();
    expect(normalizeNameType(undefined)).toBeNull();
  });
});

describe('isTaggableNameType', () => {
  it('excludes courtesy names by default and keeps everything else', () => {
    expect(DEFAULT_UNTAGGABLE_TYPES).toEqual(['courtesy', 'family', 'given']);
    expect(isTaggableNameType('courtesy')).toBe(false);
    expect(isTaggableNameType('family')).toBe(false);
    expect(isTaggableNameType('given')).toBe(false);
    expect(isTaggableNameType('primary')).toBe(true);
    expect(isTaggableNameType('posthumous')).toBe(true);
    expect(isTaggableNameType('variant')).toBe(true);
  });

  it('treats untyped legacy names as taggable', () => {
    expect(isTaggableNameType(null)).toBe(true);
  });

  it('honors a custom exclusion list', () => {
    expect(isTaggableNameType('courtesy', [])).toBe(true);
    expect(isTaggableNameType('art', ['art'])).toBe(false);
    expect(isTaggableNameType(null, ['variant'])).toBe(true);
  });
});

describe('isFamilyPrefixedCourtesyName', () => {
  it('recognizes a family-plus-courtesy composite but keeps the bare courtesy name', () => {
    expect(isFamilyPrefixedCourtesyName('蕭彦学', ['蕭'])).toBe(true);
    expect(isFamilyPrefixedCourtesyName('彦学', ['蕭'])).toBe(false);
    expect(isFamilyPrefixedCourtesyName('蕭', ['蕭'])).toBe(false);
  });
});

describe('stripFamilyPrefixFromCourtesyName', () => {
  it('strips the longest matching family prefix', () => {
    expect(stripFamilyPrefixFromCourtesyName('蕭彦学', ['蕭'])).toBe('彦学');
    expect(stripFamilyPrefixFromCourtesyName('司馬長卿', ['司', '司馬'])).toBe('長卿');
    expect(stripFamilyPrefixFromCourtesyName('彦学', ['蕭'])).toBe('彦学');
  });
});

describe('normalizeTypedNamesForIntake', () => {
  it('strips and dedupes family-prefixed courtesy names', () => {
    expect(
      normalizeTypedNamesForIntake([
        { text: '蕭', type: 'family' },
        { text: '彦学', type: 'courtesy' },
        { text: '蕭彦学', type: 'courtesy' },
      ]),
    ).toEqual([
      { text: '蕭', type: 'family' },
      { text: '彦学', type: 'courtesy' },
    ]);
  });

  it('recovers a bare courtesy name when only the composite is present', () => {
    expect(
      normalizeTypedNamesForIntake(
        [{ text: '成公廣明', type: 'courtesy' }],
        ['成公'],
      ),
    ).toEqual([{ text: '廣明', type: 'courtesy' }]);
  });

  it('strips family prefix from art and dharma names too', () => {
    expect(
      normalizeTypedNamesForIntake([
        { text: '王', type: 'family' },
        { text: '王摩詰', type: 'art' },
        { text: '王法號', type: 'dharma' },
      ]),
    ).toEqual([
      { text: '王', type: 'family' },
      { text: '摩詰', type: 'art' },
      { text: '法號', type: 'dharma' },
    ]);
  });

  it('drops dump placeholder nan in any language', () => {
    expect(
      normalizeTypedNamesForIntake([
        { text: 'nan', type: 'primary' },
        { text: '息齋道人', type: 'dharma' },
      ]),
    ).toEqual([{ text: '息齋道人', type: 'dharma' }]);
  });
});

describe('preferCanonicalFamilyGiven', () => {
  it('prefers the family that prefixes the primary headword', () => {
    expect(
      preferCanonicalFamilyGiven('拓拔建', [
        { text: '元', type: 'family' },
        { text: '拓拔', type: 'family' },
        { text: '托跋', type: 'family' },
        { text: '建', type: 'given' },
      ]),
    ).toEqual({ familyName: '拓拔', givenName: '建' });
  });

  it('falls back to the first family/given when primary does not help', () => {
    expect(
      preferCanonicalFamilyGiven('無名氏', [
        { text: '張', type: 'family' },
        { text: '李', type: 'family' },
        { text: '某', type: 'given' },
      ]),
    ).toEqual({ familyName: '張', givenName: '某' });
  });
});

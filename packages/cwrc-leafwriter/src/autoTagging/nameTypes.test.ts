import {
  DEFAULT_UNTAGGABLE_TYPES,
  isTaggableNameType,
  normalizeNameType,
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
    expect(normalizeNameType('P742')).toBe('pen');
    expect(normalizeNameType('P1449')).toBe('variant');
  });

  it('maps CJK category labels in traditional and simplified forms', () => {
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
    expect(DEFAULT_UNTAGGABLE_TYPES).toEqual(['courtesy']);
    expect(isTaggableNameType('courtesy')).toBe(false);
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

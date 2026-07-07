import { formatLifespan, formatWikidataYear, parseWikidataYear, prefixDescriptionWithLifespan } from './wikidataDates';

describe('wikidataDates', () => {
  it('parses a CE year at year precision', () => {
    expect(parseWikidataYear({ time: '+0253-01-01T00:00:00Z', precision: 9 })).toBe(253);
  });

  it('parses a BCE year (negative) at year precision', () => {
    expect(parseWikidataYear({ time: '-0155-01-01T00:00:00Z', precision: 9 })).toBe(-155);
  });

  it('rejects values below year precision', () => {
    expect(parseWikidataYear({ time: '+0253-01-01T00:00:00Z', precision: 8 })).toBeNull();
  });

  it('formats a negative year as BCE', () => {
    expect(formatWikidataYear(-155)).toBe('155 BCE');
    expect(formatWikidataYear(1990)).toBe('1990');
  });

  it('formats a full lifespan as a range', () => {
    expect(formatLifespan({ birthYear: 226, deathYear: 249 })).toBe('(226–249)');
  });

  it('formats a death-only lifespan', () => {
    expect(formatLifespan({ deathYear: 253 })).toBe('(d. 253)');
  });

  it('formats a birth-only lifespan', () => {
    expect(formatLifespan({ birthYear: 1990 })).toBe('(b. 1990)');
  });

  it('returns undefined for an empty lifespan', () => {
    expect(formatLifespan({})).toBeUndefined();
  });

  it('prefixes a description with the lifespan', () => {
    expect(prefixDescriptionWithLifespan('Romance of the Three Kingdoms character', { deathYear: 253 })).toBe(
      '(d. 253) Romance of the Three Kingdoms character',
    );
  });

  it('leaves description unchanged when no lifespan is found', () => {
    expect(prefixDescriptionWithLifespan('some description', null)).toBe('some description');
  });

  it('does not double-prefix a description that already starts with a date', () => {
    expect(prefixDescriptionWithLifespan('(226–249) already dated', { deathYear: 253 })).toBe(
      '(226–249) already dated',
    );
  });
});

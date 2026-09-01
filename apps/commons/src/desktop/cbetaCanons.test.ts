import { CBETA_CANON_EDITIONS, cbetaCanonEdition } from './cbetaCanons';
import { editionDateAttrs } from './sourceDescription';

describe('cbetaCanonEdition', () => {
  test('resolves a known canon code, case-insensitively', () => {
    expect(cbetaCanonEdition('T')?.edition).toContain('Taishō');
    expect(cbetaCanonEdition('t')).toEqual(cbetaCanonEdition('T'));
    expect(cbetaCanonEdition(' x ')?.edition).toContain('卍新纂');
  });

  test('returns undefined for an unlisted or empty code', () => {
    expect(cbetaCanonEdition('A')).toBeUndefined();
    expect(cbetaCanonEdition('')).toBeUndefined();
    expect(cbetaCanonEdition(null)).toBeUndefined();
    expect(cbetaCanonEdition(undefined)).toBeUndefined();
  });

  test('every table date parses to a usable @when or @from/@to', () => {
    for (const [code, entry] of Object.entries(CBETA_CANON_EDITIONS)) {
      const attrs = editionDateAttrs(entry.editionDate);
      const usable = Boolean(attrs.when || (attrs.from && attrs.to));
      expect(`${code}: ${JSON.stringify(attrs)}`).toBe(
        usable
          ? `${code}: ${JSON.stringify(attrs)}`
          : `${code}: <unparseable ${entry.editionDate}>`,
      );
    }
  });
});

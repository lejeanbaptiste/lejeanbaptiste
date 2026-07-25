import { describe, expect, it } from 'vitest';
import { resolveSpellCheckerLanguages } from './translationSpellcheck';

describe('resolveSpellCheckerLanguages', () => {
  it('maps short language codes to an available dictionary tag', () => {
    expect(resolveSpellCheckerLanguages(['en-US', 'en-GB', 'fr-FR'], ['en'])).toEqual(['en-US']);
    expect(resolveSpellCheckerLanguages(['fr-FR', 'en-US'], ['fr'])).toEqual(['fr-FR']);
  });

  it('preserves an exact BCP-47 match', () => {
    expect(resolveSpellCheckerLanguages(['pt-BR', 'pt-PT'], ['pt-PT'])).toEqual(['pt-PT']);
  });

  it('falls back when Chromium reports no installed dictionaries', () => {
    expect(resolveSpellCheckerLanguages([], ['fr'])).toEqual(['fr-FR']);
  });

  it('dedupes multiple codes that resolve to the same dictionary', () => {
    expect(resolveSpellCheckerLanguages(['fr-FR'], ['fr', 'fr-FR'])).toEqual(['fr-FR']);
  });
});

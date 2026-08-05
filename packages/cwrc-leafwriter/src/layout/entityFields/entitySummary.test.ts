import { pickRomanizedFromPanelNames, summaryFromSqlitePanel } from './entitySummary';

describe('pickRomanizedFromPanelNames', () => {
  test('prefers a *-Latn language tag', () => {
    expect(
      pickRomanizedFromPanelNames([
        { text: '安陸縣', language: 'zh-Hant', nameType: 'primary' },
        { text: 'Anlu', language: 'zh-Latn', nameType: 'romanization' },
      ]),
    ).toBe('Anlu');
  });

  test('prefers nameType romanization even without a Latn tag', () => {
    expect(
      pickRomanizedFromPanelNames([
        { text: '安陸縣', language: 'zh-Hant', nameType: 'primary' },
        { text: 'Anlu', language: null, nameType: 'romanization' },
      ]),
    ).toBe('Anlu');
  });

  test('falls back to Latin text mis-tagged as zh-Hant', () => {
    expect(
      pickRomanizedFromPanelNames([
        { text: '江南', language: 'zh-Hant', nameType: 'primary' },
        { text: 'Jiang Nan', language: 'zh-Hant', nameType: 'translation' },
      ]),
    ).toBe('Jiang Nan');
  });

  test('does not treat a French gloss as romanization', () => {
    expect(
      pickRomanizedFromPanelNames([
        { text: '晉書', language: 'zh-Hant', nameType: 'primary' },
        { text: 'Livre des Jin', language: 'fr', nameType: 'translation' },
      ]),
    ).toBeNull();
  });
});

describe('summaryFromSqlitePanel', () => {
  test('sets romanizedName for mis-tagged place romanizations', () => {
    const summary = summaryFromSqlitePanel({
      id: 'place-1',
      kind: 'place',
      description: null,
      familyName: null,
      startYear: null,
      endYear: null,
      names: [
        { text: '江南', language: 'zh-Hant', nameType: 'primary', status: 'active' },
        { text: 'Jiang Nan', language: 'zh-Hant', nameType: 'translation', status: 'active' },
      ],
    });
    expect(summary.romanizedName).toBe('Jiang Nan');
    expect(summary.primaryName).toBe('江南');
  });
});

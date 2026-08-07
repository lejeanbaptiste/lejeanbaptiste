import { mergeCentralGlossesIntoSummary } from './sourceUnitEntities';
import { summaryFromSqlitePanel, type EntitySummary } from './entitySummary';

const office = (overrides: Partial<EntitySummary> = {}): EntitySummary => ({
  id: 'office-project',
  kind: 'office',
  names: [{ lang: 'zh-Hant', text: '領軍將軍', type: 'primary' }],
  primaryName: '領軍將軍',
  romanizedName: 'Lingjun Jiangjun',
  translations: [],
  description: null,
  dates: null,
  familyName: null,
  authorityIds: [],
  classification: null,
  workType: null,
  ...overrides,
});

describe('mergeCentralGlossesIntoSummary', () => {
  test('pulls EN office gloss from the linked central record', () => {
    const project = office();
    const central = office({
      id: 'office-central',
      translations: [{ lang: 'en', text: 'General Commanding the Troops' }],
      names: [
        { lang: 'zh-Hant', text: '領軍將軍', type: 'primary' },
        { lang: 'en', text: 'General Commanding the Troops', type: 'translation' },
      ],
    });
    const merged = mergeCentralGlossesIntoSummary(project, central);
    expect(merged.id).toBe('office-project');
    expect(merged.translations).toEqual([
      { lang: 'en', text: 'General Commanding the Troops' },
    ]);
  });

  test('project gloss wins over central for the same language', () => {
    const project = office({
      translations: [{ lang: 'en', text: 'Project override' }],
    });
    const central = office({
      translations: [{ lang: 'en', text: 'Central gloss' }],
    });
    expect(mergeCentralGlossesIntoSummary(project, central).translations).toEqual([
      { lang: 'en', text: 'Project override' },
    ]);
  });
});

describe('summaryFromSqlitePanel translations', () => {
  test('unions entity_translations with nameType=translation rows', () => {
    const summary = summaryFromSqlitePanel({
      id: 'office-1',
      kind: 'office',
      description: null,
      familyName: null,
      startYear: null,
      endYear: null,
      startPrecision: null,
      endPrecision: null,
      classification: null,
      workType: null,
      authorities: [],
      names: [
        {
          text: '領軍將軍',
          nameType: 'primary',
          language: 'zh-Hant',
          status: 'active',
        },
        {
          text: 'From names only',
          nameType: 'translation',
          language: 'fr',
          status: 'active',
        },
      ],
      translations: [
        { text: 'General Commanding the Troops', language: 'en', status: 'active' },
      ],
    });
    expect(summary.translations).toEqual(
      expect.arrayContaining([
        { lang: 'en', text: 'General Commanding the Troops' },
        { lang: 'fr', text: 'From names only' },
      ]),
    );
  });
});

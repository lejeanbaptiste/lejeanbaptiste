/**
 * @jest-environment jsdom
 */
jest.mock('../../overmind', () => ({
  useAppState: () => ({ ui: { translationMode: { active: false } } }),
  useActions: () => ({
    ui: { notifyViaSnackbar: jest.fn(), setSelectedTranslationUnit: jest.fn() },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../js/conversion/copyForExport', () => ({
  copyUnitsForExport: jest.fn(async () => undefined),
}));

import { substituteEntityPlaceholders } from '../TranslationPane';
import { ENTITY_REF_TYPE } from './translationEntityFields';
import type { EntitySummary } from './entitySummary';

const person = (id: string, romanizedName: string): EntitySummary => ({
  id,
  kind: 'person',
  names: [{ lang: 'zh-Latn', text: romanizedName }],
  primaryName: romanizedName,
  romanizedName,
  translations: [],
  description: null,
  dates: { startYear: 440, endYear: 483, startPrecision: null, endPrecision: null },
  familyName: romanizedName.split(' ')[0] ?? null,
  authorityIds: [],
  classification: null,
  workType: null,
});

const refsIn = (html: string): HTMLElement[] => {
  const container = document.createElement('div');
  container.innerHTML = html;
  return Array.from(container.querySelectorAll(`ref[type="${ENTITY_REF_TYPE}"]`));
};

describe('substituteEntityPlaceholders', () => {
  test('replaces a single placeholder with an atomic entity field', () => {
    const entities = new Map([['q1', person('q1', 'Cui Zusi')]]);
    const html = substituteEntityPlaceholders('Hello {{entity:q1}}, welcome.', entities);
    const refs = refsIn(html);
    expect(refs).toHaveLength(1);
    expect(refs[0]!.getAttribute('key')).toBe('q1');
    expect(refs[0]!.getAttribute('contenteditable')).toBe('false');
    expect(refs[0]!.textContent).toBe('Cui Zusi (440–483)');
    expect(html).toContain('Hello ');
    expect(html).toContain(', welcome.');
  });

  test('repeated mentions of the same entity get first-occurrence vs later short form', () => {
    const entities = new Map([['q1', person('q1', 'Cui Zusi')]]);
    const html = substituteEntityPlaceholders('{{entity:q1}} met {{entity:q1}} again.', entities);
    const refs = refsIn(html);
    expect(refs).toHaveLength(2);
    expect(refs[0]!.textContent).toBe('Cui Zusi (440–483)');
    expect(refs[1]!.textContent).toBe('Cui Zusi');
  });

  test('unknown entity id falls back to stripped text without throwing', () => {
    const entities = new Map<string, EntitySummary>();
    const html = substituteEntityPlaceholders('Hello {{entity:missing}}.', entities);
    expect(refsIn(html)).toHaveLength(0);
    expect(html).toContain('{{entity:missing}}');
  });

  test('placeholder text intermixed with allowed inline tags still resolves', () => {
    const entities = new Map([['q1', person('q1', 'Cui Zusi')]]);
    const html = substituteEntityPlaceholders(
      '<hi rend="italic">Dear {{entity:q1}}</hi>, regards.',
      entities,
    );
    const refs = refsIn(html);
    expect(refs).toHaveLength(1);
    expect(refs[0]!.textContent).toBe('Cui Zusi (440–483)');
    expect(html).toContain('<hi');
  });

  test('leaves text without placeholders untouched', () => {
    const entities = new Map([['q1', person('q1', 'Cui Zusi')]]);
    const html = substituteEntityPlaceholders('No mentions here.', entities);
    expect(html).toBe('No mentions here.');
  });

  test('place placeholder becomes a kind-aware entity field', () => {
    const entities = new Map([
      [
        'place-1',
        {
          id: 'place-1',
          kind: 'place',
          names: [{ lang: 'zh-Latn', text: 'Jiankang' }],
          primaryName: 'Jiankang',
          romanizedName: 'Jiankang',
          translations: [],
          description: null,
          dates: null,
          familyName: null,
          authorityIds: [],
          classification: null,
          workType: null,
        } satisfies EntitySummary,
      ],
    ]);
    const html = substituteEntityPlaceholders('He went to {{entity:place-1}}.', entities);
    const refs = refsIn(html);
    expect(refs).toHaveLength(1);
    expect(refs[0]!.getAttribute('key')).toBe('place-1');
    expect(refs[0]!.textContent).toBe('Jiankang');
  });

  test('org placeholder becomes a kind-aware entity field', () => {
    const entities = new Map([
      [
        'org-1',
        {
          id: 'org-1',
          kind: 'org',
          names: [{ lang: 'en', text: 'Hanlin Academy' }],
          primaryName: 'Hanlin Academy',
          romanizedName: 'Hanlin Academy',
          translations: [],
          description: null,
          dates: { startYear: 738, endYear: 907, startPrecision: null, endPrecision: null },
          familyName: null,
          authorityIds: [],
          classification: null,
          workType: null,
        } satisfies EntitySummary,
      ],
    ]);
    const html = substituteEntityPlaceholders('The {{entity:org-1}} met.', entities);
    expect(refsIn(html)[0]!.textContent).toBe('Hanlin Academy');
  });

  test('work placeholder becomes a kind-aware entity field', () => {
    const entities = new Map([
      [
        'work-1',
        {
          id: 'work-1',
          kind: 'work',
          names: [{ lang: 'en', text: 'Book of Song' }],
          primaryName: 'Book of Song',
          romanizedName: 'Book of Song',
          translations: [],
          description: null,
          dates: { startYear: 488, endYear: null, startPrecision: null, endPrecision: null },
          familyName: null,
          authorityIds: [],
          classification: null,
          workType: 'book' as const,
        } satisfies EntitySummary,
      ],
    ]);
    const html = substituteEntityPlaceholders('See {{entity:work-1}}.', entities);
    const ref = refsIn(html)[0]!;
    expect(ref.getAttribute('key')).toBe('work-1');
    expect(ref.getAttribute('data-work-style')).toBe('italic');
    expect(ref.textContent).toContain('Book of Song');
  });

  test('roleName / office placeholder becomes a kind-aware entity field', () => {
    const entities = new Map([
      [
        'office-1',
        {
          id: 'office-1',
          kind: 'office',
          names: [{ lang: 'en', text: 'Prefect of Jiankang' }],
          primaryName: 'Prefect of Jiankang',
          romanizedName: 'Prefect of Jiankang',
          translations: [],
          description: null,
          dates: null,
          familyName: null,
          authorityIds: [],
          classification: 'Capital prefecture',
          workType: null,
        } satisfies EntitySummary,
      ],
    ]);
    const html = substituteEntityPlaceholders('As {{entity:office-1}}, he ruled.', entities);
    const ref = refsIn(html)[0]!;
    expect(ref.getAttribute('key')).toBe('office-1');
    expect(ref.textContent).toBe('Prefect of Jiankang Capital prefecture');
  });
});

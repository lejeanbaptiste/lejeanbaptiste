/**
 * @jest-environment jsdom
 */
jest.mock('../../overmind', () => ({
  useAppState: () => ({ ui: { translationMode: { active: false } } }),
  useActions: () => ({ ui: { notifyViaSnackbar: jest.fn(), setSelectedTranslationUnit: jest.fn() } }),
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
    const html = substituteEntityPlaceholders(
      '{{entity:q1}} met {{entity:q1}} again.',
      entities,
    );
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
});

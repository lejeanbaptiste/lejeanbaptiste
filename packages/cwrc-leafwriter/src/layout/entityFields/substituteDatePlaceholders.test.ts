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

import type { DateGlossInput } from './dateGloss';
import { DATE_REF_TYPE } from './translationDateFields';
import { substituteDatePlaceholders } from '../TranslationPane';

const refsIn = (html: string): HTMLElement[] => {
  const container = document.createElement('div');
  container.innerHTML = html;
  return Array.from(container.querySelectorAll(`ref[type="${DATE_REF_TYPE}"]`));
};

describe('substituteDatePlaceholders', () => {
  test('replaces {{date:N}} with an atomic grognard-date field', () => {
    const dates = new Map<number, DateGlossInput>([
      [
        0,
        {
          ruler: '太祖',
          era: '建元',
          year: '三年',
        },
      ],
    ]);
    const html = substituteDatePlaceholders('It was {{date:0}}.', dates, 'en');
    const refs = refsIn(html);
    expect(refs).toHaveLength(1);
    expect(refs[0]!.getAttribute('contenteditable')).toBe('false');
    expect(refs[0]!.textContent).toBe('Emperor Taizu, Jianyuan era, year 3');
  });

  test('leaves unknown indices as placeholders', () => {
    const html = substituteDatePlaceholders('See {{date:9}}.', new Map(), 'en');
    expect(html).toContain('{{date:9}}');
  });
});

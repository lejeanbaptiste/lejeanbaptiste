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

import { substituteNotePlaceholders } from '../TranslationPane';

const notesIn = (html: string): HTMLElement[] => {
  const container = document.createElement('div');
  container.innerHTML = html;
  return Array.from(container.querySelectorAll('note'));
};

describe('substituteNotePlaceholders', () => {
  test('replaces {{note:N}} with a <note place="foot"> carrying the translated HTML', () => {
    const notes = new Map<number, string>([[0, 'See the discussion above.']]);
    const html = substituteNotePlaceholders('Claim.{{note:0}} More text.', notes);
    const found = notesIn(html);
    expect(found).toHaveLength(1);
    expect(found[0]!.getAttribute('place')).toBe('foot');
    expect(found[0]!.innerHTML).toBe('See the discussion above.');
    expect(html).toContain('Claim.');
    expect(html).toContain('More text.');
    expect(html).not.toContain('{{note:0}}');
  });

  test('replaces multiple notes in document order', () => {
    const notes = new Map<number, string>([
      [0, 'First note.'],
      [1, 'Second note.'],
    ]);
    const html = substituteNotePlaceholders('A{{note:0}}B{{note:1}}C', notes);
    const found = notesIn(html);
    expect(found).toHaveLength(2);
    expect(found[0]!.innerHTML).toBe('First note.');
    expect(found[1]!.innerHTML).toBe('Second note.');
  });

  test('leaves unknown indices as placeholders', () => {
    const html = substituteNotePlaceholders('See {{note:9}}.', new Map());
    expect(html).toContain('{{note:9}}');
  });

  test('passes through text with no note placeholders unchanged', () => {
    expect(substituteNotePlaceholders('No notes here.', new Map())).toBe('No notes here.');
  });
});

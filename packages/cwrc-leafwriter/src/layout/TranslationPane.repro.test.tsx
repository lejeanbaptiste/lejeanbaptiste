/**
 * Repro for: translator panel throws when opened; footnote list (bottom bubble)
 * not appearing; zotero refs blank.
 */
import { act, render } from '@testing-library/react';

const notifyViaSnackbar = jest.fn();
const setSelectedTranslationUnit = jest.fn();

let translationMode: Record<string, unknown> = { active: false };

jest.mock('../overmind', () => ({
  useAppState: () => ({ ui: { translationMode } }),
  useActions: () => ({ ui: { notifyViaSnackbar, setSelectedTranslationUnit } }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../js/conversion/copyForExport', () => ({
  copyUnitsForExport: jest.fn(async () => undefined),
}));

import { TranslationPane } from './TranslationPane';

const TRANSLATION_XML = `<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>
<div corresp="source.xml#d1"><p>Hello <note place="foot">a footnote</note> world.</p></div>
</body></text></TEI>`;

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

describe('TranslationPane opening', () => {
  beforeEach(() => {
    (window as any).electronAPI = {
      readFile: jest.fn(async () => TRANSLATION_XML),
      writeFile: jest.fn(async () => undefined),
    };
    (window as any).writer = {
      schemaManager: { getIdName: () => 'xml:id' },
      event: () => ({ subscribe: jest.fn(), unsubscribe: jest.fn() }),
    };
  });

  afterEach(() => {
    delete (window as any).electronAPI;
    delete (window as any).writer;
  });

  test('renders footnote editors when opened on a unit containing a note', async () => {
    translationMode = { active: false };
    const { rerender } = render(<TranslationPane />);

    translationMode = {
      active: true,
      alignmentUnit: 'div',
      sourcePath: '/proj/source.xml',
      translationPath: '/proj/source.fr.xml',
      selectedUnitId: 'd1',
      lang: 'fr',
    };

    const errors: unknown[] = [];
    const consoleError = jest.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args);
    });

    rerender(<TranslationPane />);
    await flush();

    consoleError.mockRestore();
    // eslint-disable-next-line no-console
    if (errors.length)
      console.log('CONSOLE ERRORS:', JSON.stringify(errors, null, 2).slice(0, 4000));

    expect(document.querySelector('[data-leaf-footnote-editor]')).not.toBeNull();
  });
});

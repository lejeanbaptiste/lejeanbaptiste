import { setActiveProjectBundle } from '../activeProjectBundle';
import { searchText } from './searchText';

const bundle = {
  config: { version: 1 as const, name: 'test' },
  projectFilePath: '/proj/jean-baptiste.project.json',
  rootPath: '/proj',
};

const translationSettingsJson = JSON.stringify({
  version: 1,
  alignmentUnit: 'p',
  languages: [{ code: 'fr', label: 'Français' }],
  lockedAt: new Date().toISOString(),
});

describe('searchText currentFile scope with translation companions', () => {
  const originalElectronAPI = window.electronAPI;

  beforeEach(() => {
    setActiveProjectBundle(bundle as any);
  });

  afterEach(() => {
    window.electronAPI = originalElectronAPI;
    setActiveProjectBundle(null);
  });

  const mockReadFile = (files: Record<string, string>) =>
    jest.fn(async (filePath: string) => {
      if (filePath in files) return files[filePath];
      throw new Error('ENOENT');
    });

  test('finds a match inside the companion translation file, not just the open source tab', async () => {
    window.electronAPI = {
      ...originalElectronAPI,
      readFile: mockReadFile({
        '/proj/schema/translation-settings.json': translationSettingsJson,
        '/proj/chapter1.fr.translation.xml': '<translation xml:lang="fr"><p>Un mauvais chaton.</p></translation>',
      }),
    } as unknown as typeof window.electronAPI;

    const { results, totalMatches } = await searchText({
      activeTabPath: '/proj/chapter1.xml',
      docScope: 'both',
      openTabs: [{ filePath: '/proj/chapter1.xml', content: '<TEI><body><p>A bad kitten.</p></body></TEI>' } as any],
      query: 'chaton',
      rootPath: '/proj',
      scope: 'currentFile',
      useRegex: false,
    });

    expect(totalMatches).toBe(1);
    expect(results).toHaveLength(1);
    expect(results[0]?.filePath).toBe('/proj/chapter1.fr.translation.xml');
  });

  test('docScope "source" excludes the companion file even if it matches', async () => {
    window.electronAPI = {
      ...originalElectronAPI,
      readFile: mockReadFile({
        '/proj/schema/translation-settings.json': translationSettingsJson,
        '/proj/chapter1.fr.translation.xml': '<translation xml:lang="fr"><p>Un mauvais chaton.</p></translation>',
      }),
    } as unknown as typeof window.electronAPI;

    const { results, totalMatches } = await searchText({
      activeTabPath: '/proj/chapter1.xml',
      docScope: 'source',
      openTabs: [{ filePath: '/proj/chapter1.xml', content: '<TEI><body><p>A bad chaton.</p></body></TEI>' } as any],
      query: 'chaton',
      rootPath: '/proj',
      scope: 'currentFile',
      useRegex: false,
    });

    expect(totalMatches).toBe(1);
    expect(results).toHaveLength(1);
    expect(results[0]?.filePath).toBe('/proj/chapter1.xml');
  });

  test('docScope "translation" excludes the source file even if it matches', async () => {
    window.electronAPI = {
      ...originalElectronAPI,
      readFile: mockReadFile({
        '/proj/schema/translation-settings.json': translationSettingsJson,
        '/proj/chapter1.fr.translation.xml': '<translation xml:lang="fr"><p>Un mauvais chaton.</p></translation>',
      }),
    } as unknown as typeof window.electronAPI;

    const { results, totalMatches } = await searchText({
      activeTabPath: '/proj/chapter1.xml',
      docScope: 'translation',
      openTabs: [{ filePath: '/proj/chapter1.xml', content: '<TEI><body><p>A bad chaton.</p></body></TEI>' } as any],
      query: 'chaton',
      rootPath: '/proj',
      scope: 'currentFile',
      useRegex: false,
    });

    expect(totalMatches).toBe(1);
    expect(results).toHaveLength(1);
    expect(results[0]?.filePath).toBe('/proj/chapter1.fr.translation.xml');
  });
});

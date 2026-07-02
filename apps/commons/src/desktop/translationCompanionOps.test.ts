import { setActiveProjectBundle } from './activeProjectBundle';
import {
  findCompanionTranslationFiles,
  rewriteCompanionSourceReferences,
} from './translationCompanionOps';

const bundle = {
  config: { version: 1 as const, name: 'test' },
  projectFilePath: '/proj/jean-baptiste.project.json',
  rootPath: '/proj',
};

const translationSettingsJson = JSON.stringify({
  version: 1,
  alignmentUnit: 'p',
  languages: [
    { code: 'fr', label: 'Français' },
    { code: 'de', label: 'Deutsch' },
  ],
  lockedAt: new Date().toISOString(),
});

describe('findCompanionTranslationFiles', () => {
  const originalElectronAPI = window.electronAPI;

  beforeEach(() => {
    setActiveProjectBundle(bundle as any);
  });

  afterEach(() => {
    window.electronAPI = originalElectronAPI;
    setActiveProjectBundle(null);
  });

  const mockApi = (existingPaths: string[]) => {
    window.electronAPI = {
      ...originalElectronAPI,
      readFile: jest.fn(async (filePath: string) => {
        if (filePath === '/proj/schema/translation-settings.json') return translationSettingsJson;
        throw new Error('ENOENT');
      }),
      statFile: jest.fn(async (filePath: string) => {
        if (existingPaths.includes(filePath)) return { mtimeMs: 1, size: 1 };
        throw new Error('ENOENT');
      }),
    } as unknown as typeof window.electronAPI;
  };

  test('returns only companions that exist on disk, with their language', async () => {
    mockApi(['/proj/chapter1.fr.translation.xml']);

    const companions = await findCompanionTranslationFiles('/proj/chapter1.xml');

    expect(companions).toEqual([{ path: '/proj/chapter1.fr.translation.xml', lang: 'fr' }]);
  });

  test('returns all companions when every language exists', async () => {
    mockApi(['/proj/chapter1.fr.translation.xml', '/proj/chapter1.de.translation.xml']);

    const companions = await findCompanionTranslationFiles('/proj/chapter1.xml');

    expect(companions.map((c) => c.lang)).toEqual(['fr', 'de']);
  });

  test('returns [] for a directory path', async () => {
    mockApi(['/proj/chapter1.fr.translation.xml']);
    expect(await findCompanionTranslationFiles('/proj/subfolder')).toEqual([]);
  });

  test('returns [] when the target is itself a translation file', async () => {
    mockApi(['/proj/chapter1.fr.translation.xml']);
    expect(await findCompanionTranslationFiles('/proj/chapter1.fr.translation.xml')).toEqual([]);
  });

  test('returns [] when the project has no translation settings', async () => {
    window.electronAPI = {
      ...originalElectronAPI,
      readFile: jest.fn().mockRejectedValue(new Error('ENOENT')),
      statFile: jest.fn().mockResolvedValue({ mtimeMs: 1, size: 1 }),
    } as unknown as typeof window.electronAPI;

    expect(await findCompanionTranslationFiles('/proj/chapter1.xml')).toEqual([]);
  });
});

describe('rewriteCompanionSourceReferences', () => {
  const companionXml =
    '<translation xml:lang="fr" corresp="a.xml">' +
    '<div corresp="a.xml#ch1">' +
    '<p corresp="a.xml#p1">Bonjour</p>' +
    '<p corresp="a.xml#p2">Chaton</p>' +
    '</div>' +
    '</translation>';

  test('rewrites root and per-unit corresp values to the new filename', () => {
    const result = rewriteCompanionSourceReferences(companionXml, 'a.xml', 'b.xml');
    expect(result).toContain('corresp="b.xml"');
    expect(result).toContain('corresp="b.xml#ch1"');
    expect(result).toContain('corresp="b.xml#p1"');
    expect(result).toContain('corresp="b.xml#p2"');
    expect(result).not.toContain('a.xml');
  });

  test('preserves translated content and unit ids across the rewrite', () => {
    const result = rewriteCompanionSourceReferences(companionXml, 'a.xml', 'b.xml');
    expect(result).toContain('Bonjour');
    expect(result).toContain('Chaton');
  });

  test('does not touch corresp values pointing at other files', () => {
    const xml = '<translation corresp="a.xml"><p corresp="other.xml#p1">x</p></translation>';
    const result = rewriteCompanionSourceReferences(xml, 'a.xml', 'b.xml');
    expect(result).toContain('corresp="other.xml#p1"');
    expect(result).toContain('corresp="b.xml"');
  });

  test('does not partially match filenames sharing a prefix', () => {
    const xml = '<translation corresp="a.xml"><p corresp="a.xml.bak#p1">x</p></translation>';
    const result = rewriteCompanionSourceReferences(xml, 'a.xml', 'b.xml');
    expect(result).toContain('corresp="a.xml.bak#p1"');
  });

  test('returns the input unchanged when nothing references the old name', () => {
    const xml = '<translation corresp="c.xml"><p corresp="c.xml#p1">x</p></translation>';
    expect(rewriteCompanionSourceReferences(xml, 'a.xml', 'b.xml')).toBe(xml);
  });

  test('returns null for unparseable XML', () => {
    expect(rewriteCompanionSourceReferences('<not<xml', 'a.xml', 'b.xml')).toBeNull();
  });
});

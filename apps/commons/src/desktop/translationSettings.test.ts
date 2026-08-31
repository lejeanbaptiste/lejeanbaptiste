import type { ProjectBundle } from './projectTypes';
import { readTranslationSettings, upsertTranslationSettings } from './translationSettings';

const bundle = {
  config: { version: 1 as const, name: 'test' },
  projectFilePath: '/proj/jean-baptiste.project.json',
  rootPath: '/proj',
} as ProjectBundle;

describe('readTranslationSettings', () => {
  const originalElectronAPI = window.electronAPI;

  afterEach(() => {
    window.electronAPI = originalElectronAPI;
  });

  const mockSettingsFile = (settings: Record<string, unknown>) => {
    window.electronAPI = {
      ...originalElectronAPI,
      pathExists: jest.fn(async () => true),
      readFile: jest.fn(async (filePath: string) => {
        if (filePath === '/proj/schema/translation-settings.json') {
          return JSON.stringify(settings);
        }
        throw new Error('ENOENT');
      }),
    } as unknown as typeof window.electronAPI;
  };

  test.each(['p', 'div', 'ab'] as const)(
    'reads settings with alignmentUnit %s',
    async (alignmentUnit) => {
      mockSettingsFile({
        version: 1,
        alignmentUnit,
        languages: [{ code: 'en', label: 'English' }],
        lockedAt: '2026-01-01T00:00:00.000Z',
      });

      const settings = await readTranslationSettings(bundle);

      expect(settings).toEqual({
        version: 1,
        alignmentUnit,
        languages: [{ code: 'en', label: 'English' }],
        lockedAt: '2026-01-01T00:00:00.000Z',
        citationStyle: undefined,
      });
    },
  );

  test('returns null for unknown alignment units', async () => {
    mockSettingsFile({
      version: 1,
      alignmentUnit: 'note',
      languages: [],
      lockedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(await readTranslationSettings(bundle)).toBeNull();
  });
});

describe('upsertTranslationSettings', () => {
  const originalElectronAPI = window.electronAPI;
  let fileContents: string | null = null;

  afterEach(() => {
    window.electronAPI = originalElectronAPI;
    fileContents = null;
  });

  beforeEach(() => {
    window.electronAPI = {
      ...originalElectronAPI,
      pathExists: jest.fn(async () => fileContents !== null),
      readFile: jest.fn(async (filePath: string) => {
        if (filePath === '/proj/schema/translation-settings.json') {
          if (fileContents === null) throw new Error('ENOENT');
          return fileContents;
        }
        throw new Error('ENOENT');
      }),
      writeFile: jest.fn(async (filePath: string, contents: string) => {
        if (filePath === '/proj/schema/translation-settings.json') {
          fileContents = contents;
        }
      }),
      createDirectory: jest.fn(async () => undefined),
    } as unknown as typeof window.electronAPI;
  });

  test('does not create settings when no languages are configured yet', async () => {
    const result = await upsertTranslationSettings(bundle, {
      alignmentUnit: 'ab',
      languages: [],
    });

    expect(result).toBeNull();
    expect(fileContents).toBeNull();
  });

  test('replaces in-progress settings that have no languages yet', async () => {
    fileContents = JSON.stringify({
      version: 1,
      alignmentUnit: 'ab',
      languages: [],
      lockedAt: '2026-01-01T00:00:00.000Z',
    });

    const result = await upsertTranslationSettings(bundle, {
      alignmentUnit: 'p',
      languages: [{ code: 'en', label: 'English' }],
    });

    expect(result).toEqual({
      version: 1,
      alignmentUnit: 'p',
      languages: [{ code: 'en', label: 'English' }],
      lockedAt: '2026-01-01T00:00:00.000Z',
      citationStyle: undefined,
    });
  });

  test('appends languages once the list is non-empty', async () => {
    fileContents = JSON.stringify({
      version: 1,
      alignmentUnit: 'ab',
      languages: [{ code: 'en', label: 'English' }],
      lockedAt: '2026-01-01T00:00:00.000Z',
    });

    const result = await upsertTranslationSettings(bundle, {
      alignmentUnit: 'ab',
      languages: [
        { code: 'en', label: 'English' },
        { code: 'fr', label: 'Français' },
      ],
    });

    expect(result?.languages).toEqual([
      { code: 'en', label: 'English' },
      { code: 'fr', label: 'Français' },
    ]);
  });
});

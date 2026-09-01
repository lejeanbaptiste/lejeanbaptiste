import { DEFAULT_AI_API_SETTINGS, parseAppPrefs, sanitizeRecentProjectFiles } from './projectPrefs';

jest.mock('electron', () => ({
  app: {
    getPath: () => '/tmp',
  },
}));

describe('parseAppPrefs', () => {
  it('keeps entityDbFolder when lastProjectFile is null', () => {
    const prefs = parseAppPrefs({
      lastProjectFile: null,
      entityDbFolder: '/Users/me/entity-db',
    });

    expect(prefs.entityDbFolder).toBe('/Users/me/entity-db');
    expect(prefs.lastProjectFile).toBeNull();
  });

  it('keeps entityDbFolder when only entityDbFolder is stored', () => {
    const prefs = parseAppPrefs({
      entityDbFolder: '/Users/me/entity-db',
    });

    expect(prefs.entityDbFolder).toBe('/Users/me/entity-db');
    expect(prefs.lastProjectFile).toBeNull();
  });

  it('keeps entityDbFolder alongside lastProjectFile', () => {
    const prefs = parseAppPrefs({
      lastProjectFile: '/Users/me/project/jean-baptiste.project.json',
      entityDbFolder: '/Users/me/entity-db',
    });

    expect(prefs.lastProjectFile).toBe('/Users/me/project/jean-baptiste.project.json');
    expect(prefs.entityDbFolder).toBe('/Users/me/entity-db');
  });

  it('migrates lastRootPath and keeps entityDbFolder', () => {
    const prefs = parseAppPrefs({
      lastRootPath: '/Users/me/project',
      entityDbFolder: '/Users/me/entity-db',
    });

    expect(prefs.lastProjectFile).toBe('/Users/me/project/jean-baptiste.project.json');
    expect(prefs.entityDbFolder).toBe('/Users/me/entity-db');
    expect(prefs.recentProjectFiles).toEqual(['/Users/me/project/jean-baptiste.project.json']);
  });

  it('seeds recent projects from lastProjectFile when missing', () => {
    const prefs = parseAppPrefs({
      lastProjectFile: '/Users/me/tibet/jean-baptiste.project.json',
    });

    expect(prefs.recentProjectFiles).toEqual(['/Users/me/tibet/jean-baptiste.project.json']);
  });

  it('defaults aiApi.alwaysOn to false when absent', () => {
    const prefs = parseAppPrefs({
      aiApi: {
        ...DEFAULT_AI_API_SETTINGS,
        model: 'test-model',
        verifiedAt: '2026-01-01T00:00:00.000Z',
      },
    });

    expect(prefs.aiApi.alwaysOn).toBe(false);
  });

  it('preserves aiApi.alwaysOn when explicitly saved', () => {
    const prefs = parseAppPrefs({
      aiApi: {
        ...DEFAULT_AI_API_SETTINGS,
        model: 'test-model',
        alwaysOn: true,
        verifiedAt: '2026-01-01T00:00:00.000Z',
      },
    });

    expect(prefs.aiApi.alwaysOn).toBe(true);
  });
});

describe('sanitizeRecentProjectFiles', () => {
  it('deduplicates, trims, and caps the list', () => {
    const recent = sanitizeRecentProjectFiles([
      ' /a/jean-baptiste.project.json ',
      '/b/jean-baptiste.project.json',
      '/a/jean-baptiste.project.json',
      '/c/jean-baptiste.project.json',
      '/d/jean-baptiste.project.json',
      '/e/jean-baptiste.project.json',
      '/f/jean-baptiste.project.json',
      '/g/jean-baptiste.project.json',
      '/h/jean-baptiste.project.json',
      '/i/jean-baptiste.project.json',
      '/j/jean-baptiste.project.json',
      '/k/jean-baptiste.project.json',
    ]);

    expect(recent).toHaveLength(10);
    expect(recent[0]).toBe('/a/jean-baptiste.project.json');
    expect(recent).not.toContain('/k/jean-baptiste.project.json');
  });
});

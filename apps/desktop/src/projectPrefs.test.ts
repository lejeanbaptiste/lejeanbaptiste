import { parseAppPrefs } from './projectPrefs';

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
  });
});

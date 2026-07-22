import { resolveDialogDefaultPath } from './dialogDefaultPath';

describe('resolveDialogDefaultPath', () => {
  const home = '/Users/me';
  const entityDb = '/Users/me/Library/entity-database';
  const exists = new Set([
    '/Users/me/dialog-pick',
    '/Users/me/project',
    entityDb,
  ]);

  const resolve = (overrides: Partial<Parameters<typeof resolveDialogDefaultPath>[0]> = {}) =>
    resolveDialogDefaultPath({
      entityDbFolder: entityDb,
      homeDir: home,
      lastDialogDir: null,
      lastProjectFile: null,
      pathExists: (candidate) => exists.has(candidate),
      ...overrides,
    });

  it('prefers the last dialog directory', () => {
    expect(
      resolve({
        lastDialogDir: '/Users/me/dialog-pick',
        lastProjectFile: '/Users/me/project/jean-baptiste.project.json',
      }),
    ).toBe('/Users/me/dialog-pick');
  });

  it('falls back to the last opened project root, not its parent', () => {
    expect(resolve({ lastProjectFile: '/Users/me/project/jean-baptiste.project.json' })).toBe(
      '/Users/me/project',
    );
  });

  it('skips the entity database folder and uses home', () => {
    expect(resolve({ lastDialogDir: entityDb })).toBe(home);
    expect(resolve({ lastProjectFile: `${entityDb}/jean-baptiste.project.json` })).toBe(home);
  });
});

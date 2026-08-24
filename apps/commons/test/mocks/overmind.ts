/**
 * Default Overmind state and actions for commons render tests.
 *
 * The desktop panels are deeply connected — a single panel routinely reaches
 * `project`, `ui`, `editor` and `auth`, often through children it does not know
 * about. Discovering each slice from a `Cannot destructure property …` failure,
 * one run at a time, is most of the cost of writing a render test, so these
 * defaults cover every slice commons uses with a sensible empty value.
 *
 * Tests override what they care about. Build the objects once outside the hooks,
 * not per call — real Overmind actions keep a stable identity across renders, and
 * a fresh `jest.fn()` per render would both break assertions and misrepresent
 * that:
 *
 *   jest.mock('@src/overmind', () => {
 *     const m = jest.requireActual('../../../test/mocks/overmind');
 *     const state = m.appState({ project: { rootPath: '/tmp/p' } });
 *     const acts = m.actions();
 *     return { useAppState: () => state, useActions: () => acts };
 *   });
 *
 * Actions are inert `jest.fn()`s; a test that needs to assert a dispatch can
 * reach them through the same `jest.requireActual` handle.
 */

type Slice = Record<string, unknown>;

const baseState: Record<string, Slice> = {
  project: {
    activeTabPath: null,
    config: null,
    isProjectReady: false,
    openTabs: [],
    projectFilePath: null,
    rootPath: null,
    tree: [],
  },
  ui: {
    cookieConsent: [],
    currentLocale: 'en',
    darkMode: false,
    layout: {},
    skipEntityDetachConfirm: false,
    themeAppearance: 'system',
  },
  editor: {
    contentHasChanged: false,
    isReadonly: false,
    resource: null,
  },
  auth: {
    user: null,
    isAuthenticated: false,
  },
  providers: {
    storageProviders: [],
  },
  storage: {
    storageDialogState: { open: false },
  },
};

const actionNames: Record<string, string[]> = {
  ui: ['notifyViaSnackbar', 'openDialog', 'closeDialog', 'setSkipEntityDetachConfirm'],
  project: ['openFile', 'openProject', 'reloadTabFromDisk', 'setExplorerFocusedPath'],
  storage: ['uploadFile'],
  auth: ['login', 'logout'],
  editor: ['setContentHasChanged'],
  providers: ['refresh'],
};

/** Deep-ish merge: one level of slice, then a shallow merge of its keys. */
export const appState = (overrides: Record<string, Slice> = {}) => {
  const out: Record<string, Slice> = {};
  for (const [slice, value] of Object.entries(baseState)) {
    out[slice] = { ...value, ...(overrides[slice] ?? {}) };
  }
  for (const [slice, value] of Object.entries(overrides)) {
    if (!out[slice]) out[slice] = value;
  }
  return out;
};

export const actions = (overrides: Record<string, Slice> = {}) => {
  const out: Record<string, Slice> = {};
  for (const [slice, names] of Object.entries(actionNames)) {
    out[slice] = Object.fromEntries(names.map((name) => [name, jest.fn()]));
    Object.assign(out[slice], overrides[slice] ?? {});
  }
  for (const [slice, value] of Object.entries(overrides)) {
    if (!out[slice]) out[slice] = value;
  }
  return out;
};

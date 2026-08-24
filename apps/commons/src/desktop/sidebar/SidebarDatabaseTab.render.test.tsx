import { render, screen } from '@testing-library/react';
import { SidebarDatabaseTab } from './SidebarDatabaseTab';

/**
 * Render smoke test for the database sidebar.
 *
 * This panel is ~3,700 lines and had no test that mounted it, which let a real
 * crash through during the 2026-08 dependency audit: a `useCallback` was given a
 * dependency declared further down the component, and because dependency arrays
 * are evaluated during render that is a temporal-dead-zone `ReferenceError`.
 * `tsc` caught it; the whole suite stayed green. Mounting the component executes
 * every hook body and every dependency array, so that class of mistake fails
 * here instead.
 *
 * Deliberately shallow: it asserts the panel mounts and reaches its empty state,
 * not how any particular feature behaves. The value is in exercising the render
 * path at all, and the cost is a handful of mocks that stay stable as the
 * panel's internals change.
 */

const notifyViaSnackbar = jest.fn();
const setSkipEntityDetachConfirm = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: 'en' },
  }),
}));

jest.mock('@src/overmind', () => ({
  useAppState: () => ({
    ui: { skipEntityDetachConfirm: false },
    project: { config: null, rootPath: null },
  }),
  useActions: () => ({
    ui: { notifyViaSnackbar, setSkipEntityDetachConfirm },
  }),
}));

// react-window measures real DOM; with no entities to show there are no rows to
// virtualise, so a passthrough keeps the test independent of its layout maths.
jest.mock('react-window', () => ({
  List: () => null,
}));

// The bare `@cwrc/leafwriter` specifier resolves to the package's built webpack
// bundle, which cannot run under jsdom ("Automatic publicPath is not supported").
// The panel needs exactly one export from it, so stand in a real atom rather than
// mapping the whole editor into this test.
jest.mock('@cwrc/leafwriter', () => ({
  entityLookupDialogAtom: jest.requireActual('jotai').atom(null),
}));

describe('SidebarDatabaseTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  it('mounts without a project and shows the open-a-project hint', () => {
    render(<SidebarDatabaseTab active />);
    expect(screen.getByText('LWC.desktop.sidebar.database.open_project_hint')).toBeTruthy();
  });

  // The panel is normally rendered with `active` false while another sidebar tab
  // is showing, which is a different path through its effects.
  it('mounts while inactive', () => {
    expect(() => render(<SidebarDatabaseTab active={false} />)).not.toThrow();
  });

  it('does not report an error to the user on a clean mount', () => {
    render(<SidebarDatabaseTab active />);
    expect(notifyViaSnackbar).not.toHaveBeenCalled();
  });
});

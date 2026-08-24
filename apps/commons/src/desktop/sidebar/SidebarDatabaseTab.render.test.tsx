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

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: 'en' },
  }),
}));

// The factory is hoisted above any const in this file, so the shared actions are
// built inside it and re-exported for assertions rather than referenced from
// outside — the same temporal-dead-zone trap these tests exist to catch.
jest.mock('@src/overmind', () => {
  const m = jest.requireActual('../../../test/mocks/overmind');
  const state = m.appState();
  const acts = m.actions();
  return { useAppState: () => state, useActions: () => acts, __actions: acts };
});

const { __actions } = jest.requireMock('@src/overmind') as {
  __actions: { ui: { notifyViaSnackbar: jest.Mock } };
};

// react-window measures real DOM; with no entities to show there are no rows to
// virtualise, so a passthrough keeps the test independent of its layout maths.
jest.mock('react-window', () => ({
  List: () => null,
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
    expect(__actions.ui.notifyViaSnackbar).not.toHaveBeenCalled();
  });
});

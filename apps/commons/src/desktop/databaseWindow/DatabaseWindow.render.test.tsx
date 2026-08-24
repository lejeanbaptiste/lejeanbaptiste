import { render } from '@testing-library/react';
import { DatabaseWindow } from './DatabaseWindow';

/**
 * Render smoke test for the standalone database window. See
 * SidebarDatabaseTab.render.test.tsx for why these exist.
 */

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: 'en' },
  }),
}));

jest.mock('@src/overmind', () => {
  const m = jest.requireActual('../../../test/mocks/overmind');
  const state = m.appState();
  const acts = m.actions();
  return { useAppState: () => state, useActions: () => acts, __actions: acts };
});

// No entities to show, so there are no rows to virtualise.
jest.mock('react-window', () => ({ List: () => null }));

const { __actions } = jest.requireMock('@src/overmind') as {
  __actions: { ui: { notifyViaSnackbar: jest.Mock } };
};

describe('DatabaseWindow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('mounts with no project configured', () => {
    expect(() => render(<DatabaseWindow />)).not.toThrow();
  });

  it('does not report an error to the user on a clean mount', () => {
    render(<DatabaseWindow />);
    expect(__actions.ui.notifyViaSnackbar).not.toHaveBeenCalled();
  });
});

import { render } from '@testing-library/react';
import { SidebarExplorerTab } from './SidebarExplorerTab';

/**
 * Render smoke test for the file-explorer sidebar. See
 * SidebarDatabaseTab.render.test.tsx for why these exist.
 */

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

jest.mock('@src/overmind', () => {
  const m = jest.requireActual('../../../test/mocks/overmind');
  const state = m.appState();
  const acts = m.actions();
  return { useAppState: () => state, useActions: () => acts };
});

describe('SidebarExplorerTab', () => {
  it('mounts with no project open', () => {
    expect(() => render(<SidebarExplorerTab />)).not.toThrow();
  });
});

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { SidebarFindTab } from './SidebarFindTab';

/**
 * Render smoke test for the find/replace sidebar. See
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

// Reached through useFindReplace -> useLeafWriter, which calls useNavigate.
const renderPanel = () =>
  render(
    <MemoryRouter>
      <SidebarFindTab />
    </MemoryRouter>,
  );

describe('SidebarFindTab', () => {
  it('mounts with no project open', () => {
    expect(() => renderPanel()).not.toThrow();
  });

  it('offers a find field', () => {
    renderPanel();
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0);
  });
});

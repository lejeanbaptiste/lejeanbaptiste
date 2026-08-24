import { render, screen } from '@testing-library/react';
import { SidebarXPathTab } from './SidebarXPathTab';

/**
 * Render smoke test for the XPath sidebar. See SidebarDatabaseTab.render.test.tsx
 * for why these exist: mounting a panel executes every hook body and dependency
 * array, which is the only thing that catches a dependency naming a binding
 * declared further down the component.
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

describe('SidebarXPathTab', () => {
  it('mounts and offers a query field', () => {
    render(<SidebarXPathTab />);
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('mounts without a project open', () => {
    expect(() => render(<SidebarXPathTab />)).not.toThrow();
  });
});

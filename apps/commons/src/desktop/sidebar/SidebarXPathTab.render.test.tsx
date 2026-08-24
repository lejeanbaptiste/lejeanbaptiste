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

jest.mock('@src/overmind', () => ({
  useAppState: () => ({
    project: { activeTabPath: null, openTabs: [], rootPath: null },
    // Read by a child of this panel, not by the panel itself.
    editor: { resource: null },
  }),
  // Likewise: children of this panel dispatch, even though it does not.
  useActions: () => ({
    ui: { notifyViaSnackbar: jest.fn() },
    project: { openFile: jest.fn() },
  }),
}));

describe('SidebarXPathTab', () => {
  it('mounts and offers a query field', () => {
    render(<SidebarXPathTab />);
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('mounts without a project open', () => {
    expect(() => render(<SidebarXPathTab />)).not.toThrow();
  });
});

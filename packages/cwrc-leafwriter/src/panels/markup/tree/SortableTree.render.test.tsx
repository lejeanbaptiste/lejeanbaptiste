import { SortableTree } from './SortableTree';
import { renderWithOvermind } from '../../../../test/renderWithOvermind';

/**
 * Render smoke test for the markup tree. See
 * apps/commons/src/desktop/sidebar/SidebarDatabaseTab.render.test.tsx for why
 * these exist.
 */

beforeEach(() => {
  // The tree reads the editor off `window.writer` on mount.
  (window as unknown as { writer: unknown }).writer = {
    editor: null,
    event: () => ({ subscribe: () => undefined, unsubscribe: () => undefined }),
  };
});

describe('SortableTree', () => {
  it('mounts with no document loaded', () => {
    expect(() =>
      renderWithOvermind(<SortableTree refreshVersion={0} syncMode="live" />),
    ).not.toThrow();
  });

  it('mounts in manual sync mode', () => {
    expect(() =>
      renderWithOvermind(<SortableTree refreshVersion={0} syncMode="manual" />),
    ).not.toThrow();
  });
});

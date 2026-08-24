import { AutoTaggingDialog } from './index';
import { renderWithOvermind } from '../../../test/renderWithOvermind';

/**
 * Render smoke test for the auto-tagging dialog — at ~1,960 lines the largest
 * component in the repo. See
 * apps/commons/src/desktop/sidebar/SidebarDatabaseTab.render.test.tsx for why
 * these exist.
 */

describe('AutoTaggingDialog', () => {
  it('mounts closed', () => {
    expect(() =>
      renderWithOvermind(<AutoTaggingDialog id="auto-tagging" onClose={jest.fn()} />),
    ).not.toThrow();
  });

  it('mounts open on its first step', () => {
    expect(() =>
      renderWithOvermind(<AutoTaggingDialog id="auto-tagging" onClose={jest.fn()} open />),
    ).not.toThrow();
  });
});

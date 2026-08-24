import { AutoTaggingReviewPane } from './AutoTaggingReviewPane';
import { renderWithOvermind } from '../../test/renderWithOvermind';

/**
 * Render smoke test for the docked auto-tagging review pane. See
 * apps/commons/src/desktop/sidebar/SidebarDatabaseTab.render.test.tsx for why
 * these exist.
 *
 * Like AutoTaggingDialog, this only became testable once `import.meta` was
 * split out of the overmind config's import graph.
 */

describe('AutoTaggingReviewPane', () => {
  it('mounts with no batch active', () => {
    expect(() => renderWithOvermind(<AutoTaggingReviewPane />)).not.toThrow();
  });
});

import { DesktopLanguageTool } from './desktop-language-tool';
import { renderWithOvermind } from '../../../../../test/renderWithOvermind';

/**
 * Render smoke test for the LanguageTool settings panel. See
 * apps/commons/src/desktop/sidebar/SidebarDatabaseTab.render.test.tsx for why
 * these exist: mounting is what evaluates hook bodies and dependency arrays.
 */

describe('DesktopLanguageTool', () => {
  it('mounts outside the desktop app', () => {
    expect(() => renderWithOvermind(<DesktopLanguageTool />)).not.toThrow();
  });
});

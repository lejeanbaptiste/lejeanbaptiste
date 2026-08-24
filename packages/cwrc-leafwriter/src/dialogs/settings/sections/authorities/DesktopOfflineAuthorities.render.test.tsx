import { DesktopOfflineAuthorities } from './desktop-offline-authorities';
import { renderWithOvermind } from '../../../../../test/renderWithOvermind';

/**
 * Render smoke test for the offline authorities settings panel. See
 * apps/commons/src/desktop/sidebar/SidebarDatabaseTab.render.test.tsx for why
 * these exist: mounting is what evaluates hook bodies and dependency arrays.
 */

describe('DesktopOfflineAuthorities', () => {
  it('mounts outside the desktop app', () => {
    expect(() => renderWithOvermind(<DesktopOfflineAuthorities />)).not.toThrow();
  });
});

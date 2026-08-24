import { render } from '@testing-library/react';
import { UnifiedRightPanel } from './UnifiedRightPanel';

/**
 * Render smoke test for the unified right panel. See
 * src/desktop/sidebar/SidebarDatabaseTab.render.test.tsx for why these exist.
 */

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: 'en' },
  }),
}));

jest.mock('@src/overmind', () => {
  const m = jest.requireActual('../../test/mocks/overmind');
  const state = m.appState();
  const acts = m.actions();
  return { useAppState: () => state, useActions: () => acts };
});

describe('UnifiedRightPanel', () => {
  it('mounts with no editor attached', () => {
    expect(() => render(<UnifiedRightPanel />)).not.toThrow();
  });
});

import { render } from '@testing-library/react';
import { AchievementsDialog } from './AchievementsDialog';

/**
 * Render smoke test for the achievements dialog. See
 * apps/commons/src/desktop/sidebar/SidebarDatabaseTab.render.test.tsx for why
 * these exist.
 */

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: 'en' },
  }),
}));

jest.mock('@src/overmind', () => {
  const m = jest.requireActual('../../../test/mocks/overmind');
  const state = m.appState();
  const acts = m.actions();
  return { useAppState: () => state, useActions: () => acts, __actions: acts };
});

describe('AchievementsDialog', () => {
  it('mounts closed', () => {
    expect(() => render(<AchievementsDialog open={false} onClose={jest.fn()} />)).not.toThrow();
  });

  it('mounts open', () => {
    expect(() => render(<AchievementsDialog open onClose={jest.fn()} />)).not.toThrow();
  });
});

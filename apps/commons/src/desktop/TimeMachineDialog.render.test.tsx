import { render } from '@testing-library/react';
import { TimeMachineDialog } from './TimeMachineDialog';

/**
 * Render smoke test for the Time Machine dialog. See
 * apps/commons/src/desktop/sidebar/SidebarDatabaseTab.render.test.tsx for why
 * these exist: mounting is what evaluates hook bodies and dependency arrays.
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

describe('TimeMachineDialog', () => {
  it('mounts closed', () => {
    expect(() => render(<TimeMachineDialog open={false} onClose={jest.fn()} />)).not.toThrow();
  });

  it('mounts open with no project', () => {
    expect(() => render(<TimeMachineDialog open onClose={jest.fn()} />)).not.toThrow();
  });
});

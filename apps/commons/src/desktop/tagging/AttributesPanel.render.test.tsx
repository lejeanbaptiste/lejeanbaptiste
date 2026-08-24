import { render } from '@testing-library/react';
import { AttributesPanel } from './AttributesPanel';

/**
 * Render smoke test for the attributes panel. See
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

describe('AttributesPanel', () => {
  it('mounts with no document open', () => {
    expect(() => render(<AttributesPanel />)).not.toThrow();
  });

  it('mounts while hidden', () => {
    expect(() => render(<AttributesPanel visible={false} />)).not.toThrow();
  });
});

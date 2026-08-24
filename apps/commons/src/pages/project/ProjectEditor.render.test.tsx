import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ProjectEditor } from './ProjectEditor';

/**
 * Render smoke test for the project editor page. See
 * src/desktop/sidebar/SidebarDatabaseTab.render.test.tsx for why these exist.
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
  return { useAppState: () => state, useActions: () => acts };
});

describe('ProjectEditor', () => {
  it('mounts with no project open', () => {
    expect(() =>
      render(
        <MemoryRouter>
          <ProjectEditor />
        </MemoryRouter>,
      ),
    ).not.toThrow();
  });
});

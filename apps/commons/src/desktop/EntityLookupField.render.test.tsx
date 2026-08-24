import { render } from '@testing-library/react';
import { EntityLookupField } from './EntityLookupField';

/**
 * Render smoke test for the entity lookup field. See
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

describe('EntityLookupField', () => {
  it('mounts empty in single mode', () => {
    expect(() =>
      render(
        <EntityLookupField
          kind="person"
          tag="persName"
          label="Author"
          mode="single"
          values={[]}
          onChange={jest.fn()}
        />,
      ),
    ).not.toThrow();
  });

  it('mounts disabled in multi mode', () => {
    expect(() =>
      render(
        <EntityLookupField
          kind="person"
          tag="persName"
          label="Authors"
          mode="multi"
          values={[]}
          disabled
          onChange={jest.fn()}
        />,
      ),
    ).not.toThrow();
  });
});

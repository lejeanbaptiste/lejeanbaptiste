import { render } from '@testing-library/react';
import { EntityNoteEditor } from './EntityNoteEditor';

/**
 * Render smoke test for the entity note editor. See
 * src/desktop/sidebar/SidebarDatabaseTab.render.test.tsx for why these exist.
 *
 * Worth having specifically because this component's unmount path carries a
 * flush: the cleanup captures `editorRef.current` at effect setup, since React
 * has already nulled it by the time cleanup runs. Mounting and unmounting is the
 * only thing that exercises that.
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

describe('EntityNoteEditor', () => {
  it('mounts with no store or entity', () => {
    expect(() => render(<EntityNoteEditor store={null} entityId={null} />)).not.toThrow();
  });

  // The unmount flush is guarded against a null store, so tearing down a clean
  // mount must be a no-op rather than a throw.
  it('unmounts cleanly', () => {
    const { unmount } = render(<EntityNoteEditor store={null} entityId={null} />);
    expect(() => unmount()).not.toThrow();
  });
});

import { render } from '@testing-library/react';
import { ProjectMetadataForm } from './ProjectMetadataForm';

/**
 * Render smoke test for the project-metadata form.
 *
 * This is the component the editor package renders through
 * `registerProjectSettingsPanel` — the seam introduced when
 * `@cwrc/leafwriter` stopped importing the app. A break here shows up as a
 * missing Settings tab rather than an error, so mounting it is worth pinning.
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

const io = {
  loadState: jest.fn().mockResolvedValue(null),
  saveMetadata: jest.fn().mockResolvedValue({ ok: true }),
  nameTypePolicy: {
    load: jest.fn().mockResolvedValue(null),
    persist: jest.fn().mockResolvedValue(undefined),
  },
  onCancel: jest.fn(),
  onSaved: jest.fn(),
};

describe('ProjectMetadataForm', () => {
  it('mounts in panel layout', () => {
    expect(() => render(<ProjectMetadataForm io={io} layout="panel" />)).not.toThrow();
  });

  it('mounts in page layout', () => {
    expect(() => render(<ProjectMetadataForm io={io} layout="page" />)).not.toThrow();
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockPersistAuthoritySettings = jest.fn().mockResolvedValue(undefined);
const mockReadPersistedAuthoritySettings = jest.fn().mockReturnValue({});
const mockReadProjectNameTypeTaggingPolicy = jest.fn();

jest.mock('../../../../autoTagging/authoritySettings', () => {
  const actual = jest.requireActual('../../../../autoTagging/authoritySettings');
  return {
    ...actual,
    readPersistedAuthoritySettings: () => mockReadPersistedAuthoritySettings(),
    readProjectNameTypeTaggingPolicy: () => mockReadProjectNameTypeTaggingPolicy(),
    persistAuthoritySettings: (...args: unknown[]) => mockPersistAuthoritySettings(...args),
  };
});

import { DesktopNameTypePolicy } from './desktop-name-type-policy';

describe('DesktopNameTypePolicy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (window as Window & { electronAPI?: object }).electronAPI = {};
    (window as Window & { __leafWriterProject?: object }).__leafWriterProject = {
      getProjectFilePath: () => '/tmp/test.project.json',
      getProjectSourceLanguage: async () => 'zh',
    };
    mockReadProjectNameTypeTaggingPolicy.mockResolvedValue({
      buckets: {
        primary: 'phase1',
        birth: 'phase1',
        family: 'never',
        given: 'phase2',
        courtesy: 'phase2',
        art: 'phase1',
        posthumous: 'phase1',
        temple: 'phase1',
        dharma: 'phase1',
        pen: 'phase1',
        variant: 'phase1',
      },
      customTypes: [{ id: 'alias', label: 'Alias', bucket: 'phase2' }],
      artMinCodePoints: 3,
    });
  });

  afterEach(() => {
    delete (window as Window & { electronAPI?: object }).electronAPI;
    delete (window as Window & { __leafWriterProject?: object }).__leafWriterProject;
  });

  it('renders built-in rows and persists bucket changes', async () => {
    render(<DesktopNameTypePolicy />);

    expect(await screen.findByText('Name types for auto-tagging')).toBeTruthy();
    expect(screen.getByText('Primary name')).toBeTruthy();
    expect(screen.getByText('Alias')).toBeTruthy();

    const courtesyGroup = screen.getByRole('group', {
      name: 'Courtesy name (字) auto-tagging phase',
    });
    const courtesyPhase1 = Array.from(courtesyGroup.querySelectorAll('button')).find(
      (button) => button.textContent === 'Phase 1',
    );
    expect(courtesyPhase1).toBeTruthy();
    await userEvent.click(courtesyPhase1!);

    await waitFor(() => {
      expect(mockPersistAuthoritySettings).toHaveBeenCalled();
    });
    const saved = mockPersistAuthoritySettings.mock.calls.at(-1)?.[0];
    expect(saved.nameTypeTaggingPolicy.courtesy).toBe('phase1');
    expect(saved.customNameTypes).toEqual([{ id: 'alias', label: 'Alias', bucket: 'phase2' }]);
  });

  it('returns null without a desktop project', () => {
    delete (window as Window & { electronAPI?: object }).electronAPI;
    const { container } = render(<DesktopNameTypePolicy />);
    expect(container.firstChild).toBeNull();
  });
});

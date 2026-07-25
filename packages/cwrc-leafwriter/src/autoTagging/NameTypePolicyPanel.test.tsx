import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NameTypePolicyPanel, type NameTypePolicyIO } from './NameTypePolicyPanel';

describe('NameTypePolicyPanel', () => {
  const persist = jest.fn().mockResolvedValue(undefined);

  const io: NameTypePolicyIO = {
    load: async () => ({
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
      sourceLanguage: 'zh',
    }),
    persist,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders built-in rows and persists bucket changes', async () => {
    render(<NameTypePolicyPanel io={io} />);

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
      expect(persist).toHaveBeenCalled();
    });
    const saved = persist.mock.calls.at(-1)?.[0];
    expect(saved.buckets.courtesy).toBe('phase1');
    expect(saved.customTypes).toEqual([{ id: 'alias', label: 'Alias', bucket: 'phase2' }]);
  });
});

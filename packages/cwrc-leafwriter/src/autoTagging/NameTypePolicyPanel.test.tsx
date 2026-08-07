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

    expect(await screen.findByText('LW.nameTypePolicy.title')).toBeTruthy();
    expect(screen.getByText('Primary name')).toBeTruthy();
    expect(screen.getByText('Courtesy name (字)')).toBeTruthy();
    expect(screen.getByText('Alias')).toBeTruthy();
    expect(screen.getByText('LW.nameTypePolicy.custom_title')).toBeTruthy();

    const courtesyRow = screen.getByText('Courtesy name (字)').closest('div')?.parentElement;
    expect(courtesyRow).toBeTruthy();
    const courtesyPhase1 = Array.from(courtesyRow!.querySelectorAll('button')).find(
      (button) => button.textContent === 'LW.nameTypePolicy.phase1',
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

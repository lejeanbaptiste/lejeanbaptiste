import { getSkipCopyPasteHelp, setSkipCopyPasteHelp } from './copyPasteHelpSettings';

describe('copyPasteHelpSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as Window & { __ljbCommonsUi?: unknown }).__ljbCommonsUi;
  });

  test('reads and writes skipCopyPasteHelp from localStorage', () => {
    expect(getSkipCopyPasteHelp()).toBe(false);

    setSkipCopyPasteHelp(true);

    expect(localStorage.getItem('skipCopyPasteHelp')).toBe('true');
    expect(getSkipCopyPasteHelp()).toBe(true);
  });

  test('uses commons UI bridge when available', () => {
    const setSkipCopyPasteHelpBridge = jest.fn();
    window.__ljbCommonsUi = {
      skipCopyPasteHelp: true,
      setSkipCopyPasteHelp: setSkipCopyPasteHelpBridge,
    } as typeof window.__ljbCommonsUi;

    expect(getSkipCopyPasteHelp()).toBe(true);

    setSkipCopyPasteHelp(false);

    expect(setSkipCopyPasteHelpBridge).toHaveBeenCalledWith(false);
    expect(localStorage.getItem('skipCopyPasteHelp')).toBeNull();
  });
});

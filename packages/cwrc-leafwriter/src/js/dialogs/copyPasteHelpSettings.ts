type CommonsUiBridge = {
  skipCopyPasteHelp: boolean;
  setSkipCopyPasteHelp: (value: boolean) => void;
};

const getCommonsUiBridge = (): CommonsUiBridge | undefined =>
  (
    window as Window & {
      __ljbCommonsUi?: CommonsUiBridge;
    }
  ).__ljbCommonsUi;

export const getSkipCopyPasteHelp = (): boolean => {
  const bridge = getCommonsUiBridge();
  if (bridge) return bridge.skipCopyPasteHelp;

  if (typeof localStorage === 'undefined') return false;

  const value = localStorage.getItem('skipCopyPasteHelp');
  if (!value) return false;

  try {
    return JSON.parse(value) === true;
  } catch {
    return value === 'true';
  }
};

export const setSkipCopyPasteHelp = (value: boolean) => {
  const bridge = getCommonsUiBridge();
  if (bridge?.setSkipCopyPasteHelp) {
    bridge.setSkipCopyPasteHelp(value);
    return;
  }

  if (typeof localStorage === 'undefined') return;
  localStorage.setItem('skipCopyPasteHelp', JSON.stringify(value));
};

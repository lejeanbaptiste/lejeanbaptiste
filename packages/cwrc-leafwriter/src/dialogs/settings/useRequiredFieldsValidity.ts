import { useEffect, useState } from 'react';
import { useAppState } from '../../overmind';

const isDesktopApp =
  typeof window !== 'undefined' && !!(window as Window & { electronAPI?: unknown }).electronAPI;

const getCommonsUiBridge = () =>
  (
    window as Window & {
      __ljbCommonsUi?: { encoderName: string };
    }
  ).__ljbCommonsUi;

export interface RequiredFieldsValidity {
  isDesktop: boolean;
  languageValid: boolean;
  encoderNameValid: boolean;
  allValid: boolean;
}

/** Language and user name must both be set on desktop before settings can close. */
export const useRequiredFieldsValidity = (): RequiredFieldsValidity => {
  const { currentLocale } = useAppState().ui;
  const [bridgeState, setBridgeState] = useState(() => ({
    encoderName: getCommonsUiBridge()?.encoderName ?? '',
  }));

  useEffect(() => {
    if (!isDesktopApp) return;
    const sync = () =>
      setBridgeState({
        encoderName: getCommonsUiBridge()?.encoderName ?? '',
      });
    sync();
    window.addEventListener('ljbCommonsUiChanged', sync);
    return () => window.removeEventListener('ljbCommonsUiChanged', sync);
  }, []);

  const languageValid = !!currentLocale?.trim();
  const encoderNameValid = !isDesktopApp || !!bridgeState.encoderName.trim();

  return {
    isDesktop: isDesktopApp,
    languageValid,
    encoderNameValid,
    allValid: languageValid && encoderNameValid,
  };
};

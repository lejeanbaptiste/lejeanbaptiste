import { useEffect, useState } from 'react';
import { useAppState } from '../../overmind';

const isDesktopApp =
  typeof window !== 'undefined' && !!(window as Window & { electronAPI?: unknown }).electronAPI;

const getCommonsUiBridge = () =>
  (
    window as Window & {
      __ljbCommonsUi?: { encoderName: string; entityDbFolder: string | null };
    }
  ).__ljbCommonsUi;

export interface RequiredFieldsValidity {
  isDesktop: boolean;
  languageValid: boolean;
  encoderNameValid: boolean;
  entityDbFolderValid: boolean;
  allValid: boolean;
}

/** Language, user name, and database folder must all be set on desktop before settings can close. */
export const useRequiredFieldsValidity = (): RequiredFieldsValidity => {
  const { currentLocale } = useAppState().ui;
  const [bridgeState, setBridgeState] = useState(() => ({
    encoderName: getCommonsUiBridge()?.encoderName ?? '',
    entityDbFolder: getCommonsUiBridge()?.entityDbFolder ?? null,
  }));

  useEffect(() => {
    if (!isDesktopApp) return;
    const sync = () =>
      setBridgeState({
        encoderName: getCommonsUiBridge()?.encoderName ?? '',
        entityDbFolder: getCommonsUiBridge()?.entityDbFolder ?? null,
      });
    sync();
    window.addEventListener('ljbCommonsUiChanged', sync);
    return () => window.removeEventListener('ljbCommonsUiChanged', sync);
  }, []);

  const languageValid = !!currentLocale?.trim();
  const encoderNameValid = !isDesktopApp || !!bridgeState.encoderName.trim();
  const entityDbFolderValid = !isDesktopApp || !!bridgeState.entityDbFolder?.trim();

  return {
    isDesktop: isDesktopApp,
    languageValid,
    encoderNameValid,
    entityDbFolderValid,
    allValid: languageValid && encoderNameValid && entityDbFolderValid,
  };
};

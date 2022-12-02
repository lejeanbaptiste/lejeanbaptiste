import { v4 as uuidv4 } from 'uuid';
import { Context } from '../';
import type { DialogBarProps } from '../../dialogs';
import i18next from '../../i18n';
import { supportedLanguages } from '../../utilities';

//* INIITIALIZE
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const onInitializeOvermind = async ({ state }: Context, _overmind: any) => {
  //DARK MODE
  const prefDarkMode = localStorage.getItem('darkMode');
  const darkMode = prefDarkMode === 'true' ? true : false;
  state.ui.darkMode = darkMode;

  //LANGUAGE
  const prefLanguageCode = localStorage.getItem('i18nextLng');
  if (prefLanguageCode) {
    const prefLanguage = supportedLanguages[prefLanguageCode];
    state.ui.language = prefLanguage ? prefLanguage : supportedLanguages['en-CA'];

    i18next.changeLanguage(state.ui.language.code);
  }
};

export const updateTranslation = ({ state }: Context, value?: string) => {
  const prefLanguageCode = value ? value : localStorage.getItem('i18nextLng');

  if (prefLanguageCode) {
    const prefLanguage = supportedLanguages[prefLanguageCode];
    state.ui.language = prefLanguage ? prefLanguage : supportedLanguages['en-CA'];

    if (i18next.language !== state.ui.language.code) i18next.changeLanguage(state.ui.language.code);
  }
};

export const openDialog = ({ state }: Context, dialogBar: DialogBarProps) => {
  if (!dialogBar.props?.id) dialogBar.props = { ...dialogBar.props, id: uuidv4() };
  if (!dialogBar.type) dialogBar.type = 'simple';
  state.ui.dialogBar = [...state.ui.dialogBar, dialogBar];
};

export const closeDialog = ({ state }: Context, id: string) => {
  state.ui.dialogBar = [
    ...state.ui.dialogBar.map((dialogBar) => {
      if (dialogBar.props?.id === id) dialogBar.dismissed = true;
      return dialogBar;
    }),
  ];
};

export const removeDialog = ({ state }: Context, id: string) => {
  state.ui.dialogBar = state.ui.dialogBar.filter((dialogBar) => dialogBar.props?.id !== id);
};

export const setDialogDisplayId = (
  { state }: Context,
  { id, displayId }: { id: string; displayId: string }
) => {
  state.ui.dialogBar = [
    ...state.ui.dialogBar.map((dialogBar) => {
      if (dialogBar.props?.id === id) dialogBar.displayId = displayId;
      return dialogBar;
    }),
  ];
};

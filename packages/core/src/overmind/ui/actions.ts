import { ContextMenuState, PaletteMode } from '../../@types/';
import { Context } from '../';
import type { PopupProps } from '../../components/popup';
import { EntityLink, EntityLookupDialogProps } from '../../components/entityLookups/types';
import { supportedLanguages } from '../../utilities/util';

export const onInitializeOvermind = ({ actions }: Context, overmind: any) => {
  //DARK MODE
  const prefPaletteMode: PaletteMode =
    (localStorage.getItem('themeAppearance') as PaletteMode) ?? 'auto';
  actions.ui.setThemeAppearance(prefPaletteMode);
};

export const setThemeAppearance = ({ state, actions }: Context, value: PaletteMode) => {
  state.ui.themeAppearance = value;

  const darkMode =
    value === 'auto'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : value === 'light'
      ? false
      : true;

  actions.ui.setDarkMode(darkMode);

  localStorage.setItem('themeAppearance', value);
};

export const setDarkMode = ({ state }: Context, value: boolean) => {
  state.ui.darkMode = value;
};

export const closeContextMenu = ({ state }: Context) => {
  state.ui.contextMenu = { show: false };
};

export const showContextMenu = ({ state }: Context, value: ContextMenuState) => {
  state.ui.contextMenu = value;
};

export const updateTitle = ({ state }: Context, title: string) => {
  state.ui.title = title;
};

export const resetPreferences = () => {
  localStorage.removeItem('paletteMode');
};

export const openPopup = ({ state }: Context, props: Omit<PopupProps, 'open'>) => {
  state.ui.popupProps = { ...props, open: true };
};

export const closePopup = ({ state }: Context, id: string) => {
  state.ui.popupProps = { open: false };
};

export const openEditSourceDialog = ({ state }: Context, content: string) => {
  state.ui.editSourceProps = { content, open: true };
};

export const closeEditSourceDialog = ({ state }: Context) => {
  state.ui.editSourceProps = { open: false };
};

export const processEditSource = ({ state, actions }: Context, newContent: string) => {
  state.ui.editSourceProps = { open: false };
  actions.document.loadDocumentXML(newContent);
};

export const openEntityLookupsDialog = (
  { state }: Context,
  props: Omit<EntityLookupDialogProps, 'open'>
) => {
  state.ui.entityLookupDialogProps = { ...props, open: true };
};

export const closeEntityLookupsDialog = (
  { state: { ui } }: Context,
  link?: EntityLink | Pick<EntityLink, 'query' | 'type'>
) => {
  const dialog = ui.entityLookupDialogProps;
  if (link && dialog.onClose) dialog.onClose(link);
  ui.entityLookupDialogProps = { open: false };
};

export const switchLanguage = ({ state }: Context, value: string) => {
  const language = supportedLanguages.get(value) ?? {
    code: 'en-CA',
    name: 'english',
    shortName: 'en',
  };
  state.ui.language = language;
  return value;
};

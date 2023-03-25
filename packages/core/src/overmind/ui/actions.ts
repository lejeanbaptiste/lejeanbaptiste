import { v4 as uuidv4 } from 'uuid';
import { Context } from '../';
import { supportedLanguages } from '../../config';
import type { DialogBarProps } from '../../dialogs';
import type { EntityLink, EntityLookupDialogProps } from '../../dialogs/entityLookups';
import { ContextMenuState, NotificationProps, PaletteMode, PanelId, Side } from '../../types';
import i18n from 'i18next';

export const onInitializeOvermind = ({ actions }: Context, overmind: any) => {
  //DARK MODE
  const prefPaletteMode: PaletteMode =
    (localStorage.getItem('themeAppearance') as PaletteMode) ?? 'auto';
  actions.ui.setThemeAppearance(prefPaletteMode);

  //LANGUAGE
  const prefLanguageCode = effects.editor.api.getFromLocalStorage('i18nextLng');
  if (prefLanguageCode) {
    const prefLanguage = supportedLanguages.get(prefLanguageCode);

    const language = prefLanguage ?? { code: 'en-CA', name: 'english', shortName: 'en' };

    state.ui.language = language;
    i18n.changeLanguage(language.shortName);
  }
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

export const setFullscreen = ({ state }: Context, value: boolean) => {
  state.ui.fullscreen = value;
};

export const toggleFullscreen = ({ state }: Context) => {
  const isFullscreen = window.writer.layoutManager.toggleFullScreen();
  state.ui.fullscreen = isFullscreen;
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

export const openDialog = ({ state }: Context, dialogBar: DialogBarProps) => {
  if (!dialogBar.props?.id) dialogBar.props = { ...dialogBar.props, id: uuidv4() };
  if (!dialogBar.type) dialogBar.type = 'simple';
  state.ui.dialogBar = [...state.ui.dialogBar, dialogBar];
};

export const closeDialog = ({ state }: Context, id: string) => {
  state.ui.dialogBar = [
    ...state.ui.dialogBar.map((dialogBar) => {
      if (dialogBar.props.id === id) dialogBar.dismissed = true;
      return dialogBar;
    }),
  ];
};

export const removeDialog = ({ state }: Context, id: string) => {
  state.ui.dialogBar = state.ui.dialogBar.filter((dialogBar) => dialogBar.props.id !== id);
};

export const setDialogDisplayId = (
  { state }: Context,
  { id, displayId }: { id: string; displayId: string }
) => {
  state.ui.dialogBar = [
    ...state.ui.dialogBar.map((dialogBar) => {
      if (dialogBar.props.id === id) dialogBar.displayId = displayId;
      return dialogBar;
    }),
  ];
};

export const notifyViaSnackbar = ({ state }: Context, notification: NotificationProps | string) => {
  if (typeof notification === 'string') notification = { message: notification };

  let key = notification.options && notification.options.key;
  if (!key) key = new Date().getTime() + Math.random();

  state.ui.notifications = [...state.ui.notifications, { ...notification, key }];
};

export const closeNotificationSnackbar = ({ state }: Context, key?: string | number) => {
  const dismissAll = !key;
  state.ui.notifications = state.ui.notifications.map((notification) =>
    dismissAll || notification.key === key
      ? { ...notification, dismissed: true }
      : { ...notification }
  );
};

export const removeNotificationSnackbar = ({ state }: Context, key: string | number) => {
  state.ui.notifications = state.ui.notifications.filter(
    (notification) => notification.key !== key
  );
};

export const shouldDisplayDialog = ({ effects }: Context, value: string) => {
  const dialogs: string[] = effects.editor.api.getFromLocalStorage('doNotDisplayDialogs') ?? [];
  if (dialogs.includes(value)) return false;
  return true;
};

export const doNotDisplayDialog = ({ effects }: Context, value: string) => {
  let dialogs: string[] = effects.editor.api.getFromLocalStorage('doNotDisplayDialogs') ?? [];
  dialogs = [...dialogs, value];
  effects.editor.api.saveToLocalStorage('doNotDisplayDialogs', dialogs);
};

export const resetDoNotDisplayDialogs = ({ effects }: Context) => {
  effects.editor.api.removeFromLocalStorage('doNotDisplayDialogs');
};

export const updateReadonly = ({ state, actions }: Context) => {
  const { isReadonly } = state.editor;

  window.writer.isReadOnly = isReadonly;
  window.writer.editor.mode.set(isReadonly ? 'readonly' : 'design');
  window.writer.layoutManager.toggleReadonly(isReadonly);
  window.writer.entitiesList.toggleReadonly(isReadonly);
  window.writer.layoutManager.resizeEditor();
};

export const allowTagDragAndDrop = ({ state }: Context, value: boolean) => {
  state.ui.markupPanel = {
    ...state.ui.markupPanel,
    allowDragAndDrop: value,
  };
};

export const allowStructurePanelMultiselection = ({ state }: Context, value: boolean) => {
  state.ui.markupPanel = {
    ...state.ui.markupPanel,
    allowMultiselection: value,
  };
};

export const showTextNodes = ({ state, actions }: Context, value?: boolean) => {
  if (!value) value = !state.ui.markupPanel.showTextNodes;

  state.ui.markupPanel = {
    ...state.ui.markupPanel,
    showTextNodes: value,
  };

  actions.ui.allowTagDragAndDrop(value);
  if (value === false) actions.ui.showTextNodesContent(false);
};

export const showTextNodesContent = ({ state }: Context, value: boolean) => {
  state.ui.markupPanel = {
    ...state.ui.markupPanel,
    showTextNodesContent: value,
  };
};

export const changePanel = (
  { state }: Context,
  { side, panelId }: { side: Uncapitalize<Side>; panelId: PanelId }
) => {
  state.ui.layout[side].activePanel = panelId;
};

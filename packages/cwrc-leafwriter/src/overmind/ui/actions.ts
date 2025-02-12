// import i18n from 'i18next';
import { v4 as uuidv4 } from 'uuid';
import { Context } from '../';
import { db } from '../../db';
import type { DialogBarProps, PopupProps } from '../../dialogs';
import i18n, { Locales, localesSchema } from '../../i18n';
import type {
  ContextMenuState,
  NotificationProps,
  PaletteMode,
  PanelId,
  Side
} from '../../types';

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
export const onInitializeOvermind = ({ state, actions, effects }: Context, overmind: any) => {
  //DARK MODE
  const prefPaletteMode: PaletteMode =
    effects.editor.api.getFromLocalStorage<PaletteMode>('themeAppearance') ?? 'auto';

  actions.ui.setThemeAppearance(prefPaletteMode);

  //LANGUAGE
  const prefLocale = effects.editor.api.getFromLocalStorage<string>('i18nextLng');
  if (prefLocale) {
    const supportedLocaled = localesSchema.safeParse(prefLocale).success
      ? (prefLocale as Locales)
      : 'en';

    state.ui.currentLocale = supportedLocaled;
    void i18n.changeLanguage(supportedLocaled);
  }
};

export const setThemeAppearance = ({ state, actions, effects }: Context, value: PaletteMode) => {
  state.ui.themeAppearance = value;

  const darkMode =
    value === 'auto'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : value === 'light'
        ? false
        : true;

  actions.ui.setDarkMode(darkMode);

  effects.editor.api.saveToLocalStorage<PaletteMode>('themeAppearance', value);
};

export const listenChangeLanguage = async ({ state, effects }: Context) => {
  //* check language
  const prefLocale = effects.editor.api.getFromLocalStorage<string>('i18nextLng');
  if (prefLocale) {
    const supportedLocaled = localesSchema.safeParse(prefLocale).success
      ? (prefLocale as Locales)
      : 'en';

    state.ui.currentLocale = supportedLocaled;
    void i18n.changeLanguage(supportedLocaled);
  }
};

// eslint-disable-next-line @typescript-eslint/ban-types
export const switchLocal = ({ state }: Context, locale: Locales | (string & {})) => {
  const supportedLocaled = localesSchema.safeParse(locale).success ? (locale as Locales) : 'en';
  state.ui.currentLocale = supportedLocaled;
  void i18n.changeLanguage(supportedLocaled);
};

export const listenChangeTheme = ({ state, actions, effects }: Context) => {
  const prefPaletteMode = effects.editor.api.getFromLocalStorage<PaletteMode>('themeAppearance');
  if (prefPaletteMode && prefPaletteMode !== state.ui.themeAppearance) {
    if (prefPaletteMode) actions.ui.setThemeAppearance(prefPaletteMode);
  }
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

export const showContextMenu = ({ state }: Context, value: Omit<ContextMenuState, 'show'>) => {
  state.ui.contextMenu = { ...value, show: true };
};

export const updateTitle = ({ state }: Context, title: string) => {
  state.ui.title = title;
};

export const resetPreferences = ({ effects }: Context) => {
  effects.editor.api.removeFromLocalStorage('themeAppearance');
};

export const switchLocale = ({ state }: Context, locale: string) => {
  const supportedLocale = localesSchema.safeParse(locale).success ? (locale as Locales) : 'en';
  state.ui.currentLocale = supportedLocale;
  return supportedLocale;
};

export const openDialog = ({ state }: Context, dialogBar: DialogBarProps) => {
  const dialogOpened = state.ui.dialogBar.some(({ props }) => props?.id === dialogBar.props?.id);
  if (dialogOpened) return;

  if (!dialogBar.props?.id) dialogBar.props = { ...dialogBar.props, id: uuidv4() };
  if (!dialogBar.type) dialogBar.type = 'simple';
  state.ui.dialogBar = [...state.ui.dialogBar, dialogBar];
  return dialogBar.props.id;
};

export const editDialogPopupProps = ({ state }: Context, props: PopupProps) => {
  state.ui.dialogBar = [
    ...state.ui.dialogBar.map((dialog) => {
      if (dialog.props?.id === props?.id) dialog.props = props;
      return dialog;
    }),
  ];
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
  { id, displayId }: { id: string; displayId: string },
) => {
  state.ui.dialogBar = [
    ...state.ui.dialogBar.map((dialogBar) => {
      if (dialogBar.props?.id === id) dialogBar.displayId = displayId;
      return dialogBar;
    }),
  ];
};

export const notifyViaSnackbar = ({ state }: Context, notification: NotificationProps | string) => {
  if (typeof notification === 'string') notification = { message: notification };

  let key = notification.options?.key;
  if (!key) key = new Date().getTime() + Math.random();

  state.ui.notifications = [...state.ui.notifications, { ...notification, key }];
};

export const closeNotificationSnackbar = ({ state }: Context, key?: string | number) => {
  const dismissAll = !key;
  state.ui.notifications = state.ui.notifications.map((notification) =>
    dismissAll || notification.key === key
      ? { ...notification, dismissed: true }
      : { ...notification },
  );
};

export const removeNotificationSnackbar = ({ state }: Context, key: string | number) => {
  state.ui.notifications = state.ui.notifications.filter(
    (notification) => notification.key !== key,
  );
};

export const shouldDisplayDialog = async (_context: Context, value: string) => {
  const dialogId = await db.doNotDisplayDialogs.get({ id: value });
  return !dialogId;
};

export const doNotDisplayDialog = async (_context: Context, value: string) => {
  await db.doNotDisplayDialogs.put({ id: value });
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const resetDoNotDisplayDialogs = async (_context: Context) => {
  await db.doNotDisplayDialogs.clear();
};

export const updateReadonly = ({ state }: Context) => {
  const { isReadonly } = state.editor;

  window.writer.isReadOnly = isReadonly;
  window.writer.editor?.mode.set(isReadonly ? 'readonly' : 'design');
  window.writer.layoutManager.toggleReadonly(isReadonly);
  window.writer.entitiesList?.toggleReadonly(isReadonly);
  window.writer.layoutManager.resizeEditor();
};

export const allowTagDragAndDrop = ({ state }: Context, value: boolean) => {
  state.ui.markupPanel = {
    ...state.ui.markupPanel,
    allowDragAndDrop: value,
  };
};

export const showTextNodes = ({ state, actions }: Context, value?: boolean) => {
  if (!value) value = !state.ui.markupPanel.showTextNodes;

  state.ui.markupPanel = {
    ...state.ui.markupPanel,
    showTextNodes: value,
  };

  actions.ui.allowTagDragAndDrop(value);
};

export const changePanel = (
  { state }: Context,
  { side, panelId }: { side: Uncapitalize<Side>; panelId: PanelId },
) => {
  const sidePanel = state.ui.layout[side];
  if (!sidePanel) return;
  sidePanel.activePanel = panelId;
};

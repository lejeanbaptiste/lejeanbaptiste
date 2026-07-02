import { BrowserWindow, dialog, ipcMain, type MessageBoxOptions } from 'electron';

export type NativeDialogType = 'settings' | 'schemaPicker' | 'schemaSetup' | 'projectMetadata';

interface NativeDialogConfig {
  route: string;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  modal: boolean;
}

const NATIVE_DIALOG_CONFIG: Record<NativeDialogType, NativeDialogConfig> = {
  settings: {
    route: '/project/native/settings',
    width: 820,
    height: 640,
    minWidth: 400,
    minHeight: 320,
    modal: false,
  },
  schemaPicker: {
    route: '/project/native/schema-picker',
    width: 480,
    height: 340,
    minWidth: 360,
    minHeight: 280,
    modal: false,
  },
  schemaSetup: {
    route: '/project/native/schema-setup',
    width: 520,
    height: 420,
    minWidth: 400,
    minHeight: 320,
    modal: true,
  },
  projectMetadata: {
    route: '/project/native/project-metadata',
    width: 640,
    height: 720,
    minWidth: 480,
    minHeight: 480,
    modal: true,
  },
};

const POOLED_DIALOG_TYPES = new Set<NativeDialogType>(['projectMetadata']);

interface NativeDialogWindow {
  id: string;
  type: NativeDialogType;
  window: BrowserWindow;
}

interface PooledDialog {
  type: NativeDialogType;
  window: BrowserWindow;
  loaded: boolean;
  shown: boolean;
  loadPromise: Promise<void> | null;
}

const nativeDialogWindows = new Map<string, NativeDialogWindow>();
const pooledDialogs = new Map<NativeDialogType, PooledDialog>();

let getAppUrl: (path: string) => Promise<string>;
let getParentWindow: () => BrowserWindow | null;
let getAppIcon: () => Electron.NativeImage | undefined;
let getPreloadPath: () => string;

export const initNativeDialogs = (deps: {
  getAppUrl: (path: string) => Promise<string>;
  getParentWindow: () => BrowserWindow | null;
  getAppIcon: () => Electron.NativeImage | undefined;
  getPreloadPath: () => string;
}) => {
  getAppUrl = deps.getAppUrl;
  getParentWindow = deps.getParentWindow;
  getAppIcon = deps.getAppIcon;
  getPreloadPath = deps.getPreloadPath;
};

const notifyDialogClosed = (id: string) => {
  const parent = getParentWindow();
  if (parent && !parent.isDestroyed()) {
    parent.webContents.send('native-dialog:closed', id);
  }
};

const hidePooledDialogEntry = (id: string, entry: NativeDialogWindow) => {
  if (!entry.window.isDestroyed()) {
    entry.window.hide();
  }
  nativeDialogWindows.delete(id);
  notifyDialogClosed(id);
};

const closeNativeDialog = (id: string) => {
  const entry = nativeDialogWindows.get(id);
  if (!entry) return;

  if (POOLED_DIALOG_TYPES.has(entry.type)) {
    hidePooledDialogEntry(id, entry);
    return;
  }

  if (!entry.window.isDestroyed()) entry.window.close();
  nativeDialogWindows.delete(id);
};

const closeOpenDialogsOfType = (type: NativeDialogType) => {
  for (const [existingId, existing] of nativeDialogWindows) {
    if (existing.type === type) {
      closeNativeDialog(existingId);
    }
  }
};

const createDialogWindow = (
  type: NativeDialogType,
  config: NativeDialogConfig,
  parent: BrowserWindow,
): BrowserWindow =>
  new BrowserWindow({
    width: config.width,
    height: config.height,
    minWidth: config.minWidth,
    minHeight: config.minHeight,
    title: 'Le Jean-Baptiste',
    icon: getAppIcon(),
    parent,
    modal: config.modal,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

const attachPooledCloseHandler = (type: NativeDialogType, dialogWindow: BrowserWindow) => {
  dialogWindow.on('close', (event) => {
    if (!POOLED_DIALOG_TYPES.has(type)) return;
    event.preventDefault();
    for (const [id, entry] of nativeDialogWindows) {
      if (entry.window === dialogWindow) {
        hidePooledDialogEntry(id, entry);
        break;
      }
    }
  });
};

const loadPooledDialog = async (type: NativeDialogType): Promise<BrowserWindow> => {
  const parent = getParentWindow();
  if (!parent) throw new Error('No parent window');

  const config = NATIVE_DIALOG_CONFIG[type];
  let pooled = pooledDialogs.get(type);
  if (!pooled || pooled.window.isDestroyed()) {
    const dialogWindow = createDialogWindow(type, config, parent);
    attachPooledCloseHandler(type, dialogWindow);
    pooled = { type, window: dialogWindow, loaded: false, shown: false, loadPromise: null };
    pooledDialogs.set(type, pooled);
  }

  if (pooled.loaded) return pooled.window;

  if (!pooled.loadPromise) {
    const url = await getAppUrl(config.route);
    const warmupUrl = `${url}?dialogId=__prewarm__`;
    pooled.loadPromise = new Promise<void>((resolve, reject) => {
      pooled!.window.once('ready-to-show', () => {
        pooled!.loaded = true;
        resolve();
      });
      pooled!.window.webContents.once('did-fail-load', (_event, _code, description) => {
        reject(new Error(description));
      });
      void pooled!.window.loadURL(warmupUrl).catch(reject);
    });
  }

  await pooled.loadPromise;
  return pooled.window;
};

const openPooledNativeDialog = async (payload: {
  id: string;
  type: NativeDialogType;
  title?: string;
  initialState?: unknown;
}) => {
  closeOpenDialogsOfType(payload.type);

  const dialogWindow = await loadPooledDialog(payload.type);
  const pooled = pooledDialogs.get(payload.type);

  nativeDialogWindows.set(payload.id, {
    id: payload.id,
    type: payload.type,
    window: dialogWindow,
  });

  dialogWindow.setTitle(payload.title ?? 'Le Jean-Baptiste');
  dialogWindow.webContents.send('native-dialog:open', {
    dialogId: payload.id,
    title: payload.title,
    initialState: payload.initialState,
  });

  if (pooled) pooled.shown = true;
  dialogWindow.show();
  dialogWindow.focus();
  return { ok: true };
};

const openEphemeralNativeDialog = async (payload: {
  id: string;
  type: NativeDialogType;
  title?: string;
}) => {
  const parent = getParentWindow();
  if (!parent) return { ok: false };

  closeOpenDialogsOfType(payload.type);

  const config = NATIVE_DIALOG_CONFIG[payload.type] ?? NATIVE_DIALOG_CONFIG.settings;
  const url = await getAppUrl(config.route);

  const dialogWindow = createDialogWindow(payload.type, config, parent);
  dialogWindow.setTitle(payload.title ?? 'Le Jean-Baptiste');

  nativeDialogWindows.set(payload.id, {
    id: payload.id,
    type: payload.type,
    window: dialogWindow,
  });

  dialogWindow.on('closed', () => {
    nativeDialogWindows.delete(payload.id);
    notifyDialogClosed(payload.id);
  });

  const loadUrl = `${url}?dialogId=${encodeURIComponent(payload.id)}`;
  await new Promise<void>((resolve, reject) => {
    dialogWindow.once('ready-to-show', () => {
      dialogWindow.show();
      dialogWindow.focus();
      resolve();
    });
    dialogWindow.webContents.once('did-fail-load', (_event, _code, description) => {
      reject(new Error(description));
    });
    void dialogWindow.loadURL(loadUrl).catch(reject);
  });
  return { ok: true };
};

/** Load heavy dialog pages in the background so first open feels instant. */
export const prewarmNativeDialog = (type: NativeDialogType) => {
  if (!POOLED_DIALOG_TYPES.has(type)) return;
  void loadPooledDialog(type).catch((error) => {
    console.warn(`[nativeDialogs] Failed to prewarm ${type}:`, error);
  });
};

export const registerNativeDialogIpc = () => {
  ipcMain.handle(
    'showNativeMessageBox',
    async (
      _event,
      options: {
        buttons?: string[];
        cancelId?: number;
        defaultId?: number;
        detail?: string;
        message: string;
        title: string;
        type?: 'error' | 'info' | 'none' | 'question' | 'warning';
      },
    ) => {
      const parent = getParentWindow();
      const buttons = options.buttons?.length ? options.buttons : ['OK'];
      const defaultId = options.defaultId ?? 0;
      const cancelId =
        options.cancelId ??
        (buttons.length > 1
          ? buttons.findIndex((label) => /cancel|no$/i.test(label.trim()))
          : 0);
      const resolvedCancelId = cancelId >= 0 ? cancelId : buttons.length > 1 ? buttons.length - 1 : 0;

      const messageOptions: MessageBoxOptions = {
        type: options.type ?? 'none',
        title: options.title,
        message: options.message,
        detail: options.detail,
        buttons,
        defaultId,
        cancelId: resolvedCancelId,
        noLink: true,
      };

      if (parent && !parent.isDestroyed()) {
        return dialog.showMessageBox(parent, messageOptions);
      }
      return dialog.showMessageBox(messageOptions);
    },
  );

  ipcMain.handle(
    'openNativeDialog',
    async (
      _event,
      payload: { id: string; type: NativeDialogType; title?: string; initialState?: unknown },
    ) => {
      const parent = getParentWindow();
      if (!parent) return { ok: false };
      if (POOLED_DIALOG_TYPES.has(payload.type)) {
        return openPooledNativeDialog(payload);
      }
      return openEphemeralNativeDialog(payload);
    },
  );

  ipcMain.handle('closeNativeDialog', (_event, id: string) => {
    closeNativeDialog(id);
    return { ok: true };
  });

  ipcMain.handle(
    'updateNativeDialogState',
    (_event, payload: { dialogId: string; initialState: unknown }) => {
      const entry = nativeDialogWindows.get(payload.dialogId);
      if (!entry || entry.window.isDestroyed()) return { ok: false };
      entry.window.webContents.send('native-dialog:state-update', {
        dialogId: payload.dialogId,
        initialState: payload.initialState,
      });
      return { ok: true };
    },
  );

  ipcMain.handle(
    'nativeDialog:invoke',
    async (_event, payload: { dialogId: string; method: string; args?: unknown }) => {
      const parent = getParentWindow();
      if (!parent || parent.isDestroyed()) return null;

      const baseArgs =
        payload.args && typeof payload.args === 'object' && !Array.isArray(payload.args)
          ? payload.args
          : {};
      const mergedArgs = { ...baseArgs, dialogId: payload.dialogId };
      const argsJson = JSON.stringify(mergedArgs);
      return parent.webContents.executeJavaScript(
        `(window.__ljbNativeBridge?.invoke(${JSON.stringify(payload.method)}, ${argsJson}))`,
      );
    },
  );
};

export const closeAllNativeDialogs = () => {
  for (const id of [...nativeDialogWindows.keys()]) {
    closeNativeDialog(id);
  }
  for (const pooled of pooledDialogs.values()) {
    if (!pooled.window.isDestroyed()) pooled.window.destroy();
  }
  pooledDialogs.clear();
};

/** Prefer an open native dialog as parent for nested system dialogs (e.g. file picker). */
export const getTopNativeDialogWindow = (): BrowserWindow | null => {
  for (const entry of nativeDialogWindows.values()) {
    if (!entry.window.isDestroyed()) return entry.window;
  }
  return null;
};

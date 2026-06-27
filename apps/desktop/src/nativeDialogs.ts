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

interface NativeDialogWindow {
  id: string;
  type: NativeDialogType;
  window: BrowserWindow;
}

const nativeDialogWindows = new Map<string, NativeDialogWindow>();

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

const closeNativeDialog = (id: string) => {
  const entry = nativeDialogWindows.get(id);
  if (!entry) return;
  if (!entry.window.isDestroyed()) entry.window.close();
  nativeDialogWindows.delete(id);
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
    async (_event, payload: { id: string; type: NativeDialogType; title?: string }) => {
      const parent = getParentWindow();
      if (!parent) return { ok: false };

      closeNativeDialog(payload.id);

      const config = NATIVE_DIALOG_CONFIG[payload.type] ?? NATIVE_DIALOG_CONFIG.settings;
      const url = await getAppUrl(config.route);

      const dialogWindow = new BrowserWindow({
        width: config.width,
        height: config.height,
        minWidth: config.minWidth,
        minHeight: config.minHeight,
        title: payload.title ?? 'Le Jean-Baptiste',
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

      nativeDialogWindows.set(payload.id, {
        id: payload.id,
        type: payload.type,
        window: dialogWindow,
      });

      dialogWindow.on('closed', () => {
        nativeDialogWindows.delete(payload.id);
        if (!parent.isDestroyed()) {
          parent.webContents.send('native-dialog:closed', payload.id);
        }
      });

      const loadUrl = `${url}?dialogId=${encodeURIComponent(payload.id)}`;
      const openStarted = Date.now();
      // #region agent log
      fetch('http://127.0.0.1:7253/ingest/aae22f38-d876-4045-816e-e95acef3f779',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dfd93a'},body:JSON.stringify({sessionId:'dfd93a',location:'nativeDialogs.ts:openNativeDialog',message:'dialog open started',data:{type:payload.type,dialogId:payload.id},timestamp:Date.now(),hypothesisId:'S1'})}).catch(()=>{});
      // #endregion

      await new Promise<void>((resolve, reject) => {
        dialogWindow.once('ready-to-show', () => {
          // #region agent log
          fetch('http://127.0.0.1:7253/ingest/aae22f38-d876-4045-816e-e95acef3f779',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'dfd93a'},body:JSON.stringify({sessionId:'dfd93a',location:'nativeDialogs.ts:openNativeDialog',message:'dialog ready-to-show',data:{type:payload.type,dialogId:payload.id,elapsedMs:Date.now()-openStarted},timestamp:Date.now(),hypothesisId:'S2'})}).catch(()=>{});
          // #endregion
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
    },
  );

  ipcMain.handle('closeNativeDialog', (_event, id: string) => {
    closeNativeDialog(id);
    return { ok: true };
  });

  ipcMain.handle(
    'nativeDialog:invoke',
    async (_event, payload: { dialogId: string; method: string; args?: unknown }) => {
      const parent = getParentWindow();
      if (!parent || parent.isDestroyed()) return null;

      const argsJson = JSON.stringify(payload.args ?? null);
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
};

/** Prefer an open native dialog as parent for nested system dialogs (e.g. file picker). */
export const getTopNativeDialogWindow = (): BrowserWindow | null => {
  for (const entry of nativeDialogWindows.values()) {
    if (!entry.window.isDestroyed()) return entry.window;
  }
  return null;
};

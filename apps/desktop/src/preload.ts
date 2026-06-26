import { contextBridge, ipcRenderer } from 'electron';

import type { ProjectBundle } from './projectFile';

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface NativeMessageBoxOptions {
  buttons?: string[];
  message: string;
  title: string;
  type?: 'error' | 'info' | 'none' | 'question' | 'warning';
}

export interface NativeDialogOptions {
  id: string;
  type: 'settings' | 'schemaPicker';
  title?: string;
}

export interface ElectronAPI {
  openProject: () => Promise<ProjectBundle | null>;
  /** @deprecated Use openProject */
  openProjectFolder: () => Promise<ProjectBundle | null>;
  restoreLastProject: () => Promise<ProjectBundle | null>;
  readDirectory: (dirPath: string, options?: { allFiles?: boolean }) => Promise<FileEntry[]>;
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<void>;
  setWindowTitle: (title: string) => Promise<void>;
  onAppMenuAction: (callback: (action: string) => void) => () => void;
  showNativeMessageBox: (
    options: NativeMessageBoxOptions,
  ) => Promise<{ response: number; checkboxChecked: boolean }>;
  openNativeDialog: (options: NativeDialogOptions) => Promise<{ ok: boolean }>;
  closeNativeDialog: (id: string) => Promise<{ ok: boolean }>;
  nativeDialogInvoke: (payload: {
    dialogId: string;
    method: string;
    args?: unknown;
  }) => Promise<unknown>;
  onNativeDialogClosed: (callback: (id: string) => void) => () => void;
}

const electronAPI: ElectronAPI = {
  openProject: () => ipcRenderer.invoke('openProject'),
  openProjectFolder: () => ipcRenderer.invoke('openProject'),
  restoreLastProject: () => ipcRenderer.invoke('restoreLastProject'),
  readDirectory: (dirPath: string, options?: { allFiles?: boolean }) =>
    ipcRenderer.invoke('readDirectory', dirPath, options),
  readFile: (filePath: string) => ipcRenderer.invoke('readFile', filePath),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('writeFile', filePath, content),
  setWindowTitle: (title: string) => ipcRenderer.invoke('setWindowTitle', title),
  onAppMenuAction: (callback: (action: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: string) => callback(action);
    ipcRenderer.on('app:menu-action', listener);
    return () => ipcRenderer.removeListener('app:menu-action', listener);
  },
  showNativeMessageBox: (options) => ipcRenderer.invoke('showNativeMessageBox', options),
  openNativeDialog: (options) => ipcRenderer.invoke('openNativeDialog', options),
  closeNativeDialog: (id: string) => ipcRenderer.invoke('closeNativeDialog', id),
  nativeDialogInvoke: (payload) => ipcRenderer.invoke('nativeDialog:invoke', payload),
  onNativeDialogClosed: (callback: (id: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, id: string) => callback(id);
    ipcRenderer.on('native-dialog:closed', listener);
    return () => ipcRenderer.removeListener('native-dialog:closed', listener);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

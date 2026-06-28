import { contextBridge, ipcRenderer } from 'electron';

import type { ProjectBundle } from './projectFile';
import type { SchemaUpdateApplyResult, SchemaUpdateCheckOptions, SchemaUpdateCheckResult } from '../../commons/src/desktop/schemaUpdateTypes';

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface NativeMessageBoxOptions {
  buttons?: string[];
  cancelId?: number;
  defaultId?: number;
  message: string;
  title: string;
  type?: 'error' | 'info' | 'none' | 'question' | 'warning';
}

export interface NativeDialogOptions {
  id: string;
  type: 'settings' | 'schemaPicker' | 'schemaSetup' | 'projectMetadata';
  title?: string;
  initialState?: unknown;
}

export interface PickSchemaFilesResult {
  rngPath: string;
  cssPath: string | null;
}

export interface NamedPath {
  name: string;
  path: string;
}

export interface FileStat {
  mtimeMs: number;
  size: number;
}

export interface ElectronAPI {
  openProject: () => Promise<ProjectBundle | null>;
  /** @deprecated Use openProject */
  openProjectFolder: () => Promise<ProjectBundle | null>;
  restoreLastProject: () => Promise<ProjectBundle | null>;
  readDirectory: (dirPath: string, options?: { allFiles?: boolean }) => Promise<FileEntry[]>;
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<void>;
  statFile: (filePath: string) => Promise<FileStat>;
  syncWatchedFiles: (paths: string[]) => Promise<void>;
  ignoreFileChange: (filePath: string, mtimeMs: number) => Promise<void>;
  findXmlFilesByName: (rootPath: string, query: string) => Promise<NamedPath[]>;
  listProjectXmlFiles: (rootPath: string) => Promise<NamedPath[]>;
  reloadProjectBundle: (projectFilePath: string) => Promise<ProjectBundle | null>;
  installCatalogSchema: (projectFilePath: string, catalogId: string) => Promise<ProjectBundle>;
  installLocalSchema: (
    projectFilePath: string,
    rngPath: string,
    cssPath?: string | null,
  ) => Promise<ProjectBundle>;
  checkSchemaUpdate: (
    projectFilePath: string,
    options?: SchemaUpdateCheckOptions,
  ) => Promise<SchemaUpdateCheckResult>;
  applyCatalogSchemaUpdate: (projectFilePath: string) => Promise<SchemaUpdateApplyResult>;
  pickSchemaFiles: () => Promise<PickSchemaFilesResult | null>;
  createTempDocument: (content: string) => Promise<{ filePath: string; filename: string }>;
  getEncoderName: () => Promise<string>;
  setEncoderName: (name: string) => Promise<void>;
  renamePath: (oldPath: string, newPath: string) => Promise<void>;
  movePath: (sourcePath: string, destDir: string) => Promise<string>;
  deletePath: (targetPath: string) => Promise<void>;
  createDirectory: (parentDir: string, folderName: string) => Promise<string>;
  pickMoveDestination: (defaultDir?: string) => Promise<string | null>;
  saveFileAs: (defaultPath?: string) => Promise<string | null>;
  setWindowTitle: (title: string) => Promise<void>;
  onAppMenuAction: (callback: (action: string) => void) => () => void;
  onExternalFileChange: (callback: (filePath: string) => void) => () => void;
  showNativeMessageBox: (
    options: NativeMessageBoxOptions,
  ) => Promise<{ response: number; checkboxChecked: boolean }>;
  openNativeDialog: (options: NativeDialogOptions) => Promise<{ ok: boolean }>;
  closeNativeDialog: (id: string) => Promise<{ ok: boolean }>;
  updateNativeDialogState: (payload: {
    dialogId: string;
    initialState: unknown;
  }) => Promise<{ ok: boolean }>;
  nativeDialogInvoke: (payload: {
    dialogId: string;
    method: string;
    args?: unknown;
  }) => Promise<unknown>;
  onNativeDialogClosed: (callback: (id: string) => void) => () => void;
  onNativeDialogOpen: (
    callback: (payload: { dialogId: string; title?: string; initialState?: unknown }) => void,
  ) => () => void;
  onNativeDialogStateUpdate: (
    callback: (payload: { dialogId: string; initialState: unknown }) => void,
  ) => () => void;
  lspStart: (options?: {
    defaultSchemaRng?: string;
    projectRoot?: string;
  }) => Promise<{ ok: boolean; error?: string; initializationOptions?: unknown }>;
  lspStop: () => Promise<{ ok: boolean }>;
  lspSend: (message: unknown) => Promise<{ ok: boolean }>;
  onLspMessage: (callback: (message: unknown) => void) => () => void;
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
  statFile: (filePath: string) => ipcRenderer.invoke('statFile', filePath),
  syncWatchedFiles: (paths: string[]) => ipcRenderer.invoke('syncWatchedFiles', paths),
  ignoreFileChange: (filePath: string, mtimeMs: number) =>
    ipcRenderer.invoke('ignoreFileChange', filePath, mtimeMs),
  findXmlFilesByName: (rootPath: string, query: string) =>
    ipcRenderer.invoke('findXmlFilesByName', rootPath, query),
  listProjectXmlFiles: (rootPath: string) =>
    ipcRenderer.invoke('listProjectXmlFiles', rootPath),
  reloadProjectBundle: (projectFilePath: string) =>
    ipcRenderer.invoke('reloadProjectBundle', projectFilePath),
  installCatalogSchema: (projectFilePath: string, catalogId: string) =>
    ipcRenderer.invoke('installCatalogSchema', projectFilePath, catalogId),
  installLocalSchema: (projectFilePath: string, rngPath: string, cssPath?: string | null) =>
    ipcRenderer.invoke('installLocalSchema', projectFilePath, rngPath, cssPath),
  checkSchemaUpdate: (projectFilePath: string, options?: SchemaUpdateCheckOptions) =>
    ipcRenderer.invoke('checkSchemaUpdate', projectFilePath, options),
  applyCatalogSchemaUpdate: (projectFilePath: string) =>
    ipcRenderer.invoke('applyCatalogSchemaUpdate', projectFilePath),
  pickSchemaFiles: () => ipcRenderer.invoke('pickSchemaFiles'),
  createTempDocument: (content: string) => ipcRenderer.invoke('createTempDocument', content),
  getEncoderName: () => ipcRenderer.invoke('getEncoderName'),
  setEncoderName: (name: string) => ipcRenderer.invoke('setEncoderName', name),
  renamePath: (oldPath: string, newPath: string) =>
    ipcRenderer.invoke('renamePath', oldPath, newPath),
  movePath: (sourcePath: string, destDir: string) =>
    ipcRenderer.invoke('movePath', sourcePath, destDir),
  deletePath: (targetPath: string) => ipcRenderer.invoke('deletePath', targetPath),
  createDirectory: (parentDir: string, folderName: string) =>
    ipcRenderer.invoke('createDirectory', parentDir, folderName),
  pickMoveDestination: (defaultDir?: string) =>
    ipcRenderer.invoke('pickMoveDestination', defaultDir),
  saveFileAs: (defaultPath?: string) => ipcRenderer.invoke('saveFileAs', defaultPath),
  setWindowTitle: (title: string) => ipcRenderer.invoke('setWindowTitle', title),
  onAppMenuAction: (callback: (action: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: string) => callback(action);
    ipcRenderer.on('app:menu-action', listener);
    return () => ipcRenderer.removeListener('app:menu-action', listener);
  },
  onExternalFileChange: (callback: (filePath: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { filePath: string }) => {
      if (payload?.filePath) callback(payload.filePath);
    };
    ipcRenderer.on('file:external-change', listener);
    return () => ipcRenderer.removeListener('file:external-change', listener);
  },
  showNativeMessageBox: (options) => ipcRenderer.invoke('showNativeMessageBox', options),
  openNativeDialog: (options) => ipcRenderer.invoke('openNativeDialog', options),
  closeNativeDialog: (id: string) => ipcRenderer.invoke('closeNativeDialog', id),
  updateNativeDialogState: (payload) => ipcRenderer.invoke('updateNativeDialogState', payload),
  nativeDialogInvoke: (payload) => ipcRenderer.invoke('nativeDialog:invoke', payload),
  onNativeDialogClosed: (callback: (id: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, id: string) => callback(id);
    ipcRenderer.on('native-dialog:closed', listener);
    return () => ipcRenderer.removeListener('native-dialog:closed', listener);
  },
  onNativeDialogOpen: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: { dialogId: string; title?: string; initialState?: unknown },
    ) => callback(payload);
    ipcRenderer.on('native-dialog:open', listener);
    return () => ipcRenderer.removeListener('native-dialog:open', listener);
  },
  onNativeDialogStateUpdate: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: { dialogId: string; initialState: unknown },
    ) => callback(payload);
    ipcRenderer.on('native-dialog:state-update', listener);
    return () => ipcRenderer.removeListener('native-dialog:state-update', listener);
  },
  lspStart: (options) => ipcRenderer.invoke('lsp:start', options),
  lspStop: () => ipcRenderer.invoke('lsp:stop'),
  lspSend: (message) => ipcRenderer.invoke('lsp:send', message),
  onLspMessage: (callback: (message: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, message: unknown) => callback(message);
    ipcRenderer.on('lsp:message', listener);
    return () => ipcRenderer.removeListener('lsp:message', listener);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

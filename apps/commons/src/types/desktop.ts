import type { ProjectBundle } from '@src/desktop/projectFile';

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

export type NativeDialogType = 'settings' | 'schemaPicker';

export interface NativeDialogOptions {
  id: string;
  type: NativeDialogType;
  title?: string;
}

export interface SchemaPickerOpenerOptions {
  mappingIds: string[];
  onSchemaSelect: (schema: { id: string; name: string; mapping: string; rng: string[]; css: string[] }) => void | Promise<void>;
  onClose: (action: string) => void;
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
  nativeDialogInvoke: (payload: {
    dialogId: string;
    method: string;
    args?: unknown;
  }) => Promise<unknown>;
  onNativeDialogClosed: (callback: (id: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    __ljbCommonsUi?: {
      skipCopyPasteHelp: boolean;
      skipExplorerDeleteConfirm: boolean;
      setSkipCopyPasteHelp: (value: boolean) => void;
      setSkipExplorerDeleteConfirm: (value: boolean) => void;
    };
    __ljbOpenNativeSchemaPicker?: (options: SchemaPickerOpenerOptions) => Promise<void>;
  }
}

export const isDesktop = (): boolean => typeof window !== 'undefined' && !!window.electronAPI;

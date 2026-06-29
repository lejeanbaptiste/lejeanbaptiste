import type { ProjectBundle } from '@src/desktop/projectFile';
import type { SchemaUpdateApplyResult, SchemaUpdateCheckOptions, SchemaUpdateCheckResult } from '@src/desktop/schemaUpdateTypes';

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

export type NativeDialogType = 'settings' | 'schemaPicker' | 'schemaSetup' | 'projectMetadata';

export interface PickSchemaFilesResult {
  rngPath: string;
  cssPath: string | null;
}

export interface NativeDialogOptions {
  id: string;
  type: NativeDialogType;
  title?: string;
  initialState?: unknown;
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
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  isWindowMaximized: () => Promise<boolean>;
  onWindowMaximized: (callback: (maximized: boolean) => void) => () => void;
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

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    __desktopRightPanel?: {
      expand: () => void;
      showTab: (tab: string) => void;
    };
    __ljbCommonsUi?: {
      encoderName: string;
      skipCopyPasteHelp: boolean;
      skipExplorerDeleteConfirm: boolean;
      setEncoderName: (name: string) => void | Promise<void>;
      setSkipCopyPasteHelp: (value: boolean) => void;
      setSkipExplorerDeleteConfirm: (value: boolean) => void;
    };
    __ljbOpenNativeSchemaPicker?: (options: SchemaPickerOpenerOptions) => Promise<void>;
    /** Desktop: strip teiHeader before WYSIWYG load (registered by useLeafWriter). */
    __desktopStripTeiHeaderForVisualEditor?: (xml: string) => string;
    /** Desktop: canonical tab XML with header (for validation merge). */
    __desktopStoredDocumentXml?: string;
    /** Desktop: merge stored header into editor XML before validation. */
    __desktopMergeHeaderForValidation?: (editorXml: string) => string;
  }
}

export const isDesktop = (): boolean => typeof window !== 'undefined' && !!window.electronAPI;

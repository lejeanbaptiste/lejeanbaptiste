import type { ProjectBundle } from '@src/desktop/projectFile';
import type {
  SchemaUpdateApplyResult,
  SchemaUpdateCheckOptions,
  SchemaUpdateCheckResult,
} from '@src/desktop/schemaUpdateTypes';

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
  onSchemaSelect: (schema: {
    id: string;
    name: string;
    mapping: string;
    rng: string[];
    css: string[];
  }) => void | Promise<void>;
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

export interface TimeMachineSnapshotSummary {
  app: 'le-jean-baptiste';
  createdAt: string;
  fileCount: number;
  id: string;
  path: string;
  projectName: string;
  projectRootPath: string;
  sizeBytes: number;
  version: 1;
}

export interface AiApiSettings {
  apiKey: string;
  baseUrl: string;
  customInstructions: string;
  model: string;
  temperature: number;
}

export interface AiConnectionResult {
  error?: string;
  models?: string[];
  ok: boolean;
}

export interface AiTranslationRequest {
  alignmentUnit: 'div' | 'p';
  sourceUnitXml: string;
  targetLanguage: string;
}

export interface AiTranslationResult {
  error?: string;
  ok: boolean;
  translationXml?: string;
}

export interface WorkspaceSession {
  activeFilePath: string | null;
  cursorPositions?: Record<string, WorkspaceCursorPosition>;
  openFilePaths: string[];
  projectFilePath: string | null;
}

export type WorkspaceCursorPosition =
  | { mode: 'source'; offset: number }
  | { mode: 'visual'; offsetInElementText: number; teiXPath: string };

export interface WorkspaceSessionRestore {
  activeFilePath: string | null;
  bundle: ProjectBundle;
  cursorPositions?: Record<string, WorkspaceCursorPosition>;
  openFilePaths: string[];
}

export interface ElectronAPI {
  openProject: () => Promise<ProjectBundle | null>;
  /** @deprecated Use openProject */
  openProjectFolder: () => Promise<ProjectBundle | null>;
  restoreLastProject: () => Promise<ProjectBundle | null>;
  getRememberWorkspaceOnStartup: () => Promise<boolean>;
  setRememberWorkspaceOnStartup: (remember: boolean) => Promise<void>;
  saveWorkspaceSession: (session: WorkspaceSession) => Promise<void>;
  restoreWorkspaceSession: () => Promise<WorkspaceSessionRestore | null>;
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
  listTimeMachineSnapshots: (projectRootPath: string) => Promise<TimeMachineSnapshotSummary[]>;
  createTimeMachineSnapshot: (
    projectRootPath: string,
    projectName: string,
  ) => Promise<TimeMachineSnapshotSummary>;
  pickTimeMachineRestoreDestination: (
    projectRootPath: string,
    snapshotId: string,
  ) => Promise<string | null>;
  restoreTimeMachineSnapshot: (snapshotPath: string, destinationPath: string) => Promise<void>;
  restoreTimeMachineSnapshotToProject: (
    projectRootPath: string,
    projectName: string,
    snapshotPath: string,
  ) => Promise<{ beforeRestoreSnapshot: TimeMachineSnapshotSummary }>;
  pickSchemaFiles: () => Promise<PickSchemaFilesResult | null>;
  createTempDocument: (content: string) => Promise<{ filePath: string; filename: string }>;
  getEncoderName: () => Promise<string>;
  setEncoderName: (name: string) => Promise<void>;
  getAiApiSettings: () => Promise<AiApiSettings>;
  setAiApiSettings: (settings: Partial<AiApiSettings>) => Promise<void>;
  testAiConnection: (settings: Partial<AiApiSettings>) => Promise<AiConnectionResult>;
  generateAiTranslation: (request: AiTranslationRequest) => Promise<AiTranslationResult>;
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
      aiApiSettings: AiApiSettings | null;
      encoderName: string;
      skipCopyPasteHelp: boolean;
      skipExplorerDeleteConfirm: boolean;
      setAiApiSettings: (settings: Partial<AiApiSettings>) => void | Promise<void>;
      setEncoderName: (name: string) => void | Promise<void>;
      setSkipCopyPasteHelp: (value: boolean) => void;
      setSkipExplorerDeleteConfirm: (value: boolean) => void;
      testAiConnection: (settings: Partial<AiApiSettings>) => Promise<AiConnectionResult>;
    };
    __ljbOpenNativeSchemaPicker?: (options: SchemaPickerOpenerOptions) => Promise<void>;
    /** Desktop: strip teiHeader before WYSIWYG load (registered by useLeafWriter). */
    __desktopStripTeiHeaderForVisualEditor?: (xml: string) => string;
    /** Desktop: canonical tab XML with header (for validation merge). */
    __desktopStoredDocumentXml?: string;
    /** Desktop: merge stored header into editor XML before validation. */
    __desktopMergeHeaderForValidation?: (editorXml: string) => string;
    /** Desktop: whether the Translation tab is currently open (gates automatic reindex-on-save). */
    __desktopTranslationTabActive?: boolean;
    /** One-shot: next external sync into the Monaco source editor resets the undo stack
     * instead of pushing an undoable edit (set by reload paths after translation reindexing). */
    __leafWriterNextSourceSyncResetsUndo?: boolean;
    __leafWriterTranslationPane?: {
      filePath: string | null;
      isActive: () => boolean;
      redo: () => Promise<boolean>;
      replaceContent: (filePath: string, content: string) => boolean;
      undo: () => Promise<boolean>;
    };
    __leafWriterCursorSession?: {
      capture: () => WorkspaceCursorPosition | null;
      restore: (position: WorkspaceCursorPosition) => Promise<boolean>;
    };
  }
}

export const isDesktop = (): boolean => typeof window !== 'undefined' && !!window.electronAPI;

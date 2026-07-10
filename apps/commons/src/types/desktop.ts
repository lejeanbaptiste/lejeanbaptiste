import type {
  AuthorityDownloadProgress,
  AuthoritySourceId,
  AuthoritySourceStatus,
} from '@src/desktop/authorityDbTypes';
import type {
  AuthorityLifecycleProgress,
  AuthorityLifecycleRunResult,
  AuthorityLifecycleSetEnabledOptions,
  AuthorityLifecycleStatus,
} from '@src/desktop/authorityLifecycleTypes';
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
  detail?: string;
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

export type ImportableDocumentFormat = 'txt' | 'md' | 'rtf' | 'docx' | 'odt';

export interface DocumentImportSource {
  format: ImportableDocumentFormat;
  relativePath: string;
  sourcePath: string;
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
  streamResults: boolean;
  verifiedAt: string | null;
  verifiedBaseUrl: string;
  verifiedModel: string;
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

export interface ZoteroStyle {
  id: string;
  label: string;
  xml: string;
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

export type DesktopRightPanelTab =
  'fileMetadata' | 'attributes' | 'css' | 'imageViewer' | 'validation' | 'translation';

export type DesktopValidatorInstrumentation = {
  workerLoading: boolean;
  workerLoaded: boolean;
  schemaLoading: boolean;
  schemaLoaded: boolean;
  validationRunning: boolean;
  validationPanelRequested: boolean;
  validationPanelMounted: boolean;
};

export interface LeafWriterSourceFindBridge {
  applyJump: (params: {
    content: string;
    ignoreCase: boolean;
    query: string;
    useRegex: boolean;
    start: number;
    end: number;
  }) => boolean;
  clear: () => void;
  replaceRange: (params: {
    content: string;
    end: number;
    replacement: string;
    start: number;
  }) => boolean;
  revealRange: (params: {
    content: string;
    end: number;
    focusEditor?: boolean;
    start: number;
  }) => boolean;
  scrollToHit: (params: { content: string; end: number; start: number }) => boolean;
  getCursorOffset: () => number | null;
  setCursorOffset: (params: { focusEditor?: boolean; offset: number }) => boolean;
  undo: () => Promise<string | null>;
  redo: () => Promise<string | null>;
}

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
  readFileAutoEncoding: (filePath: string) => Promise<{ encoding: string; text: string }>;
  extractDocxText: (filePath: string) => Promise<{ text: string; warnings: string[] }>;
  extractOdtText: (filePath: string) => Promise<{ text: string; warnings: string[] }>;
  writeClipboardRich: (flavors: { text: string; html?: string; rtf?: string }) => Promise<void>;
  writeFile: (filePath: string, content: string) => Promise<void>;
  pathExists: (filePath: string) => Promise<boolean>;
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
  ensureSanmiaoDatesSchema?: (projectFilePath: string) => Promise<{ merged: boolean }>;
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
  pickDocumentImportSources: () => Promise<DocumentImportSource[] | null>;
  createTempDocument: (content: string) => Promise<{ filePath: string; filename: string }>;
  getEncoderName: () => Promise<string>;
  setEncoderName: (name: string) => Promise<void>;
  getEntityDbFolder: () => Promise<string | null>;
  setEntityDbFolder: (folder: string | null) => Promise<void>;
  pickEntityDbFolder: () => Promise<string | null>;
  pickAuthorityPacksSource?: () => Promise<string | null>;
  authorityDbStatuses?: () => Promise<AuthoritySourceStatus[]>;
  authorityDbDownload?: (sourceId: AuthoritySourceId) => Promise<{ ok: boolean; error?: string }>;
  authorityDbPromptDownload?: () => Promise<'accepted' | 'declined'>;
  onAuthorityDbProgress?: (callback: (progress: AuthorityDownloadProgress) => void) => () => void;
  authorityPackStatuses?: () => Promise<
    import('@src/desktop/authorityPackTypes').AuthorityPackStatus[]
  >;
  authorityPackRead?: (
    packId: import('@src/desktop/authorityPackTypes').AuthorityPackId,
  ) => Promise<string>;
  authorityPackInstallFrom?: (
    sourcePacksRoot: string,
  ) => Promise<{ ok: boolean; copied?: string[]; error?: string }>;
  authorityLifecycleGet?: () => Promise<AuthorityLifecycleStatus>;
  authorityLifecycleSetEnabled?: (
    options: AuthorityLifecycleSetEnabledOptions,
  ) => Promise<AuthorityLifecycleRunResult>;
  authorityLifecycleUpdate?: () => Promise<AuthorityLifecycleRunResult>;
  authorityLifecycleMaybeCheckUpdates?: () => Promise<AuthorityLifecycleStatus | null>;
  authorityLifecyclePromptEnable?: (
    profile?: import('@src/desktop/authorityLifecycleTypes').AuthorityLifecycleProfile,
  ) => Promise<'accepted' | 'declined'>;
  authorityLifecycleRevealFolder?: () => Promise<boolean>;
  onAuthorityLifecycleProgress?: (
    callback: (progress: AuthorityLifecycleProgress) => void,
  ) => () => void;
  authorityChgisGet?: () => Promise<import('@src/desktop/authorityChgisTypes').ChgisStatus>;
  pickChgisArchive?: () => Promise<string | null>;
  authorityChgisInstallFromArchive?: (
    archivePath: string,
  ) => Promise<import('@src/desktop/authorityChgisTypes').ChgisInstallResult>;
  authorityChgisRemove?: () => Promise<{ ok: boolean; error?: string }>;
  onAuthorityChgisProgress?: (
    callback: (progress: import('@src/desktop/authorityChgisTypes').ChgisInstallProgress) => void,
  ) => () => void;
  sanmiaoProposeDates?: (
    text: string,
    options?: import('../../../../packages/cwrc-leafwriter/src/autoTagging/dates').SanmiaoProposeOptions,
  ) => Promise<
    import('../../../../packages/cwrc-leafwriter/src/autoTagging/dates').SanmiaoProposal[]
  >;
  sanmiaoProposeDatesBatch?: (
    chunks: string[],
    options?: import('../../../../packages/cwrc-leafwriter/src/autoTagging/dates').SanmiaoProposeOptions,
  ) => Promise<
    import('../../../../packages/cwrc-leafwriter/src/autoTagging/dates').SanmiaoProposal[][]
  >;
  sanmiaoTagDatesBatch?: (
    chunks: string[],
    options?: import('../../../../packages/cwrc-leafwriter/src/autoTagging/dates').SanmiaoProposeOptions,
  ) => Promise<
    import('../../../../packages/cwrc-leafwriter/src/autoTagging/dates').SanmiaoProposal[][]
  >;
  sanmiaoResolveDatesBatch?: (
    dates: string[],
    options?: import('../../../../packages/cwrc-leafwriter/src/autoTagging/dates').SanmiaoProposeOptions,
  ) => Promise<
    (import('../../../../packages/cwrc-leafwriter/src/autoTagging/dates').SanmiaoProposal | null)[]
  >;
  sanmiaoListDateAuthority?: (options?: {
    civ?: string[];
  }) => Promise<
    import('../../../../packages/cwrc-leafwriter/src/dateAuthority/types').DateAuthorityIndex
  >;
  onSanmiaoProgress?: (
    callback: (
      progress: import('../../../../packages/cwrc-leafwriter/src/autoTagging/dates').SanmiaoChunkProgressEvent,
    ) => void,
  ) => () => void;
  updateProjectFileConfig: (
    projectFilePath: string,
    patch: Record<string, unknown>,
  ) => Promise<ProjectBundle>;
  getAiApiSettings: () => Promise<AiApiSettings>;
  setAiApiSettings: (settings: Partial<AiApiSettings>) => Promise<void>;
  testAiConnection: (settings: Partial<AiApiSettings>) => Promise<AiConnectionResult>;
  generateAiTranslation: (request: AiTranslationRequest) => Promise<AiTranslationResult>;
  zoteroListStyles: () => Promise<ZoteroStyle[]>;
  renamePath: (oldPath: string, newPath: string) => Promise<void>;
  movePath: (sourcePath: string, destDir: string) => Promise<string>;
  deletePath: (targetPath: string) => Promise<void>;
  createDirectory: (parentDir: string, folderName: string) => Promise<string>;
  ensureDirectory: (dirPath: string) => Promise<void>;
  pickMoveDestination: (defaultDir?: string) => Promise<string | null>;
  saveFileAs: (defaultPath?: string) => Promise<string | null>;
  setWindowTitle: (title: string) => Promise<void>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  openExternalUrl: (url: string) => Promise<boolean>;
  isWindowMaximized: () => Promise<boolean>;
  onWindowMaximized: (callback: (maximized: boolean) => void) => () => void;
  onAppMenuAction: (callback: (action: string) => void) => () => void;
  signalRendererReady: () => Promise<void>;
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
  /** Interface (window chrome) zoom — scales the entire UI, unlike the per-pane text zooms. */
  setUiZoomFactor?: (factor: number) => void;
  getUiZoomFactor?: () => number;
}

declare global {
  interface JQuery {
    dialog(method: 'option', optionName: string): any;
    dialog(...args: unknown[]): JQuery;
  }

  interface Window {
    electronAPI?: ElectronAPI;
    __desktopRightPanel?: {
      expand: () => void;
      showTab: (tab: DesktopRightPanelTab) => void;
    };
    __desktopRightPanelPendingTab?: DesktopRightPanelTab;
    __desktopValidatorInstrumentation?: DesktopValidatorInstrumentation;
    __ljbCommonsUi?: {
      aiApiSettings: AiApiSettings | null;
      encoderName: string;
      entityDbFolder: string | null;
      rememberWorkspaceOnStartup: boolean;
      skipCopyPasteHelp: boolean;
      skipEntityDetachConfirm: boolean;
      skipExplorerDeleteConfirm: boolean;
      pickEntityDbFolder: () => Promise<string | null>;
      setAiApiSettings: (settings: Partial<AiApiSettings>) => void | Promise<void>;
      setEncoderName: (name: string) => void | Promise<void>;
      setRememberWorkspaceOnStartup: (value: boolean) => void | Promise<void>;
      setSkipCopyPasteHelp: (value: boolean) => void;
      setSkipEntityDetachConfirm: (value: boolean) => void;
      setSkipExplorerDeleteConfirm: (value: boolean) => void;
      testAiConnection: (settings: Partial<AiApiSettings>) => Promise<AiConnectionResult>;
      authorityLifecycleStatus: AuthorityLifecycleStatus | null;
      refreshAuthorityLifecycle: () => Promise<void>;
      setAuthorityLifecycleEnabled: (
        options: AuthorityLifecycleSetEnabledOptions,
      ) => Promise<AuthorityLifecycleRunResult>;
      runAuthorityLifecycleUpdate: () => Promise<AuthorityLifecycleRunResult>;
      revealAuthorityLifecycleFolder: () => Promise<void>;
    };
    __ljbOpenNativeSchemaPicker?: (options: SchemaPickerOpenerOptions) => Promise<void>;
    /** Desktop: strip teiHeader before WYSIWYG load (registered by useLeafWriter). */
    __desktopStripTeiHeaderForVisualEditor?: (xml: string) => string;
    /** Desktop: merge visual editor body XML into the stored full document. */
    __desktopMergeEditorBodyWithStoredHeader?: (editorXml: string, storedXml?: string) => string;
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
    __leafWriterSourceFind?: LeafWriterSourceFindBridge;
    /** Zoom the visual editor pane (published by cwrc-leafwriter on editor init). */
    __leafWriterEditorZoom?: {
      zoomIn: () => void;
      zoomOut: () => void;
      reset: () => void;
      get: () => number;
    };
    /** Zoom the source (Monaco) view font (published while a source editor is mounted). */
    __leafWriterSourceZoom?: {
      zoomIn: () => void;
      zoomOut: () => void;
      reset: () => void;
      get: () => number;
    };
    /** Zoom the translation pane font (published while the pane is mounted). */
    __leafWriterTranslationZoom?: {
      zoomIn: () => void;
      zoomOut: () => void;
      reset: () => void;
      get: () => number;
    };
  }
}

export const isDesktop = (): boolean => typeof window !== 'undefined' && !!window.electronAPI;

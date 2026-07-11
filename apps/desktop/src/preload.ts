import { contextBridge, ipcRenderer, webFrame } from 'electron';

import type {
  ZoteroAvailability,
  ZoteroCaywResult,
  ZoteroSearchResult,
  ZoteroStyle,
} from './zoteroClient';

import type {
  AuthorityDownloadProgress,
  AuthoritySourceId,
  AuthoritySourceStatus,
} from './authorityDatabases';
import type { ProjectBundle } from './projectFile';
import type {
  SchemaUpdateApplyResult,
  SchemaUpdateCheckOptions,
  SchemaUpdateCheckResult,
} from '../../commons/src/desktop/schemaUpdateTypes';

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

export type ImportableDocumentFormat = 'txt' | 'md' | 'rtf';

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
  pickAuthorityPacksSource: () => Promise<string | null>;
  authorityDbStatuses: () => Promise<AuthoritySourceStatus[]>;
  authorityDbDownload: (sourceId: AuthoritySourceId) => Promise<{ ok: boolean; error?: string }>;
  authorityDbPromptDownload: () => Promise<'accepted' | 'declined'>;
  onAuthorityDbProgress: (callback: (progress: AuthorityDownloadProgress) => void) => () => void;
  authorityPackStatuses?: () => Promise<
    import('../../commons/src/desktop/authorityPackTypes').AuthorityPackStatus[]
  >;
  authorityPackRead?: (
    packId: import('../../commons/src/desktop/authorityPackTypes').AuthorityPackId,
  ) => Promise<string>;
  authorityPackInstallFrom?: (
    sourcePacksRoot: string,
  ) => Promise<{ ok: boolean; copied?: string[]; error?: string }>;
  authorityLifecycleGet?: () => Promise<
    import('../../commons/src/desktop/authorityLifecycleTypes').AuthorityLifecycleStatus
  >;
  authorityLifecycleSetEnabled?: (
    options: import('../../commons/src/desktop/authorityLifecycleTypes').AuthorityLifecycleSetEnabledOptions,
  ) => Promise<
    import('../../commons/src/desktop/authorityLifecycleTypes').AuthorityLifecycleRunResult
  >;
  authorityLifecycleUpdate?: () => Promise<
    import('../../commons/src/desktop/authorityLifecycleTypes').AuthorityLifecycleRunResult
  >;
  authorityLifecycleMaybeCheckUpdates?: () => Promise<
    import('../../commons/src/desktop/authorityLifecycleTypes').AuthorityLifecycleStatus | null
  >;
  authorityLifecyclePromptEnable?: (
    profile?: import('../../commons/src/desktop/authorityLifecycleTypes').AuthorityLifecycleProfile,
  ) => Promise<'accepted' | 'declined'>;
  authorityLifecycleRevealFolder?: () => Promise<boolean>;
  onAuthorityLifecycleProgress?: (
    callback: (
      progress: import('../../commons/src/desktop/authorityLifecycleTypes').AuthorityLifecycleProgress,
    ) => void,
  ) => () => void;
  authorityChgisGet?: () => Promise<
    import('../../commons/src/desktop/authorityChgisTypes').ChgisStatus
  >;
  pickChgisArchive?: () => Promise<string | null>;
  authorityChgisInstallFromArchive?: (
    archivePath: string,
  ) => Promise<import('../../commons/src/desktop/authorityChgisTypes').ChgisInstallResult>;
  authorityChgisRemove?: () => Promise<{ ok: boolean; error?: string }>;
  onAuthorityChgisProgress?: (
    callback: (
      progress: import('../../commons/src/desktop/authorityChgisTypes').ChgisInstallProgress,
    ) => void,
  ) => () => void;
  sanmiaoProposeDates?: (
    text: string,
    options?: import('./sanmiaoBridge').SanmiaoProposeOptions,
  ) => Promise<import('./sanmiaoBridge').SanmiaoProposal[]>;
  sanmiaoProposeDatesBatch?: (
    chunks: string[],
    options?: import('./sanmiaoBridge').SanmiaoProposeOptions,
  ) => Promise<import('./sanmiaoBridge').SanmiaoProposal[][]>;
  sanmiaoTagDatesBatch?: (
    chunks: string[],
    options?: import('./sanmiaoBridge').SanmiaoProposeOptions,
  ) => Promise<import('./sanmiaoBridge').SanmiaoProposal[][]>;
  sanmiaoResolveDatesBatch?: (
    dates: string[],
    options?: import('./sanmiaoBridge').SanmiaoProposeOptions,
  ) => Promise<(import('./sanmiaoBridge').SanmiaoProposal | null)[]>;
  sanmiaoListDateAuthority?: (
    options?: import('./sanmiaoBridge').SanmiaoProposeOptions,
  ) => Promise<import('./sanmiaoBridge').DateAuthorityIndex>;
  onSanmiaoProgress?: (
    callback: (progress: import('./sanmiaoBridge').SanmiaoChunkProgress) => void,
  ) => () => void;
  updateProjectFileConfig: (
    projectFilePath: string,
    patch: Record<string, unknown>,
  ) => Promise<ProjectBundle>;
  getAiApiSettings: () => Promise<AiApiSettings>;
  setAiApiSettings: (settings: Partial<AiApiSettings>) => Promise<void>;
  testAiConnection: (settings: Partial<AiApiSettings>) => Promise<AiConnectionResult>;
  generateAiTranslation: (request: AiTranslationRequest) => Promise<AiTranslationResult>;
  zoteroCheckAvailability: () => Promise<ZoteroAvailability>;
  zoteroSearchItems: (query: string) => Promise<ZoteroSearchResult[]>;
  zoteroListStyles: () => Promise<ZoteroStyle[]>;
  zoteroPickCitation: () => Promise<ZoteroCaywResult>;
  zoteroCancelPick: () => Promise<void>;
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
  popupAppMenu: (x?: number, y?: number) => Promise<void>;
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
  setUiZoomFactor: (factor: number) => void;
  getUiZoomFactor: () => number;
}

const electronAPI: ElectronAPI = {
  setUiZoomFactor: (factor: number) => webFrame.setZoomFactor(factor),
  getUiZoomFactor: () => webFrame.getZoomFactor(),
  openProject: () => ipcRenderer.invoke('openProject'),
  openProjectFolder: () => ipcRenderer.invoke('openProject'),
  restoreLastProject: () => ipcRenderer.invoke('restoreLastProject'),
  getRememberWorkspaceOnStartup: () => ipcRenderer.invoke('getRememberWorkspaceOnStartup'),
  setRememberWorkspaceOnStartup: (remember: boolean) =>
    ipcRenderer.invoke('setRememberWorkspaceOnStartup', remember),
  saveWorkspaceSession: (session: WorkspaceSession) =>
    ipcRenderer.invoke('saveWorkspaceSession', session),
  restoreWorkspaceSession: () => ipcRenderer.invoke('restoreWorkspaceSession'),
  readDirectory: (dirPath: string, options?: { allFiles?: boolean }) =>
    ipcRenderer.invoke('readDirectory', dirPath, options),
  readFile: (filePath: string) => ipcRenderer.invoke('readFile', filePath),
  readFileAutoEncoding: (filePath: string) => ipcRenderer.invoke('readFileAutoEncoding', filePath),
  extractDocxText: (filePath: string) => ipcRenderer.invoke('extractDocxText', filePath),
  extractOdtText: (filePath: string) => ipcRenderer.invoke('extractOdtText', filePath),
  writeClipboardRich: (flavors: { text: string; html?: string; rtf?: string }) =>
    ipcRenderer.invoke('writeClipboardRich', flavors),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('writeFile', filePath, content),
  pathExists: (filePath: string) => ipcRenderer.invoke('pathExists', filePath),
  statFile: (filePath: string) => ipcRenderer.invoke('statFile', filePath),
  syncWatchedFiles: (paths: string[]) => ipcRenderer.invoke('syncWatchedFiles', paths),
  ignoreFileChange: (filePath: string, mtimeMs: number) =>
    ipcRenderer.invoke('ignoreFileChange', filePath, mtimeMs),
  findXmlFilesByName: (rootPath: string, query: string) =>
    ipcRenderer.invoke('findXmlFilesByName', rootPath, query),
  listProjectXmlFiles: (rootPath: string) => ipcRenderer.invoke('listProjectXmlFiles', rootPath),
  reloadProjectBundle: (projectFilePath: string) =>
    ipcRenderer.invoke('reloadProjectBundle', projectFilePath),
  installCatalogSchema: (projectFilePath: string, catalogId: string) =>
    ipcRenderer.invoke('installCatalogSchema', projectFilePath, catalogId),
  installLocalSchema: (projectFilePath: string, rngPath: string, cssPath?: string | null) =>
    ipcRenderer.invoke('installLocalSchema', projectFilePath, rngPath, cssPath),
  ensureSanmiaoDatesSchema: (projectFilePath: string) =>
    ipcRenderer.invoke('ensureSanmiaoDatesSchema', projectFilePath),
  checkSchemaUpdate: (projectFilePath: string, options?: SchemaUpdateCheckOptions) =>
    ipcRenderer.invoke('checkSchemaUpdate', projectFilePath, options),
  applyCatalogSchemaUpdate: (projectFilePath: string) =>
    ipcRenderer.invoke('applyCatalogSchemaUpdate', projectFilePath),
  listTimeMachineSnapshots: (projectRootPath: string) =>
    ipcRenderer.invoke('timeMachine:listSnapshots', projectRootPath),
  createTimeMachineSnapshot: (projectRootPath: string, projectName: string) =>
    ipcRenderer.invoke('timeMachine:createSnapshot', projectRootPath, projectName),
  pickTimeMachineRestoreDestination: (projectRootPath: string, snapshotId: string) =>
    ipcRenderer.invoke('timeMachine:pickRestoreDestination', projectRootPath, snapshotId),
  restoreTimeMachineSnapshot: (snapshotPath: string, destinationPath: string) =>
    ipcRenderer.invoke('timeMachine:restoreSnapshot', snapshotPath, destinationPath),
  restoreTimeMachineSnapshotToProject: (
    projectRootPath: string,
    projectName: string,
    snapshotPath: string,
  ) =>
    ipcRenderer.invoke(
      'timeMachine:restoreSnapshotToProject',
      projectRootPath,
      projectName,
      snapshotPath,
    ),
  pickSchemaFiles: () => ipcRenderer.invoke('pickSchemaFiles'),
  pickDocumentImportSources: () => ipcRenderer.invoke('pickDocumentImportSources'),
  createTempDocument: (content: string) => ipcRenderer.invoke('createTempDocument', content),
  getEncoderName: () => ipcRenderer.invoke('getEncoderName'),
  setEncoderName: (name: string) => ipcRenderer.invoke('setEncoderName', name),
  getEntityDbFolder: () => ipcRenderer.invoke('getEntityDbFolder'),
  setEntityDbFolder: (folder: string | null) => ipcRenderer.invoke('setEntityDbFolder', folder),
  pickEntityDbFolder: () => ipcRenderer.invoke('pickEntityDbFolder'),
  pickAuthorityPacksSource: () => ipcRenderer.invoke('pickAuthorityPacksSource'),
  authorityDbStatuses: () => ipcRenderer.invoke('authorityDb:statuses'),
  authorityDbDownload: (sourceId: AuthoritySourceId) =>
    ipcRenderer.invoke('authorityDb:download', sourceId),
  authorityDbPromptDownload: () => ipcRenderer.invoke('authorityDb:promptDownload'),
  onAuthorityDbProgress: (callback: (progress: AuthorityDownloadProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: AuthorityDownloadProgress) =>
      callback(progress);
    ipcRenderer.on('authorityDb:progress', listener);
    return () => ipcRenderer.removeListener('authorityDb:progress', listener);
  },
  authorityPackStatuses: () => ipcRenderer.invoke('authorityPack:statuses'),
  authorityPackRead: (packId: string) => ipcRenderer.invoke('authorityPack:read', packId),
  authorityPackInstallFrom: (sourcePacksRoot: string) =>
    ipcRenderer.invoke('authorityPack:installFrom', sourcePacksRoot),
  authorityLifecycleGet: () => ipcRenderer.invoke('authorityLifecycle:get'),
  authorityLifecycleSetEnabled: (options) =>
    ipcRenderer.invoke('authorityLifecycle:setEnabled', options),
  authorityLifecycleUpdate: () => ipcRenderer.invoke('authorityLifecycle:update'),
  authorityLifecycleMaybeCheckUpdates: () =>
    ipcRenderer.invoke('authorityLifecycle:maybeCheckUpdates'),
  authorityLifecyclePromptEnable: (profile) =>
    ipcRenderer.invoke('authorityLifecycle:promptEnable', profile),
  authorityLifecycleRevealFolder: () => ipcRenderer.invoke('authorityLifecycle:revealFolder'),
  authorityChgisGet: () => ipcRenderer.invoke('authorityChgis:get'),
  pickChgisArchive: () => ipcRenderer.invoke('pickChgisArchive'),
  authorityChgisInstallFromArchive: (archivePath: string) =>
    ipcRenderer.invoke('authorityChgis:installFromArchive', archivePath),
  authorityChgisRemove: () => ipcRenderer.invoke('authorityChgis:remove'),
  onAuthorityLifecycleProgress: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      progress: import('../../commons/src/desktop/authorityLifecycleTypes').AuthorityLifecycleProgress,
    ) => callback(progress);
    ipcRenderer.on('authorityLifecycle:progress', listener);
    return () => ipcRenderer.removeListener('authorityLifecycle:progress', listener);
  },
  onAuthorityChgisProgress: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      progress: import('../../commons/src/desktop/authorityChgisTypes').ChgisInstallProgress,
    ) => callback(progress);
    ipcRenderer.on('authorityChgis:progress', listener);
    return () => ipcRenderer.removeListener('authorityChgis:progress', listener);
  },
  sanmiaoProposeDates: (text, options) => ipcRenderer.invoke('sanmiao:proposeDates', text, options),
  sanmiaoProposeDatesBatch: (chunks, options) =>
    ipcRenderer.invoke('sanmiao:proposeDatesBatch', chunks, options),
  sanmiaoTagDatesBatch: (chunks, options) =>
    ipcRenderer.invoke('sanmiao:tagDatesBatch', chunks, options),
  sanmiaoResolveDatesBatch: (dates, options) =>
    ipcRenderer.invoke('sanmiao:resolveDatesBatch', dates, options),
  sanmiaoListDateAuthority: (options) => ipcRenderer.invoke('sanmiao:listDateAuthority', options),
  onSanmiaoProgress: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      progress: import('./sanmiaoBridge').SanmiaoChunkProgress,
    ) => callback(progress);
    ipcRenderer.on('sanmiao:progress', listener);
    return () => ipcRenderer.removeListener('sanmiao:progress', listener);
  },
  updateProjectFileConfig: (projectFilePath: string, patch: Record<string, unknown>) =>
    ipcRenderer.invoke('updateProjectFileConfig', projectFilePath, patch),
  getAiApiSettings: () => ipcRenderer.invoke('getAiApiSettings'),
  setAiApiSettings: (settings: Partial<AiApiSettings>) =>
    ipcRenderer.invoke('setAiApiSettings', settings),
  testAiConnection: (settings: Partial<AiApiSettings>) =>
    ipcRenderer.invoke('testAiConnection', settings),
  generateAiTranslation: (request: AiTranslationRequest) =>
    ipcRenderer.invoke('generateAiTranslation', request),
  zoteroCheckAvailability: () => ipcRenderer.invoke('zoteroCheckAvailability'),
  zoteroSearchItems: (query: string) => ipcRenderer.invoke('zoteroSearchItems', query),
  zoteroListStyles: () => ipcRenderer.invoke('zoteroListStyles'),
  zoteroPickCitation: () => ipcRenderer.invoke('zoteroPickCitation'),
  zoteroCancelPick: () => ipcRenderer.invoke('zoteroCancelPick'),
  renamePath: (oldPath: string, newPath: string) =>
    ipcRenderer.invoke('renamePath', oldPath, newPath),
  movePath: (sourcePath: string, destDir: string) =>
    ipcRenderer.invoke('movePath', sourcePath, destDir),
  deletePath: (targetPath: string) => ipcRenderer.invoke('deletePath', targetPath),
  createDirectory: (parentDir: string, folderName: string) =>
    ipcRenderer.invoke('createDirectory', parentDir, folderName),
  ensureDirectory: (dirPath: string) => ipcRenderer.invoke('ensureDirectory', dirPath),
  pickMoveDestination: (defaultDir?: string) =>
    ipcRenderer.invoke('pickMoveDestination', defaultDir),
  saveFileAs: (defaultPath?: string) => ipcRenderer.invoke('saveFileAs', defaultPath),
  setWindowTitle: (title: string) => ipcRenderer.invoke('setWindowTitle', title),
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  popupAppMenu: (x?: number, y?: number) => ipcRenderer.invoke('popup-app-menu', x, y),
  openExternalUrl: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  isWindowMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowMaximized: (callback: (maximized: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, maximized: boolean) => callback(maximized);
    ipcRenderer.on('window-maximized', listener);
    return () => ipcRenderer.removeListener('window-maximized', listener);
  },
  onAppMenuAction: (callback: (action: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: string) => callback(action);
    ipcRenderer.on('app:menu-action', listener);
    return () => ipcRenderer.removeListener('app:menu-action', listener);
  },
  signalRendererReady: () => ipcRenderer.invoke('signalRendererReady'),
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

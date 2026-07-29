export {};

declare global {
  interface JQuery {
    dialog(method: 'option', optionName: string): any;
    dialog(...args: unknown[]): JQuery;
  }

  type DesktopLeftPanelTab = 'explorer' | 'find' | 'xpath' | 'toc' | 'markup';

  interface DesktopLeftPanelBridge {
    expand: () => void;
    showTab: (tab: DesktopLeftPanelTab) => void;
  }

  type DesktopRightPanelTab =
    'fileMetadata' | 'attributes' | 'css' | 'imageViewer' | 'validation' | 'translation';

  interface DesktopRightPanelBridge {
    expand: () => void;
    showTab: (tab: DesktopRightPanelTab) => void;
  }

  type DesktopValidatorInstrumentation = {
    workerLoading: boolean;
    workerLoaded: boolean;
    schemaLoading: boolean;
    schemaLoaded: boolean;
    validationRunning: boolean;
    validationPanelRequested: boolean;
    validationPanelMounted: boolean;
  };

  interface LeafWriterElectronApi {
    lspStart: (options?: {
      defaultSchemaRng?: string;
      projectRoot?: string;
    }) => Promise<{ ok: boolean; error?: string; initializationOptions?: unknown }>;
    lspSend: (message: unknown) => Promise<{ ok: boolean }>;
    onLspMessage: (callback: (message: unknown) => void) => () => void;
    /** Interface (window chrome) zoom — scales the entire UI, unlike the per-pane text zooms. */
    setUiZoomFactor?: (factor: number) => void;
    getUiZoomFactor?: () => number;
    /** Chromium spellcheck for the translation pane (dictionary language follows the target lang). */
    setTranslationSpellcheck?: (options: {
      enabled: boolean;
      languageCodes?: string[];
    }) => Promise<void>;
    pluginsEnsureSchemaContribution?: (
      pluginId: string,
      projectFilePath: string,
    ) => Promise<{ merged: boolean }>;
    pluginsInvokePython?: (pluginId: string, payload: Record<string, unknown>) => Promise<unknown>;
    onPluginPythonProgress?: (
      pluginId: string,
      callback: (progress: import('../autoTagging/dates').SanmiaoChunkProgressEvent) => void,
    ) => () => void;
    showNativeMessageBox?: (options: {
      buttons?: string[];
      cancelId?: number;
      defaultId?: number;
      detail?: string;
      message: string;
      title: string;
      type?: 'error' | 'info' | 'none' | 'question' | 'warning';
    }) => Promise<{ response: number; checkboxChecked: boolean }>;
    reloadProjectBundle?: (
      projectFilePath: string,
    ) => Promise<import('../../../../apps/commons/src/desktop/projectTypes').ProjectBundle | null>;
    installCatalogSchema?: (
      projectFilePath: string,
      catalogId: string,
    ) => Promise<import('../../../../apps/commons/src/desktop/projectTypes').ProjectBundle>;
    updateProjectFileConfig?: (
      projectFilePath: string,
      patch: Record<string, unknown>,
    ) => Promise<unknown>;
    /** File I/O bridge, used by the entity store and authority pack readers. */
    pathExists?: (filePath: string) => Promise<boolean>;
    readFile?: (filePath: string) => Promise<string>;
    writeFile?: (filePath: string, content: string) => Promise<void>;
    ensureDirectory?: (dirPath: string) => Promise<void>;
    statFile?: (filePath: string) => Promise<{ mtimeMs: number }>;
    ignoreFileChange?: (filePath: string, mtimeMs: number) => Promise<void>;
    /** Entity database folder (holds entities.xml and authority-packs/). */
    getEntityDbFolder?: () => Promise<string | null>;
    setEntityDbFolder?: (folder: string | null) => Promise<void>;
    pickEntityDbFolder?: () => Promise<string | null>;
    moveEntityDbFolder?: () => Promise<{
      ok: boolean;
      cancelled?: boolean;
      error?: string;
      folder?: string;
    }>;
    pickAuthorityPacksSource?: () => Promise<string | null>;
    /** Local PMTiles regional basemaps for the place-name geo-comparison map (see mapView/PlaceComparisonMap.tsx, mapView/regionalBundles.ts). */
    mapTilesStatus?: () => Promise<{
      installed: boolean;
      path: string | null;
      regions: { id: string; sha256: string; installedAt: string }[];
    }>;
    mapTilesPromptDownload?: () => Promise<'accepted' | 'declined'>;
    mapTilesDownloadBackground?: (bundle: {
      id: string;
      source?: string;
      url: string;
      bbox?: [number, number, number, number];
      fileName: string;
      bytes?: number;
      sha256?: string;
    }) => Promise<{ ok: boolean; queued?: boolean; error?: string }>;
    mapTilesDownload?: (bundle: {
      id: string;
      source?: string;
      url: string;
      bbox?: [number, number, number, number];
      fileName: string;
      bytes?: number;
      sha256?: string;
    }) => Promise<{ ok: boolean; path?: string; error?: string }>;
    mapTilesRemove?: (bundleId: string) => Promise<{ ok: boolean; error?: string }>;
    mapTilesDownloadStatus?: () => Promise<{
      active: {
        bundleId: string;
        message: string;
        receivedBytes?: number;
        totalBytes?: number | null;
      }[];
    }>;
    onMapTilesProgress?: (
      callback: (progress: {
        bundleId: string;
        message: string;
        receivedBytes?: number;
        totalBytes?: number | null;
      }) => void,
    ) => () => void;
    onMapTilesDownloadComplete?: (
      callback: (result: {
        bundleId: string;
        installed: boolean;
        path?: string;
        error?: string;
      }) => void,
    ) => () => void;
    authorityPackStatuses?: () => Promise<import('../autoTagging/packPaths').AuthorityPackStatus[]>;
    authorityPackRead?: (
      packId: import('../autoTagging/packPaths').AuthorityPackId,
    ) => Promise<string[]>;
    authorityPackInstallFrom?: (
      sourcePacksRoot: string,
    ) => Promise<{ ok: boolean; copied?: string[]; error?: string }>;
    pluginsGetSnapshot?: () => Promise<import('../plugins/types').PluginHostSnapshotView>;
    pluginsSetEnabled?: (
      pluginId: string,
      enabled: boolean,
    ) => Promise<import('../plugins/types').PluginHostSnapshotView>;
    pluginsInstallFrom?: (
      sourceDir: string,
    ) => Promise<import('../plugins/types').PluginHostSnapshotView>;
    pluginsPickInstallFolder?: () => Promise<string | null>;
    pluginsDismissLanguagePrompt?: (pluginId: string) => Promise<void>;
    pluginsIsEnabled?: (pluginId: string) => Promise<boolean>;
    pluginsGetModuleUrl?: (pluginId: string) => Promise<string | null>;
    pluginsGetRemoteIndex?: () => Promise<
      import('../../../../apps/commons/src/desktop/pluginRegistryTypes').PluginReleaseIndex
    >;
    pluginsInstallRemote?: (
      entry: import('../../../../apps/commons/src/desktop/pluginRegistryTypes').PluginReleaseEntry,
    ) => Promise<import('../plugins/types').PluginHostSnapshotView>;
    /** CHGIS historical-places authority (installed from a downloaded archive). */
    authorityChgisGet?: () => Promise<{
      installed: boolean;
      entityDbFolder: string | null;
      entityDbReady: boolean;
      layers?: string[];
      placeCount?: number;
      crosswalkCount?: number;
      installedAt?: string;
      diskBytes?: number;
      lastError?: string;
      busy: boolean;
    }>;
    pickChgisArchive?: () => Promise<string | null>;
    authorityChgisInstallFromArchive?: (
      archivePath: string,
    ) => Promise<{ ok: boolean; error?: string; placeCount?: number }>;
    authorityChgisInstallFromDataverse?: () => Promise<{
      ok: boolean;
      error?: string;
      placeCount?: number;
    }>;
    authorityChgisRemove?: () => Promise<{ ok: boolean; error?: string }>;
    onAuthorityChgisProgress?: (
      callback: (progress: {
        phase: 'downloading' | 'extracting' | 'compiling' | 'idle';
        message: string;
      }) => void,
    ) => () => void;
  }

  type WorkspaceCursorPosition =
    | { mode: 'source'; offset: number }
    | { mode: 'visual'; offsetInElementText: number; teiXPath: string };

  interface DesktopTaggingBridge {
    changeTag?: (tagId: string, newTagName: string) => void;
    handleEditorKeyDown: (event: KeyboardEvent) => boolean;
    openAttributePopup?: (anchorOverride: { left: number; top: number }) => Promise<boolean>;
    openTagPopup?: (
      mode: string,
      anchorOverride: { left: number; top: number },
    ) => Promise<boolean>;
  }

  interface Window {
    electronAPI?: LeafWriterElectronApi;
    __desktopLeftPanel?: DesktopLeftPanelBridge;
    __desktopMergeEditorBodyWithStoredHeader?: (editorXml: string, storedXml?: string) => string;
    __desktopMergeHeaderForValidation?: (editorXml: string) => string;
    __desktopRightPanel?: DesktopRightPanelBridge;
    __desktopRightPanelPendingTab?: DesktopRightPanelTab;
    __desktopStoredDocumentXml?: string;
    __desktopStripTeiHeaderForVisualEditor?: (xml: string) => string;
    __desktopTagging?: DesktopTaggingBridge;
    __desktopCorrection?: {
      openCorrectionPopup: () => boolean;
    };
    __desktopValidatorInstrumentation?: DesktopValidatorInstrumentation;
    /** DevTools helper: `await __ljbDebugValidator()` */
    __ljbDebugValidator?: (options?: { runValidation?: boolean }) => Promise<unknown>;
    __leafWriterEditorZoom?: {
      zoomIn: () => void;
      zoomOut: () => void;
      reset: () => void;
      get: () => number;
    };
    __leafWriterSourceZoom?: {
      zoomIn: () => void;
      zoomOut: () => void;
      reset: () => void;
      get: () => number;
    };
    __leafWriterTranslationZoom?: {
      zoomIn: () => void;
      zoomOut: () => void;
      reset: () => void;
      get: () => number;
    };
    __leafWriterCursorSession?: {
      capture: () => WorkspaceCursorPosition | null;
      restore: (position: WorkspaceCursorPosition) => Promise<boolean>;
    };
    __leafWriterTranslationPane?: {
      filePath: string | null;
      isActive: () => boolean;
      redo: () => Promise<boolean>;
      replaceContent: (filePath: string, content: string) => boolean;
      undo: () => Promise<boolean>;
    };
    __leafWriterProject?: {
      getProjectFilePath: () => string;
      getProjectSourceLanguage?: () => Promise<string | null>;
      /** Signed year (negative = BCE) from the active file's profileDesc/creation/date, or null if unset/no file. */
      getActiveFileWorkYear?: () => number | null;
      /** Every open editor tab, for `openTabs`-scoped tag bomb runs. */
      getOpenTabs?: () => { filePath: string; content: string }[];
      /** Re-read `filePath` from disk into its open tab, if any, after a direct (skip-review) write. */
      reloadFileFromDisk?: (filePath: string) => Promise<void>;
      /** Open (or switch to) `filePath` as the active editor tab. */
      openFile?: (filePath: string) => Promise<void>;
      /** Guardrail hook: snapshot the project before a multi-document automated edit (tag bomb, purge, propagate). */
      createTimeMachineSnapshot?: (label?: string) => Promise<{ ok: boolean; path?: string }>;
      getAutoTaggingAuthoritySettings: () =>
        | {
            packs?: string[];
            dateFilter?: 'none' | 'limit' | 'exclude';
            yearStart?: number;
            yearEnd?: number;
            excludedNameTypes?: string[];
            nameTypeTaggingPolicy?: Record<string, 'phase1' | 'phase2' | 'never'>;
            customNameTypes?: Array<{
              id: string;
              label: string;
              labelsByLang?: Record<string, string>;
              bucket: 'phase1' | 'phase2' | 'never';
            }>;
            artMinCodePoints?: number;
            yearFilterEnabled?: boolean;
            hideUndated?: boolean;
          }
        | undefined;
      setAutoTaggingAuthoritySettings: (settings: {
        packs?: string[];
        dateFilter?: 'none' | 'limit' | 'exclude';
        yearStart?: number;
        yearEnd?: number;
        excludedNameTypes?: string[];
        nameTypeTaggingPolicy?: Record<string, 'phase1' | 'phase2' | 'never'>;
        customNameTypes?: Array<{
          id: string;
          label: string;
          labelsByLang?: Record<string, string>;
          bucket: 'phase1' | 'phase2' | 'never';
        }>;
        artMinCodePoints?: number;
        yearFilterEnabled?: boolean;
        hideUndated?: boolean;
      }) => void;
      getAutoTaggingValidationSettings: () =>
        | {
            aiValidation?: boolean;
            autoAcceptThreshold?: number;
          }
        | undefined;
      setAutoTaggingValidationSettings: (settings: {
        aiValidation?: boolean;
        autoAcceptThreshold?: number;
      }) => void;
      getDisambiguationSettings: () =>
        | {
            aiCuration?: boolean;
            disableCaching?: boolean;
            dateFilter?: 'none' | 'limit' | 'exclude';
            yearStart?: number;
            yearEnd?: number;
          }
        | undefined;
      setDisambiguationSettings: (settings: {
        aiCuration?: boolean;
        disableCaching?: boolean;
        dateFilter?: 'none' | 'limit' | 'exclude';
        yearStart?: number;
        yearEnd?: number;
      }) => void;
    };
    __lwPanelTrace?: { t: string; tag: string; data?: Record<string, unknown> }[];
  }
}

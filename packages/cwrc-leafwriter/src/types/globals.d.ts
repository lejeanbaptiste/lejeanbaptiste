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
    | 'fileMetadata'
    | 'attributes'
    | 'css'
    | 'imageViewer'
    | 'validation'
    | 'translation';

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
    sanmiaoListDateAuthority?: (options?: {
      civ?: string[];
    }) => Promise<import('../dateAuthority/types').DateAuthorityIndex>;
    sanmiaoProposeDates?: (
      text: string,
      options?: import('../autoTagging/dates').SanmiaoProposeOptions,
    ) => Promise<import('../autoTagging/dates').SanmiaoProposal[]>;
    sanmiaoProposeDatesBatch?: (
      chunks: string[],
      options?: import('../autoTagging/dates').SanmiaoProposeOptions,
    ) => Promise<import('../autoTagging/dates').SanmiaoProposal[][]>;
    sanmiaoTagDatesBatch?: (
      chunks: string[],
      options?: import('../autoTagging/dates').SanmiaoProposeOptions,
    ) => Promise<import('../autoTagging/dates').SanmiaoProposal[][]>;
    sanmiaoResolveDatesBatch?: (
      dates: string[],
      options?: import('../autoTagging/dates').SanmiaoProposeOptions,
    ) => Promise<(import('../autoTagging/dates').SanmiaoProposal | null)[]>;
    onSanmiaoProgress?: (
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
    authorityPackStatuses?: () => Promise<
      import('../autoTagging/packPaths').AuthorityPackStatus[]
    >;
    authorityPackRead?: (
      packId: import('../autoTagging/packPaths').AuthorityPackId,
    ) => Promise<string>;
    authorityPackInstallFrom?: (
      sourcePacksRoot: string,
    ) => Promise<{ ok: boolean; copied?: string[]; error?: string }>;
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
    authorityChgisRemove?: () => Promise<{ ok: boolean; error?: string }>;
    onAuthorityChgisProgress?: (
      callback: (progress: { phase: 'extracting' | 'compiling' | 'idle'; message: string }) => void,
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
      getAutoTaggingAuthoritySettings: () =>
        | {
            packs?: string[];
            dateFilter?: 'none' | 'limit' | 'exclude';
            yearStart?: number;
            yearEnd?: number;
            excludedNameTypes?: string[];
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

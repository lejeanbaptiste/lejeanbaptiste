export {};

declare global {
  interface JQuery {
    dialog(method: 'option', optionName: string): any;
    dialog(...args: unknown[]): JQuery;
  }

  type DesktopLeftPanelTab = 'explorer' | 'find' | 'xpath' | 'toc' | 'markup' | 'entities';

  interface DesktopLeftPanelBridge {
    expand: () => void;
    showTab: (tab: DesktopLeftPanelTab) => void;
  }

  type DesktopRightPanelTab =
    | 'fileMetadata'
    | 'attributes'
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
    sanmiaoListDateAuthority?: (options?: {
      civ?: string[];
    }) => Promise<import('../dateAuthority/types').DateAuthorityIndex>;
    showNativeMessageBox?: (options: {
      buttons?: string[];
      cancelId?: number;
      defaultId?: number;
      detail?: string;
      message: string;
      title: string;
      type?: 'error' | 'info' | 'none' | 'question' | 'warning';
    }) => Promise<{ response: number; checkboxChecked: boolean }>;
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
    __desktopValidatorInstrumentation?: DesktopValidatorInstrumentation;
    /** DevTools helper: `await __ljbDebugValidator()` */
    __ljbDebugValidator?: (options?: { runValidation?: boolean }) => Promise<unknown>;
    __leafWriterEditorZoom?: {
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
      getAutoTaggingAuthoritySettings: () =>
        | {
            packs?: string[];
            dateFilter?: 'none' | 'limit' | 'exclude';
            yearStart?: number;
            yearEnd?: number;
            yearFilterEnabled?: boolean;
            hideUndated?: boolean;
          }
        | undefined;
      setAutoTaggingAuthoritySettings: (settings: {
        packs?: string[];
        dateFilter?: 'none' | 'limit' | 'exclude';
        yearStart?: number;
        yearEnd?: number;
        yearFilterEnabled?: boolean;
        hideUndated?: boolean;
      }) => void;
      getDisambiguationSettings: () =>
        | {
            aiCuration?: boolean;
            dateFilter?: 'none' | 'limit' | 'exclude';
            yearStart?: number;
            yearEnd?: number;
          }
        | undefined;
      setDisambiguationSettings: (settings: {
        aiCuration?: boolean;
        dateFilter?: 'none' | 'limit' | 'exclude';
        yearStart?: number;
        yearEnd?: number;
      }) => void;
    };
    __lwPanelTrace?: { t: string; tag: string; data?: Record<string, unknown> }[];
  }
}

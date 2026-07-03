declare module '*.mdx' {
  import type { ComponentType } from 'react';
  import type { MDXProps } from 'mdx/types';
  import type { Toc } from '@stefanprobst/rehype-extract-toc';

  const tableOfContents: Toc;
  const MDXContent: ComponentType<MDXProps>;

  export { tableOfContents };
  export const frontmatter: Record<string, any>;
  export default MDXContent;
}

declare module '*.svg' {
  const content: any;
  export default content;
}

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export = classes;
}

export {};

declare global {
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
    __lwPanelTrace?: { t: string; tag: string; data?: Record<string, unknown> }[];
  }
}

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

declare global {
  interface Window {
    __desktopRightPanelPendingTab?: DesktopRightPanelTab;
    __desktopValidatorInstrumentation?: DesktopValidatorInstrumentation;
    __lwPanelTrace?: { t: string; tag: string; data?: Record<string, unknown> }[];
  }
  interface Window {
    __desktopLeftPanel?: DesktopLeftPanelBridge;
    __desktopRightPanel?: DesktopRightPanelBridge;
    __desktopTagging?: {
      changeTag?: (tagId: string, newTagName: string) => void;
      handleEditorKeyDown: (event: KeyboardEvent) => boolean;
    };
    __desktopMergeEditorBodyWithStoredHeader?: (editorXml: string, storedXml?: string) => string;
    __desktopMergeHeaderForValidation?: (editorXml: string) => string;
    __desktopStoredDocumentXml?: string;
    __leafWriterTranslationPane?: {
      filePath: string | null;
      isActive: () => boolean;
      redo: () => Promise<boolean>;
      replaceContent: (filePath: string, content: string) => boolean;
      undo: () => Promise<boolean>;
    };
  }
}

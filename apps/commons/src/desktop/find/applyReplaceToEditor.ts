import { clearFindHighlights } from './findEditorHighlights';
import { resolveTextHitInXml } from './resolveTextHitInXml';
import { replaceTextHitInEditor } from './selectTextInEditor';
import type { ResolvedTextHit } from './resolveTextHitInXml';

const isSourceEditorMode = () =>
  window.writer?.overmindState?.ui?.editorViewMode === 'source';

const isActiveFile = (filePath: string, activeTabPath: string | null, resourceFilePath?: string | null) => {
  const currentPath = resourceFilePath ?? activeTabPath;
  return currentPath === filePath;
};

export interface SyncReplacedContentParams {
  activeTabPath: string | null;
  content: string;
  filePath: string;
  loadDocumentInWriter?: (filePath: string, content: string) => Promise<void>;
  markTabDirty: (dirty: boolean) => void;
  resourceFilePath?: string | null;
  /** In-place Monaco edit (undoable) instead of replacing the whole buffer. */
  sourcePatch?: {
    contentBefore: string;
    end: number;
    replacement: string;
    start: number;
  };
  updateTabContent: (params: { content: string; filePath: string }) => void;
  /** When set, patch the WYSIWYG editor in place instead of reloading the document. */
  visualPatch?: { replacement: string; resolved: ResolvedTextHit };
}

/** Update in-memory tab state and sync the active editor when applicable. */
export const syncReplacedContent = async ({
  activeTabPath,
  content,
  filePath,
  loadDocumentInWriter,
  markTabDirty,
  resourceFilePath,
  sourcePatch,
  updateTabContent,
  visualPatch,
}: SyncReplacedContentParams): Promise<void> => {
  updateTabContent({ filePath, content });
  markTabDirty(true);

  if (!isActiveFile(filePath, activeTabPath, resourceFilePath)) return;

  if (isSourceEditorMode()) {
    if (
      sourcePatch &&
      window.__leafWriterSourceFind?.replaceRange({
        content: sourcePatch.contentBefore,
        end: sourcePatch.end,
        replacement: sourcePatch.replacement,
        start: sourcePatch.start,
      })
    ) {
      // #region agent log
      fetch('http://127.0.0.1:7253/ingest/aae22f38-d876-4045-816e-e95acef3f779',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cdf07b'},body:JSON.stringify({sessionId:'cdf07b',location:'applyReplaceToEditor.ts:sourcePatch',message:'replace sync path',data:{path:'sourcePatch',replacementLen:sourcePatch.replacement.length},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      return;
    }

    window.writer?.overmindActions?.ui?.setSourceCurrentContent?.(content);
    return;
  }

  if (visualPatch) {
    // Find highlight spans can break text-node patching; markup in replacement needs a full reload.
    const canPatchInPlace = !/[<>]/.test(visualPatch.replacement);
    if (canPatchInPlace) {
      clearFindHighlights();
      const patched = replaceTextHitInEditor(visualPatch.resolved, visualPatch.replacement);
      // #region agent log
      fetch('http://127.0.0.1:7253/ingest/aae22f38-d876-4045-816e-e95acef3f779',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cdf07b'},body:JSON.stringify({sessionId:'cdf07b',location:'applyReplaceToEditor.ts:visualPatch',message:'replace sync path',data:{path:patched?'visualPatch':'visualPatchFailed',canPatchInPlace,replacementHasMarkup:/[<>]/.test(visualPatch.replacement)},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      if (patched) {
        window.writer?.overmindActions?.editor?.setContentHasChanged?.(true);
        window.writer?.editor?.focus();
        return;
      }
    }
  }

  // #region agent log
  fetch('http://127.0.0.1:7253/ingest/aae22f38-d876-4045-816e-e95acef3f779',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cdf07b'},body:JSON.stringify({sessionId:'cdf07b',location:'applyReplaceToEditor.ts:reload',message:'replace sync path',data:{path:'loadDocumentInWriter',hasVisualPatch:!!visualPatch},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  if (loadDocumentInWriter) {
    await loadDocumentInWriter(filePath, content);
  } else if (window.writer) {
    window.writer.overmindActions?.ui?.resetSourceEditor?.();
    window.writer.loadDocumentXML(content);
    window.writer.layoutManager?.resizeEditor?.();
    window.writer.layoutManager?.resizeAll?.();
  }
};

export const writeReplacedContentToDisk = async (
  filePath: string,
  content: string,
): Promise<boolean> => {
  if (!window.electronAPI?.writeFile) return false;

  try {
    await window.electronAPI.writeFile(filePath, content);
    return true;
  } catch {
    return false;
  }
};

export const getContentForReplace = (
  filePath: string,
  openTabs: { content: string; filePath: string }[],
  activeTabPath: string | null,
  resourceFilePath?: string | null,
): string | undefined => {
  if (isActiveFile(filePath, activeTabPath, resourceFilePath) && isSourceEditorMode()) {
    return window.writer?.overmindState?.ui?.sourceCurrentContent;
  }

  return openTabs.find((tab) => tab.filePath === filePath)?.content;
};

export const readFileContentForReplace = async (filePath: string): Promise<string | null> => {
  if (!window.electronAPI?.readFile) return null;

  try {
    return await window.electronAPI.readFile(filePath);
  } catch {
    return null;
  }
};

export const isFileOpenInTabs = (
  filePath: string,
  openTabs: { filePath: string }[],
): boolean => openTabs.some((tab) => tab.filePath === filePath);

export { resolveTextHitInXml };

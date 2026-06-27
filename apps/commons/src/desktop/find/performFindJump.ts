import { clearFindHighlights } from './findEditorHighlights';
import { resolveTextHitInXml } from './resolveTextHitInXml';
import {
  applyFindJumpInSourceEditor,
  getActiveEditorContent,
  revealRangeInSourceEditor,
  scrollToSourceFindHit,
} from './findSourceEditorHighlights';
import { clearWysiwygActiveFindHighlight, jumpToWysiwygFindHit } from './wysiwygFindJump';
import type { FindHighlightMode } from './types';

export interface PerformFindJumpParams {
  content: string;
  contentForJump?: string;
  end: number;
  highlightMode?: FindHighlightMode;
  matchIndexInFile: number;
  query: string;
  start: number;
  useRegex: boolean;
}

const isSourceEditorMode = () =>
  window.writer?.overmindState?.ui?.editorViewMode === 'source';

export const performFindJump = ({
  content,
  contentForJump,
  end,
  highlightMode = 'full',
  matchIndexInFile,
  query,
  start,
  useRegex,
}: PerformFindJumpParams): boolean => {
  const editorContent = contentForJump ?? getActiveEditorContent(content);

  if (isSourceEditorMode()) {
    if (highlightMode === 'scroll-only') {
      const scrolled = scrollToSourceFindHit({
        content: editorContent,
        end,
        start,
      });
      if (scrolled) return true;

      return revealRangeInSourceEditor({
        content: editorContent,
        end,
        start,
        focusEditor: false,
      });
    }

    if (highlightMode === 'active-only') {
      return revealRangeInSourceEditor({
        content: editorContent,
        end,
        start,
        focusEditor: false,
      });
    }

    return applyFindJumpInSourceEditor({
      content: editorContent,
      end,
      query,
      start,
      useRegex,
    });
  }

  const resolved = resolveTextHitInXml(editorContent, start, end);
  if (!resolved) {
    return false;
  }

  if (highlightMode === 'full') {
    clearFindHighlights();
  } else {
    clearWysiwygActiveFindHighlight();
  }

  return jumpToWysiwygFindHit(resolved, highlightMode);
};

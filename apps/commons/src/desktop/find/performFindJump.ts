import { applyFindHighlightsInEditor, scrollToFindHitInEditor } from './findEditorHighlights';
import {
  applyFindJumpInSourceEditor,
  getActiveEditorContent,
  revealRangeInSourceEditor,
  scrollToSourceFindHit,
} from './findSourceEditorHighlights';
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
      return scrollToSourceFindHit({
        content: editorContent,
        end,
        start,
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

  if (highlightMode === 'scroll-only') {
    return scrollToFindHitInEditor(matchIndexInFile);
  }

  const highlighted = applyFindHighlightsInEditor(query, useRegex, matchIndexInFile);

  return highlighted;
};

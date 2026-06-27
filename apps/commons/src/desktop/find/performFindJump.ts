import { applyFindHighlightsInEditor } from './findEditorHighlights';
import {
  applyFindJumpInSourceEditor,
  getActiveEditorContent,
} from './findSourceEditorHighlights';
import { resolveTextHitInXml } from './resolveTextHitInXml';
import { scrollToTextHitInEditor } from './selectTextInEditor';

export interface PerformFindJumpParams {
  content: string;
  end: number;
  matchIndexInFile: number;
  query: string;
  start: number;
  useRegex: boolean;
}

const isSourceEditorMode = () =>
  window.writer?.overmindState?.ui?.editorViewMode === 'source';

export const performFindJump = ({
  content,
  end,
  matchIndexInFile,
  query,
  start,
  useRegex,
}: PerformFindJumpParams): boolean => {
  const editorContent = getActiveEditorContent(content);

  if (isSourceEditorMode()) {
    return applyFindJumpInSourceEditor({
      content: editorContent,
      end,
      query,
      start,
      useRegex,
    });
  }

  const highlighted = applyFindHighlightsInEditor(query, useRegex, matchIndexInFile);

  const resolved = resolveTextHitInXml(content, start, end);
  const scrolled = resolved ? scrollToTextHitInEditor(resolved) : false;

  return highlighted || scrolled;
};

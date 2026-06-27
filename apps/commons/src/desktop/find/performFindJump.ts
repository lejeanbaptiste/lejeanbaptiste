import { applyFindHighlightsInEditor } from './findEditorHighlights';
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

export const performFindJump = ({
  content,
  end,
  matchIndexInFile,
  query,
  start,
  useRegex,
}: PerformFindJumpParams): boolean => {
  const highlighted = applyFindHighlightsInEditor(query, useRegex, matchIndexInFile);

  const resolved = resolveTextHitInXml(content, start, end);
  const scrolled = resolved ? scrollToTextHitInEditor(resolved) : false;

  return highlighted || scrolled;
};

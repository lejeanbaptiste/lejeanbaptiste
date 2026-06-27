import type { ResolvedTextHit } from './resolveTextHitInXml';
import {
  clearActiveFindHighlightInEditor,
  highlightTextHitInEditor,
  scrollToTextHitInEditor,
} from './selectTextInEditor';
import type { FindHighlightMode } from './types';

/** Jump to a hit by TEI xpath — scroll + optional single-span highlight (undo-safe). */
export const jumpToWysiwygFindHit = (
  resolved: ResolvedTextHit,
  highlightMode: FindHighlightMode,
): boolean => {
  if (highlightMode !== 'scroll-only') {
    highlightTextHitInEditor(resolved);
  }

  const scrolled = scrollToTextHitInEditor(resolved);

  return scrolled;
};

export const clearWysiwygActiveFindHighlight = () => {
  clearActiveFindHighlightInEditor();
};

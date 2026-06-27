import { getActiveEditorContent } from '../find/findSourceEditorHighlights';
import { findElementOpenTagInXml } from './findElementOpenTagInXml';
import type { PendingXPathJump } from './types';

const isSourceEditorMode = () =>
  window.writer?.overmindState?.ui?.editorViewMode === 'source';

export const performXPathJumpInSourceEditor = (jump: PendingXPathJump): boolean => {
  if (!isSourceEditorMode() || !jump.xpath) return false;

  const content = getActiveEditorContent();
  if (!content) return false;

  const position = findElementOpenTagInXml(content, jump.xpath);
  if (!position) return false;

  return (
    window.__leafWriterSourceFind?.revealRange({
      content,
      start: position.start,
      end: position.end,
    }) ?? false
  );
};

import { findElementOpenTagStartInXml } from '../../utilities/sourceCursorSync';
import { findEditorNodeByTeiXPath } from '../../utilities/teiXPath';

const findTagEnd = (content: string, tagStart: number) => {
  let quote: '"' | "'" | null = null;

  for (let j = tagStart + 1; j < content.length; j++) {
    const ch = content[j];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '>') return j + 1;
  }

  return tagStart + 1;
};

const jumpInSourceEditor = (teiXpath: string, focusEditor: boolean): boolean => {
  const content = window.writer?.overmindState?.ui?.sourceCurrentContent ?? '';
  if (!content) return false;

  const start = findElementOpenTagStartInXml(content, teiXpath);
  if (start === null) return false;

  const end = findTagEnd(content, start);
  return (
    window.__leafWriterSourceFind?.revealRange({
      content,
      end,
      focusEditor,
      start,
    }) ?? false
  );
};

const jumpInVisualEditor = (teiXpath: string, focusEditor: boolean): boolean => {
  const body = window.writer?.editor?.getBody();
  const utilities = window.writer?.utilities;
  if (!body || !utilities) return false;

  const element = findEditorNodeByTeiXPath(body, teiXpath);
  if (!element) return false;

  const xpath = utilities.getElementXPath(element);
  if (!xpath) return false;

  utilities.selectNode({ xpath }, false, focusEditor);
  return true;
};

/** Select the editor element at a TEI xpath (visual or source mode). */
export const jumpToTeiXPath = (teiXpath: string, focusEditor = true): boolean => {
  if (!teiXpath || !window.writer) return false;

  const isSourceMode = window.writer.overmindState?.ui?.editorViewMode === 'source';
  if (isSourceMode) {
    return jumpInSourceEditor(teiXpath, focusEditor);
  }

  return jumpInVisualEditor(teiXpath, focusEditor);
};

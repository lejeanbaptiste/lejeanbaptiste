import type { LeafWriterEditor } from '../types';

/** Plain-text editor selection captured on toolbar mousedown (before focus leaves TinyMCE). */
let capturedPlain = '';

export function captureEditorSelectionFromEditor(
  editor: Pick<LeafWriterEditor, 'selection' | 'currentBookmark'>,
): void {
  if (editor.selection.isCollapsed?.()) {
    capturedPlain = '';
    return;
  }
  editor.currentBookmark = editor.selection.getBookmark(1);
  const text = editor.selection.getContent({ format: 'text' }) ?? '';
  capturedPlain = text.replace(/\s+/g, '');
}

export function peekCapturedEditorSelection(): string {
  return capturedPlain;
}

export function consumeCapturedEditorSelection(): string {
  const text = capturedPlain;
  capturedPlain = '';
  return text;
}

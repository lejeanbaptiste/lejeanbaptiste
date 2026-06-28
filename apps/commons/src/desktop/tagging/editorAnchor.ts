/** Screen position for caret-anchored popups (tag + attribute). */
export const getCaretScreenPosition = (): { left: number; top: number } | null => {
  const editor = window.writer?.editor;
  if (!editor) return null;

  const iframe =
    (editor as { iframeElement?: HTMLIFrameElement }).iframeElement ??
    (editor.getContentAreaContainer()?.querySelector('iframe') as HTMLIFrameElement | null);
  const iframeRect = iframe?.getBoundingClientRect();

  const rng = editor.selection.getRng();
  let rect = rng.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    const marker = editor.dom.create('span', { 'data-mce-bogus': '1' }, '\u200b');
    rng.insertNode(marker);
    rect = marker.getBoundingClientRect();
    editor.dom.remove(marker);
  }

  const offsetLeft = iframeRect?.left ?? 0;
  const offsetTop = iframeRect?.top ?? 0;

  return { left: rect.left + offsetLeft, top: rect.bottom + offsetTop };
};

/** Place the caret in the first body paragraph after loading XML into the editor. */
export const focusFirstBodyParagraph = () => {
  if (!window.writer?.editor) return;

  window.setTimeout(() => {
    const writer = window.writer;
    if (!writer?.editor) return;

    const paragraph = writer.editor.getBody()?.querySelector('[_tag="p"]');
    if (paragraph?.id) {
      writer.utilities.selectElementById(paragraph.id, true, true);
    }
  }, 150);
};

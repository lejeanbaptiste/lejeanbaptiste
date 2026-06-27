/** Clear the running LEAF-Writer editor when no document should be open. */
export const clearWriterSession = () => {
  const writer = window.writer;
  if (!writer) return;

  writer.event('loadingDocument').publish();
  writer.overmindActions?.document?.clear?.();
  writer.overmindActions?.ui?.resetSourceEditor?.();
  void writer.overmindActions?.validator?.updateValidationError?.(0);

  const body = writer.editor?.getBody?.();
  if (body) body.innerHTML = '';

  writer.event('documentLoaded').publish(false, null);
};

import { getDefaultStore } from 'jotai';

import { leafWriterSessionKeyAtom, leafwriterAtom } from '@src/jotai';

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

/**
 * Tear down the editor instance when switching projects so schemas and validation
 * reload for the new project (window.writer otherwise skips initLeafWriter).
 */
export const resetDesktopEditorSession = () => {
  const store = getDefaultStore();
  const leafWriter = store.get(leafwriterAtom);

  if (leafWriter) {
    try {
      leafWriter.dispose();
    } catch {
      // ignore dispose errors during teardown
    }
    store.set(leafwriterAtom, null);
  }

  window.writer?.overmindActions?.editor?.clearProjectSchemas?.();
  clearWriterSession();
  store.set(leafWriterSessionKeyAtom, (key) => key + 1);
};

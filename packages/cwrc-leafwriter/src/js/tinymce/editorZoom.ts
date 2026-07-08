import type { Editor } from 'tinymce';

const STORAGE_KEY = 'leafWriterEditorZoom';
const MIN_ZOOM = 50;
const MAX_ZOOM = 300;
const ZOOM_STEP = 10;
const DEFAULT_ZOOM = 100;

const clampZoom = (level: number) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(level)));

export const getEditorZoom = (): number => {
  const stored = Number(window.localStorage.getItem(STORAGE_KEY));
  if (!Number.isFinite(stored)) return DEFAULT_ZOOM;
  return clampZoom(stored);
};

const applyEditorZoom = (editor: Editor, level: number) => {
  const doc = editor.getDoc();
  if (!doc) return;
  // CSS zoom on the iframe's root scales the document content (including the
  // fixed-px tag pills) without affecting the surrounding application UI.
  doc.documentElement.style.zoom = level === DEFAULT_ZOOM ? '' : `${level}%`;
};

export const setEditorZoom = (editor: Editor, level: number) => {
  const clamped = clampZoom(level);
  window.localStorage.setItem(STORAGE_KEY, String(clamped));
  applyEditorZoom(editor, clamped);
};

export const zoomEditorIn = (editor: Editor) =>
  setEditorZoom(editor, getEditorZoom() + ZOOM_STEP);

export const zoomEditorOut = (editor: Editor) =>
  setEditorZoom(editor, getEditorZoom() - ZOOM_STEP);

export const resetEditorZoom = (editor: Editor) => setEditorZoom(editor, DEFAULT_ZOOM);

/**
 * Apply the persisted zoom level and register in-editor zoom shortcuts.
 * Call from the editor's init handler. Also publishes a bridge on window so
 * the desktop menu (whose accelerators fire before the renderer sees the
 * keys) can drive the same zoom.
 */
export const initEditorZoom = (editor: Editor) => {
  applyEditorZoom(editor, getEditorZoom());

  // Handle Cmd/Ctrl +/-/0 when focus is inside the editor iframe (web build;
  // on desktop the menu accelerators intercept these keys first).
  editor.on('keydown', (event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    if (event.key === '=' || event.key === '+') {
      event.preventDefault();
      zoomEditorIn(editor);
    } else if (event.key === '-') {
      event.preventDefault();
      zoomEditorOut(editor);
    } else if (event.key === '0') {
      event.preventDefault();
      resetEditorZoom(editor);
    }
  });

  window.__leafWriterEditorZoom = {
    zoomIn: () => zoomEditorIn(editor),
    zoomOut: () => zoomEditorOut(editor),
    reset: () => resetEditorZoom(editor),
    get: getEditorZoom,
  };

  editor.on('remove', () => {
    if (window.__leafWriterEditorZoom?.zoomIn) {
      delete window.__leafWriterEditorZoom;
    }
  });
};

import type { Editor } from 'tinymce';

const STORAGE_KEY = 'leafWriterEditorZoom';
const LEGACY_DEFAULT_ZOOM = 100;
const MIN_ZOOM = 50;
const MAX_ZOOM = 300;
const ZOOM_STEP = 10;
// Start a bit larger so the visual editor feels aligned with the rest of the UI,
// especially on macOS where the default document text can look undersized.
const DEFAULT_ZOOM = 200;
const MIGRATION_KEY = 'leafWriterEditorZoomMigratedTo125';

const clampZoom = (level: number) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(level)));

export const getEditorZoom = (): number => {
  const stored = Number(window.localStorage.getItem(STORAGE_KEY));
  if (!Number.isFinite(stored) || stored <= 0) return DEFAULT_ZOOM;
  if (
    stored === LEGACY_DEFAULT_ZOOM &&
    window.localStorage.getItem(MIGRATION_KEY) !== 'true'
  ) {
    window.localStorage.setItem(MIGRATION_KEY, 'true');
    window.localStorage.setItem(STORAGE_KEY, String(DEFAULT_ZOOM));
    return DEFAULT_ZOOM;
  }
  return clampZoom(stored);
};

const applyEditorZoom = (editor: Editor, level: number) => {
  const doc = editor.getDoc();
  if (!doc) return;
  // CSS zoom on the iframe's root scales the document content (including the
  // fixed-px tag pills) without affecting the surrounding application UI.
  // 100% is the browser-native no-op value, regardless of DEFAULT_ZOOM.
  doc.documentElement.style.zoom = level === LEGACY_DEFAULT_ZOOM ? '' : `${level}%`;
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

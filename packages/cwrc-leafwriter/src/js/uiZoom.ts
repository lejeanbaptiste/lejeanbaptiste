/**
 * Interface (window chrome) zoom for the desktop app: scales the whole UI via
 * Electron's webFrame zoom factor, independent of the per-pane text zooms
 * (visual editor %, source/translation font sizes). Percent-based, persisted.
 *
 * The startup re-apply lives in the desktop shell (useDesktopAppMenuBridge),
 * which reads the same storage key.
 */

export const UI_ZOOM_STORAGE_KEY = 'leafWriterUiZoom';
export const UI_ZOOM_MIN = 80;
export const UI_ZOOM_MAX = 150;
export const UI_ZOOM_DEFAULT = 100;

const clamp = (percent: number) =>
  Math.min(UI_ZOOM_MAX, Math.max(UI_ZOOM_MIN, Math.round(percent)));

export const isUiZoomAvailable = (): boolean =>
  typeof window.electronAPI?.setUiZoomFactor === 'function';

export const getUiZoom = (): number => {
  const stored = Number(window.localStorage.getItem(UI_ZOOM_STORAGE_KEY));
  return Number.isFinite(stored) && stored > 0 ? clamp(stored) : UI_ZOOM_DEFAULT;
};

export const setUiZoom = (percent: number) => {
  const clamped = clamp(percent);
  window.localStorage.setItem(UI_ZOOM_STORAGE_KEY, String(clamped));
  window.electronAPI?.setUiZoomFactor?.(clamped / 100);
};

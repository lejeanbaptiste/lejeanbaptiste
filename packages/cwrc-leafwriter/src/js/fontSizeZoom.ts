/**
 * Persisted, clamped font-size zoom shared by the source (Monaco) view and the
 * translation pane. The visual editor keeps its own percentage-based zoom
 * (editorZoom.ts); these two zoom actual font sizes in px within 8–24.
 */

export const FONT_ZOOM_MIN = 8;
export const FONT_ZOOM_MAX = 24;
const FONT_ZOOM_STEP = 1;

export interface FontSizeZoom {
  get: () => number;
  set: (size: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  /** Notifies with the new size on every change; returns an unsubscribe. */
  subscribe: (listener: (size: number) => void) => () => void;
}

const clamp = (size: number) =>
  Math.min(FONT_ZOOM_MAX, Math.max(FONT_ZOOM_MIN, Math.round(size)));

export const createFontSizeZoom = (storageKey: string, defaultSize: number): FontSizeZoom => {
  const listeners = new Set<(size: number) => void>();

  const get = () => {
    const stored = Number(window.localStorage.getItem(storageKey));
    return Number.isFinite(stored) && stored > 0 ? clamp(stored) : defaultSize;
  };

  const set = (size: number) => {
    const clamped = clamp(size);
    window.localStorage.setItem(storageKey, String(clamped));
    listeners.forEach((listener) => listener(clamped));
  };

  return {
    get,
    set,
    zoomIn: () => set(get() + FONT_ZOOM_STEP),
    zoomOut: () => set(get() - FONT_ZOOM_STEP),
    reset: () => set(defaultSize),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

/** Source (Monaco) view font size. Monaco's own default is 14px. */
export const sourceFontZoom = createFontSizeZoom('leafWriterSourceFontSize', 14);

/** Translation pane font size. */
export const translationFontZoom = createFontSizeZoom('leafWriterTranslationFontSize', 14);

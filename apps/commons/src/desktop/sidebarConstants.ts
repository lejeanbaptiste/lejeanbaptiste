/** One step below editor toolbar IconButton (34×34, 20px icon). */
export const SIDEBAR_TAB_BUTTON_SIZE = 30;
export const SIDEBAR_TAB_ICON_SIZE = 16;

/**
 * Shared height for the three top bars (left tab bar, editor toolbar row,
 * right tab bar) so their bottom borders always align. Fits the editor
 * toolbar's 34px buttons plus the 1px bottom border (border-box).
 */
export const TOOLBAR_ROW_HEIGHT = 35;

/** Minimum width so six tab icons stay on one row. */
export const LEFT_PANEL_MIN_WIDTH = 240;
/**
 * Database tab toolbar: type menu + Central/Project + Fusionner + tool icons
 * must stay on one line without clipping.
 */
export const LEFT_PANEL_DATABASE_MIN_WIDTH = 340;
export const LEFT_PANEL_DEFAULT_WIDTH = 280;
export const LEFT_PANEL_MAX_WIDTH = 520;
export const LEFT_PANEL_COLLAPSED_WIDTH = 48;

export const LEFT_PANEL_WIDTH_STORAGE_KEY = 'grognard-left-panel-width';

export const RIGHT_PANEL_MIN_WIDTH = 240;
export const RIGHT_PANEL_DEFAULT_WIDTH = 280;
export const RIGHT_PANEL_MAX_WIDTH = 520;
/** While the Translation tab is open the right panel may grow further. */
export const RIGHT_PANEL_TRANSLATION_MAX_WIDTH = 900;
export const RIGHT_PANEL_COLLAPSED_WIDTH = 48;

export const RIGHT_PANEL_WIDTH_STORAGE_KEY = 'grognard-right-panel-width';

/** Target width for the translation pane (~45% of the window, capped). */
export const preferredTranslationPanelWidth = (): number => {
  if (typeof window === 'undefined') return 640;
  const target = Math.floor(window.innerWidth * 0.45);
  return Math.min(RIGHT_PANEL_TRANSLATION_MAX_WIDTH, Math.max(480, target));
};

import type { TagCommandMode } from './tagCommand';

export interface DesktopTaggingBridge {
  changeTag?: (tagId: string, newTagName: string) => void;
  handleEditorKeyDown: (event: KeyboardEvent) => boolean;
  /**
   * True while the tag or attribute popup is open. The visual editor must not
   * accept IME composition or typing then — otherwise Chinese IME can replace
   * a wrap selection before Esc cancels composition and the string vanishes.
   */
  isPopupOpen?: () => boolean;
  /**
   * Open the rename/wrap tag popup from outside the editor (e.g. the markup tree panel),
   * anchored at anchorOverride instead of the editor caret. Requires the editor's own
   * selection to already reflect the target tag/content (rename needs a tag at the resolved
   * cursor position; wrap needs a non-collapsed selection).
   */
  openTagPopup?: (
    mode: TagCommandMode,
    anchorOverride: { left: number; top: number },
  ) => Promise<boolean>;
  /** Same, for the attribute popup. */
  openAttributePopup?: (anchorOverride: { left: number; top: number }) => Promise<boolean>;
}

declare global {
  interface Window {
    __desktopTagging?: DesktopTaggingBridge;
  }
}

export const registerDesktopTaggingBridge = (bridge: DesktopTaggingBridge) => {
  window.__desktopTagging = bridge;
};

export const unregisterDesktopTaggingBridge = () => {
  delete window.__desktopTagging;
};

export const isDesktopTaggingActive = (): boolean => Boolean(window.__desktopTagging);

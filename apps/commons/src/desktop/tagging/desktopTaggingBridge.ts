export interface DesktopTaggingBridge {
  handleEditorKeyDown: (event: KeyboardEvent) => boolean;
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

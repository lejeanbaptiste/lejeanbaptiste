export interface DesktopCorrectionBridge {
  openCorrectionPopup: () => boolean;
}

declare global {
  interface Window {
    __desktopCorrection?: DesktopCorrectionBridge;
  }
}

export const registerDesktopCorrectionBridge = (bridge: DesktopCorrectionBridge) => {
  window.__desktopCorrection = bridge;
};

export const unregisterDesktopCorrectionBridge = () => {
  delete window.__desktopCorrection;
};

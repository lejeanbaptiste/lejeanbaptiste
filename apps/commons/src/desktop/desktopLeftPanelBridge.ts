import type { SidebarTabId } from '@src/icons/tab';

export interface DesktopLeftPanelBridge {
  expand: () => void;
  showTab: (tab: SidebarTabId) => void;
}

declare global {
  interface Window {
    __desktopLeftPanel?: DesktopLeftPanelBridge;
  }
}

export const DESKTOP_LEFT_PANEL_EVENT = 'desktop-left-panel:show';

export const DESKTOP_FIND_FOCUS_EVENT = 'desktop-left-panel:focus-find';

export type DesktopLeftPanelShowDetail = {
  tab: SidebarTabId;
};

export const openFindPanel = () => {
  window.__desktopLeftPanel?.showTab('find');
  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent(DESKTOP_FIND_FOCUS_EVENT));
  }, 0);
};

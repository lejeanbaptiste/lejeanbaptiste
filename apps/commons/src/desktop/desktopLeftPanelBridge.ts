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

export type DesktopLeftPanelShowDetail = {
  tab: SidebarTabId;
};

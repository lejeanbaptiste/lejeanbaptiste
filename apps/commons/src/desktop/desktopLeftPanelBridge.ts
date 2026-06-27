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

export const DESKTOP_OPEN_FIND_EVENT = 'desktop:open-find';

/** Fired when the user switches Visual ↔ Source in the editor. */
export const DESKTOP_EDITOR_VIEW_MODE_EVENT = 'desktop:editor-view-mode-changed';

export type DesktopEditorViewModeDetail = {
  mode: 'source' | 'visual';
};

const MAX_OPEN_FIND_RETRIES = 30;

export const openFindPanel = (attempt = 0) => {
  const bridge = window.__desktopLeftPanel;

  if (!bridge) {
    if (attempt < MAX_OPEN_FIND_RETRIES) {
      requestAnimationFrame(() => openFindPanel(attempt + 1));
    }
    return;
  }

  bridge.showTab('find');
  window.dispatchEvent(new CustomEvent(DESKTOP_FIND_FOCUS_EVENT));
};

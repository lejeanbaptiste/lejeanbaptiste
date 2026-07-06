import { Box } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SidebarTabId } from '@src/icons/tab';
import {
  DESKTOP_FIND_FOCUS_EVENT,
  DESKTOP_LEFT_PANEL_EVENT,
  type DesktopLeftPanelShowDetail,
} from './desktopLeftPanelBridge';
import { LeftPanelResizeHandle } from './LeftPanelResizeHandle';
import {
  LEFT_PANEL_COLLAPSED_WIDTH,
  LEFT_PANEL_DEFAULT_WIDTH,
  LEFT_PANEL_MAX_WIDTH,
  LEFT_PANEL_MIN_WIDTH,
  LEFT_PANEL_WIDTH_STORAGE_KEY,
} from './sidebarConstants';
import { SidebarExplorerTab } from './sidebar/SidebarExplorerTab';
import { SidebarFindTab } from './sidebar/SidebarFindTab';
import { SidebarXPathTab } from './sidebar/SidebarXPathTab';
import { SidebarIconTabBar } from './SidebarIconTabBar';

const clampWidth = (width: number) =>
  Math.min(LEFT_PANEL_MAX_WIDTH, Math.max(LEFT_PANEL_MIN_WIDTH, width));

const readStoredWidth = () => {
  try {
    const stored = localStorage.getItem(LEFT_PANEL_WIDTH_STORAGE_KEY);
    if (stored) return clampWidth(Number(stored));
  } catch {
    // ignore
  }
  return LEFT_PANEL_DEFAULT_WIDTH;
};

const resizeEditor = () => {
  window.writer?.layoutManager?.resizeEditor();
  window.writer?.layoutManager?.resizeAll?.();
};

export const UnifiedLeftPanel = () => {
  const [activeTab, setActiveTab] = useState<SidebarTabId>('explorer');
  const [collapsed, setCollapsed] = useState(false);
  const [panelWidth, setPanelWidth] = useState(readStoredWidth);
  const collapsedRef = useRef(collapsed);
  const suppressedByDockedReviewRef = useRef(false);
  const dockedReviewSuppressCountRef = useRef(0);
  const restoreExpandedAfterDockedReviewRef = useRef(false);

  collapsedRef.current = collapsed;

  const showTab = useCallback((tab: SidebarTabId) => {
    setActiveTab(tab);
    if (!suppressedByDockedReviewRef.current) setCollapsed(false);
  }, []);

  const expand = useCallback(() => {
    if (suppressedByDockedReviewRef.current) return;
    setCollapsed(false);
  }, []);

  const handleWidthChange = useCallback((nextWidth: number) => {
    const clamped = clampWidth(nextWidth);
    setPanelWidth(clamped);
    try {
      localStorage.setItem(LEFT_PANEL_WIDTH_STORAGE_KEY, String(clamped));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    window.__desktopLeftPanel = { showTab, expand };

    const onShowEvent = (event: Event) => {
      const detail = (event as CustomEvent<DesktopLeftPanelShowDetail>).detail;
      if (detail?.tab) showTab(detail.tab);
    };

    window.addEventListener(DESKTOP_LEFT_PANEL_EVENT, onShowEvent);

    return () => {
      delete window.__desktopLeftPanel;
      window.removeEventListener(DESKTOP_LEFT_PANEL_EVENT, onShowEvent);
    };
  }, [expand, showTab]);

  // Hide the left panel while a docked review pane is open; restore if it was expanded.
  useEffect(() => {
    const onOpen = () => {
      if (dockedReviewSuppressCountRef.current === 0) {
        restoreExpandedAfterDockedReviewRef.current = !collapsedRef.current;
        if (!collapsedRef.current) setCollapsed(true);
      }
      dockedReviewSuppressCountRef.current += 1;
      suppressedByDockedReviewRef.current = true;
    };
    const onClose = () => {
      dockedReviewSuppressCountRef.current = Math.max(0, dockedReviewSuppressCountRef.current - 1);
      if (dockedReviewSuppressCountRef.current > 0) return;
      suppressedByDockedReviewRef.current = false;
      if (restoreExpandedAfterDockedReviewRef.current) setCollapsed(false);
      restoreExpandedAfterDockedReviewRef.current = false;
    };
    const openEvents = [
      'desktop:auto-tagging-review-open',
      'desktop:disambiguation-review-open',
    ] as const;
    const closeEvents = [
      'desktop:auto-tagging-review-close',
      'desktop:disambiguation-review-close',
    ] as const;
    for (const eventName of openEvents) window.addEventListener(eventName, onOpen);
    for (const eventName of closeEvents) window.addEventListener(eventName, onClose);
    return () => {
      for (const eventName of openEvents) window.removeEventListener(eventName, onOpen);
      for (const eventName of closeEvents) window.removeEventListener(eventName, onClose);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'find') return;
    window.dispatchEvent(new CustomEvent(DESKTOP_FIND_FOCUS_EVENT));
  }, [activeTab]);

  useEffect(() => {
    const id = requestAnimationFrame(resizeEditor);
    return () => cancelAnimationFrame(id);
  }, [collapsed, panelWidth]);

  const handleSelectTab = (tab: SidebarTabId) => {
    setActiveTab(tab);
    if (!suppressedByDockedReviewRef.current && collapsed) setCollapsed(false);
  };

  const expandPanel = () => {
    if (suppressedByDockedReviewRef.current) return;
    setCollapsed(false);
  };

  const panelSx = (tab: SidebarTabId) => ({
    display: activeTab === tab ? 'flex' : 'none',
    flexDirection: 'column' as const,
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
  });

  // Collapse must not unmount panel slots: LEAF-Writer portals (TOC, markup) and the
  // entities module render into #desktop-panel-* nodes for the lifetime of the editor.
  // Destroying those nodes leaves permanently blank panels when the sidebar expands again.
  return (
    <Box
      sx={{
        width: collapsed ? LEFT_PANEL_COLLAPSED_WIDTH : panelWidth,
        minWidth: collapsed ? LEFT_PANEL_COLLAPSED_WIDTH : LEFT_PANEL_MIN_WIDTH,
        maxWidth: collapsed ? LEFT_PANEL_COLLAPSED_WIDTH : LEFT_PANEL_MAX_WIDTH,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
        position: 'relative',
      }}
    >
      <SidebarIconTabBar
        activeTab={activeTab}
        collapsed={collapsed}
        onSelectTab={handleSelectTab}
        onToggleCollapse={collapsed ? expandPanel : () => setCollapsed(true)}
        orientation={collapsed ? 'vertical' : 'horizontal'}
      />

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: collapsed ? 'none' : 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={panelSx('explorer')}>
          <SidebarExplorerTab />
        </Box>
        <Box sx={panelSx('find')}>
          <SidebarFindTab />
        </Box>
        <Box sx={panelSx('xpath')}>
          <SidebarXPathTab />
        </Box>
        <Box id="desktop-panel-toc" sx={panelSx('toc')} />
        <Box id="desktop-panel-markup" sx={panelSx('markup')} />
        <Box id="desktop-panel-entities" sx={panelSx('entities')} />
      </Box>

      {!collapsed && (
        <LeftPanelResizeHandle panelWidth={panelWidth} onWidthChange={handleWidthChange} />
      )}
    </Box>
  );
};

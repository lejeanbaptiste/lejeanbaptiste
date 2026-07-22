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
import { SidebarDatabaseTab } from './sidebar/SidebarDatabaseTab';
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

  // Hide the left panel while a docked review pane is open; restore if it was
  // expanded. Driven by the CustomEvent's `detail.active` (the authoritative
  // "is any review active right now" computed at dispatch time in
  // overmind/ui/actions.ts) rather than counting opens/closes locally -
  // counting drifts permanently stuck-collapsed if events ever fire out of
  // the exact pairs it expects (e.g. auto-tagging exiting straight into
  // disambiguation dispatches close+open back to back).
  useEffect(() => {
    const onDockedReviewChange = (event: Event) => {
      const active = (event as CustomEvent<{ active: boolean }>).detail?.active ?? false;
      if (active === suppressedByDockedReviewRef.current) return;
      suppressedByDockedReviewRef.current = active;
      if (active) {
        setCollapsed((prev) => {
          restoreExpandedAfterDockedReviewRef.current = !prev;
          return true;
        });
      } else {
        if (restoreExpandedAfterDockedReviewRef.current) setCollapsed(false);
        restoreExpandedAfterDockedReviewRef.current = false;
      }
    };
    const events = [
      'desktop:auto-tagging-review-open',
      'desktop:auto-tagging-review-close',
      'desktop:disambiguation-review-open',
      'desktop:disambiguation-review-close',
    ] as const;
    for (const eventName of events) window.addEventListener(eventName, onDockedReviewChange);
    return () => {
      for (const eventName of events) window.removeEventListener(eventName, onDockedReviewChange);
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
        <Box sx={panelSx('database')}>
          <SidebarDatabaseTab active={activeTab === 'database'} />
        </Box>
      </Box>

      {!collapsed && (
        <LeftPanelResizeHandle panelWidth={panelWidth} onWidthChange={handleWidthChange} />
      )}
    </Box>
  );
};

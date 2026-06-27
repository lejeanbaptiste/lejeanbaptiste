import { Box } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
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

  const showTab = useCallback((tab: SidebarTabId) => {
    setActiveTab(tab);
    setCollapsed(false);
  }, []);

  const expand = useCallback(() => {
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
    if (collapsed) setCollapsed(false);
  };

  const panelSx = (tab: SidebarTabId) => ({
    display: activeTab === tab ? 'flex' : 'none',
    flexDirection: 'column' as const,
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
  });

  if (collapsed) {
    return (
      <Box
        sx={{
          width: LEFT_PANEL_COLLAPSED_WIDTH,
          minWidth: LEFT_PANEL_COLLAPSED_WIDTH,
          flexShrink: 0,
          height: '100%',
          bgcolor: 'background.paper',
          borderRight: 1,
          borderColor: 'divider',
        }}
      >
        <SidebarIconTabBar
          activeTab={activeTab}
          collapsed={collapsed}
          onSelectTab={handleSelectTab}
          onToggleCollapse={() => setCollapsed(false)}
          orientation="vertical"
        />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: panelWidth,
        minWidth: LEFT_PANEL_MIN_WIDTH,
        maxWidth: LEFT_PANEL_MAX_WIDTH,
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
        onToggleCollapse={() => setCollapsed(true)}
        orientation="horizontal"
      />

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
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

      <LeftPanelResizeHandle panelWidth={panelWidth} onWidthChange={handleWidthChange} />
    </Box>
  );
};

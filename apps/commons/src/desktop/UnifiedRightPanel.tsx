import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DescriptionIcon from '@mui/icons-material/Description';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import { Box, IconButton, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import { leafwriterAtom } from '@src/jotai';
import { useAtom } from 'jotai';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FileMetadataPanel } from './FileMetadataPanel';
import { AttributesPanel } from './tagging/AttributesPanel';
import { RightPanelResizeHandle } from './RightPanelResizeHandle';
import {
  RIGHT_PANEL_COLLAPSED_WIDTH,
  RIGHT_PANEL_DEFAULT_WIDTH,
  RIGHT_PANEL_MAX_WIDTH,
  RIGHT_PANEL_MIN_WIDTH,
  RIGHT_PANEL_WIDTH_STORAGE_KEY,
  SIDEBAR_TAB_BUTTON_SIZE,
  SIDEBAR_TAB_ICON_SIZE,
} from './sidebarConstants';

type RightTabId = 'fileMetadata' | 'attributes' | 'imageViewer' | 'validation';

const TAB_CONFIG: Record<RightTabId, { label: string; icon: React.ReactNode }> = {
  fileMetadata: {
    label: 'File Metadata',
    icon: <DescriptionIcon sx={{ fontSize: SIDEBAR_TAB_ICON_SIZE }} />,
  },
  attributes: {
    label: 'Attributes',
    icon: <LabelOutlinedIcon sx={{ fontSize: SIDEBAR_TAB_ICON_SIZE }} />,
  },
  imageViewer: {
    label: 'Image Viewer',
    icon: <ImageOutlinedIcon sx={{ fontSize: SIDEBAR_TAB_ICON_SIZE }} />,
  },
  validation: {
    label: 'Validation',
    icon: <CheckCircleOutlineIcon sx={{ fontSize: SIDEBAR_TAB_ICON_SIZE }} />,
  },
};

const TAB_ORDER: RightTabId[] = ['fileMetadata', 'attributes', 'imageViewer', 'validation'];

const JQUERY_TABS: RightTabId[] = ['imageViewer', 'validation'];

const clampWidth = (width: number) =>
  Math.min(RIGHT_PANEL_MAX_WIDTH, Math.max(RIGHT_PANEL_MIN_WIDTH, width));

const readStoredWidth = () => {
  try {
    const stored = localStorage.getItem(RIGHT_PANEL_WIDTH_STORAGE_KEY);
    if (stored) return clampWidth(Number(stored));
  } catch {
    // ignore
  }
  return RIGHT_PANEL_DEFAULT_WIDTH;
};

const resizeEditor = () => {
  window.writer?.layoutManager?.resizeEditor();
  window.writer?.layoutManager?.resizeAll?.();
};

export const UnifiedRightPanel = () => {
  const [leafWriter] = useAtom(leafwriterAtom);
  const [activeTab, setActiveTab] = useState<RightTabId>('fileMetadata');
  const [collapsed, setCollapsed] = useState(false);
  const [panelWidth, setPanelWidth] = useState(readStoredWidth);

  const imageViewerSlotRef = useRef<HTMLDivElement>(null);
  const validationSlotRef = useRef<HTMLDivElement>(null);
  const migratedRef = useRef(false);

  const showTab = useCallback((tab: RightTabId) => {
    setActiveTab(tab);
    setCollapsed(false);
  }, []);

  const expand = useCallback(() => {
    setCollapsed(false);
  }, []);

  useEffect(() => {
    window.__desktopRightPanel = { showTab, expand };
    return () => {
      delete window.__desktopRightPanel;
    };
  }, [showTab, expand]);

  // After jQuery east tabs are ready, migrate the jQuery-rendered containers into our slots
  useEffect(() => {
    if (!leafWriter) {
      migratedRef.current = false;
      return;
    }

    const migrate = () => {
      if (migratedRef.current) return;
      const editorId = window.writer?.editorId;
      if (!editorId) return;

      const imageViewerSrc = document.getElementById(`${editorId}-imageViewer`);
      const validationSrc = document.getElementById(`${editorId}-validation`);

      if (imageViewerSrc && imageViewerSlotRef.current) {
        imageViewerSlotRef.current.appendChild(imageViewerSrc);
      }
      if (validationSrc && validationSlotRef.current) {
        validationSlotRef.current.appendChild(validationSrc);
      }

      // Hide the now-empty jQuery east pane so it doesn't overlap anything
      const eastPane = document.querySelector<HTMLElement>('.ui-layout-east');
      if (eastPane) {
        eastPane.style.display = 'none';
      }

      if (imageViewerSrc || validationSrc) {
        migratedRef.current = true;
      }
    };

    const onEastTabsReady = () => {
      // Give jQuery UI a frame to finish tab initialization before we move nodes
      requestAnimationFrame(migrate);
    };

    window.addEventListener('lw:east-tabs-ready', onEastTabsReady);
    return () => {
      window.removeEventListener('lw:east-tabs-ready', onEastTabsReady);
    };
  }, [leafWriter]);

  const handleWidthChange = useCallback((nextWidth: number) => {
    const clamped = clampWidth(nextWidth);
    setPanelWidth(clamped);
    try {
      localStorage.setItem(RIGHT_PANEL_WIDTH_STORAGE_KEY, String(clamped));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(resizeEditor);
    return () => cancelAnimationFrame(id);
  }, [collapsed, panelWidth]);

  if (!leafWriter) return null;

  const panelSx = (tab: RightTabId) => ({
    display: activeTab === tab ? 'flex' : 'none',
    flexDirection: 'column' as const,
    height: '100%',
    minHeight: 0,
    overflow: 'hidden',
  });

  const iconTabBar = (orientation: 'horizontal' | 'vertical') => {
    const isVertical = orientation === 'vertical';
    const tooltipPlacement = isVertical ? 'left' : 'bottom';

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: isVertical ? 'column' : 'row',
          alignItems: 'center',
          bgcolor: 'background.paper',
          flexShrink: 0,
          py: isVertical ? 0.25 : 0,
          px: isVertical ? 0 : 0.25,
          ...(isVertical
            ? { width: '100%', height: '100%' }
            : {
                width: '100%',
                minHeight: SIDEBAR_TAB_BUTTON_SIZE + 4,
                borderBottom: 1,
                borderColor: 'divider',
                flexWrap: 'nowrap',
                overflow: 'hidden',
              }),
        }}
      >
        {/* Collapse button comes first in vertical mode (top of the band) */}
        {isVertical && (
          <Tooltip placement={tooltipPlacement} title="Expand panel">
            <IconButton
              size="small"
              onClick={() => setCollapsed(false)}
              aria-label="Expand right panel"
              sx={{
                width: SIDEBAR_TAB_BUTTON_SIZE,
                height: SIDEBAR_TAB_BUTTON_SIZE,
                flexShrink: 0,
              }}
            >
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        <ToggleButtonGroup
          exclusive
          orientation={orientation}
          value={activeTab}
          onChange={(_event, value: RightTabId | null) => {
            if (value) {
              setActiveTab(value);
              if (collapsed) setCollapsed(false);
            }
          }}
          sx={{
            flex: isVertical ? undefined : 1,
            flexWrap: 'nowrap',
            minWidth: 0,
            '& .MuiToggleButtonGroup-grouped': {
              margin: 0.125,
              border: 0,
              borderRadius: 1,
            },
          }}
        >
          {TAB_ORDER.map((tabId) => (
            <ToggleButton
              key={tabId}
              value={tabId}
              sx={{
                width: SIDEBAR_TAB_BUTTON_SIZE,
                height: SIDEBAR_TAB_BUTTON_SIZE,
                minWidth: SIDEBAR_TAB_BUTTON_SIZE,
                p: 0.25,
                flexShrink: 0,
              }}
            >
              <Tooltip placement={tooltipPlacement} title={TAB_CONFIG[tabId].label}>
                <Box component="span" sx={{ display: 'inline-flex', color: 'text.primary' }}>
                  {TAB_CONFIG[tabId].icon}
                </Box>
              </Tooltip>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {isVertical && <Box sx={{ flex: 1 }} />}

        {/* Collapse button at end in horizontal mode */}
        {!isVertical && (
          <Tooltip placement={tooltipPlacement} title="Collapse panel">
            <IconButton
              size="small"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse right panel"
              sx={{
                width: SIDEBAR_TAB_BUTTON_SIZE,
                height: SIDEBAR_TAB_BUTTON_SIZE,
                flexShrink: 0,
              }}
            >
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    );
  };

  if (collapsed) {
    return (
      <Box
        sx={{
          width: RIGHT_PANEL_COLLAPSED_WIDTH,
          minWidth: RIGHT_PANEL_COLLAPSED_WIDTH,
          flexShrink: 0,
          height: '100%',
          bgcolor: 'background.paper',
          borderLeft: 1,
          borderColor: 'divider',
        }}
      >
        {iconTabBar('vertical')}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: panelWidth,
        minWidth: RIGHT_PANEL_MIN_WIDTH,
        maxWidth: RIGHT_PANEL_MAX_WIDTH,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: 'background.paper',
        borderLeft: 1,
        borderColor: 'divider',
        position: 'relative',
      }}
    >
      {iconTabBar('horizontal')}

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={panelSx('fileMetadata')}>
          <FileMetadataPanel />
        </Box>
        <Box sx={panelSx('attributes')}>
          <AttributesPanel />
        </Box>
        {/* jQuery-rendered modules are migrated into these slots after east-tabs-ready */}
        {JQUERY_TABS.map((tabId) => (
          <Box
            key={tabId}
            ref={tabId === 'imageViewer' ? imageViewerSlotRef : validationSlotRef}
            sx={{
              ...panelSx(tabId),
              overflow: 'auto',
              '& > div': { height: '100%', minHeight: 0 },
            }}
          />
        ))}
      </Box>

      <RightPanelResizeHandle panelWidth={panelWidth} onWidthChange={handleWidthChange} />
    </Box>
  );
};

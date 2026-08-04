import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DescriptionIcon from '@mui/icons-material/Description';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import TranslateIcon from '@mui/icons-material/Translate';
import { Box, IconButton, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import { leafwriterAtom } from '@src/jotai';
import { useAppState } from '@src/overmind';
import { useAtom } from 'jotai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileMetadataPanel } from './FileMetadataPanel';
import { describePanelNode, panelTrace } from './panelTrace';
import { AttributesPanel } from './tagging/AttributesPanel';
import { CssPanel } from './tagging/CssPanel';
import { HighlighterIcon } from './tagging/HighlighterIcon';
import { RightPanelResizeHandle } from './RightPanelResizeHandle';
import { TranslationTabContent } from './TranslationTabContent';
import {
  RIGHT_PANEL_COLLAPSED_WIDTH,
  RIGHT_PANEL_DEFAULT_WIDTH,
  RIGHT_PANEL_MAX_WIDTH,
  RIGHT_PANEL_MIN_WIDTH,
  RIGHT_PANEL_TRANSLATION_MAX_WIDTH,
  RIGHT_PANEL_WIDTH_STORAGE_KEY,
  SIDEBAR_TAB_BUTTON_SIZE,
  SIDEBAR_TAB_ICON_SIZE,
  TOOLBAR_ROW_HEIGHT,
  preferredTranslationPanelWidth,
} from './sidebarConstants';

type RightTabId =
  | 'fileMetadata'
  | 'attributes'
  | 'css'
  | 'imageViewer'
  | 'validation'
  | 'translation';

const TAB_CONFIG: Record<RightTabId, { label: string; icon: React.ReactNode }> = {
  fileMetadata: {
    label: 'File Metadata',
    icon: <DescriptionIcon sx={{ fontSize: SIDEBAR_TAB_ICON_SIZE }} />,
  },
  attributes: {
    label: 'Attributes',
    icon: <LabelOutlinedIcon sx={{ fontSize: SIDEBAR_TAB_ICON_SIZE }} />,
  },
  css: {
    label: 'CSS',
    icon: <HighlighterIcon sx={{ fontSize: SIDEBAR_TAB_ICON_SIZE }} />,
  },
  imageViewer: {
    label: 'Image Viewer',
    icon: <ImageOutlinedIcon sx={{ fontSize: SIDEBAR_TAB_ICON_SIZE }} />,
  },
  validation: {
    label: 'Validation',
    icon: <CheckCircleOutlineIcon sx={{ fontSize: SIDEBAR_TAB_ICON_SIZE }} />,
  },
  translation: {
    label: 'Translation',
    icon: <TranslateIcon sx={{ fontSize: SIDEBAR_TAB_ICON_SIZE }} />,
  },
};

const TAB_ORDER: RightTabId[] = [
  'fileMetadata',
  'attributes',
  'css',
  'validation',
  'translation',
];

const JQUERY_TABS: RightTabId[] = ['imageViewer', 'validation'];

const clampWidth = (width: number, maxWidth = RIGHT_PANEL_MAX_WIDTH) =>
  Math.min(maxWidth, Math.max(RIGHT_PANEL_MIN_WIDTH, width));

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
  const { rootPath } = useAppState().project;

  // `enableXmlEditing` lives in the embedded editor's own overmind instance,
  // outside this app's state tree — read it off `window.writer` and stay in
  // sync via the change event `setEnableXmlEditing` dispatches.
  const [enableXmlEditing, setEnableXmlEditing] = useState(
    () => window.writer?.overmindState?.editor?.enableXmlEditing ?? true,
  );
  useEffect(() => {
    setEnableXmlEditing(window.writer?.overmindState?.editor?.enableXmlEditing ?? true);
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ value: boolean }>).detail;
      setEnableXmlEditing(detail.value);
    };
    window.addEventListener('leafwriter:enable-xml-editing-change', handler);
    return () => window.removeEventListener('leafwriter:enable-xml-editing-change', handler);
  }, [leafWriter]);
  const visibleTabOrder = useMemo(
    () => TAB_ORDER.filter((tabId) => enableXmlEditing || tabId !== 'validation'),
    [enableXmlEditing],
  );
  const hasProject = Boolean(rootPath);
  const hadProjectRef = useRef(hasProject);

  const [activeTab, setActiveTab] = useState<RightTabId>('fileMetadata');
  const [collapsed, setCollapsed] = useState(!hasProject);
  const [panelWidth, setPanelWidth] = useState(readStoredWidth);
  const collapsedRef = useRef(collapsed);
  const suppressedByDockedReviewRef = useRef(false);
  const restoreExpandedAfterDockedReviewRef = useRef(false);
  // Tab to return to once the auto-opened fileMetadata/validation view is dismissed
  // (panel collapsed, or user navigates away). Set the first time an automatic
  // showTab() call (file load -> fileMetadata, validation errors -> validation)
  // overrides whatever the user had open; cleared once restored or once the user
  // makes a manual tab choice of their own.
  const restoreTabRef = useRef<RightTabId | null>(null);
  /** Width before opening Translation — restored when leaving the tab. */
  const widthBeforeTranslationRef = useRef<number | null>(null);

  collapsedRef.current = collapsed;

  useEffect(() => {
    if (!hasProject) {
      setCollapsed(true);
    } else if (!hadProjectRef.current && leafWriter) {
      // Stay collapsed until the editor exists; expand once content can use it.
      setCollapsed(false);
    }
    hadProjectRef.current = hasProject;
  }, [hasProject, leafWriter]);

  const imageViewerSlotRef = useRef<HTMLDivElement>(null);
  const validationSlotRef = useRef<HTMLDivElement>(null);
  const migratedNodesRef = useRef<{ node: HTMLElement; originalParent: HTMLElement | null }[]>([]);

  const showTab = useCallback((tab: string) => {
    panelTrace('rightPanel: showTab', { tab });
    if (!TAB_ORDER.includes(tab as RightTabId)) return;
    const tabId = tab as RightTabId;
    setActiveTab((current) => {
      if (tabId === 'fileMetadata' && current === 'translation') return current;
      if (
        (tabId === 'fileMetadata' || tabId === 'validation') &&
        tabId !== current &&
        restoreTabRef.current === null &&
        current !== 'fileMetadata' &&
        current !== 'validation'
      ) {
        restoreTabRef.current = current;
      }
      return tabId;
    });
    if (!suppressedByDockedReviewRef.current) setCollapsed(false);
  }, []);

  const expand = useCallback(() => {
    if (suppressedByDockedReviewRef.current) return;
    setCollapsed(false);
  }, []);

  const collapse = useCallback(() => {
    setCollapsed(true);
  }, []);

  // Dismiss a tab if it's the one currently showing (e.g. the validation tab when
  // the tab it was reporting on gets closed), falling back to whatever tab was
  // open before it took over, same as the collapse-button restore.
  const dismissTab = useCallback((tab: string) => {
    setActiveTab((current) => {
      if (current !== tab) return current;
      const fallback = restoreTabRef.current ?? 'fileMetadata';
      restoreTabRef.current = null;
      return fallback;
    });
  }, []);

  useEffect(() => {
    window.__desktopRightPanel = { showTab, expand, collapse, dismissTab };

    if (window.__desktopRightPanelPendingTab) {
      setActiveTab(window.__desktopRightPanelPendingTab);
      if (!suppressedByDockedReviewRef.current) setCollapsed(false);
      delete window.__desktopRightPanelPendingTab;
    }

    return () => {
      delete window.__desktopRightPanel;
    };
  }, [showTab, expand, collapse, dismissTab]);

  // Hide the right panel while a docked review pane is open; restore if it was
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

  // After jQuery east tabs are ready, migrate the jQuery-rendered containers into our slots.
  // Migration must be idempotent (re-attempted on every ready event) and reversible: the
  // jQuery modules render into these nodes by id forever, so if React ever destroys a slot
  // that holds one, the module keeps appending results into a detached node and the panel
  // goes permanently blank. On cleanup we hand the nodes back to their original parent.
  useEffect(() => {
    if (!leafWriter) return;
    panelTrace('rightPanel: migration effect mounted', {
      editorId: window.writer?.editorId ?? null,
    });

    const migrate = (reason: string): boolean => {
      const editorId = window.writer?.editorId;
      if (!editorId) {
        panelTrace('rightPanel: migrate skipped, no editorId', { reason });
        return false;
      }

      const pairs: [RightTabId, HTMLElement | null, HTMLDivElement | null][] = [
        ['imageViewer', document.getElementById(`${editorId}-imageViewer`), imageViewerSlotRef.current],
        ['validation', document.getElementById(`${editorId}-validation`), validationSlotRef.current],
      ];

      let migratedAny = false;
      let foundAll = true;
      for (const [tabId, src, slot] of pairs) {
        if (!src || !slot) {
          foundAll = false;
          panelTrace('rightPanel: migrate missing node', {
            reason,
            tabId,
            editorId,
            srcFound: !!src,
            slotFound: !!slot,
          });
          continue;
        }
        if (slot.contains(src)) continue;
        panelTrace('rightPanel: migrating node', {
          reason,
          tabId,
          src: describePanelNode(src),
        });
        migratedNodesRef.current.push({ node: src, originalParent: src.parentElement });
        // jQuery UI tabs hid this panel (inline display:none + aria-hidden) because it
        // wasn't the active jQuery tab. From here on the React slot controls visibility,
        // so strip jQuery's hiding or the panel stays permanently blank.
        src.style.removeProperty('display');
        src.removeAttribute('aria-hidden');
        slot.appendChild(src);
        panelTrace('rightPanel: node migrated', {
          tabId,
          src: describePanelNode(src),
          slot: describePanelNode(slot),
        });
        migratedAny = true;
      }

      if (migratedAny) {
        // Hide the now-empty east pane (unmanaged by jQuery layout in desktop mode)
        const eastPane = document.querySelector<HTMLElement>('.ui-layout-east');
        if (eastPane) eastPane.style.display = 'none';
      }

      return foundAll;
    };

    let observer: MutationObserver | undefined;
    let fallbackTimeout: number | undefined;
    const stopObserving = () => {
      observer?.disconnect();
      observer = undefined;
      if (fallbackTimeout !== undefined) window.clearTimeout(fallbackTimeout);
      fallbackTimeout = undefined;
    };

    const tryMigrate = (reason: string) => {
      if (migrate(reason)) stopObserving();
    };

    const onEastTabsReady = () => {
      panelTrace('rightPanel: lw:east-tabs-ready received');
      // Give jQuery UI a frame to finish tab initialization before we move nodes
      requestAnimationFrame(() => tryMigrate('east-tabs-ready'));
    };

    window.addEventListener('lw:east-tabs-ready', onEastTabsReady);
    // The event may have fired just before this effect mounted. Observe that narrow
    // timing window instead of rescanning the document on a fixed interval.
    const initialAttempt = requestAnimationFrame(() => {
      if (migrate('initial')) return;
      observer = new MutationObserver(() => tryMigrate('DOM mutation'));
      observer.observe(document.body, { childList: true, subtree: true });
      fallbackTimeout = window.setTimeout(() => {
        panelTrace('rightPanel: migration did not complete within 5 seconds', {
          editorId: window.writer?.editorId ?? null,
          panelNodeIdsInDom: Array.from(
            document.querySelectorAll('[id$="-imageViewer"], [id$="-validation"]'),
            (el) => el.id,
          ),
          eastPane: describePanelNode(document.querySelector<HTMLElement>('.ui-layout-east')),
        });
        stopObserving();
      }, 5000);
    });
    return () => {
      window.removeEventListener('lw:east-tabs-ready', onEastTabsReady);
      cancelAnimationFrame(initialAttempt);
      stopObserving();
      for (const { node, originalParent } of migratedNodesRef.current) {
        if (originalParent?.isConnected) originalParent.appendChild(node);
      }
      migratedNodesRef.current = [];
    };
  }, [leafWriter]);

  useEffect(() => {
    if (activeTab !== 'imageViewer' && activeTab !== 'validation') return;
    const slot =
      activeTab === 'imageViewer' ? imageViewerSlotRef.current : validationSlotRef.current;
    const id = requestAnimationFrame(() => {
      panelTrace('rightPanel: jquery-module tab shown', {
        activeTab,
        collapsed,
        slot: describePanelNode(slot),
        migratedChild: describePanelNode((slot?.firstElementChild as HTMLElement | null) ?? null),
      });
    });
    return () => cancelAnimationFrame(id);
  }, [activeTab, collapsed]);

  const handleWidthChange = useCallback(
    (nextWidth: number) => {
      const maxWidth =
        activeTab === 'translation' ? RIGHT_PANEL_TRANSLATION_MAX_WIDTH : RIGHT_PANEL_MAX_WIDTH;
      const clamped = clampWidth(nextWidth, maxWidth);
      setPanelWidth(clamped);
      // Persist only ordinary tab widths so Translation's wide layout does not
      // stick as the default for Attributes / Metadata.
      if (activeTab !== 'translation') {
        try {
          localStorage.setItem(RIGHT_PANEL_WIDTH_STORAGE_KEY, String(clamped));
        } catch {
          // ignore
        }
      }
    },
    [activeTab],
  );

  // Translation tab: collapse the left explorer and widen this panel for parallel reading.
  useEffect(() => {
    const active = activeTab === 'translation';
    window.dispatchEvent(
      new CustomEvent('desktop:translation-layout', { detail: { active } }),
    );

    if (active) {
      if (widthBeforeTranslationRef.current === null) {
        widthBeforeTranslationRef.current = panelWidth;
      }
      setPanelWidth(preferredTranslationPanelWidth());
      setCollapsed(false);
    } else if (widthBeforeTranslationRef.current !== null) {
      setPanelWidth(widthBeforeTranslationRef.current);
      widthBeforeTranslationRef.current = null;
    }

    return () => {
      if (active) {
        window.dispatchEvent(
          new CustomEvent('desktop:translation-layout', { detail: { active: false } }),
        );
      }
    };
    // panelWidth intentionally omitted — we only snapshot it when entering translation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    const id = requestAnimationFrame(resizeEditor);
    return () => cancelAnimationFrame(id);
  }, [collapsed, panelWidth]);

  if (!leafWriter) return null;

  const panelMaxWidth =
    activeTab === 'translation' ? RIGHT_PANEL_TRANSLATION_MAX_WIDTH : RIGHT_PANEL_MAX_WIDTH;

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
                height: TOOLBAR_ROW_HEIGHT,
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
              onClick={() => {
                if (suppressedByDockedReviewRef.current) return;
                setCollapsed(false);
              }}
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
              // A manual pick breaks any pending auto-view restore chain.
              restoreTabRef.current = null;
              setActiveTab(value);
              if (!suppressedByDockedReviewRef.current && collapsed) setCollapsed(false);
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
          {visibleTabOrder.map((tabId) => (
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
              onClick={() => {
                if (restoreTabRef.current) {
                  setActiveTab(restoreTabRef.current);
                  restoreTabRef.current = null;
                }
                setCollapsed(true);
              }}
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

  // The collapsed state must not unmount the tab content: the imageViewer/validation slots
  // hold migrated jQuery-rendered nodes that cannot be re-created if React destroys them
  // (the modules render into them by id for the lifetime of the editor). So collapse only
  // narrows the panel and hides the content Box.
  return (
    <Box
      sx={{
        width: collapsed ? RIGHT_PANEL_COLLAPSED_WIDTH : panelWidth,
        minWidth: collapsed ? RIGHT_PANEL_COLLAPSED_WIDTH : RIGHT_PANEL_MIN_WIDTH,
        maxWidth: collapsed ? RIGHT_PANEL_COLLAPSED_WIDTH : panelMaxWidth,
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
      {collapsed ? iconTabBar('vertical') : iconTabBar('horizontal')}

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: collapsed ? 'none' : 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={panelSx('fileMetadata')}>
          <FileMetadataPanel visible={activeTab === 'fileMetadata' && !collapsed} />
        </Box>
        <Box sx={panelSx('attributes')}>
          <AttributesPanel visible={activeTab === 'attributes' && !collapsed} />
        </Box>
        <Box sx={panelSx('css')}>
          <CssPanel visible={activeTab === 'css' && !collapsed} />
        </Box>
        <Box sx={panelSx('translation')}>
          <TranslationTabContent active={activeTab === 'translation'} />
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

      {!collapsed && (
        <RightPanelResizeHandle panelWidth={panelWidth} onWidthChange={handleWidthChange} />
      )}
    </Box>
  );
};

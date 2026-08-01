import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DescriptionIcon from '@mui/icons-material/Description';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import { Box } from '@mui/material';
import { leafwriterAtom } from '@src/jotai';
import { isDesktop } from '@src/types/desktop';
import { useAtom } from 'jotai';
import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { AttributesPanel } from './tagging/AttributesPanel';
import { FileMetadataPanel } from './FileMetadataPanel';

const EAST_TAB_ICONS: Record<string, { label: string; icon: ReactNode }> = {
  fileMetadata: { label: 'File metadata', icon: <DescriptionIcon fontSize="inherit" /> },
  attributes: { label: 'Attributes', icon: <LabelOutlinedIcon fontSize="inherit" /> },
  imageViewer: { label: 'Image Viewer', icon: <ImageOutlinedIcon fontSize="inherit" /> },
  validation: { label: 'Validation', icon: <CheckCircleOutlineIcon fontSize="inherit" /> },
};

const EAST_PANELS: Record<string, ComponentType> = {
  fileMetadata: FileMetadataPanel,
  attributes: AttributesPanel,
};

const decorateEastTabIcons = () => {
  const tabItems = document.querySelectorAll('.cwrc-east-icon-tabs > ul > li');
  tabItems.forEach((item) => {
    const tabId = item.id;
    const config = EAST_TAB_ICONS[tabId];
    const anchor = item.querySelector('a');
    if (!config || !anchor) return;
    if (anchor.querySelector('.cwrc-east-tab-icon')) return;

    anchor.setAttribute('title', config.label);
    anchor.setAttribute('aria-label', config.label);
    anchor.textContent = '';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'cwrc-east-tab-icon';
    anchor.appendChild(iconSpan);

    createRoot(iconSpan).render(config.icon);
  });
};

export const DesktopEastPanels = () => {
  const [leafWriter] = useAtom(leafwriterAtom);
  const [panelContainers, setPanelContainers] = useState<Record<string, Element>>({});

  const mountEastPanels = useCallback((editorId?: string): boolean => {
    const id = editorId ?? window.writer?.editorId;
    if (!isDesktop() || !id) return false;

    const next: Record<string, Element> = {};
    for (const moduleId of Object.keys(EAST_PANELS)) {
      const container = document.getElementById(`${id}-${moduleId}`);
      if (container) next[moduleId] = container;
    }

    if (Object.keys(next).length > 0) {
      setPanelContainers((current) => {
        const changed = Object.entries(next).some(([moduleId, container]) =>
          current[moduleId] !== container,
        );
        return changed ? { ...current, ...next } : current;
      });
    }
    return Object.keys(next).length === Object.keys(EAST_PANELS).length;
  }, []);

  useEffect(() => {
    if (!isDesktop() || !leafWriter) {
      setPanelContainers({});
      return;
    }

    let observer: MutationObserver | undefined;
    let fallbackTimeout: number | undefined;
    const stopObserving = () => {
      observer?.disconnect();
      observer = undefined;
      if (fallbackTimeout !== undefined) window.clearTimeout(fallbackTimeout);
      fallbackTimeout = undefined;
    };

    const tryMount = (editorId?: string) => {
      if (mountEastPanels(editorId)) stopObserving();
    };

    const onEastTabsReady = (event: Event) => {
      const detail = (event as CustomEvent<{ editorId: string }>).detail;
      decorateEastTabIcons();
      tryMount(detail?.editorId);
    };

    window.addEventListener('lw:east-tabs-ready', onEastTabsReady);
    decorateEastTabIcons();
    if (!mountEastPanels()) {
      // Normally lw:east-tabs-ready handles this. If React mounts first, watch only
      // until the legacy containers appear instead of polling every 200 ms.
      observer = new MutationObserver(() => tryMount());
      observer.observe(document.body, { childList: true, subtree: true });
      fallbackTimeout = window.setTimeout(stopObserving, 5000);
    }

    return () => {
      window.removeEventListener('lw:east-tabs-ready', onEastTabsReady);
      stopObserving();
    };
  }, [leafWriter, mountEastPanels]);

  if (!isDesktop()) return null;

  return (
    <>
      {Object.entries(EAST_PANELS).map(([moduleId, PanelComponent]) => {
        const container = panelContainers[moduleId];
        if (!container) return null;
        return createPortal(
          <Box sx={{ bgcolor: 'background.paper', height: '100%', minHeight: 0, width: '100%' }}>
            <PanelComponent />
          </Box>,
          container,
          moduleId,
        );
      })}
    </>
  );
};

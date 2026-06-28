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

const waitForElement = (selector: string, timeoutMs = 5000): Promise<Element> =>
  new Promise((resolve, reject) => {
    const started = Date.now();
    const check = () => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Element not found: ${selector}`));
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  });

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

  const mountEastPanels = useCallback(async (editorId?: string) => {
    const id = editorId ?? window.writer?.editorId;
    if (!isDesktop() || !id) return;

    const next: Record<string, Element> = {};
    await Promise.all(
      Object.keys(EAST_PANELS).map(async (moduleId) => {
        try {
          next[moduleId] = await waitForElement(`#${id}-${moduleId}`);
        } catch {
          // Writer layout may not be ready yet.
        }
      }),
    );

    if (Object.keys(next).length > 0) {
      setPanelContainers((current) => ({ ...current, ...next }));
    }
  }, []);

  useEffect(() => {
    if (!isDesktop() || !leafWriter) {
      setPanelContainers({});
      return;
    }

    const onEastTabsReady = (event: Event) => {
      const detail = (event as CustomEvent<{ editorId: string }>).detail;
      decorateEastTabIcons();
      void mountEastPanels(detail?.editorId);
    };

    window.addEventListener('lw:east-tabs-ready', onEastTabsReady);
    decorateEastTabIcons();
    void mountEastPanels();

    const retryId = window.setInterval(() => {
      if (window.writer?.editorId) {
        void mountEastPanels();
        window.clearInterval(retryId);
      }
    }, 200);

    return () => {
      window.removeEventListener('lw:east-tabs-ready', onEastTabsReady);
      window.clearInterval(retryId);
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

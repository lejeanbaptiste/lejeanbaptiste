import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DescriptionIcon from '@mui/icons-material/Description';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import { Box } from '@mui/material';
import { leafwriterAtom } from '@src/jotai';
import { isDesktop } from '@src/types/desktop';
import { useAtom } from 'jotai';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { FileMetadataPanel } from './FileMetadataPanel';

const EAST_TAB_ICONS: Record<string, { label: string; icon: ReactNode }> = {
  fileMetadata: { label: 'File metadata', icon: <DescriptionIcon fontSize="inherit" /> },
  imageViewer: { label: 'Image Viewer', icon: <ImageOutlinedIcon fontSize="inherit" /> },
  validation: { label: 'Validation', icon: <CheckCircleOutlineIcon fontSize="inherit" /> },
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
  const [panelContainer, setPanelContainer] = useState<Element | null>(null);

  const mountFileMetadataPanel = useCallback(async (editorId?: string) => {
    const id = editorId ?? window.writer?.editorId;
    if (!isDesktop() || !id) return;

    try {
      const container = await waitForElement(`#${id}-fileMetadata`);
      setPanelContainer(container);
    } catch {
      // Writer layout may not be ready yet; lw:east-tabs-ready or retry will try again.
    }
  }, []);

  useEffect(() => {
    if (!isDesktop() || !leafWriter) {
      setPanelContainer(null);
      return;
    }

    const onEastTabsReady = (event: Event) => {
      const detail = (event as CustomEvent<{ editorId: string }>).detail;
      decorateEastTabIcons();
      void mountFileMetadataPanel(detail?.editorId);
    };

    window.addEventListener('lw:east-tabs-ready', onEastTabsReady);
    decorateEastTabIcons();
    void mountFileMetadataPanel();

    const retryId = window.setInterval(() => {
      if (window.writer?.editorId) {
        void mountFileMetadataPanel();
        window.clearInterval(retryId);
      }
    }, 200);

    return () => {
      window.removeEventListener('lw:east-tabs-ready', onEastTabsReady);
      window.clearInterval(retryId);
    };
  }, [leafWriter, mountFileMetadataPanel]);

  if (!isDesktop() || !panelContainer) return null;

  return createPortal(
    <Box sx={{ bgcolor: 'background.paper', height: '100%', minHeight: 0, width: '100%' }}>
      <FileMetadataPanel />
    </Box>,
    panelContainer,
  );
};

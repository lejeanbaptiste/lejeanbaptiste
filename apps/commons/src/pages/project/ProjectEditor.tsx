import { Box, Typography } from '@mui/material';
import {
  TagCommandProvider,
  CorrectionProvider,
  UnifiedLeftPanel,
  UnifiedRightPanel,
  useExternalFileWatcher,
  useProjectMenu,
  registerApplicationSettingsBootstrap,
} from '@src/desktop';
import { TOOLBAR_ROW_HEIGHT } from '@src/desktop/sidebarConstants';
import { AboutDialog } from '@src/desktop/AboutDialog';
import { TimeMachineDialog } from '@src/desktop/TimeMachineDialog';
import { openFindPanel, DESKTOP_OPEN_FIND_EVENT } from '@src/desktop/desktopLeftPanelBridge';
import { openNativeSchemaPicker } from '@src/desktop/openNativeSchemaPicker';
import { useLeafWriter } from '@src/hooks';
import { leafwriterAtom, leafWriterSessionKeyAtom } from '@src/jotai';
import { useActions, useAppState } from '@src/overmind';
import { isDesktop } from '@src/types/desktop';
import { useAtom } from 'jotai';
import { useEffect, useRef } from 'react';

export const ProjectEditor = () => {
  const { contentHasChanged, readonly, resource } = useAppState().editor;
  const { cursorPositions, isProjectReady, projectFilePath } = useAppState().project;
  const { markTabDirty } = useActions().project;

  const divEl = useRef<HTMLDivElement>(null);
  const previousTabRef = useRef<string | null>(null);
  const initStartedForRef = useRef<string | null>(null);
  const loadLibStartedForRef = useRef<number | null>(null);

  const { initLeafWriter, loadDocumentInWriter, loadLib, ensureLeafWriterReadyForSettings } =
    useLeafWriter();
  const { aboutOpen, onKeydownHandle, setAboutOpen, setTimeMachineOpen, timeMachineOpen } =
    useProjectMenu();
  const [leafWriter] = useAtom(leafwriterAtom);
  const [sessionKey] = useAtom(leafWriterSessionKeyAtom);
  useExternalFileWatcher();

  useEffect(() => {
    if (!isDesktop()) return;

    window.__ljbOpenNativeSchemaPicker = openNativeSchemaPicker;
    return () => {
      delete window.__ljbOpenNativeSchemaPicker;
    };
  }, []);

  useEffect(() => {
    if (!isDesktop() || !resource?.content) return;
    window.__desktopStoredDocumentXml = resource.content;
  }, [resource?.content]);

  useEffect(() => {
    window.addEventListener('keydown', onKeydownHandle, true);
    return () => {
      window.removeEventListener('keydown', onKeydownHandle, true);
    };
  }, [onKeydownHandle]);

  useEffect(() => {
    if (!isDesktop()) return;

    const onOpenFind = () => openFindPanel();
    window.addEventListener(DESKTOP_OPEN_FIND_EVENT, onOpenFind);
    return () => window.removeEventListener(DESKTOP_OPEN_FIND_EVENT, onOpenFind);
  }, []);

  useEffect(() => {
    if (loadLibStartedForRef.current !== sessionKey) {
      loadLibStartedForRef.current = null;
      initStartedForRef.current = null;
    }
  }, [sessionKey]);

  useEffect(() => {
    registerApplicationSettingsBootstrap(ensureLeafWriterReadyForSettings);
    return () => registerApplicationSettingsBootstrap(async () => false);
  }, [ensureLeafWriterReadyForSettings]);

  useEffect(() => {
    if (divEl.current && isProjectReady && !leafWriter && loadLibStartedForRef.current !== sessionKey) {
      loadLibStartedForRef.current = sessionKey;
      divEl.current.style.height = '100%';
      void loadLib(divEl.current);
    }
  }, [isProjectReady, leafWriter, loadLib, sessionKey]);

  useEffect(() => {
    if (!leafWriter) {
      previousTabRef.current = null;
      initStartedForRef.current = null;
    }
  }, [leafWriter]);

  useEffect(() => {
    initStartedForRef.current = null;
    previousTabRef.current = null;
  }, [projectFilePath]);

  useEffect(() => {
    if (!resource?.filePath) {
      previousTabRef.current = null;
      return;
    }

    if (!leafWriter || !resource?.content) return;

    if (!window.writer) {
      if (initStartedForRef.current === leafWriter.id) return;
      initStartedForRef.current = leafWriter.id;
      void initLeafWriter();
      previousTabRef.current = resource.filePath;
      return;
    }

    if (previousTabRef.current !== resource.filePath) {
      void loadDocumentInWriter(
        resource.filePath,
        resource.content,
        cursorPositions[resource.filePath] ?? null,
      );
    }

    previousTabRef.current = resource.filePath;
  }, [
    cursorPositions,
    resource?.filePath,
    leafWriter,
    resource?.content,
    initLeafWriter,
    loadDocumentInWriter,
  ]);

  useEffect(() => {
    leafWriter?.setContentHasChanged(contentHasChanged);
  }, [contentHasChanged, leafWriter]);

  useEffect(() => {
    leafWriter?.setReadonly(readonly);
  }, [readonly, leafWriter]);

  useEffect(() => {
    markTabDirty(contentHasChanged);
  }, [contentHasChanged, markTabDirty]);

  // Safety net: when a docked review closes, collapse its mount even if the
  // portaled pane missed a layout effect (race on fast close / tab switch).
  useEffect(() => {
    if (!isDesktop()) return;

    const collapseMount = (id: string) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.display = 'none';
      el.style.width = '0';
      el.style.minWidth = '0';
      el.style.maxWidth = '0';
      el.style.flex = '0 0 0px';
    };

    const relayout = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.writer?.layoutManager?.resizeAll?.();
          window.writer?.layoutManager?.resizeEditor?.();
        });
      });
    };

    const onAutoTagClose = () => {
      collapseMount('desktop-panel-auto-tagging');
      relayout();
    };
    const onDisambigClose = () => {
      collapseMount('desktop-panel-disambiguation');
      relayout();
    };

    window.addEventListener('desktop:auto-tagging-review-close', onAutoTagClose);
    window.addEventListener('desktop:disambiguation-review-close', onDisambigClose);
    return () => {
      window.removeEventListener('desktop:auto-tagging-review-close', onAutoTagClose);
      window.removeEventListener('desktop:disambiguation-review-close', onDisambigClose);
    };
  }, []);

  return (
    <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <AboutDialog onClose={() => setAboutOpen(false)} open={aboutOpen} />
      <TimeMachineDialog onClose={() => setTimeMachineOpen(false)} open={timeMachineOpen} />
      <TagCommandProvider />
      <CorrectionProvider />
      <UnifiedLeftPanel />
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <Box
          id="desktop-toolbar-row"
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            height: TOOLBAR_ROW_HEIGHT,
            overflow: 'hidden',
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        />
        <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
          {!resource && (
            <Box
              sx={{
                alignItems: 'center',
                bgcolor: 'background.default',
                display: 'flex',
                height: '100%',
                justifyContent: 'center',
                inset: 0,
                position: 'absolute',
                zIndex: 1,
              }}
            >
              <Typography color="text.secondary" variant="body1">
                Open a folder and select an XML file to begin editing.
              </Typography>
            </Box>
          )}
          <Box
            key={sessionKey}
            ref={divEl}
            id="leaf-writer-container"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              minHeight: 0,
              width: '100%',
              visibility: resource ? 'visible' : 'hidden',
            }}
          />
        </Box>
      </Box>
      {/* Mount point for the auto-tagging review panel (portaled from LEAF-Writer App). */}
      <Box
        id="desktop-panel-auto-tagging"
        sx={{ flexShrink: 0, height: '100%', overflow: 'hidden', width: 0, minWidth: 0, display: 'none' }}
      />
      <Box
        id="desktop-panel-disambiguation"
        sx={{ flexShrink: 0, height: '100%', overflow: 'hidden', width: 0, minWidth: 0, display: 'none' }}
      />
      <UnifiedRightPanel />
    </Box>
  );
};

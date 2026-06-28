import { Box, Typography } from '@mui/material';
import { DocumentTabBar, DesktopEastPanels, UnifiedLeftPanel, useExternalFileWatcher, useProjectMenu } from '@src/desktop';
import { AboutDialog } from '@src/desktop/AboutDialog';
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
  const { projectFilePath } = useAppState().project;
  const { markTabDirty } = useActions().project;

  const divEl = useRef<HTMLDivElement>(null);
  const previousTabRef = useRef<string | null>(null);
  const initStartedForRef = useRef<string | null>(null);
  const loadLibStartedForRef = useRef<number | null>(null);

  const { initLeafWriter, loadDocumentInWriter, loadLib } = useLeafWriter();
  const { aboutOpen, onKeydownHandle, setAboutOpen } = useProjectMenu();
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
    if (divEl.current && resource && !leafWriter && loadLibStartedForRef.current !== sessionKey) {
      loadLibStartedForRef.current = sessionKey;
      divEl.current.style.height = '100%';
      void loadLib(divEl.current);
    }
  }, [resource, leafWriter, loadLib, sessionKey]);

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
      void loadDocumentInWriter(resource.filePath, resource.content);
    }

    previousTabRef.current = resource.filePath;
  }, [resource?.filePath, leafWriter, resource?.content, initLeafWriter, loadDocumentInWriter]);

  useEffect(() => {
    leafWriter?.setContentHasChanged(contentHasChanged);
  }, [contentHasChanged, leafWriter]);

  useEffect(() => {
    leafWriter?.setReadonly(readonly);
  }, [readonly, leafWriter]);

  useEffect(() => {
    markTabDirty(contentHasChanged);
  }, [contentHasChanged, markTabDirty]);

  return (
    <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <AboutDialog onClose={() => setAboutOpen(false)} open={aboutOpen} />
      <UnifiedLeftPanel />
      <DesktopEastPanels />
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        <DocumentTabBar />
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
    </Box>
  );
};

import { Box, Button, Typography } from '@mui/material';
import WestIcon from '@mui/icons-material/West';
import {
  TagCommandProvider,
  CorrectionProvider,
  UnifiedLeftPanel,
  UnifiedRightPanel,
  useExternalFileWatcher,
  usePluginBootstrap,
  useProjectMenu,
  registerApplicationSettingsBootstrap,
} from '@src/desktop';
import { DatabaseWindow } from '@src/desktop/databaseWindow';
import {
  LEFT_PANEL_COLLAPSED_WIDTH,
  SIDEBAR_TAB_BUTTON_SIZE,
  TOOLBAR_ROW_HEIGHT,
} from '@src/desktop/sidebarConstants';
import { AboutDialog } from '@src/desktop/AboutDialog';
import { TimeMachineDialog } from '@src/desktop/TimeMachineDialog';
import { UserNamePromptDialog } from '@src/desktop/UserNamePromptDialog';
import { openFindPanel, DESKTOP_OPEN_FIND_EVENT } from '@src/desktop/desktopLeftPanelBridge';
import { openNativeSchemaPicker } from '@src/desktop/openNativeSchemaPicker';
import { resetDesktopEditorSession } from '@src/desktop/clearWriterSession';
import { isWriterReady, useLeafWriter, waitForWriter } from '@src/hooks';
import { leafwriterAtom, leafWriterSessionKeyAtom } from '@src/jotai';
import { useActions, useAppState } from '@src/overmind';
import { isDesktop } from '@src/types/desktop';
import { modShortcut } from '@src/utils/platform';
import { useAtom } from 'jotai';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Vertical center of the sidebar's folder/explorer icon in its collapsed
// strip (see SidebarIconTabBar.tsx): 2px top padding (theme spacing 0.25) +
// the collapse chevron button (SIDEBAR_TAB_BUTTON_SIZE) + 1px grouped-button
// margin (theme spacing 0.125), then half the folder button's own height.
// Computed against the sidebar strip's own top edge (y=0 of the shared row
// container both it and this callout sit in) rather than guessed from the
// content column, which has an extra toolbar row above it that the sidebar
// doesn't.
const OPEN_FOLDER_CALLOUT_TOP = 2 + SIDEBAR_TAB_BUTTON_SIZE + 1 + SIDEBAR_TAB_BUTTON_SIZE / 2;

export const ProjectEditor = () => {
  const { contentHasChanged, readonly, resource } = useAppState().editor;
  const { cursorPositions, isProjectReady, openTabs, projectFilePath, rootPath } =
    useAppState().project;
  const { desktopWindowMode } = useAppState().ui;
  const { markTabDirty, openProject } = useActions().project;
  const { notifyViaSnackbar, openDialog } = useActions().ui;
  const { t } = useTranslation();
  const hasProject = Boolean(rootPath);

  const divEl = useRef<HTMLDivElement>(null);
  const previousTabRef = useRef<string | null>(null);
  const initStartedForRef = useRef<string | null>(null);
  const loadLibStartedForRef = useRef<number | null>(null);
  const loadGenerationRef = useRef(0);
  const [editorLoadFailed, setEditorLoadFailed] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  const { initLeafWriter, loadDocumentInWriter, loadLib, ensureLeafWriterReadyForSettings } =
    useLeafWriter();
  const { aboutOpen, onKeydownHandle, setAboutOpen, setTimeMachineOpen, timeMachineOpen } =
    useProjectMenu();
  const [leafWriter] = useAtom(leafwriterAtom);
  const [sessionKey] = useAtom(leafWriterSessionKeyAtom);
  useExternalFileWatcher();
  const showPluginPrompt = useCallback(
    (prompt: { message: string }) => {
      openDialog({
        type: 'simple',
        props: {
          title: t('LWC.commons.plugins_available_title'),
          Body: `${t('LWC.commons.plugins_available_message')}\n\n${prompt.message}`,
          severity: 'info',
          actions: [
            {
              action: 'open-plugins',
              label: t('LWC.commons.open_plugins'),
              variant: 'contained',
            },
            { action: 'later', label: t('LWC.commons.not_now') },
          ],
          onClose: (action) => {
            if (action === 'open-plugins') {
              window.writer?.overmindActions?.ui?.openDialog?.({
                type: 'plugins',
                props: { id: 'plugins' },
              });
            }
          },
        },
      });
    },
    [openDialog, t],
  );
  usePluginBootstrap(undefined, showPluginPrompt);

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

  const markEditorLoadFailed = useCallback(() => {
    setEditorLoadFailed(true);
    notifyViaSnackbar({
      message: t('LWC.desktop.project.messages.editor_failed_to_load'),
      options: { variant: 'error', persist: true },
    });
  }, [notifyViaSnackbar, t]);

  const retryEditorLoad = useCallback(() => {
    setEditorLoadFailed(false);
    loadLibStartedForRef.current = null;
    initStartedForRef.current = null;
    previousTabRef.current = null;
    // Half-booted writer (object exists, TinyMCE never finished) needs a full
    // remount; a plain retry would call init again with the same URL and skip setup.
    if (window.writer && !isWriterReady()) {
      resetDesktopEditorSession();
    }
    setRetryToken((token) => token + 1);
  }, []);

  useEffect(() => {
    // Project restoration first reads and normalizes every remembered tab.  Do
    // not compete with that work by importing and initializing TinyMCE as soon
    // as the project shell exists: the editor cannot display anything until an
    // active resource has arrived, and overlapping the two has left slow
    // startup runs with a half-initialized editor.  Waiting for the prepared
    // active document makes the hand-off deterministic.
    if (
      divEl.current &&
      isProjectReady &&
      resource?.filePath &&
      resource.content &&
      !leafWriter &&
      loadLibStartedForRef.current !== sessionKey
    ) {
      const container = divEl.current;
      loadLibStartedForRef.current = sessionKey;
      container.style.height = '100%';
      void (async () => {
        const ok = await loadLib(container);
        if (!ok) {
          loadLibStartedForRef.current = null;
          markEditorLoadFailed();
        }
      })();
    }
  }, [
    isProjectReady,
    leafWriter,
    loadLib,
    markEditorLoadFailed,
    resource?.content,
    resource?.filePath,
    retryToken,
    sessionKey,
  ]);

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

    if (!leafWriter || !resource.content) return;

    let cancelled = false;

    const syncEditorToActiveTab = async () => {
      const targetPath = resource.filePath!;
      const targetContent = resource.content!;
      const generation = ++loadGenerationRef.current;

      const shouldApply = () => !cancelled && loadGenerationRef.current === generation;

      if (!isWriterReady()) {
        if (initStartedForRef.current !== leafWriter.id) {
          initStartedForRef.current = leafWriter.id;
          const ready = await initLeafWriter({
            filePath: targetPath,
            content: targetContent,
            shouldApply,
          });
          if (!shouldApply()) return;
          if (!ready) {
            initStartedForRef.current = null;
            markEditorLoadFailed();
            return;
          }
        } else {
          const ready = await waitForWriter();
          if (!shouldApply()) return;
          if (!ready) {
            initStartedForRef.current = null;
            markEditorLoadFailed();
            return;
          }
        }
      }

      if (!shouldApply() || !isWriterReady()) return;
      if (previousTabRef.current === targetPath) return;

      const restoreDirty = openTabs.find((tab) => tab.filePath === targetPath)?.dirty ?? false;
      const loaded = await loadDocumentInWriter(
        targetPath,
        targetContent,
        cursorPositions[targetPath] ?? null,
        restoreDirty,
        shouldApply,
      );
      if (shouldApply() && loaded) {
        previousTabRef.current = targetPath;
        setEditorLoadFailed(false);
      } else if (shouldApply() && !loaded) {
        markEditorLoadFailed();
      }
    };

    void syncEditorToActiveTab();

    return () => {
      cancelled = true;
    };
  }, [
    cursorPositions,
    resource?.filePath,
    resource?.content,
    leafWriter,
    initLeafWriter,
    loadDocumentInWriter,
    markEditorLoadFailed,
    openTabs,
    retryToken,
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
    <Box sx={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
      <AboutDialog onClose={() => setAboutOpen(false)} open={aboutOpen} />
      <TimeMachineDialog onClose={() => setTimeMachineOpen(false)} open={timeMachineOpen} />
      <UserNamePromptDialog />
      <TagCommandProvider />
      <CorrectionProvider />
      {desktopWindowMode === 'database' && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            display: 'flex',
            bgcolor: 'background.default',
          }}
        >
          <DatabaseWindow />
        </Box>
      )}
      <Box
        sx={{
          display: desktopWindowMode === 'database' ? 'none' : 'flex',
          flex: 1,
          minHeight: 0,
          width: '100%',
          position: 'relative',
        }}
      >
      <UnifiedLeftPanel />
      {!resource && !hasProject && (
        // A floating callout rather than a plain inline hint, so it visually
        // reads as "click the folder icon over there". Positioned against
        // this component's own top-level row (the shared ancestor whose top
        // edge the sidebar's icon strip and this callout both start from),
        // not the content column below — that column has an extra 35px
        // toolbar row above it that the sidebar doesn't, which would throw
        // off any offset measured from inside it.
        <Box
          component="button"
          type="button"
          onClick={() => void openProject()}
          sx={{
            alignItems: 'center',
            bgcolor: 'success.main',
            border: 'none',
            borderRadius: 5,
            boxShadow: 3,
            color: 'success.contrastText',
            cursor: 'pointer',
            display: 'inline-flex',
            font: 'inherit',
            gap: 1,
            left: LEFT_PANEL_COLLAPSED_WIDTH + 8,
            m: 0,
            position: 'absolute',
            px: 2,
            py: 1,
            top: OPEN_FOLDER_CALLOUT_TOP,
            transform: 'translateY(-50%)',
            zIndex: 2,
            '&:hover': { bgcolor: 'success.dark' },
          }}
        >
          <WestIcon sx={{ fontSize: 20 }} aria-hidden />
          <Typography color="inherit" variant="body1">
            {t('LWC.desktop.explorer.open_folder_editor_hint', { shortcut: modShortcut('O') })}
          </Typography>
        </Box>
      )}
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
                inset: 0,
                justifyContent: 'center',
                position: 'absolute',
                zIndex: 1,
              }}
            >
              {hasProject && (
                <Typography color="text.secondary" variant="body1">
                  {t('LWC.desktop.project.no_file_open', { shortcut: modShortcut('N') })}
                </Typography>
              )}
            </Box>
          )}
          {editorLoadFailed && resource && (
            <Box
              sx={{
                alignItems: 'center',
                bgcolor: 'background.default',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                height: '100%',
                inset: 0,
                justifyContent: 'center',
                position: 'absolute',
                zIndex: 2,
              }}
            >
              <Typography color="text.secondary" variant="body1">
                {t('LWC.desktop.project.messages.editor_failed_to_load')}
              </Typography>
              <Button onClick={retryEditorLoad} variant="contained">
                {t('LWC.commons.retry')}
              </Button>
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
        sx={{
          flexShrink: 0,
          height: '100%',
          overflow: 'hidden',
          width: 0,
          minWidth: 0,
          display: 'none',
        }}
      />
      <Box
        id="desktop-panel-disambiguation"
        sx={{
          flexShrink: 0,
          height: '100%',
          overflow: 'hidden',
          width: 0,
          minWidth: 0,
          display: 'none',
        }}
      />
      <UnifiedRightPanel />
      </Box>
    </Box>
  );
};

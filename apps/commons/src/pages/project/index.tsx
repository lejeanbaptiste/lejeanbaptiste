import { Box, CircularProgress } from '@mui/material';
import { useCommonsUiBridge, useEntityDatabaseLifecycle, useLspProjectBridge, useNativeDialogBridge } from '@src/desktop';
import { Page } from '@src/layouts';
import { useActions, useAppState } from '@src/overmind';
import { isDesktop } from '@src/types/desktop';
import { useEffect } from 'react';
import { ProjectEditor } from './ProjectEditor';

export const ProjectEditPage = () => {
  const { setPage } = useActions().ui;
  const { restoreLastProject, saveWorkspaceSession } = useActions().project;
  const { activeTabPath, isProjectReady, openTabs, projectFilePath } = useAppState().project;

  useNativeDialogBridge();
  useCommonsUiBridge();
  useLspProjectBridge();
  useEntityDatabaseLifecycle();

  useEffect(() => {
    setPage('project');
  }, [setPage]);

  useEffect(() => {
    if (!isDesktop()) return;
    void restoreLastProject();
  }, [restoreLastProject]);

  useEffect(() => {
    if (!isDesktop() || !isProjectReady || !projectFilePath) return;

    void saveWorkspaceSession();

    return () => {
      void saveWorkspaceSession();
    };
  }, [activeTabPath, isProjectReady, openTabs, projectFilePath, saveWorkspaceSession]);

  useEffect(() => {
    if (!isDesktop() || !isProjectReady) return;

    const flush = () => {
      void saveWorkspaceSession();
    };

    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);

    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, [isProjectReady, saveWorkspaceSession]);

  if (isDesktop() && !isProjectReady) {
    return (
      <Page>
        <Box
          sx={{
            alignItems: 'center',
            display: 'flex',
            height: 'calc(100vh - var(--titlebar-height, 0px))',
            justifyContent: 'center',
          }}
        >
          <CircularProgress size={32} />
        </Box>
      </Page>
    );
  }

  return (
    <Page>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--titlebar-height, 0px))' }}>
        <ProjectEditor />
      </Box>
    </Page>
  );
};

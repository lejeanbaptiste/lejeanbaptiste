import { Box, CircularProgress } from '@mui/material';
import { Page } from '@src/layouts';
import { useActions, useAppState } from '@src/overmind';
import { isDesktop } from '@src/types/desktop';
import { useEffect } from 'react';
import { ProjectEditor } from './ProjectEditor';

export const ProjectEditPage = () => {
  const { setPage } = useActions().ui;
  const { restoreLastProject } = useActions().project;
  const { isProjectReady } = useAppState().project;

  useEffect(() => {
    setPage('project');
  }, [setPage]);

  useEffect(() => {
    if (!isDesktop()) return;
    void restoreLastProject();
  }, [restoreLastProject]);

  if (isDesktop() && !isProjectReady) {
    return (
      <Page>
        <Box
          sx={{
            alignItems: 'center',
            display: 'flex',
            height: '100vh',
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
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <ProjectEditor />
      </Box>
    </Page>
  );
};

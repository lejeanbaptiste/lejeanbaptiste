import { AppBar, Box, Toolbar, Typography } from '@mui/material';
import { Page } from '@src/layouts';
import { useActions } from '@src/overmind';
import { useEffect } from 'react';
import { ProjectEditor } from './ProjectEditor';

export const ProjectEditPage = () => {
  const { setPage } = useActions().ui;

  useEffect(() => {
    setPage('project');
  }, [setPage]);

  return (
    <Page title="CRCAO Editor">
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <AppBar position="static" color="default" elevation={1}>
          <Toolbar variant="dense">
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              CRCAO Editor
            </Typography>
          </Toolbar>
        </AppBar>
        <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <ProjectEditor />
        </Box>
      </Box>
    </Page>
  );
};

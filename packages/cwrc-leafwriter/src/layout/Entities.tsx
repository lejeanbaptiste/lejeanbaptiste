import { Box, Paper } from '@mui/material';
import { useEffect, useRef } from 'react';
import EntitiesList from '../js/layout/panels/entitiesList';

const containerID = 'entities-panel';

export const Entities = () => {
  const writer = window.writer;

  // const entityList = useRef<EntitiesList>(null)

  useEffect(() => {
    const list = new EntitiesList({ writer, parentId: containerID });
  }, []);

  return (
    <Paper
      elevation={5}
      square
      sx={{
        overflow: 'auto',
        height: '100%',
        p: 1,
        bgcolor: ({ palette }) => (palette.mode === 'dark' ? palette.background.paper : '#f5f5f5'),
      }}
    >
      <Box id={containerID}>This is a test</Box>
    </Paper>
  );
};

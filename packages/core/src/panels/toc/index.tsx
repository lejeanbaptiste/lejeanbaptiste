import { Paper } from '@mui/material';
import React from 'react';
import { Tree } from './tree';

export const Toc = () => {
  return (
    <Paper
      id="toc"
      elevation={5}
      square
      sx={{
        overflow: 'auto',
        height: '100%',
        p: 1,
        bgcolor: ({ palette }) => (palette.mode === 'dark' ? palette.background.paper : '#f5f5f5'),
      }}
    >
      <Tree />
    </Paper>
  );
};

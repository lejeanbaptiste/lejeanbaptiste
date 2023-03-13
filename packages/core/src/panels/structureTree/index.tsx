import { Paper } from '@mui/material';
import { Provider } from 'jotai';
import React from 'react';
import { TreeView } from './treeView';

export const StructureTree = () => {
  return (
    <Paper
      id="structure-view"
      elevation={5}
      square
      sx={{
        overflow: 'auto',
        height: '100%',
        p: 1,
        bgcolor: ({ palette }) => (palette.mode === 'dark' ? palette.background.paper : '#f5f5f5'),
      }}
    >
      <Provider>
        <TreeView />
      </Provider>
    </Paper>
  );
};

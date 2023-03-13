import PanoramaVerticalSelectIcon from '@mui/icons-material/PanoramaVerticalSelect';
import { Box } from '@mui/material';
import React from 'react';
import { PanelResizeHandle } from 'react-resizable-panels';

export const ResizeHandle = () => (
  <PanelResizeHandle
    style={{
      flex: '0 0 1.5em',
      position: 'relative',
      outline: 'none',
      backgroundColor: 'transparent',
    }}
  >
    <Box
      sx={{
        position: 'absolute',
        top: '0.25em',
        bottom: '0.25em',
        left: '0.5em',
        right: '0.5em',
        borderRadius: '0.25em',
        bgcolor: 'red',
        transition: 'background-color 0.2s linear',
      }}
    >
    </Box>
  </PanelResizeHandle>
);

import { Box } from '@mui/material';
import { useDialog, useNotifier } from '@src/hooks';
import React, { type FC } from 'react';
import { Outlet } from 'react-router-dom';

export const BasicLayout: FC = () => {
  useDialog();
  useNotifier();

  return (
    <Box sx={{ display: 'flex', width: '100%', backgroundColor: 'background.default' }}>
      <Box sx={{ flex: '1 1 auto' }}>
        <Outlet />
      </Box>
    </Box>
  );
};

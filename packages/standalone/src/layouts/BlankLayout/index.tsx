import { Box } from '@mui/material';
import React, { FC } from 'react';
import { Outlet } from 'react-router-dom';

const BlankLayout: FC = () => (
  <Box
    sx={{
      display: 'flex',
      width: '100%',
      backgroundColor: 'background.default',
    }}
  >
    <Box sx={{ flex: '1 1 auto' }}>
      <Outlet />
    </Box>
  </Box>
);

export default BlankLayout;

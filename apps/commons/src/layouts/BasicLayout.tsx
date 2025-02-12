import { Box } from '@mui/material';
import { useDialog, useNotifier } from '@src/hooks';
import { Outlet } from 'react-router';

export const BasicLayout = () => {
  useDialog();
  useNotifier();

  return (
    <Box sx={{ display: 'flex', width: '100%', bgcolor: 'background.default' }}>
      <Box sx={{ flex: '1 1 auto' }}>
        <Outlet />
      </Box>
    </Box>
  );
};

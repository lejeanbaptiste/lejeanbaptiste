import { Box, CircularProgress } from '@mui/material';

export const Loader = () => (
  <Box display="flex" height={600} width="100%" alignItems="center" justifyContent="center">
    <CircularProgress sx={{ width: '100%' }} />
  </Box>
);

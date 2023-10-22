import { Box, Skeleton, Stack, Typography } from '@mui/material';

const Loader = () => (
  <Box p={4}>
    <Stack direction="row" justifyContent="space-between">
      <Stack spacing={1} gap={1}>
        {[1, 2, 3, 4, 5].map((s) => (
          <Box key={s} width={350}>
            <Typography variant="h5">
              <Skeleton />
            </Typography>
            <Typography variant="body2">
              <Skeleton />
            </Typography>
          </Box>
        ))}
      </Stack>
      <Stack spacing={1} gap={0}>
        {[1, 2, 3].map((s) => (
          <Box key={s} width={100}>
            <Typography variant="h6" sx={{ height: 24 }}>
              <Skeleton />
            </Typography>
          </Box>
        ))}
      </Stack>
    </Stack>
  </Box>
);

export default Loader;

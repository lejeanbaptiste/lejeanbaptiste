import { Box, Skeleton as MuiSkeleton, Stack, Typography } from '@mui/material';
import React from 'react';

interface ItemsSkeletonProps {
  skeletonCount?: number;
}

export const Skeleton = ({ skeletonCount = 5 }: ItemsSkeletonProps) => {
  if (skeletonCount < 1) skeletonCount = 1;
  const skeletons = Array(skeletonCount).fill(0, 0);

  return (
    <Stack spacing={1}>
      {skeletons.map((_skeleton, index) => (
        <Box key={index} px={1} height={32}>
          <Typography variant="body1">
            <MuiSkeleton animation="wave" width="65%" />
          </Typography>
        </Box>
      ))}
    </Stack>
  );
};

import { Box, Skeleton, Stack, Typography } from '@mui/material';
import React from 'react';

interface ItemsSkeletonProps {
  skeletonCount?: number;
}

export const ItemsSkeleton = ({ skeletonCount = 5 }: ItemsSkeletonProps) => {
  if (skeletonCount < 1) skeletonCount = 1;
  const skeletons = Array(skeletonCount).fill(0, 0);

  return (
    <Stack spacing={1}>
      {skeletons.map((_skeleton, index) => (
        <Box key={index} px={1}>
          <Typography variant="body1">
            <Skeleton animation="wave" width="65%" />
          </Typography>
          <Typography variant="caption">
            <Skeleton animation="wave" width="85%" />
          </Typography>
        </Box>
      ))}
    </Stack>
  );
};

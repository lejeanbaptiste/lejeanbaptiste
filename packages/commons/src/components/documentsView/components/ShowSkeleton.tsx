import { Skeleton, Stack } from '@mui/material';
import { motion } from 'framer-motion';
import React, { type FC } from 'react';
import type { DisplayLayout } from '..';

interface ShowSkeletonProps {
  displayLayout?: DisplayLayout;
  items?: number;
  width?: number;
}

export const ShowSkeleton = ({ displayLayout = 'list', items = 2, width = 250 }: ShowSkeletonProps) => {
  const _width = displayLayout === 'grid' ? 250 : width - 32;
  const _height = displayLayout === 'grid' ? 180 : 32;

  const skeletons = Array(items).fill(0);

  return (
    <Stack
      direction={displayLayout === 'grid' ? 'row' : 'column'}
      flexWrap={displayLayout === 'grid' ? 'wrap' : 'nowrap'}
      justifyContent={displayLayout === 'grid' ? 'center' : 'flex-start'}
      mx={2}
      my={2}
      gap={1.5}
    >
      {skeletons.map((_i, index) => (
        <Skeleton
          key={index}
          variant="rounded"
          width={_width}
          height={_height}
          component={motion.div}
          layout
          transition={{ delay: index / 20 }}
        />
      ))}
    </Stack>
  );
};

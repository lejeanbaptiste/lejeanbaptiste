import { Skeleton, Stack } from '@mui/material';
import { motion } from 'motion/react';
import type { Layout } from '..';

interface ShowSkeletonProps {
  items?: number;
  layout?: Layout;
  width?: number;
}

export const ShowSkeleton = ({ items = 2, layout = 'list', width = 250 }: ShowSkeletonProps) => {
  const _width = layout === 'grid' ? 250 : width - 32;
  const _height = layout === 'grid' ? 180 : 32;

  const skeletons = Array(items).fill(0);

  return (
    <Stack
      direction={layout === 'grid' ? 'row' : 'column'}
      flexWrap={layout === 'grid' ? 'wrap' : 'nowrap'}
      justifyContent={layout === 'grid' ? 'center' : 'flex-start'}
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

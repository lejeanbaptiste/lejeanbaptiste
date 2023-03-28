import { Box } from '@mui/material';
import type { ViewProps } from '@src/types';
import { motion, type AnimationControls, type Variants } from 'framer-motion';
import React from 'react';
import { DisplayLayout } from '..';
import { RecentView } from '../RecentView';
import { SamplesView } from '../SamplesView';
import { TemplatesView } from '../TemplatesView';
import { ShowSkeleton } from './ShowSkeleton';

interface ContainerProps {
  animationControl?: AnimationControls;
  displayLayout: DisplayLayout;
  height: number;
  type?: ViewProps;
  width: number;
}

export const Container = ({
  animationControl,
  displayLayout,
  height = 250,
  type = undefined,
  width,
}: ContainerProps) => {
  const collectionVariants: Variants = {
    show: { x: 0, opacity: 1 },
    hide: { x: -width, opacity: 0 },
  };

  return (
    <Box height={height} overflow="auto">
      <Box component={motion.div} animate={animationControl} variants={collectionVariants}>
        {!type ? (
          <ShowSkeleton displayLayout={displayLayout} width={width} />
        ) : type.value === 'recent' ? (
          <RecentView displayLayout={displayLayout} width={width} />
        ) : type.value === 'samples' ? (
          <SamplesView displayLayout={displayLayout} width={width} />
        ) : (
          <TemplatesView displayLayout={displayLayout} width={width} />
        )}
      </Box>
    </Box>
  );
};

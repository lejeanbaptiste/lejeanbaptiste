import { Box } from '@mui/material';
import type { ViewType } from '@src/types';
import { motion, type AnimationControls, type Variants } from 'framer-motion';
import { Layout } from '..';
import { RecentView, SamplesView, TemplatesView } from '../views';
import { ShowSkeleton } from './ShowSkeleton';

interface ContainerProps {
  animationControl?: AnimationControls;
  height: number;
  layout: Layout;
  type: ViewType;
  width: number;
}

export const Container = ({
  animationControl,
  height = 250,
  layout,
  type,
  width,
}: ContainerProps) => {
  const collectionVariants: Variants = {
    show: { x: 0, opacity: 1 },
    hide: { x: -width, opacity: 0 },
  };

  return (
    <Box height={height} overflow="auto">
      <Box component={motion.div} animate={animationControl} variants={collectionVariants}>
        {type === 'blank' ? (
          <ShowSkeleton layout={layout} width={width} />
        ) : type === 'recent' ? (
          <RecentView layout={layout} width={width} />
        ) : type === 'samples' ? (
          <SamplesView layout={layout} width={width} />
        ) : (
          <TemplatesView layout={layout} width={width} />
        )}
      </Box>
    </Box>
  );
};

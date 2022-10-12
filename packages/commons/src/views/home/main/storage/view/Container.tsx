import { Box, Divider, Skeleton, Stack, Typography } from '@mui/material';
import { AnimatePresence, AnimationControls, motion } from 'framer-motion';
import React, { type FC } from 'react';

interface ViewProps {
  animationControl: AnimationControls;
  children: React.ReactNode;
  height?: number;
  title?: string;
  width: number;
}

export const Container: FC<ViewProps> = ({
  animationControl,
  children,
  height = 250,
  title,
  width,
}) => {
  const titleVariants = {
    show: { y: 0, opacity: 1 },
    hide: { y: 28, opacity: 0 },
  };

  const collectionVariants = {
    show: { x: 0, opacity: 1 },
    hide: { x: -width, opacity: 0 },
  };

  return (
    <Stack
      width={width}
      pt={2}
      overflow="auto"
      component={motion.div}
      animate={{ width }}
      transition={{ type: 'tween', duration: 2 }}
      initial="hidden"
    >
      <Box overflow="hidden" height={28}>
        <Typography
          fontWeight={700}
          letterSpacing=".15rem"
          textTransform="uppercase"
          mx={3}
          variant="subtitle1"
          component={motion.p}
          animate={animationControl}
          variants={titleVariants}
        >
          {title ?? <Skeleton />}
        </Typography>
      </Box>
      <Divider
        sx={{
          borderColor: '#999',
          boxShadow: '2px 0px 2px 0px rgb(0 0 0 / 15%)',
        }}
      />
      <AnimatePresence mode="popLayout">
        <Stack
          direction="column"
          gap={2}
          height={height}
          pt={2}
          overflow="auto"
          component={motion.div}
          animate={animationControl}
          variants={collectionVariants}
        >
          {children ??
            [1, 2, 3, 4].map((i) => (
              <Skeleton key={i} variant="rounded" width={width - 36} height={28} sx={{ mx: 2 }} />
            ))}
          {/* {children} */}
        </Stack>
      </AnimatePresence>
    </Stack>
  );
};

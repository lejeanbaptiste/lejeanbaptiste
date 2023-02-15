import { Stack, Typography } from '@mui/material';
import { useAppState } from '@src/overmind';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useState, type FC } from 'react';
import { useLeafWriter } from '../../useLeafWriter';
import { Cloud } from './Cloud';
import { FullPath } from './FullPath';

export const Meta: FC = () => {
  const { resource } = useAppState().editor;

  const { leafWriter } = useLeafWriter();

  const [hover, setHover] = useState(false);

  const handleMouseOverTitle = () => setHover(true);
  const handleMouseOutTitle = () => setHover(false);

  const extraInfoVariant = {
    visible: { height: 'auto', opacity: 1 },
    hidden: { height: 0, opacity: 0 },
  };

  return (
    <AnimatePresence mode="wait">
      {resource && (
        <Stack direction="row">
          <Stack
            alignItems="center"
            justifyContent="center"
            onMouseOver={handleMouseOverTitle}
            onMouseOut={handleMouseOutTitle}
            height={48}
            component={motion.div}
            variants={extraInfoVariant}
            animate="visible"
            exit="hidden"
          >
            {resource.provider && <FullPath show={hover} />}
            <Stack direction="row" alignItems="center">
              <Typography component="h2" ml={1} sx={{ cursor: 'default' }} variant="subtitle1">
                {resource.filename ?? 'untitled.xml'}
              </Typography>
            </Stack>
          </Stack>
          {leafWriter && resource.provider && <Cloud />}
        </Stack>
      )}
    </AnimatePresence>
  );
};

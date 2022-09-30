import { Icon, Stack, Typography } from '@mui/material';
import { useAppState } from '@src/overmind';
import { getIcon } from '@src/utilities';
import { AnimatePresence, motion } from 'framer-motion';
import React, { FC, useMemo } from 'react';

interface FullPathProps {
  show: boolean;
}

export const FullPath: FC<FullPathProps> = ({ show }) => {
  const { resource } = useAppState().storage;

  const getFullPath = useMemo(() => {
    if (!resource) return '';
    if (!resource.filename) return '';

    const { owner, repo, path } = resource;
    return `${owner}: ${repo}/${path && `${path}/`}`;
  }, [resource]);

  const extraInfoVariant = {
    visible: { height: 'auto', opacity: 1 },
    hidden: { height: 0, opacity: 0 },
  };

  return (
    <AnimatePresence mode="wait">
      <Stack
        direction="row"
        alignItems="center"
        component={motion.div}
        variants={extraInfoVariant}
        initial="hidden"
        animate={show ? 'visible' : 'hidden'}
        transition={{ type: 'tween' }}
        sx={{ mb: -0.5, overflow: 'hidden' }}
      >
        {resource?.provider && (
          <Icon component={getIcon(resource.provider)} sx={{ width: 14, height: 14 }} />
        )}
        <Typography sx={{ marginLeft: 1, cursor: 'default' }} variant="caption">
          {getFullPath}
        </Typography>
      </Stack>
    </AnimatePresence>
  );
};

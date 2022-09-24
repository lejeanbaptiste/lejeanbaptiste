import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import { Icon, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import Badge, { BadgeProps } from '@mui/material/Badge';
import { styled } from '@mui/material/styles';
import { useAppState } from '@src/overmind';
import { getIcon } from '@src/utilities';
import { AnimatePresence, motion } from 'framer-motion';
import { CloudSyncOutline } from 'mdi-material-ui';
import React, { FC, useMemo, useState } from 'react';
import { useLeafWriter } from '../useLeafWriter';

const StyledBadge = styled(Badge)<BadgeProps>(({ theme }) => ({
  '& .MuiBadge-badge': { top: -5, left: 11, minWidth: 4, height: 4 },
}));

export const Meta: FC = () => {
  const { isDirty, isSaving } = useAppState().editor;
  const { resource } = useAppState().storage;

  const { leafWriter, handleSave } = useLeafWriter();

  const [titleHover, setTitleHover] = useState(false);

  const getFullPath = useMemo(() => {
    if (!resource) return '';
    if (!resource.filename) return '';

    const { owner, repo, path } = resource;
    return `${owner}: ${repo}/${path && `${path}/`}`;
  }, [resource]);

  const handleMouseOverTitle = () => setTitleHover(true);
  const handleMouseOutTitle = () => setTitleHover(false);

  const extraInfoVariant = {
    visible: { height: 'auto', opacity: 1 },
    hidden: { height: 0, opacity: 0 },
  };

  return (
    <AnimatePresence mode="wait">
      {resource && (
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
          <Stack
            direction="row"
            alignItems="center"
            component={motion.div}
            variants={extraInfoVariant}
            initial="hidden"
            animate={titleHover ? 'visible' : 'hidden'}
            transition={{ type: 'tween' }}
            sx={{ mb: -0.5, overflow: 'hidden' }}
          >
            {resource.provider && (
              <Icon component={getIcon(resource.provider)} sx={{ width: 14, height: 14 }} />
            )}
            <Typography sx={{ marginLeft: 1, cursor: 'default' }} variant="caption">
              {getFullPath}
            </Typography>
          </Stack>

          <Stack direction="row" alignItems="center">
            <Typography
              component="h3"
              sx={{ marginLeft: 1, cursor: 'default' }}
              variant="subtitle1"
            >
              {resource.filename ?? 'untitled.xml'}
              {leafWriter && (
                <Tooltip title={isDirty ? 'Click to sync' : 'Synced to the cloud'}>
                  <IconButton
                    aria-label="save"
                    disableRipple={!isDirty}
                    onClick={() => handleSave()}
                    size="small"
                    sx={{
                      mt: -0.125,
                      ml: 0.5,
                      cursor: isDirty ? 'pointer' : 'default',
                    }}
                  >
                    {isSaving ? (
                      <CloudSyncOutline sx={{ width: 16, height: 16 }} />
                    ) : isDirty ? (
                      <>
                        <StyledBadge color="warning" variant="dot" />
                        <CloudQueueIcon color="warning" sx={{ width: 16, height: 16 }} />
                      </>
                    ) : (
                      <CloudDoneOutlinedIcon sx={{ width: 16, height: 16 }} />
                    )}
                  </IconButton>
                </Tooltip>
              )}
            </Typography>
          </Stack>
        </Stack>
      )}
    </AnimatePresence>
  );
};

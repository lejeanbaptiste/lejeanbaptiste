import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import { Icon, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import Badge, { BadgeProps } from '@mui/material/Badge';
import { styled } from '@mui/material/styles';
import { useActions } from '@src/overmind';
import { Resource } from '@src/types';
import { getIcon } from '@src/utilities/icons';
import { AnimatePresence, motion } from 'framer-motion';
import React, { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface IMeta {
  isDirty: boolean;
  resource: Resource;
}

const StyledBadge = styled(Badge)<BadgeProps>(({ theme }) => ({
  '& .MuiBadge-badge': { top: -5, left: 11, minWidth: 4, height: 4 },
}));

export const Meta: FC<IMeta> = ({ resource, isDirty }) => {
  const { editor, storage, ui } = useActions();

  const { t } = useTranslation();

  const [titleHover, setTitleHover] = useState(false);

  const handleSave = async () => {
    const saved = await editor.save();

    if (!saved || saved.success === false) {
      ui.notifyViaSnackbar({
        message: `${t('Something went wrong')}. ${t('Document not saved')}!`,
        options: { variant: 'error' },
      });
      return;
    }

    storage.updateRecentDocument();
    ui.notifyViaSnackbar({ message: t('Document Saved'), options: { variant: 'success' } });
  };

  const getFullPath = useMemo(() => {
    if (!resource) return '';
    if (!resource.filename) return '';

    const { owner, repo, path } = resource;
    return `${owner}: ${repo}/${path && `${path}/`}`;
  }, [resource]);

  const handleMouseOverTitle = () => {
    setTitleHover(true);
  };

  const handleMouseOutTitle = () => {
    setTitleHover(false);
  };

  const extraInfoVariant = {
    visible: { height: 'auto', opacity: 1 },
    hidden: { height: 0, opacity: 0 },
  };

  return (
    <Stack direction="row" alignItems="center">
      <Stack
        alignItems="center"
        justifyContent="center"
        onMouseOver={handleMouseOverTitle}
        onMouseOut={handleMouseOutTitle}
        height={48}
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

        <Typography component="h3" sx={{ marginLeft: 1, cursor: 'default' }} variant="subtitle1">
          {resource.filename ?? 'untitled.xml'}
        </Typography>
      </Stack>

      <Tooltip title={isDirty ? 'Click to sync' : 'Synced to the cloud'}>
        <IconButton aria-label="save" onClick={handleSave} size="small" sx={{ ml: 0.5 }}>
          {isDirty ? (
            <>
              <StyledBadge color="warning" variant="dot" />
              <CloudQueueIcon color="warning" sx={{ width: 16, height: 16 }} />
            </>
          ) : (
            <CloudDoneOutlinedIcon sx={{ width: 16, height: 16 }} />
          )}
        </IconButton>
      </Tooltip>
    </Stack>
  );
};

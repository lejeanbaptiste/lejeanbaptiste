import ClearIcon from '@mui/icons-material/Clear';
import { Box, Card, Icon, IconButton, Stack, Typography, useTheme } from '@mui/material';
import { getIcon } from '@src/assets/icons';
import type { StorageProviderName } from '@src/services';
import type { Resource } from '@src/types';
import { formatDistanceToNow } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useState, type FC, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

interface RecentFileCardProps {
  onClick: (resource: Resource) => void;
  onRemove: (url: string) => void;
  resource: Resource;
}

export const RecentFileCard: FC<RecentFileCardProps> = ({ onClick, onRemove, resource }) => {
  const { t } = useTranslation('recents');
  const { palette } = useTheme();

  const [hover, setHover] = useState(false);

  const { filename, modifiedAt, owner, path, provider, repo, url } = resource;

  const lastDate = modifiedAt
    ? formatDistanceToNow(new Date(modifiedAt), {
        includeSeconds: true,
        addSuffix: true,
      })
    : '';

  const handleClick = async () => onClick(resource);

  const handleRemove = (event: MouseEvent<HTMLButtonElement, globalThis.MouseEvent>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!url) return;
    onRemove(url);
  };

  const extraInfoVariant = {
    visible: { x: 0, opacity: 1 },
    hidden: { x: 10, opacity: 0 },
  };

  return (
    <Card
      onClick={handleClick}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
      raised={hover ? true : false}
      sx={{ mx: 2, cursor: 'pointer' }}
      component={motion.div}
      layout
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ type: 'spring' }}
    >
      <Stack>
        <Stack
          justifyContent="space-between"
          px={1}
          sx={{
            backgroundColor: palette.mode === 'dark' ? palette.grey[900] : palette.grey[200],
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            gap={0.5}
            sx={{ height: 22, overflow: 'hidden' }}
          >
            <Icon
              component={getIcon(provider as StorageProviderName)}
              sx={{ width: 14, height: 14 }}
            />
            <Typography variant="caption">
              {owner}: {repo}/{path && `${path}/`}
            </Typography>
            {hover && (
              <IconButton
                aria-label={t('remove_from_recents')}
                onClick={handleRemove}
                size="small"
                sx={{ ml: 'auto' }}
              >
                <ClearIcon sx={{ height: 12, width: 12 }} />
              </IconButton>
            )}
          </Stack>
        </Stack>
        <Stack direction="column">
          <Box py={0.5} px={1}>
            <Typography variant="subtitle1">{filename}</Typography>
          </Box>
          <AnimatePresence>
            {hover && (
              <Box
                alignSelf="flex-end"
                mt={-3}
                component={motion.div}
                variants={extraInfoVariant}
                initial="hidden"
                animate={hover ? 'visible' : 'hidden'}
              >
                <Box
                  px={1}
                  sx={{
                    backgroundColor:
                      palette.mode === 'dark' ? palette.action.hover : palette.grey[50],
                    borderTopLeftRadius: '6px',
                  }}
                >
                  <Typography variant="caption">{lastDate}</Typography>
                </Box>
              </Box>
            )}
          </AnimatePresence>
        </Stack>
      </Stack>
    </Card>
  );
};

import { loadDocument } from '@cwrc/leafwriter-storage-service';
import ClearIcon from '@mui/icons-material/Clear';
import { Card, Icon, IconButton, Stack, Typography, useTheme } from '@mui/material';
import { usePermalink } from '@src/hooks';
import { useActions } from '@src/overmind';
import { StorageProviderName } from '@src/services';
import type { Resource } from '@src/types';
import { getIcon } from '@src/utilities/icons';
import { formatDistanceToNow } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useState, type FC, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

interface RecentFileProps {
  resource: Resource;
}

const RecentFile: FC<RecentFileProps> = ({ resource }) => {
  const { getStorageProviderAuth, removeRecentDocument, setResource } = useActions().storage;

  const navigate = useNavigate();
  const { t } = useTranslation();
  const { setPermalink } = usePermalink();
  const { palette } = useTheme();

  const [hover, setHover] = useState(false);

  const { filename, modifiedAt, owner, path, provider, repo, schemaName, url } = resource;

  const lastDate = modifiedAt
    ? formatDistanceToNow(new Date(modifiedAt), {
        includeSeconds: true,
        addSuffix: true,
      })
    : '';

  const handleClick = async (resource: Resource) => {
    if (!resource.provider) return;

    const providerAuth = getStorageProviderAuth(resource.provider as StorageProviderName);
    if (!providerAuth) return;

    const document = await loadDocument(providerAuth, resource);
    if (!document || 'error' in document || !document.content || !document.url) {
      return;
    }

    setResource(document);
    const permalink = setPermalink(document);
    navigate(`/edit${permalink}`, { replace: true });
  };

  const handleRemove = (event: MouseEvent<HTMLButtonElement, globalThis.MouseEvent>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!url) return;
    removeRecentDocument(url);
  };

  const extraInfoVariant = {
    initial: { height: 0 },
    visible: { height: 'auto' },
    exit: { height: 0 },
  };

  return (
    <Card
      onClick={() => handleClick(resource)}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
      sx={{ cursor: 'pointer' }}
      raised={hover ? true : false}
    >
      <Stack>
        <Stack sx={{ py: 0.5, px: 1 }}>
          <AnimatePresence>
            {hover && (
              <Stack
                direction="row"
                alignItems="center"
                gap={0.5}
                component={motion.div}
                variants={extraInfoVariant}
                initial="initial"
                animate="visible"
                exit="exit"
                transition={{ type: 'tween' }}
                sx={{ overflow: 'hidden' }}
              >
                <Icon
                  component={getIcon(provider as StorageProviderName)}
                  sx={{ width: 14, height: 14 }}
                />
                <Typography variant="caption">
                  {owner}: {repo}/{path && `${path}/`}
                </Typography>
                <IconButton
                  aria-label={t('remove from recents')}
                  onClick={handleRemove}
                  size="small"
                  sx={{ ml: 'auto' }}
                >
                  <ClearIcon sx={{ height: 12, width: 12 }} />
                </IconButton>
              </Stack>
            )}
          </AnimatePresence>
          <Typography
            color={hover ? 'primary' : 'inherit'}
            sx={{
              textTransform: 'unset',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            variant="button"
          >
            {filename}
          </Typography>
        </Stack>
        <Stack
          direction="row"
          justifyContent="space-between"
          sx={{
            px: 1,
            backgroundColor: palette.mode === 'dark' ? palette.grey[800] : palette.grey[100],
          }}
        >
          <Typography variant="caption">{schemaName}</Typography>
          <Typography variant="caption">{lastDate}</Typography>
        </Stack>
      </Stack>
    </Card>
  );
};

export default RecentFile;

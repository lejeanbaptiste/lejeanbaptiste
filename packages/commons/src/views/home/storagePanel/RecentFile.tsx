import { loadDocument } from '@cwrc/leafwriter-storage-service';
import ClearIcon from '@mui/icons-material/Clear';
import { Box, Card, Icon, IconButton, Stack, Typography, useTheme } from '@mui/material';
import { usePermalink } from '@src/hooks';
import { useActions } from '@src/overmind';
import { StorageProviderName } from '@src/services';
import type { Resource } from '@src/types';
import { getIcon } from '@src/utilities';
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
  const { t } = useTranslation('recents');
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
    visible: { x: 0, opacity: 1 },
    hidden: { x: 10, opacity: 0 },
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
                aria-label={t('remove from recents')}
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

export default RecentFile;

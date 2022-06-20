import { loadDocument } from '@cwrc/leafwriter-storage-service';
import { Card, Stack, Typography, useTheme } from '@mui/material';
import { usePermalink } from '@src/hooks/usePermalink';
import { useActions } from '@src/overmind';
import type { Resource } from '@src/types';
import { formatDistanceToNow } from 'date-fns';
import React, { useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

interface RecentFileProps {
  resource: Resource;
}

const RecentFile: FC<RecentFileProps> = ({ resource }) => {
  const { getStorageProviderAuth, setResource } = useActions().storage;

  const navigate = useNavigate();
  const { t } = useTranslation();
  const { setPermalink } = usePermalink();
  const { palette } = useTheme();

  const [hover, setHover] = useState(false);

  const lastDate = resource.modifiedAt
    ? formatDistanceToNow(new Date(resource.modifiedAt), {
        includeSeconds: true,
        addSuffix: true,
      })
    : '';

  const handleClick = async (resource: Resource) => {
    if (!resource.provider) return;

    const providerAuth = getStorageProviderAuth(resource.provider);
    if (!providerAuth) return;

    const document = await loadDocument(providerAuth, resource);
    if (!document || 'error' in document || !document.content || !document.url) {
      return;
    }

    setResource(document);
    const permalink = setPermalink(document);
    navigate(`/edit${permalink}`, { replace: true });
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
        <Typography
          color={hover ? 'primary' : 'inherit'}
          sx={{
            textTransform: 'unset',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            py: 0.5,
            px: 1,
          }}
          variant="button"
        >
          {resource.filename}
        </Typography>
        <Stack
          direction="row"
          justifyContent="space-between"
          sx={{
            px: 1,
            backgroundColor: palette.mode === 'dark' ? palette.grey[800] : palette.grey[100],
          }}
        >
          <Typography variant="caption">{resource.schemaName}</Typography>
          <Typography variant="caption">{lastDate}</Typography>
        </Stack>
      </Stack>
    </Card>
  );
};

export default RecentFile;

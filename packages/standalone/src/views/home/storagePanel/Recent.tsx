import { loadDocument } from '@cwrc/leafwriter-storage-service/headless';
import { Button, Stack, Typography } from '@mui/material';
import { Resource } from '@src/@types/types';
import { usePermalink } from '@src/hooks/permalink';
import { useActions, useAppState } from '@src/overmind';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

const Recent: FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { recentDocuments } = useAppState();
  const { getStorageProviderAuth, setResource } = useActions();
  const { setPermalink } = usePermalink();

  const handleClick = async (resource: Resource) => {
    if (!resource.provider) return;

    const providerAuth = getStorageProviderAuth(resource.provider);
    if (!providerAuth) return;

    const document: Resource = await loadDocument(providerAuth, resource);
    if (!document || 'error' in document || !document.content || !document.url) {
      return;
    }

    setResource(document);
    setPermalink(document);
    navigate('/edit', { replace: true });
  };

  return (
    <Stack spacing={1} sx={{ maxWidth: 250 }}>
      <Typography
        align="center"
        component="h5"
        mb={2}
        sx={{ fontWeight: 700, textTransform: 'uppercase' }}
        variant="h6"
      >
        {t('home:recent')}
      </Typography>
      <Stack>
        {recentDocuments.map((resource, index) => (
          <Button
            key={index}
            color="inherit"
            onClick={() => handleClick(resource)}
            sx={{
              textTransform: 'unset',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {resource.filename}
          </Button>
        ))}
      </Stack>
    </Stack>
  );
};

export default Recent;

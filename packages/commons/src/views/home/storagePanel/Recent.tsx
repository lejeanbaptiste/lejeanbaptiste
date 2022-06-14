import { Divider, Stack, Typography } from '@mui/material';
import { useAppState } from '@src/overmind';
import React, { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import RecentFile from './RecentFile';

const Recent: FC = () => {
  const { recentDocuments } = useAppState().storage;
  const { t } = useTranslation();

  return (
    <Stack spacing={1} sx={{ width: 320 }}>
      <Typography sx={{ fontWeight: 700, letterSpacing: '.15rem', textTransform: 'uppercase' }}>
        {t('home:recent')}
      </Typography>
      <Stack direction="row" spacing={2} minHeight={145}>
        <Divider
          flexItem
          orientation="vertical"
          sx={{ borderColor: '#999', ml: 0.5, boxShadow: '2px 0px 2px 0px rgb(0 0 0 / 15%)' }}
        />
        {recentDocuments.length === 0 ? (
          <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, opacity: 0.3 }} variant="h6">
            Recent documents are listed here
          </Typography>
        ) : (
          <Stack spacing={1} width={275}>
            {recentDocuments.map((resource, index) => (
              <RecentFile key={index} resource={resource} />
            ))}
          </Stack>
        )}
      </Stack>
    </Stack>
  );
};

export default Recent;

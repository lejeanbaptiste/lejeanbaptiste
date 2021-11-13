import { Button, Stack, Typography } from '@mui/material';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';

const recentFiles = [
  { title: 'Regenerations', URI: '' },
  { title: 'Laurence Margaret', URI: '' },
  { title: 'Cultural Mapping and digital sphere', URI: '' },
  { title: 'Sample TEI letter', URI: '' },
];

const Recent: FC = () => {
  const { t } = useTranslation();

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
        {recentFiles.map(({ title, URI }) => (
          <Button key={title} color="inherit" sx={{ textTransform: 'unset' }}>
            {title}
          </Button>
        ))}
      </Stack>
    </Stack>
  );
};

export default Recent;

import { Button, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';

const templates = [
  { title: 'Blank', URI: '' },
  { title: 'Letter', URI: '' },
  { title: 'Poem', URI: '' },
  { title: 'Prose', URI: '' },
];

const Templates: FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Stack spacing={1} sx={{ maxWidth: isMobile ? 'auto' : 170 }}>
      <Typography
        align="center"
        component="h5"
        mb={2}
        sx={{ fontWeight: 700, textTransform: 'uppercase' }}
        variant="h6"
      >
        {t('home:templates')}
      </Typography>
      <Typography align="center" component="h6" variant="subtitle2">
        TEI
      </Typography>
      <Stack direction="row" flexWrap="wrap" justifyContent="center">
        {templates.map(({ title, URI }) => (
          <Button key={title} color="secondary" size="small" sx={{ m: 0.5 }} variant="outlined">
            {title}
          </Button>
        ))}
      </Stack>
    </Stack>
  );
};

export default Templates;

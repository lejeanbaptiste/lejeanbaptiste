import { Button, Divider, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useActions, useAppState } from '@src/overmind';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

const Templates: FC = () => {
  const navigate = useNavigate();
  const { templates } = useAppState().storage;
  const { loadTemplate, setResource } = useActions().storage;
  const { t } = useTranslation();
  const { breakpoints, palette } = useTheme();
  const isMobile = useMediaQuery(breakpoints.down('sm'));

  const handleClick = async (url: string) => {
    const documentString = await loadTemplate(url);
    setResource({ content: documentString });
    navigate('/edit', { replace: true });
  };

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
        {templates.map(({ title, url }) => (
          <Button
            key={title}
            color="secondary"
            onClick={() => handleClick(url)}
            size="small"
            sx={{ m: 0.5 }}
            variant="outlined"
          >
            {title}
          </Button>
        ))}
      </Stack>
    </Stack>
  );
};

export default Templates;

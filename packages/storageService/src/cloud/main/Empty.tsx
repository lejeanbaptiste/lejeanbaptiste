import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';

const Empty: FC = () => {
  const { t } = useTranslation();
  return (
    <Stack data-testid="list-empty" justifyContent="center" height={200}>
      <Stack
        direction="row"
        justifyContent="center"
        spacing={2}
        sx={{ color: ({ palette }) => alpha(palette.text.secondary, 0.15) }}
      >
        <ErrorOutlineIcon sx={{ height: 56, width: 56 }} />
        <Typography variant="h3">{t('commons:empty')}</Typography>
      </Stack>
    </Stack>
  );
};

export default Empty;

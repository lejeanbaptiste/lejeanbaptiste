import { Box, Grid, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppState } from '../overmind';

export const Header = () => {
  const { name: providerName } = useAppState().cloud;
  const { dialogType, source } = useAppState().common;

  const { t } = useTranslation('LWStorageService');

  const title = source === 'cloud' && providerName ? providerName : source;

  return (
    <Grid container alignItems="center" px={2} py={1} minHeight={49}>
      <Grid item xs={4}>
        <Typography
          data-testid="header-source"
          sx={{ textTransform: 'capitalize' }}
          variant="subtitle1"
        >
          {title}
        </Typography>
      </Grid>

      <Grid item xs={4}>
        <Typography
          color="primary"
          data-testid="header-dialog-title"
          sx={{ textTransform: 'capitalize' }}
          textAlign="center"
          variant="h6"
        >
          {t(`commons.${dialogType}`)}
        </Typography>
      </Grid>

      <Grid item xs={4}>
        <Box flexGrow={1} />
      </Grid>
    </Grid>
  );
};

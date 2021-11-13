import { Box, Grid, Typography } from '@mui/material';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppState } from '../overmind';

const Header: FC = () => {
  const { name: providerName } = useAppState().cloud;
  const { dialogType, source } = useAppState().common;
  const { t } = useTranslation();

  const title = () => {
    if (source === 'cloud' && providerName) return providerName;
    return source;
  };

  return (
    <Grid container alignItems="center" px={2} py={1} minHeight={49}>
      <Grid item xs={4}>
        <Typography
          data-testid="header-source"
          sx={{ textTransform: 'capitalize' }}
          variant="subtitle1"
        >
          {title()}
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
          {t(`commons:${dialogType}`)}
        </Typography>
      </Grid>

      <Grid item xs={4}>
        <Box flexGrow={1} />
      </Grid>
    </Grid>
  );
};

export default Header;

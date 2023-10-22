import { Chip, Stack, useMediaQuery, useTheme } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

export const StatusBar = () => {
  const { t } = useTranslation('LWC');

  const { breakpoints } = useTheme();
  const isMobile = useMediaQuery(breakpoints.down('sm'));

  const handleClick = () => {
    window.open(
      'https://gitlab.com/calincs/cwrc/leaf-writer/leaf-writer/-/issues/new?issuable_template=Bug%20Report',
    );
  };

  return (
    <Stack justifyContent="center" alignItems="center" px={2} mt={5}>
      <Chip
        label={`${t('LWC:home.bugs')} / ${t('LWC:home.requests')}`}
        onClick={handleClick}
        size="small"
        variant="outlined"
        sx={{ mb: 1 }}
      />
    </Stack>
  );
};

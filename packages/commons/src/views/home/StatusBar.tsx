import { Chip, Stack } from '@mui/material';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';

export const StatusBar: FC = () => {
  const { t } = useTranslation();

  const handleClick = () => {
    window.open(
      'https://gitlab.com/calincs/cwrc/leaf-writer/leaf-writer/-/issues/new?issuable_template=Bug%20Report'
    );
  };

  return (
    <Stack justifyContent="center" alignItems="flex-end" px={2}>
      <Chip
        label={`${t('home:bugs')} / ${t('home:requests')}`}
        onClick={handleClick}
        size="small"
        variant="outlined"
        sx={{ mb: 1 }}
      />
    </Stack>
  );
};

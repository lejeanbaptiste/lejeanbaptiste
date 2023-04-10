import { Link, Stack } from '@mui/material';
import { useActions } from '@src/overmind';
import React from 'react';
import { useTranslation } from 'react-i18next';

export const Footer = () => {
  const { openDialog } = useActions().ui;
  const { t } = useTranslation('LWC');

  const handleClick = () => {
    openDialog({ type: 'privacy' });
  };

  return (
    <Stack justifyContent="center" alignItems="center" py={2}>
      <Link
        onClick={handleClick}
        sx={{ cursor: 'pointer', textTransform: 'capitalize' }}
        variant="caption"
      >
        {t('commons.privacy')}
      </Link>
    </Stack>
  );
};

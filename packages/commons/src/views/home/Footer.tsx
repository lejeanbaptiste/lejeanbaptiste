import { Link, Stack } from '@mui/material';
import { useActions } from '@src/overmind';
import React, { type FC } from 'react';
import { useTranslation } from 'react-i18next';

export const Footer: FC = () => {
  const { openDialog } = useActions().ui;
  const { t } = useTranslation('commons');

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
        {t('privacy')}
      </Link>
    </Stack>
  );
};

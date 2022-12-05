import { Link, Stack } from '@mui/material';
import { useActions } from '@src/overmind';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface ProfileProps {
  onClick: () => void;
}

export const Footer = ({ onClick }: ProfileProps) => {
  const { openDialog } = useActions().ui;
  const { t } = useTranslation('commons');

  const handleClickPrivacy = () => {
    onClick();
    openDialog({ type: 'privacy' });
  };

  return (
    <Stack direction="row" justifyContent="center" alignItems="center" py={0.5}>
      <Link
        color="text.secondary"
        onClick={handleClickPrivacy}
        sx={{ cursor: 'pointer', textTransform: 'capitalize' }}
        variant="caption"
        underline="none"
      >
        {t('privacy')}
      </Link>
    </Stack>
  );
};

import { Link, Stack } from '@mui/material';
import { useActions } from '@src/overmind';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';

interface ProfileProps {
  onClick: () => void;
}

export const Footer: FC<ProfileProps> = ({ onClick }) => {
  const { openDialog } = useActions().ui;
  const { t } = useTranslation('commons');

  const handleClickPrivacy = () => {
    onClick();
    openDialog({ type: 'privacy' });
  };

  return (
    <Stack
      direction="row"
      justifyContent="center"
      alignItems="center"
      py={0.5}
      sx={{
        background: ({ palette }) =>
          palette.mode === 'dark' ? palette.grey[900] : palette.grey[50],
      }}
    >
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

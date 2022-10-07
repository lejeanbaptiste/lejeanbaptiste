import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import { IconButton, Stack, Typography } from '@mui/material';
import { StyledToolTip } from '@src/components';
import { useActions, useAppState } from '@src/overmind';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ProfileAvatar } from '../ProfileAvatar';

export const UserCard: FC = () => {
  const { user } = useAppState().auth;
  const { accountManagement } = useActions().auth;
  const { t } = useTranslation('commons');

  const handleManageAccontClick = () => accountManagement();

  return (
    <Stack
      direction="row"
      alignItems="flex-start"
      spacing={2}
      p={2}
      sx={{
        background: ({ palette }) =>
          palette.mode === 'dark' ? palette.grey[900] : palette.grey[50],
      }}
    >
      <ProfileAvatar clickable={false} size={40} />
      <Stack flexGrow={1}>
        <Typography variant="body1">
          {user?.firstName} {user?.lastName}
        </Typography>
        <Typography variant="caption">{user?.email}</Typography>
      </Stack>
      <IconButton onClick={handleManageAccontClick} size="small">
        <StyledToolTip title={t('profile:manageYourLincsAccount')}>
          <ManageAccountsIcon fontSize="inherit" />
        </StyledToolTip>
      </IconButton>
    </Stack>
  );
};

import SettingsIcon from '@mui/icons-material/Settings';
import { Button, IconButton, Link, Stack, Typography } from '@mui/material';
import { StyledToolTip } from '@src/components';
import { useActions, useAppState } from '@src/overmind';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ProfileAvatar } from '../ProfileAvatar';

export const UserCard = () => {
  const { user } = useAppState().auth;
  const { page } = useAppState().ui;

  const { accountManagement } = useActions().auth;

  const { t } = useTranslation('LWC');

  const userDetail = useMemo(() => {
    if (!user) return;
    const identity = user.identities.get(user.preferredID);

    if (!identity) {
      return {
        id: user.username,
        name: `${user.firstName} ${user.lastName}`,
        uri: user.url,
      };
    }

    return {
      id: identity.username ?? identity.id,
      name: identity.name,
      uri: identity.uri,
    };
  }, [user, user?.preferredID]);

  const handleManageAccontClick = () => accountManagement();

  return (
    <Stack direction="row" alignItems="flex-start" spacing={2} p={2}>
      <ProfileAvatar clickable={false} size={40} />
      <Stack flexGrow={1} alignItems="flex-start">
        <Typography variant="body1">{userDetail?.name}</Typography>
        <StyledToolTip enterDelay={3000} title={userDetail?.uri}>
          <Button
            component={Link}
            href={userDetail?.uri}
            size="small"
            sx={{ height: 20, minWidth: 'unset', py: 0, textTransform: 'none' }}
            target="_blank"
          >
            {userDetail?.id}
          </Button>
        </StyledToolTip>
      </Stack>

      {page !== 'edit' && (
        <IconButton
          color="primary"
          onClick={handleManageAccontClick}
          size="small"
          sx={{ mt: '4px !important' }}
        >
          <StyledToolTip title={t('profile.manage_your_lincs_account')}>
            <SettingsIcon fontSize="inherit" />
          </StyledToolTip>
        </IconButton>
      )}
    </Stack>
  );
};

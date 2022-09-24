import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import {
  Avatar,
  Box,
  Button,
  Divider,
  IconButton,
  List,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { Storage } from '@src/components/Storage';
import { useActions, useAppState } from '@src/overmind';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import EditorSettings from './EditorSettings';
import Identity from './Identity';
import Language from './Language';
import ThemeAppearance from './ThemeAppearance';

interface ProfileProps {
  anchor: HTMLDivElement;
  handleClose: () => void;
}

export const Profile: FC<ProfileProps> = ({ anchor, handleClose }) => {
  const { user } = useAppState().auth;
  const { libLoaded } = useAppState().editor;
  const { accountManagement, signOut } = useActions().auth;
  const { t } = useTranslation();

  const open = Boolean(anchor);

  const handleManageAccontClick = () => accountManagement();

  const handleSignOut = async () => {
    await signOut();
    handleClose();
  };

  return (
    <Popover
      anchorEl={anchor}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      id="profile"
      onClose={handleClose}
      open={open}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <Stack direction="row" alignItems="flex-start" spacing={2} p={2}>
        <Avatar src={user?.avatar_url} />
        <Stack flexGrow={1}>
          <Typography variant="button">
            {user?.firstName} {user?.lastName}
          </Typography>
          <Typography variant="body2">{user?.email}</Typography>
        </Stack>
        <IconButton onClick={handleManageAccontClick} size="small">
          <Tooltip title="Manage your Lincs account">
            <ManageAccountsIcon fontSize="inherit" />
          </Tooltip>
        </IconButton>
      </Stack>
      <Divider />
      <List
        sx={{
          width: 280,
          background: ({ palette }) => (palette.mode === 'dark' ? 'inherent' : '#f9f9f9'),
        }}
      >
        <Identity />
        <Storage />
      </List>

      <Divider />
      <List sx={{ width: 280 }}>
        <ThemeAppearance />
        <Language />
      </List>
      <Divider />
      {libLoaded && (
        <>
          <EditorSettings handleClose={handleClose} />
          <Divider />
        </>
      )}
      <Box display="flex" justifyContent="center" mt={2} mb={2}>
        <Button onClick={handleSignOut} size="small" variant="outlined">
          {t('home:signOut')}
        </Button>
      </Box>
    </Popover>
  );
};

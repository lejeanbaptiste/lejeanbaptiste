import { Avatar, Box, Button, Divider, List, Stack, Typography } from '@mui/material';
import { useAppState } from '../../../overmind';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import SubMenuButton from '../SubMenuButton';
import FontSize from './FontSize';
import HelpButton from './Help';
import Language from './Language';
import ShowTags from './ShowTags';
import ThemeAppearance from './ThemeAppearance';

interface MainMenuProps {
  onSignOut: () => void;
  onSwitchMenu: (value: string) => void;
}

const MainMenu: FC<MainMenuProps> = ({ onSignOut, onSwitchMenu }) => {
  const { t } = useTranslation();
  const { user } = useAppState();

  const handleSignOut = async () => {
    user.signOut && (await user.signOut());
    onSignOut();
  };

  return (
    <Box width={302}>
      <Stack direction="row" spacing={2} p={2}>
        <Avatar src={user?.avatar_url} />
        <Stack>
          <Typography variant="button">
            {user.name ? user.name : `${user?.firstName} ${user?.lastName}`}
          </Typography>
          <Typography variant="body2">{user?.email}</Typography>
        </Stack>
      </Stack>

      <Divider />

      <List dense>
        <ThemeAppearance />
        <Language />
      </List>

      <Divider />

      <List dense>
        <FontSize />
        <ShowTags />
        <Divider sx={{ my: 1 }} />
        <SubMenuButton onClick={onSwitchMenu} label="preferences" />
        <HelpButton />
      </List>

      <Divider />

      <Box display="flex" justifyContent="center" mt={2} mb={2}>
        <Button onClick={handleSignOut} size="small" variant="outlined">
          {t('ui:signOut')}
        </Button>
      </Box>
    </Box>
  );
};

export default MainMenu;

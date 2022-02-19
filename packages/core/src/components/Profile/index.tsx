import { Popover } from '@mui/material';
import React, { FC, useState } from 'react';
import MainMenu from './MainMenu';
import PreferencesMenu from './PreferencesMenu';

type MenuType = 'main' | 'preferences';

interface ProfileProps {
  anchor: HTMLDivElement;
  handleClose: () => void;
}

const Profile: FC<ProfileProps> = ({ anchor, handleClose }) => {
  const [currentMenu, setCurrentMenu] = useState<MenuType>('main');
  const open = Boolean(anchor);

  const handleSwitchMenu = (value: string) => {
    setCurrentMenu(value as MenuType);
  };

  return (
    <Popover
      anchorEl={anchor}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      id="profile"
      onClose={handleClose}
      open={open}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
    >
      {currentMenu === 'preferences' && <PreferencesMenu onSwitchMenu={handleSwitchMenu} />}
      {currentMenu === 'main' && (
        <MainMenu onSwitchMenu={handleSwitchMenu} onSignOut={handleClose} />
      )}
    </Popover>
  );
};

export default Profile;

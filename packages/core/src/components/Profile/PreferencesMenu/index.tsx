import { Box, Divider, List } from '@mui/material';
import React, { FC } from 'react';
import BackButton from '../BackButton';
import Resets from './Resets';
import AutoritiesPanel from './AuthoritySource';

interface PreferencesMenuProps {
  onSwitchMenu: (value: string) => void;
}

const PreferencesMenu: FC<PreferencesMenuProps> = ({ onSwitchMenu }) => {
  const handleGoBack = () => {
    onSwitchMenu('main');
  };

  return (
    <Box width={302}>
      <BackButton label="Preferences" onClick={handleGoBack} />
      <Divider />
      <List dense>
        <AutoritiesPanel />
        <Divider />
        <Resets />
      </List>
    </Box>
  );
};

export default PreferencesMenu;

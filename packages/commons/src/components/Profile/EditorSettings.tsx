import SettingsIcon from '@mui/icons-material/Settings';
import { ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';

const EditorSettings: FC = () => {
  const { t } = useTranslation();

  const handleClick = () => {
    console.log('Open Settings Dialog');
  };

  return (
    <ListItem disableGutters>
      <ListItemButton onClick={handleClick}>
        <ListItemIcon sx={{ minWidth: 40 }}>
          <SettingsIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText id="settings" primary={t('settings')} sx={{ textTransform: 'capitalize' }} />
      </ListItemButton>
    </ListItem>
  );
};

export default EditorSettings;

import {
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  Switch,
} from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { useActions, useAppState } from '@src/overmind';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';

const DarkMode: FC = () => {
  const { t } = useTranslation();

  const { darkMode } = useAppState();
  const { setDarkMode } = useActions();

  const switchAppearenceMode = () => {
    const value = !darkMode;
    setDarkMode(value);
  };

  return (
    <ListItem>
      <ListItemIcon sx={{ minWidth: 40 }}>
        {darkMode ? <Brightness7Icon /> : <Brightness4Icon />}
      </ListItemIcon>
      <ListItemText id="dark-mode" primary={t('home:darkMode')} />
      <ListItemSecondaryAction>
        <Switch
          checked={darkMode}
          color="primary"
          edge="end"
          inputProps={{ 'aria-labelledby': 'dark-mode' }}
          onChange={switchAppearenceMode}
          size="small"
        />
      </ListItemSecondaryAction>
    </ListItem>
  );
};

export default DarkMode;

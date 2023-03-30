import { ListItem, ListItemButton, ListItemIcon, ListItemText, Menu, Switch } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../overmind';

interface SettingsDialogProps {
  anchor?: HTMLDivElement | null;
  onDone: () => void;
  open: boolean;
}

export const SettingsDialog = ({ anchor, onDone, open }: SettingsDialogProps) => {
  const { allowAllFileTypes } = useAppState().common;
  const { setAllowedAllFileTypes } = useActions().common;

  const { t } = useTranslation();

  const handleToggleAllowAllFiles = () => {
    setAllowedAllFileTypes(!allowAllFileTypes);
  };

  const handleDone = () => onDone();

  return (
    <Menu
      anchorEl={anchor}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      data-testid="global_settings-dialog"
      id="settings-popper"
      open={open}
      onClose={handleDone}
      transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    >
      <ListItem disablePadding>
        <ListItemButton dense onClick={handleToggleAllowAllFiles} role={undefined}>
          <ListItemIcon>
            <Switch
              checked={allowAllFileTypes}
              data-testid="global_settings-dialog-allow_all_files-switch"
              inputProps={{ 'aria-label': 'allow-all-files' }}
              onChange={handleToggleAllowAllFiles}
              title="Allow all files"
              size="small"
            />
          </ListItemIcon>
          <ListItemText
            primary={t('settings:allow_all_files')}
            sx={{ textTransform: 'capitalize' }}
          />
        </ListItemButton>
      </ListItem>
    </Menu>
  );
};

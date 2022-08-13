import TuneIcon from '@mui/icons-material/Tune';
import { ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { useAppState } from '@src/overmind';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  handleClose: () => void;
}

const EditorSettings: FC<Props> = ({ handleClose }) => {
  const { leafWriter } = useAppState().editor;
  const { t } = useTranslation();

  const handleClick = () => {
    handleClose();
    leafWriter?.showSettingsDialog();
  };

  return (
    <ListItem disableGutters>
      <ListItemButton onClick={handleClick}>
        <ListItemIcon sx={{ minWidth: 40 }}>
          <TuneIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText id="settings" primary={t('home:settings')} sx={{ textTransform: 'capitalize' }} />
      </ListItemButton>
    </ListItem>
  );
};

export default EditorSettings;

import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TuneIcon from '@mui/icons-material/Tune';
import { ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { useLeafWriter } from '@src/views/edit/useLeafWriter';
import React, { FC, MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  onClick: () => void;
}

export const EditorSettings: FC<Props> = ({ onClick }) => {
  const { t } = useTranslation('commons');
  const { leafWriter } = useLeafWriter();

  const handleClick = (event: MouseEvent<HTMLDivElement, globalThis.MouseEvent>) => {
    onClick();
    leafWriter?.showSettingsDialog();
  };

  return (
    <ListItem disableGutters>
      <ListItemButton onClick={handleClick}>
        <ListItemIcon sx={{ minWidth: 40 }}>
          <TuneIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText id="settings" primary={t('settings')} sx={{ textTransform: 'capitalize' }} />
        <ChevronRightIcon />
      </ListItemButton>
    </ListItem>
  );
};

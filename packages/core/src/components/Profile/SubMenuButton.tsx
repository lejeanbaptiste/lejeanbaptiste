import SettingsIcon from '@mui/icons-material/Settings';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import {
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
} from '@mui/material';
import React, { FC } from 'react';

interface SubMenuButtonProps {
  label: string;
  onClick: (value: string) => void;
}

const SubMenuButton: FC<SubMenuButtonProps> = ({ label, onClick }) => {
  const handleClick = () => {
    onClick(label);
  };

  return (
    <ListItem disableGutters>
      <ListItemButton onClick={handleClick}>
        <ListItemIcon sx={{ minWidth: 40 }}>
          <SettingsIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText id="language" primary={label} sx={{ textTransform: 'capitalize' }} />
        <ListItemSecondaryAction>
          <KeyboardArrowRightIcon fontSize="small" sx={{ mt: 1 }} />
        </ListItemSecondaryAction>
      </ListItemButton>
    </ListItem>
  );
};

export default SubMenuButton;

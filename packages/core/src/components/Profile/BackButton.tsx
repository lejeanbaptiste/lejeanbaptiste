import KeyboardArrowLefttIcon from '@mui/icons-material/KeyboardArrowLeft';
import { ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import React, { FC } from 'react';

interface SubMenuProps {
  label: string;
  onClick: () => void;
}

const BackButton: FC<SubMenuProps> = ({ label, onClick }) => {
  const handleClick = () => {
    onClick()
  };

  return (
    <ListItem disableGutters>
      <ListItemButton onClick={handleClick}>
        <ListItemIcon sx={{ minWidth: 40 }}>
          <KeyboardArrowLefttIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText id="language" primary={label} />
      </ListItemButton>
    </ListItem>
  );
};

export default BackButton;

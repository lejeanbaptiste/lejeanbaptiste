import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import {
  Icon,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import React from 'react';
import type { Owner } from '../../../../../../types';

interface ItemProps {
  onSelect?: (owner: Owner) => void;
  owner: Owner;
}

export const Item = ({ onSelect, owner }: ItemProps) => {
  const { name, type, username } = owner;

  const handleSelect = () => {
    onSelect && onSelect(owner);
  };

  return (
    <ListItem dense disablePadding>
      <ListItemButton
        alignItems="flex-start"
        dense
        onClick={handleSelect}
        sx={{ m: 0.25, py: 0, px: 0.5, borderRadius: 1 }}
      >
        <ListItemIcon sx={{ minWidth: 30 }}>
          <Icon
            component={type === 'organization' ? GroupWorkIcon : AccountCircleIcon}
            fontSize="small"
          />
        </ListItemIcon>
        <ListItemText
          primary={<Typography>{name === '' ? username : name}</Typography>}
          secondary={
            <Typography color="text.secondary" variant="body2">
              {username}
            </Typography>
          }
        />
      </ListItemButton>
    </ListItem>
  );
};

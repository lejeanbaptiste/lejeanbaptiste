import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import { ListItem, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import React, { FC } from 'react';
import type { Owner } from '../../../../types';

interface ItemProps {
  item: Owner;
  onSelect?: (owner: Owner) => void;
}

const Item: FC<ItemProps> = ({ item, onSelect }) => {
  const { name, type, username } = item;

  const handleSelect = (owner: Owner) => {
    if (onSelect) onSelect(owner);
  };

  return (
    <ListItem dense disablePadding>
      <ListItemButton
        alignItems="flex-start"
        dense
        onClick={() => handleSelect(item)}
        sx={{ m: 0.25, py: 0, px: 0.5, borderRadius: 1 }}
      >
        <ListItemIcon sx={{ minWidth: 30 }}>
          {type === 'organization' ? (
            <GroupWorkIcon fontSize="small" />
          ) : (
            <AccountCircleIcon fontSize="small" />
          )}
        </ListItemIcon>
        <ListItemText
          primary={<Typography>{name === '' ? username : name}</Typography>}
          secondary={
            <Typography variant="body2" color="text.secondary">
              {username}
            </Typography>
          }
        />
      </ListItemButton>
    </ListItem>
  );
};

export default Item;

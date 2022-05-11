import FormatSizeIcon from '@mui/icons-material/FormatSize';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import {
  Box,
  Button,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  Menu,
  MenuItem,
} from '@mui/material';
import { useActions, useAppState } from '../../../overmind';
import React, { FC, MouseEvent, useState } from 'react';

const FontSize: FC = () => {
  const actions = useActions();
  const { editor } = useAppState();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleSelect = (value: number) => {
    actions.editor.setFontSize(value);
    setAnchorEl(null);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <ListItem>
      <ListItemIcon sx={{ minWidth: 40 }}>
        <FormatSizeIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText id="language" primary="Font Size" />
      <ListItemSecondaryAction>
        <Box sx={{ flex: 2, mt: 0.5, pl: 1 }}>
          <Button
            aria-controls={open ? 'ont-size-menu' : undefined}
            aria-expanded={open ? 'true' : undefined}
            aria-haspopup="true"
            color="inherit"
            endIcon={<KeyboardArrowDownIcon />}
            id="font-size-button"
            onClick={handleClick}
            size="small"
            sx={{ textTransform: 'lowercase' }}
            variant="text"
          >
            {editor.currentFontSize}pt
          </Button>
          <Menu
            anchorEl={anchorEl}
            id="ont-size-menu"
            MenuListProps={{ 'aria-labelledby': 'font-size-button' }}
            onClose={handleClose}
            open={open}
          >
            {editor.fontSizeOptions.map((size) => (
              <MenuItem key={size} dense disableRipple onClick={() => handleSelect(size)}>
                {size}pt
              </MenuItem>
            ))}
          </Menu>
        </Box>
      </ListItemSecondaryAction>
    </ListItem>
  );
};

export default FontSize;

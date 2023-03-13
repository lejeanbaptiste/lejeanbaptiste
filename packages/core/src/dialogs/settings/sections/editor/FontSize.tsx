import FormatSizeIcon from '@mui/icons-material/FormatSize';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Box, Button, ListItem, Menu, MenuItem, Typography } from '@mui/material';
import React, { MouseEvent, useState } from 'react';
import { useActions, useAppState } from '../../../../overmind';

const options = [8, 9, 10, 11, 12, 13, 14, 16, 18];

export const FontSize = () => {
  const { fontSize: currentFontSize } = useAppState().editor;
  const { setFontSize } = useActions().editor;

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleSelect = (value: number) => {
    setFontSize(value);
    setAnchorEl(null);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <ListItem dense disableGutters>
      <FormatSizeIcon sx={{ mx: 1, height: 18, width: 18 }} />
      <Typography variant="body2">Font Size</Typography>
      <Box flexGrow={1} />
      <Button
        aria-controls={open ? 'font-size-menu' : undefined}
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
        {`${currentFontSize} pt`}
      </Button>
      <Menu
        anchorEl={anchorEl}
        id="ont-size-menu"
        MenuListProps={{ 'aria-labelledby': 'font-size-button' }}
        onClose={handleClose}
        open={open}
      >
        {options.map((size) => (
          <MenuItem key={size} dense disableRipple onClick={() => handleSelect(size)}>
            {`${size} pt`}
          </MenuItem>
        ))}
      </Menu>
    </ListItem>
  );
};

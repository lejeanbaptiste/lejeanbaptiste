import FormatSizeIcon from '@mui/icons-material/FormatSize';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Box, Button, Menu, MenuItem, Stack, Typography } from '@mui/material';
import React, { MouseEvent, useState, type FC } from 'react';
import { useActions, useAppState } from '../../overmind';

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
    <Stack direction="row" alignItems="center">
      <FormatSizeIcon sx={{ mx: 1, height: 18, width: 18 }} />
      <Typography>Font Size</Typography>
      <Box flexGrow={1} />


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
    </Stack>
  );
};

export default FontSize;

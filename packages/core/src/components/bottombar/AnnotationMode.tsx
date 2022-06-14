import { Box, Button, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import { SnackbarKey, useSnackbar } from 'notistack';
import React, { useState, type FC, type MouseEvent } from 'react';
import { useAppState } from '../../overmind';
import useSettings from './useSettings';

const AnnotationMode: FC = () => {
  const { editor } = useAppState();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { changeAnnotationMode } = useSettings();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);

  const handleButtonClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => setAnchorEl(null);

  const handleChange = (annotationMode: number) => {
    handleMenuClose();
    if (annotationMode === editor.annotationMode) return;

    const previousValue = editor.annotationMode;
    const response = changeAnnotationMode({ mode: annotationMode });

    enqueueSnackbar(response, {
      autoHideDuration: 10000,
      action: (key) => <Button onClick={() => handleUndo(key, previousValue)}>Undo</Button>,
    });
  };

  const handleUndo = (snackbarKey: SnackbarKey, previousValue: number) => {
    closeSnackbar(snackbarKey);

    const response = changeAnnotationMode({ mode: previousValue, isUndo: true });
    enqueueSnackbar(response);
  };

  return (
    <Box>
      <Tooltip title="Annotation Mode">
        <span>
          <Button
            id="annotation-mode-select"
            aria-controls="annotation-mode-menu"
            aria-expanded={openMenu ? 'true' : undefined}
            aria-haspopup="true"
            // disabled={editor.isReadonly}
            disabled
            onClick={handleButtonClick}
            size="small"
            sx={{ color: 'text.primary' }}
          >
            {editor.annotationModeLabel}
          </Button>
        </span>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{ horizontal: 'left', vertical: 'top' }}
        id="annotation-mode-menu"
        MenuListProps={{ sx: { py: 0.5, borderRadius: 1 } }}
        onClose={handleMenuClose}
        open={openMenu}
        transformOrigin={{ horizontal: 'left', vertical: 'bottom' }}
      >
        <Box
          display="flex"
          justifyContent="center"
          mt={-0.5}
          mb={0.5}
          sx={{ cursor: 'default', backgroundColor: ({ palette }) => palette.action.hover }}
        >
          <Typography sx={{ cursor: 'default' }} variant="caption">
            Annotation
          </Typography>
        </Box>
        {editor.annotationModes.map(({ disabled, label, value }) => (
          <MenuItem
            key={value}
            dense
            disabled={disabled}
            onClick={() => handleChange(value)}
            selected={value === editor.annotationMode}
            sx={{ mx: 0.5, borderRadius: 1 }}
            value={value}
          >
            {label}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

export default AnnotationMode;

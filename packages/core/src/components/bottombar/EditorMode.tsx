import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import { useAppState } from '../../overmind';
import { SnackbarKey, useSnackbar } from 'notistack';
import React, { FC, MouseEvent, useEffect, useState } from 'react';
import useSettings from './useSettings';

const EditorMode: FC = () => {
  const { editor } = useAppState();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { changeEditorMode, editorModeShouldChange } = useSettings();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [dialogMessage, setDialogMessage] = useState<string>();
  const [modeSelected, setModeSelected] = useState<string>();
  const [openDialog, setOpenDialog] = useState(false);

  const openMenu = Boolean(anchorEl);

  useEffect(() => {
    return () => {
      setDialogMessage(undefined);
      setModeSelected(undefined);
      setOpenDialog(false);
    };
  }, []);

  const handleButtonClick = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleChange = (editorMode: string) => {
    handleMenuClose();
    if (editorMode === editor.editorMode) return;

    const [shouldChange, message] = editorModeShouldChange(editorMode);

    if (!shouldChange) return;
    if (!message) return applyChange(editorMode);

    setModeSelected(editorMode);
    setDialogMessage(message.text);
    setOpenDialog(true);
  };

  const handleConfirmChange = () => {
    handleCloseDialog();
    if (!modeSelected) return;
    applyChange(modeSelected);
    setModeSelected(undefined);
  };

  const handleCloseDialog = () => setOpenDialog(false);

  const applyChange = (editorModeValue: string) => {
    const previousValue = editor.editorMode;
    const response = changeEditorMode({ mode: editorModeValue });

    enqueueSnackbar(response, {
      autoHideDuration: 10000,
      action: (key) => <Button onClick={() => handleUndo(key, previousValue)}>Undo</Button>,
    });
  };

  const handleUndo = (snackbarKey: SnackbarKey, previousValue: string) => {
    closeSnackbar(snackbarKey);
    
    const response = changeEditorMode({ mode: previousValue, isUndo: true });
    enqueueSnackbar(response);
  };

  return (
    <Box>
      <Tooltip title="Editor Mode">
        <Button
          aria-controls="editor-mode-menu"
          aria-expanded={openMenu ? 'true' : undefined}
          aria-haspopup="true"
          disabled={editor.isReadonly}
          id="editor-mode-select"
          onClick={handleButtonClick}
          size="small"
          sx={{ color: 'text.primary' }}
        >
          {editor.editorModeLabel}
        </Button>
      </Tooltip>
      <Menu
        aria-labelledby="editor-mode-select"
        anchorEl={anchorEl}
        anchorOrigin={{ horizontal: 'left', vertical: 'top' }}
        id="editor-mode-menu"
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
            Editor Mode
          </Typography>
        </Box>
        {editor.editorModes.map(({ value, label }) => (
          <MenuItem
            key={value}
            dense
            onClick={() => handleChange(value)}
            selected={value === editor.editorMode}
            sx={{ mx: 0.5, borderRadius: 1 }}
            value={value}
          >
            {label}
          </MenuItem>
        ))}
      </Menu>

      <Dialog onClose={handleCloseDialog} open={openDialog}>
        <DialogTitle>Change Editor Mode?</DialogTitle>
        <DialogContent>
          <DialogContentText>{dialogMessage}</DialogContentText>
          <Typography>Do you wish to continue?</Typography>
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={handleCloseDialog}>
            No
          </Button>
          <Button onClick={handleConfirmChange}>Yes</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EditorMode;

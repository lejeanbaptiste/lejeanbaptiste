import CloseIcon from '@mui/icons-material/Close';
import { Alert, AlertTitle, Dialog, IconButton } from '@mui/material';
import React, { FC } from 'react';
import { useActions, useAppState } from '../overmind';

const AlertDialog: FC = () => {
  const { alertDialog } = useAppState().common;
  const { closeAlertDialog } = useActions().common;

  const { message, onClose, open, type } = alertDialog;

  const handleBackdropClick = () => {
    onClose && onClose();
    closeAlertDialog();
  };

  const handleClose = () => {
    onClose && onClose();
    closeAlertDialog();
  };

  return (
    <Dialog
      aria-describedby="alert-dialog-description"
      aria-labelledby="alert-dialog-title"
      disableEnforceFocus
      onBackdropClick={handleBackdropClick}
      open={open}
    >
      <Alert
        action={
          <IconButton aria-label="close" color="inherit" onClick={handleClose} size="small">
            <CloseIcon fontSize="inherit" />
          </IconButton>
        }
        severity={type}
        variant="outlined"
      >
        <AlertTitle sx={{ textTransform: 'uppercase' }}>{type}</AlertTitle>
        {message}
      </Alert>
    </Dialog>
  );
};

export default AlertDialog;

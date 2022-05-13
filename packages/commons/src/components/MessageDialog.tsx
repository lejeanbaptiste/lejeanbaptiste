import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
} from '@mui/material';
import React, { FC } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import { useActions, useAppState } from '@src/overmind';

const MessageDialog: FC = () => {
  const { messageDialog } = useAppState();
  const { closeCloseMessageDialog } = useActions();
  const {
    closable = true,
    message,
    labelNoButton = 'cancel',
    labelYesButton = 'ok',
    onClose,
    onNo,
    onYes,
    open,
    title,
  } = messageDialog;

  const handleBackdropClick = () => {
    if (!closable) return;
    onClose && onClose();
    closeCloseMessageDialog();
  };

  const handleClose = () => {
    onClose && onClose();
    closeCloseMessageDialog();
  };

  const handleNo = () => {
    onNo && onNo();
    closeCloseMessageDialog();
  };

  const handleYes = () => {
    onYes && onYes();
    closeCloseMessageDialog();
  };

  return (
    <Dialog
      aria-describedby="alert-dialog-description"
      aria-labelledby="alert-dialog-title"
      onBackdropClick={handleBackdropClick}
      open={open}
    >
      <DialogTitle id="alert-dialog-title">
        {title}
        {closable && (
          <IconButton
            aria-label="close"
            onClick={handleClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">{message}</DialogContentText>
      </DialogContent>

      <DialogActions>
        {onNo && <Button onClick={handleNo}>{labelNoButton}</Button>}
        {onYes && (
          <Button onClick={handleYes} autoFocus>
            {labelYesButton}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default MessageDialog;

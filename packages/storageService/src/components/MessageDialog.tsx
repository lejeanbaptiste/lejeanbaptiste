import CloseIcon from '@mui/icons-material/Close';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack
} from '@mui/material';
import React, { FC } from 'react';
import { useActions, useAppState } from '../overmind';

const MessageDialog: FC = () => {
  const { messageDialog } = useAppState().common;
  const { closeMessageDialog } = useActions().common;

  const {
    closable = true,
    fullWidth = true,
    labelCancelButton = 'cancel',
    labelConfirmButton = 'ok',
    maxWidth = 'sm',
    message,
    onClose,
    onCancel,
    onConfirm,
    open,
    progress = false,
    title,
  } = messageDialog;

  const handleBackdropClick = () => {
    if (!closable) return;
    onClose && onClose();
    closeMessageDialog();
  };

  const handleClose = () => {
    onClose && onClose();
    closeMessageDialog();
  };

  const handleCancel = () => {
    onCancel && onCancel();
    closeMessageDialog();
  };

  const handleConfirm = () => {
    onConfirm && onConfirm();
    closeMessageDialog();
  };

  return (
    <Dialog
      aria-describedby="message-dialog-description"
      aria-labelledby="message-dialog-title"
      disableEnforceFocus
      fullWidth={fullWidth}
      maxWidth={maxWidth}
      onBackdropClick={closable ? handleBackdropClick : undefined}
      open={open}
    >
      {title && (
        <DialogTitle id="message-dialog-title">
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
      )}

      <DialogContent>
        <Stack direction="row">
          {progress && <CircularProgress color="secondary" size={20} sx={{ mr: 1.5 }} />}
          <DialogContentText id="message-dialog-description">{message}</DialogContentText>
        </Stack>
      </DialogContent>

      {(onCancel || onConfirm) && (
        <DialogActions sx={{ justifyContent: 'space-between' }}>
          {onCancel && <Button onClick={handleCancel}>{labelCancelButton}</Button>}
          {onConfirm && (
            <Button onClick={handleConfirm} variant="outlined">
              {labelConfirmButton}
            </Button>
          )}
        </DialogActions>
      )}
    </Dialog>
  );
};

export default MessageDialog;

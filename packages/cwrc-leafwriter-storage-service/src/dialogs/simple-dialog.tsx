import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { useActions } from '../overmind';
import { type SimpleDialogProps } from './type';

export const SimpleDialog = ({
  actions = [{ action: 'close', label: 'close' }],
  id = uuidv4(),
  maxWidth = 'sm',
  Body,
  onBeforeClose,
  onClose,
  open = true,
  preventEscape = false,
  severity,
  title,
  children,
}: SimpleDialogProps) => {
  const { closeDialog } = useActions().ui;

  const { t } = useTranslation();

  const [data, setData] = useState<{ [key: string]: any }>({});

  const handleShouldCLose = async (action?: string) => {
    if (!onBeforeClose) return true;
    return await onBeforeClose(action);
  };

  const handleClose = async (_event: MouseEvent, reason: string) => {
    if (preventEscape && (reason === 'backdropClick' || reason === 'escapeKeyDown')) {
      return;
    }

    const shouldClose = await handleShouldCLose();
    if (!shouldClose) return;

    closeDialog(id);
    onClose && onClose(reason, data);
  };

  const handleAction = async (action: string) => {
    const shouldClose = await handleShouldCLose(action);
    if (!shouldClose) return;

    closeDialog(id);
    onClose && onClose(action, data);
  };

  return (
    <Dialog
      aria-labelledby="alert-dialog-title"
      fullWidth
      id={id}
      maxWidth={maxWidth}
      onClose={handleClose}
      open={open}
    >
      <DialogTitle
        id="alert-dialog-title"
        sx={{ display: 'flex', alignItems: 'center', gap: 1, textTransform: 'capitalize' }}
      >
        {severity === 'error' && <ErrorOutlineIcon />}
        {severity === 'warning' && <WarningAmberIcon />}
        {title}
      </DialogTitle>
      {(children || Body) && (
        <DialogContent sx={{ pt: 0.5 }}>
          {children
            ? children
            : typeof Body === 'string'
              ? Body
              : Body && <Body data={data} onChangeData={setData} />}
        </DialogContent>
      )}
      <DialogActions
        sx={[
          {
            justifyContent: 'flex-end',
            '& :first-of-type': { marginRight: 0 },
          },
          actions.length > 1 && {
            justifyContent: 'space-between',
            '& :first-of-type': { marginRight: 'auto' },
          },
        ]}
      >
        {actions.map(({ action, label, variant }, index) => (
          <Button key={index} onClick={() => handleAction(action)} variant={variant ?? 'text'}>
            {t(`SS.${label ?? action}`)}
          </Button>
        ))}
      </DialogActions>
    </Dialog>
  );
};

import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Icon } from '@mui/material';
import { getIcon } from '@src/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { useActions } from '../overmind';
import type { SimpleDialogProps } from './type';

export const SimpleDialog = ({
  actions = [{ action: 'close', label: 'close' }],
  Body,
  id = uuidv4(),
  icon,
  maxWidth = 'sm',
  onBeforeClose,
  onClose,
  open = true,
  preventEscape = false,
  severity,
  title,
  children,
}: SimpleDialogProps) => {
  const { closeDialog } = useActions().ui;
  const { t } = useTranslation('LWC');

  const [data, setData] = useState<{ [key: string]: any }>({});
  const [actionsDisabled, setActionsDisabled] = useState(false);

  const handleShouldClose = async (action?: string) => {
    if (!onBeforeClose) return true;
    return await onBeforeClose(action);
  };

  const handleClose = async (_event: MouseEvent, reason: string) => {
    if (preventEscape && (reason === 'backdropClick' || reason === 'escapeKeyDown')) {
      return;
    }

    setActionsDisabled(true);
    const shouldClose = await handleShouldClose();
    if (shouldClose === false) {
      setActionsDisabled(false);
      return;
    }

    closeDialog(id);
    onClose && onClose(reason, data);
  };

  const handleAction = async (action: string) => {
    setActionsDisabled(true);
    const shouldClose = await handleShouldClose(action);
    if (shouldClose === false) {
      setActionsDisabled(false);
      return;
    }

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
        display="flex"
        justifyContent="center"
        alignItems="center"
        py={2.5}
        gap={1}
        textTransform="capitalize"
      >
        {icon ? (
          <Icon component={getIcon(icon)} />
        ) : (
          <>
            {severity === 'error' && <ErrorOutlineIcon color="error" />}
            {severity === 'warning' && <WarningAmberIcon color="warning" />}
          </>
        )}
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
        sx={{
          mx: 1.5,
          justifyContent: actions.length > 1 ? 'space-between' : 'flex-end',
          '& :first-of-type': {
            marginRight: actions.length > 1 ? 'auto' : 0,
          },
        }}
      >
        {actions.map(({ action, label, variant }, index) => (
          <Button
            key={index}
            disabled={actionsDisabled}
            onClick={() => handleAction(action)}
            variant={variant ?? 'text'}
          >
            {t(`LWC:commons.${label ?? action}`)}
          </Button>
        ))}
      </DialogActions>
    </Dialog>
  );
};

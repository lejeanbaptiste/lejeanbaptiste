import { Box, Button, Menu as MuiMenu, MenuItem, Typography } from '@mui/material';
import { SnackbarKey } from 'notistack';
import React, { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { SeverityType } from '../../../dialogs';
import { useActions, useAppState } from '../../../overmind';
import useEditorReaction from '../hooks/useEditorReaction';

interface IMenu {
  anchorEl?: HTMLElement;
  handleClose: () => void;
}

export const Menu: FC<IMenu> = ({ anchorEl, handleClose }) => {
  const { editorMode, editorModes } = useAppState().editor;
  const { closeNotificationSnackbar, openDialog, notifyViaSnackbar } = useActions().ui;
  const { t } = useTranslation(['leafwriter']);

  const { changeEditorMode, editorModeShouldChange } = useEditorReaction();

  const openMenu = Boolean(anchorEl);

  const handleChange = (value: string) => {
    handleClose();
    if (value === editorMode) return;

    const [shouldChange, message] = editorModeShouldChange(value);

    if (!shouldChange) return;
    if (!message) return applyChanges(value);

    handleOpenConfirmationDialog(value, message.text, message.severity);
  };

  const handleOpenConfirmationDialog = (
    value: string,
    text: React.ReactNode,
    severity?: SeverityType
  ) => {
    openDialog({
      type: 'simple',
      props: {
        maxWidth: 'xs',
        severity,
        title: `${t('Change Editor Mode')}?`,
        Message: () => <>{text}</>,
        actions: [
          { action: 'cance', label: t('cancel'), variant: 'outlined' },
          { action: 'change', label: severity === 'warning' ? t('change anyway') : t('change') },
        ],
        onClose: async (action: string) => {
          if (action !== 'change') return;
          applyChanges(value);
        },
      },
    });
  };

  const applyChanges = (value: string) => {
    const previousValue = editorMode;
    const response = changeEditorMode({ value: value });

    notifyViaSnackbar({
      message: response,
      options: {
        action: (key) => (
          <Button color="secondary" onClick={() => handleUndo(key, previousValue)} size="small">
            {t('undo')}
          </Button>
        ),
      },
    });
  };

  const handleUndo = (snackbarKey: SnackbarKey, previousValue: string) => {
    closeNotificationSnackbar(snackbarKey);

    const response = changeEditorMode({ value: previousValue, isUndo: true });
    notifyViaSnackbar(response);
  };

  return (
    <MuiMenu
      anchorEl={anchorEl}
      anchorOrigin={{ horizontal: 'left', vertical: 'top' }}
      aria-labelledby="editor-mode-select"
      id="editor-mode-menu"
      MenuListProps={{ sx: { py: 0.5, borderRadius: 1 } }}
      onClose={handleClose}
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
          {t('Editor Mode')}
        </Typography>
      </Box>
      {editorModes.map(({ disabled, label, value }) => (
        <MenuItem
          key={value}
          dense
          disabled={disabled}
          onClick={() => handleChange(value)}
          selected={value === editorMode}
          sx={{ mx: 0.5, borderRadius: 1 }}
          value={value}
        >
          {label}
        </MenuItem>
      ))}
    </MuiMenu>
  );
};

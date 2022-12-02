import { Box, Button, Menu as MuiMenu, MenuItem, Typography } from '@mui/material';
import { SnackbarKey } from 'notistack';
import React, { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useActions, useAppState } from '../../../overmind';
import useEditorReaction from '../hooks/useEditorReaction';

interface MenuProps {
  anchorEl?: HTMLElement;
  handleClose: () => void;
}

export const Menu: FC<MenuProps> = ({ anchorEl, handleClose }) => {
  const { annotationMode, annotationModes } = useAppState().editor;
  const { closeNotificationSnackbar, notifyViaSnackbar } = useActions().ui;
  const { changeAnnotationMode } = useEditorReaction();

  const { t } = useTranslation(['leafwriter']);

  const openMenu = Boolean(anchorEl);

  const handleChange = (value: number) => {
    handleClose();
    if (annotationMode === value) return;

    const previousValue = annotationMode;
    const response = changeAnnotationMode({ value: annotationMode });

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

  const handleUndo = (snackbarKey: SnackbarKey, previousValue: number) => {
    closeNotificationSnackbar(snackbarKey);

    const response = changeAnnotationMode({ value: previousValue, isUndo: true });
    notifyViaSnackbar(response);
  };

  return (
    <MuiMenu
      anchorEl={anchorEl}
      anchorOrigin={{ horizontal: 'left', vertical: 'top' }}
      id="annotation-mode-menu"
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
          {t('Annotation')}
        </Typography>
      </Box>
      {annotationModes.map(({ disabled, label, value }) => (
        <MenuItem
          key={value}
          dense
          disabled={disabled}
          onClick={() => handleChange(value)}
          selected={value === annotationMode}
          sx={{ mx: 0.5, borderRadius: 1 }}
          value={value}
        >
          {label}
        </MenuItem>
      ))}
    </MuiMenu>
  );
};

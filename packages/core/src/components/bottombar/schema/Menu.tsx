import EditIcon from '@mui/icons-material/Edit';
import {
  Button,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemText,
  Menu as MenuMui,
} from '@mui/material';
import { SnackbarKey } from 'notistack';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { SeverityType } from '../../../dialogs';
import { useActions, useAppState } from '../../../overmind';
import useEditorReaction from '../hooks/useEditorReaction';
import { Header } from './Header';

interface MenuProps {
  anchorEl?: HTMLElement | null;
  handleClose: () => void;
}

export const Menu = ({ anchorEl, handleClose }: MenuProps) => {
  const { document, editor } = useAppState();
  const { closeNotificationSnackbar, openDialog, notifyViaSnackbar } = useActions().ui;
  const { t } = useTranslation('leafwriter');

  const { changeSchema, schemaShouldChange } = useEditorReaction();

  const open = Boolean(anchorEl);

  const handleChange = async (schemaId: string) => {
    handleClose();
    if (schemaId === document.schemaId) return;

    const [shouldChange, message] = await schemaShouldChange(schemaId);

    if (shouldChange && message) {
      return handleOpenConfirmationDialog(schemaId, message.text, message.severity);
    }

    if (message) return handleOpenConfirmationDialog(schemaId, message.text, message.severity);

    applyNewSchema(schemaId);
  };

  const handleOpenConfirmationDialog = (
    schemaId: string,
    text: React.ReactNode,
    severity?: SeverityType
  ) => {
    openDialog({
      type: 'simple',
      props: {
        maxWidth: severity === 'error' ? 'xs' : 'sm',
        severity,
        title: `${t('Change Schema')}?`,
        Message: () => <>{text}</>,
        actions:
          severity === 'error'
            ? [{ action: 'close', label: t('commons.close').toString() }]
            : [
                { action: 'cancel', label: t('commons.cancel').toString(), variant: 'outlined' },
                { action: 'change', label: t('change anyway').toString() },
              ],
        onClose: async (action) => {
          if (action !== 'change') return;
          applyNewSchema(schemaId);
        },
      },
    });
  };

  const applyNewSchema = (schemaId: string) => {
    const previousValue = document.schemaId;
    const response = changeSchema({ value: schemaId });

    notifyViaSnackbar({
      message: response,
      options: {
        action: (key) => (
          <Button color="secondary" onClick={() => handleUndo(key, previousValue)} size="small">
            {t('commons.undo')}
          </Button>
        ),
      },
    });
  };

  const handleOpenEditSchemaDialog = (action: 'add' | 'update', id?: string) => {
    const mappingIds = document.rootName
      ? window.writer.schemaManager.getMappingIdsFromRoot(document.rootName)
      : undefined;
    openDialog({
      type: 'editSchema',
      props: { actionType: action, mappingIds, schemaId: id },
    });
  };

  const handleUndo = (snackbarKey: SnackbarKey, previousValue: string) => {
    closeNotificationSnackbar(snackbarKey);
    const response = changeSchema({ value: previousValue, isUndo: true });

    notifyViaSnackbar(response);
  };

  return (
    <MenuMui
      anchorEl={anchorEl}
      anchorOrigin={{ horizontal: 'left', vertical: 'top' }}
      aria-labelledby="schema-select"
      id="schema-menu"
      MenuListProps={{ sx: { py: 0.5, borderRadius: 1 } }}
      onClose={handleClose}
      open={open}
      transformOrigin={{ horizontal: 'left', vertical: 'bottom' }}
    >
      <Header onClickAdd={handleOpenEditSchemaDialog} />
      {editor.schemasList.map(({ id, name, editable }) => (
        <ListItem
          key={id}
          dense
          disablePadding
          secondaryAction={
            editable && (
              <IconButton onClick={() => handleOpenEditSchemaDialog('update', id)}>
                <EditIcon sx={{ height: 12, width: 12 }} />
              </IconButton>
            )
          }
        >
          <ListItemButton
            dense
            onClick={() => handleChange(id)}
            selected={id === document.schemaId}
            sx={{ mx: 0.5, borderRadius: 1 }}
          >
            <ListItemText primary={name} />
          </ListItemButton>
        </ListItem>
      ))}
    </MenuMui>
  );
};

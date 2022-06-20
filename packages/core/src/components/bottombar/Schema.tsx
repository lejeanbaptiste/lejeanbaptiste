import AddIcon from '@mui/icons-material/Add';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grow,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import { SnackbarKey, useSnackbar } from 'notistack';
import React, { MouseEvent, useEffect, useState, type FC } from 'react';
import { useAppState } from '../../overmind';
import AddSchemaDialog from './AddSchemaDialog';
import useSettings from './useSettings';

const Schema: FC = () => {
  const { document, editor } = useAppState();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { changeSchema, schemaShouldChange } = useSettings();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [dialogType, setDialogType] = useState('warning');
  const [dialogMessage, setDialogMessage] = useState<string>();
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [schemaSelected, setSchemaSelected] = useState<string>('');

  const openMenu = Boolean(anchorEl);

  useEffect(() => {
    // if (state.document.schemaId === '') {
    //   const schema = window.writer.schemaManager.getCurrentSchema();
    //   actions.document.setInitialStateSchema(schema.id);
    // }
    return () => {
      setDialogMessage(undefined);
      setDialogType('warning');
      setOpenAddDialog(false);
      setOpenDialog(false);
      setSchemaSelected('');
    };
  }, []);

  const handleButtonClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => setAnchorEl(null);

  const handleChange = async (schemaId?: string) => {
    handleMenuClose();
    if (!schemaId) return;
    if (schemaId === document.schemaId) return;

    const [shouldChange, message] = await schemaShouldChange(schemaId);

    if (!shouldChange) {
      if (message) {
        setDialogType(message.type);
        setDialogMessage(message.text);
        setOpenDialog(true);
      }
      return;
    }

    setSchemaSelected(schemaId);

    if (message) {
      setDialogType(message.type);
      setDialogMessage(message.text);
      setOpenDialog(true);
      return;
    }

    doChangeSchema(schemaId);
  };

  const handleConfirmChange = () => {
    doChangeSchema(schemaSelected);
    handleCloseDialog();
  };

  const doChangeSchema = (schemaId: string) => {
    const previousValue = document.schemaId;

    const response = changeSchema({ schemaId });

    enqueueSnackbar(response, {
      autoHideDuration: 10000,
      action: (key) => <Button onClick={() => handleUndo(key, previousValue)}>Undo</Button>,
    });
  };

  const handleCloseDialog = () => setOpenDialog(false);

  const handleAddSchema = () => setOpenAddDialog(true);
  const handleCloseAddDialog = () => setOpenAddDialog(false);

  const handleUndo = (snackbarKey: SnackbarKey, previousValue: string) => {
    closeSnackbar(snackbarKey);
    const response = changeSchema({ schemaId: previousValue, isUndo: true });
    enqueueSnackbar(response);
  };

  return (
    <Grow in={document.schemaId !== ''}>
      <Box>
        <Tooltip title="Schema">
          <Button
            aria-controls="schema-menu"
            aria-expanded={openMenu ? 'true' : undefined}
            aria-haspopup="true"
            disabled={editor.isReadonly}
            id="schema-select"
            onClick={handleButtonClick}
            size="small"
            sx={{ color: 'text.primary' }}
          >
            {document.schemaName}
          </Button>
        </Tooltip>
        <Menu
          anchorEl={anchorEl}
          anchorOrigin={{ horizontal: 'left', vertical: 'top' }}
          aria-labelledby="schema-select"
          id="schema-menu"
          MenuListProps={{ sx: { py: 0.5, borderRadius: 1 } }}
          onClose={handleMenuClose}
          open={openMenu}
          transformOrigin={{ horizontal: 'left', vertical: 'bottom' }}
        >
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mt={-0.5}
            mb={0.5}
            px={0.5}
            sx={{ cursor: 'default', backgroundColor: ({ palette }) => palette.action.hover }}
          >
            <Box height={1.5} width={1.5} p="3px" />
            <Typography sx={{ cursor: 'default' }} variant="caption">
              Schema
            </Typography>
            <IconButton aria-label="add" onClick={handleAddSchema} size="small">
              <AddIcon
                fontSize="inherit"
                sx={{ height: ({ spacing }) => spacing(1.5), width: ({ spacing }) => spacing(1.5) }}
              />
            </IconButton>
          </Box>
          {editor.schemas.map(({ id, name }) => (
            <MenuItem
              key={id}
              dense
              onClick={() => handleChange(id)}
              selected={id === document.schemaId}
              sx={{ mx: 0.5, borderRadius: 1 }}
              value={id}
            >
              {name}
            </MenuItem>
          ))}
        </Menu>
        <AddSchemaDialog handleClose={handleCloseAddDialog} open={openAddDialog} />

        <Dialog onClose={handleCloseDialog} open={openDialog}>
          <DialogTitle>Change Schema?</DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description">{dialogMessage}</DialogContentText>
            <Typography>Do you wish to continue?</Typography>
          </DialogContent>
          <DialogActions>
            {dialogType === 'error' ? (
              <Button autoFocus onClick={handleCloseDialog}>
                Ok
              </Button>
            ) : (
              <>
                <Button autoFocus onClick={handleCloseDialog}>
                  No
                </Button>
                <Button onClick={handleConfirmChange}>Yes</Button>
              </>
            )}
          </DialogActions>
        </Dialog>
      </Box>
    </Grow>
  );
};

export default Schema;

import AddIcon from '@mui/icons-material/Add';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Grow, IconButton, Menu, MenuItem, Tooltip, Typography, } from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useAppState } from '../../overmind';
import AddSchemaDialog from './AddSchemaDialog';
import useSettings from './useSettings';
const Schema = () => {
    const { document, editor } = useAppState();
    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const { changeSchema, schemaShouldChange } = useSettings();
    const [anchorEl, setAnchorEl] = useState(null);
    const [dialogType, setDialogType] = useState('warning');
    const [dialogMessage, setDialogMessage] = useState();
    const [openAddDialog, setOpenAddDialog] = useState(false);
    const [openDialog, setOpenDialog] = useState(false);
    const [schemaSelected, setSchemaSelected] = useState('');
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
    const handleButtonClick = (event) => {
        setAnchorEl(event.currentTarget);
    };
    const handleMenuClose = () => setAnchorEl(null);
    const handleChange = async (schemaId) => {
        handleMenuClose();
        if (!schemaId)
            return;
        if (schemaId === document.schemaId)
            return;
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
    const doChangeSchema = (schemaId) => {
        const previousValue = document.schemaId;
        const response = changeSchema({ schemaId });
        enqueueSnackbar(response, {
            autoHideDuration: 10000,
            action: (key) => React.createElement(Button, { onClick: () => handleUndo(key, previousValue) }, "Undo"),
        });
    };
    const handleCloseDialog = () => setOpenDialog(false);
    const handleAddSchema = () => setOpenAddDialog(true);
    const handleCloseAddDialog = () => setOpenAddDialog(false);
    const handleUndo = (snackbarKey, previousValue) => {
        closeSnackbar(snackbarKey);
        const response = changeSchema({ schemaId: previousValue, isUndo: true });
        enqueueSnackbar(response);
    };
    return (React.createElement(Grow, { in: document.schemaId !== '' },
        React.createElement(Box, null,
            React.createElement(Tooltip, { title: "Schema" },
                React.createElement(Button, { "aria-controls": "schema-menu", "aria-expanded": openMenu ? 'true' : undefined, "aria-haspopup": "true", disabled: editor.isReadonly, id: "schema-select", onClick: handleButtonClick, size: "small", sx: { color: 'text.primary' } }, document.schemaName)),
            React.createElement(Menu, { anchorEl: anchorEl, anchorOrigin: { horizontal: 'left', vertical: 'top' }, "aria-labelledby": "schema-select", id: "schema-menu", MenuListProps: { sx: { py: 0.5, borderRadius: 1 } }, onClose: handleMenuClose, open: openMenu, transformOrigin: { horizontal: 'left', vertical: 'bottom' } },
                React.createElement(Box, { display: "flex", justifyContent: "space-between", alignItems: "center", mt: -0.5, mb: 0.5, px: 0.5, sx: { cursor: 'default', backgroundColor: ({ palette }) => palette.action.hover } },
                    React.createElement(Box, { height: 1.5, width: 1.5, p: "3px" }),
                    React.createElement(Typography, { sx: { cursor: 'default' }, variant: "caption" }, "Schema"),
                    React.createElement(IconButton, { "aria-label": "add", onClick: handleAddSchema, size: "small" },
                        React.createElement(AddIcon, { fontSize: "inherit", sx: { height: ({ spacing }) => spacing(1.5), width: ({ spacing }) => spacing(1.5) } }))),
                editor.schemas.map(({ id, name }) => (React.createElement(MenuItem, { key: id, dense: true, onClick: () => handleChange(id), selected: id === document.schemaId, sx: { mx: 0.5, borderRadius: 1 }, value: id }, name)))),
            React.createElement(AddSchemaDialog, { handleClose: handleCloseAddDialog, open: openAddDialog }),
            React.createElement(Dialog, { onClose: handleCloseDialog, open: openDialog },
                React.createElement(DialogTitle, null, "Change Schema?"),
                React.createElement(DialogContent, null,
                    React.createElement(DialogContentText, { id: "alert-dialog-description" }, dialogMessage),
                    React.createElement(Typography, null, "Do you wish to continue?")),
                React.createElement(DialogActions, null, dialogType === 'error' ? (React.createElement(Button, { autoFocus: true, onClick: handleCloseDialog }, "Ok")) : (React.createElement(React.Fragment, null,
                    React.createElement(Button, { autoFocus: true, onClick: handleCloseDialog }, "No"),
                    React.createElement(Button, { onClick: handleConfirmChange }, "Yes"))))))));
};
export default Schema;
//# sourceMappingURL=Schema.js.map
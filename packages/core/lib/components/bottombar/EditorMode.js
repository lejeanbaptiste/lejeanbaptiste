import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Menu, MenuItem, Tooltip, Typography, } from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';
import { useAppState } from '../../overmind';
import useSettings from './useSettings';
const EditorMode = () => {
    const { editor } = useAppState();
    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const { changeEditorMode, editorModeShouldChange } = useSettings();
    const [anchorEl, setAnchorEl] = useState(null);
    const [dialogMessage, setDialogMessage] = useState();
    const [modeSelected, setModeSelected] = useState();
    const [openDialog, setOpenDialog] = useState(false);
    const openMenu = Boolean(anchorEl);
    useEffect(() => {
        return () => {
            setDialogMessage(undefined);
            setModeSelected(undefined);
            setOpenDialog(false);
        };
    }, []);
    const handleButtonClick = (event) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);
    const handleChange = (editorMode) => {
        handleMenuClose();
        if (editorMode === editor.editorMode)
            return;
        const [shouldChange, message] = editorModeShouldChange(editorMode);
        if (!shouldChange)
            return;
        if (!message)
            return applyChange(editorMode);
        setModeSelected(editorMode);
        setDialogMessage(message.text);
        setOpenDialog(true);
    };
    const handleConfirmChange = () => {
        handleCloseDialog();
        if (!modeSelected)
            return;
        applyChange(modeSelected);
        setModeSelected(undefined);
    };
    const handleCloseDialog = () => setOpenDialog(false);
    const applyChange = (editorModeValue) => {
        const previousValue = editor.editorMode;
        const response = changeEditorMode({ mode: editorModeValue });
        enqueueSnackbar(response, {
            autoHideDuration: 10000,
            action: (key) => React.createElement(Button, { onClick: () => handleUndo(key, previousValue) }, "Undo"),
        });
    };
    const handleUndo = (snackbarKey, previousValue) => {
        closeSnackbar(snackbarKey);
        const response = changeEditorMode({ mode: previousValue, isUndo: true });
        enqueueSnackbar(response);
    };
    return (React.createElement(Box, null,
        React.createElement(Tooltip, { title: "Editor Mode" },
            React.createElement(Button, { "aria-controls": "editor-mode-menu", "aria-expanded": openMenu ? 'true' : undefined, "aria-haspopup": "true", disabled: editor.isReadonly, id: "editor-mode-select", onClick: handleButtonClick, size: "small", sx: { color: 'text.primary' } }, editor.editorModeLabel)),
        React.createElement(Menu, { "aria-labelledby": "editor-mode-select", anchorEl: anchorEl, anchorOrigin: { horizontal: 'left', vertical: 'top' }, id: "editor-mode-menu", MenuListProps: { sx: { py: 0.5, borderRadius: 1 } }, onClose: handleMenuClose, open: openMenu, transformOrigin: { horizontal: 'left', vertical: 'bottom' } },
            React.createElement(Box, { display: "flex", justifyContent: "center", mt: -0.5, mb: 0.5, sx: { cursor: 'default', backgroundColor: ({ palette }) => palette.action.hover } },
                React.createElement(Typography, { sx: { cursor: 'default' }, variant: "caption" }, "Editor Mode")),
            editor.editorModes.map(({ value, label }) => (React.createElement(MenuItem, { key: value, dense: true, onClick: () => handleChange(value), selected: value === editor.editorMode, sx: { mx: 0.5, borderRadius: 1 }, value: value }, label)))),
        React.createElement(Dialog, { onClose: handleCloseDialog, open: openDialog },
            React.createElement(DialogTitle, null, "Change Editor Mode?"),
            React.createElement(DialogContent, null,
                React.createElement(DialogContentText, null, dialogMessage),
                React.createElement(Typography, null, "Do you wish to continue?")),
            React.createElement(DialogActions, null,
                React.createElement(Button, { autoFocus: true, onClick: handleCloseDialog }, "No"),
                React.createElement(Button, { onClick: handleConfirmChange }, "Yes")))));
};
export default EditorMode;
//# sourceMappingURL=EditorMode.js.map
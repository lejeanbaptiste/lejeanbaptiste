import { Box, Button, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useState } from 'react';
import { useAppState } from '../../overmind';
import useSettings from './useSettings';
const AnnotationMode = () => {
    const { editor } = useAppState();
    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const { changeAnnotationMode } = useSettings();
    const [anchorEl, setAnchorEl] = useState(null);
    const openMenu = Boolean(anchorEl);
    const handleButtonClick = (event) => {
        setAnchorEl(event.currentTarget);
    };
    const handleMenuClose = () => setAnchorEl(null);
    const handleChange = (annotationMode) => {
        handleMenuClose();
        if (annotationMode === editor.annotationMode)
            return;
        const previousValue = editor.annotationMode;
        const response = changeAnnotationMode({ mode: annotationMode });
        enqueueSnackbar(response, {
            autoHideDuration: 10000,
            action: (key) => React.createElement(Button, { onClick: () => handleUndo(key, previousValue) }, "Undo"),
        });
    };
    const handleUndo = (snackbarKey, previousValue) => {
        closeSnackbar(snackbarKey);
        const response = changeAnnotationMode({ mode: previousValue, isUndo: true });
        enqueueSnackbar(response);
    };
    return (React.createElement(Box, null,
        React.createElement(Tooltip, { title: "Annotation Mode" },
            React.createElement("span", null,
                React.createElement(Button, { id: "annotation-mode-select", "aria-controls": "annotation-mode-menu", "aria-expanded": openMenu ? 'true' : undefined, "aria-haspopup": "true", 
                    // disabled={editor.isReadonly}
                    disabled: true, onClick: handleButtonClick, size: "small", sx: { color: 'text.primary' } }, editor.annotationModeLabel))),
        React.createElement(Menu, { anchorEl: anchorEl, anchorOrigin: { horizontal: 'left', vertical: 'top' }, id: "annotation-mode-menu", MenuListProps: { sx: { py: 0.5, borderRadius: 1 } }, onClose: handleMenuClose, open: openMenu, transformOrigin: { horizontal: 'left', vertical: 'bottom' } },
            React.createElement(Box, { display: "flex", justifyContent: "center", mt: -0.5, mb: 0.5, sx: { cursor: 'default', backgroundColor: ({ palette }) => palette.action.hover } },
                React.createElement(Typography, { sx: { cursor: 'default' }, variant: "caption" }, "Annotation")),
            editor.annotationModes.map(({ disabled, label, value }) => (React.createElement(MenuItem, { key: value, dense: true, disabled: disabled, onClick: () => handleChange(value), selected: value === editor.annotationMode, sx: { mx: 0.5, borderRadius: 1 }, value: value }, label))))));
};
export default AnnotationMode;
//# sourceMappingURL=AnnotationMode.js.map
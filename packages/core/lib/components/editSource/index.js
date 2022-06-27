import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, } from '@mui/material';
import React, { Suspense, useEffect, useState } from 'react';
import { useActions, useAppState } from '../../overmind';
const Editor = React.lazy(() => import('./Editor'));
const EditSourceDialog = () => {
    const [originalContent, setOriginalContent] = useState('');
    const [content, setContent] = useState('');
    const { editSourceProps } = useAppState().ui;
    const { closeEditSourceDialog, processEditSource } = useActions().ui;
    useEffect(() => {
        if (editSourceProps.content)
            setContent(editSourceProps.content);
        if (editSourceProps.content)
            setOriginalContent(editSourceProps.content);
    }, [editSourceProps.content]);
    const handleUpdateContent = (value) => {
        setContent(value);
    };
    const handleClose = () => {
        closeEditSourceDialog();
    };
    const handleOk = () => {
        if (content === originalContent) {
            closeEditSourceDialog();
            return;
        }
        processEditSource(content);
    };
    const Progress = () => (React.createElement(Box, { display: "flex", height: 600, width: "100%", alignItems: "center", justifyContent: "center" },
        React.createElement(CircularProgress, { sx: { width: '100%' } })));
    return (React.createElement(Dialog, { "aria-labelledby": "edit-source-title", fullWidth: true, maxWidth: "lg", open: editSourceProps.open },
        React.createElement(DialogTitle, { id: "edit-source-title", sx: { textAlign: 'center', fontSize: '1rem', padding: 0 } }, "Edit Source"),
        React.createElement(DialogContent, { sx: { minHeight: 600, padding: 0 } },
            React.createElement(Suspense, { fallback: React.createElement(Progress, null) }, editSourceProps.content && (React.createElement(Editor, { content: editSourceProps.content, updateContent: handleUpdateContent })))),
        React.createElement(DialogActions, { sx: { justifyContent: 'space-between' } },
            React.createElement(Button, { autoFocus: true, onClick: handleClose, variant: "outlined" }, "Cancel"),
            React.createElement(Button, { onClick: handleOk, variant: "contained" }, "Ok"))));
};
export default EditSourceDialog;
//# sourceMappingURL=index.js.map
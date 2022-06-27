import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { Button, Stack } from '@mui/material';
import { useSnackbar } from 'notistack';
import React from 'react';
import { useActions } from '../../overmind';
const Resets = () => {
    const { editor } = useActions();
    const { enqueueSnackbar } = useSnackbar();
    const handleResetWarning = () => {
        editor.resetDialogWarnings();
        const message = 'Confirmation dialog preferences have been reset';
        enqueueSnackbar(message);
    };
    const handleResetSettings = () => {
        editor.resetPreferences();
        const message = 'Settings preferences have been reset to default';
        enqueueSnackbar(message);
    };
    return (React.createElement(Stack, { alignItems: "flex-start", spacing: 1, py: 1 },
        React.createElement(Button, { color: "inherit", onClick: handleResetWarning, size: "small", startIcon: React.createElement(RestartAltIcon, null), variant: "outlined", sx: { justifyContent: 'flex-start' } }, "Reset Dialog Warnings"),
        React.createElement(Button, { color: "inherit", onClick: handleResetSettings, size: "small", startIcon: React.createElement(RestartAltIcon, null), variant: "outlined", sx: { justifyContent: 'flex-start' } }, "Reset Settings")));
};
export default Resets;
//# sourceMappingURL=Resets.js.map
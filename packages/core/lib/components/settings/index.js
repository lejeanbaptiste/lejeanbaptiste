import CloseIcon from '@mui/icons-material/Close';
import TuneIcon from '@mui/icons-material/Tune';
import { Dialog, DialogContent, IconButton, Stack, Typography } from '@mui/material';
import React from 'react';
import { useActions, useAppState } from '../../overmind';
import AutoritiesPanel from './AuthoritySource';
import FontSize from './FontSize';
import Language from './Language';
import Resets from './Resets';
import Section from './Section';
import ShowEntities from './ShowEntities';
import ThemeAppearance from './ThemeAppearance';
const SettingsDialog = () => {
    const { settingsDialogOpen } = useAppState().ui;
    const { closeSettingsDialog } = useActions().ui;
    const handleClose = () => {
        closeSettingsDialog();
    };
    return (React.createElement(Dialog, { "aria-labelledby": "settings-title", fullWidth: true, maxWidth: "sm", onClose: handleClose, open: settingsDialogOpen },
        React.createElement(Stack, { direction: "row", justifyContent: "center", alignItems: "center", py: 2, spacing: 2 },
            React.createElement(TuneIcon, { sx: { height: 24, width: 24 } }),
            React.createElement(Typography, { sx: { textTransform: 'capitalize' }, variant: "h5" }, "Settings"),
            React.createElement(IconButton, { "aria-label": "close", onClick: closeSettingsDialog, sx: {
                    position: 'absolute',
                    right: 8,
                    top: 12,
                    color: (theme) => theme.palette.grey[500],
                } },
                React.createElement(CloseIcon, { fontSize: "inherit" }))),
        React.createElement(DialogContent, { sx: { width: 500 } },
            React.createElement(Stack, { spacing: 3, sx: { pt: 2.5 } },
                React.createElement(Section, { title: "Interface" },
                    React.createElement(ThemeAppearance, null),
                    React.createElement(Language, null)),
                React.createElement(Section, { title: "Editor" },
                    React.createElement(FontSize, null),
                    React.createElement(ShowEntities, null)),
                React.createElement(Section, { title: "Authorities" },
                    React.createElement(AutoritiesPanel, null)),
                React.createElement(Section, { title: "Resets" },
                    React.createElement(Resets, null))))));
};
export default SettingsDialog;
//# sourceMappingURL=index.js.map
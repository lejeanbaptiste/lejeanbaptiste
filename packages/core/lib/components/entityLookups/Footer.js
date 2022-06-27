import { Button, DialogActions } from '@mui/material';
import React from 'react';
import { useActions, useAppState } from '../../overmind';
const Footer = () => {
    const { type } = useAppState().ui.entityLookupDialogProps;
    const { closeEntityLookupsDialog } = useActions().ui;
    const { isUriValid, query, selected, manualInput } = useAppState().lookups;
    const { processSelected } = useActions().lookups;
    const handleNoLink = () => {
        if (!type)
            return;
        handleClose({ type, query });
    };
    const handlSelectLink = () => {
        const link = processSelected();
        if (!link)
            return;
        handleClose(link);
    };
    const handleCancel = () => {
        handleClose();
    };
    const handleClose = (link) => {
        closeEntityLookupsDialog(link);
    };
    return (React.createElement(DialogActions, { sx: {
            justifyContent: 'space-between',
            borderTopWidth: 1,
            borderTopStyle: 'solid',
            borderTopColor: ({ palette }) => palette.divider,
        } },
        React.createElement(Button, { autoFocus: true, onClick: handleCancel, variant: "text" }, "Cancel"),
        React.createElement(Button, { onClick: handleNoLink, variant: "text" }, "Tag without Linking"),
        React.createElement(Button, { disabled: !selected && (manualInput === '' || !isUriValid), onClick: handlSelectLink, variant: "contained" }, "Select")));
};
export default Footer;
//# sourceMappingURL=Footer.js.map
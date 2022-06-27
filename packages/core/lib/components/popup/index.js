import { Link, Popover, Typography } from '@mui/material';
import React from 'react';
import { useAppState } from '../../overmind';
const Popup = (props) => {
    const { popupProps } = useAppState().ui;
    const { content, id, isLink, open, position } = popupProps;
    const { left, top } = position ?? { left: 0, top: 0 };
    const handlePopoverClose = () => { };
    return (React.createElement(Popover, { anchorReference: "anchorPosition", anchorOrigin: { horizontal: 'left', vertical: 'bottom' }, anchorPosition: { left, top }, disableRestoreFocus: true, id: "popup", onClose: handlePopoverClose, open: open, transformOrigin: { horizontal: 'left', vertical: 'top' }, sx: { pointerEvents: 'none' } },
        React.createElement(Typography, { sx: { p: 1 }, variant: "body2" }, isLink ? (React.createElement(Link, { href: content, rel: "noreferrer", target: "_blank" }, content)) : (content))));
};
export default Popup;
//# sourceMappingURL=index.js.map
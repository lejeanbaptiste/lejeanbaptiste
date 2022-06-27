import CloseIcon from '@mui/icons-material/Close';
import { Button, IconButton, Slide, Snackbar } from '@mui/material';
import React from 'react';
const TransitionRight = (props) => {
    return React.createElement(Slide, { ...props, direction: "right" });
};
const Notification = ({ message, onClose, open, actionName, callback }) => {
    return (React.createElement(Snackbar, { autoHideDuration: 60000, key: message, message: message, onClose: onClose, open: open, TransitionComponent: TransitionRight, action: React.createElement(React.Fragment, null,
            actionName !== undefined && (React.createElement(Button, { color: "primary", size: "small", onClick: callback }, actionName)),
            React.createElement(IconButton, { size: "small", "aria-label": "close", color: "inherit", onClick: onClose },
                React.createElement(CloseIcon, { fontSize: "small" }))) }));
};
export default Notification;
//# sourceMappingURL=Notification.js.map
import FormatSizeIcon from '@mui/icons-material/FormatSize';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Box, Button, Menu, MenuItem, Stack, Typography } from '@mui/material';
import React, { useState } from 'react';
import { useActions, useAppState } from '../../overmind';
const FontSize = () => {
    const actions = useActions();
    const { editor } = useAppState();
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);
    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };
    const handleSelect = (value) => {
        actions.editor.setFontSize(value);
        setAnchorEl(null);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };
    return (React.createElement(Stack, { direction: "row", alignItems: "center" },
        React.createElement(FormatSizeIcon, { sx: { mx: 1, height: 18, width: 18 } }),
        React.createElement(Typography, null, "Font Size"),
        React.createElement(Box, { flexGrow: 1 }),
        React.createElement(Button, { "aria-controls": open ? 'ont-size-menu' : undefined, "aria-expanded": open ? 'true' : undefined, "aria-haspopup": "true", color: "inherit", endIcon: React.createElement(KeyboardArrowDownIcon, null), id: "font-size-button", onClick: handleClick, size: "small", sx: { textTransform: 'lowercase' }, variant: "text" },
            editor.currentFontSize,
            "pt"),
        React.createElement(Menu, { anchorEl: anchorEl, id: "ont-size-menu", MenuListProps: { 'aria-labelledby': 'font-size-button' }, onClose: handleClose, open: open }, editor.fontSizeOptions.map((size) => (React.createElement(MenuItem, { key: size, dense: true, disableRipple: true, onClick: () => handleSelect(size) },
            size,
            "pt"))))));
};
export default FontSize;
//# sourceMappingURL=FontSize.js.map
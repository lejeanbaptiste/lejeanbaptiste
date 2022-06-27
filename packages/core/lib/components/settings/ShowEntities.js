import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import RemoveIcon from '@mui/icons-material/Remove';
import StyleOutlinedIcon from '@mui/icons-material/StyleOutlined';
import { Box, Stack, ToggleButton, Typography } from '@mui/material';
import React from 'react';
import { useActions, useAppState } from '../../overmind';
const ShowEntities = () => {
    const actions = useActions();
    const { editor } = useAppState();
    const handleChangeShowEntities = () => {
        actions.editor.showEntities(!editor.showEntities);
    };
    return (React.createElement(Stack, { direction: "row", alignItems: "center" },
        React.createElement(StyleOutlinedIcon, { sx: { mx: 1, height: 18, width: 18 } }),
        React.createElement(Typography, null, "Show Entities"),
        React.createElement(Box, { flexGrow: 1 }),
        React.createElement(ToggleButton, { color: "primary", onChange: handleChangeShowEntities, selected: editor.showEntities, size: "small", sx: { border: 0 }, value: editor.showEntities }, editor.showEntities ? (React.createElement(RemoveIcon, { sx: { height: 16, width: 16, transform: 'rotate(90deg)' } })) : (React.createElement(CircleOutlinedIcon, { sx: { height: 16, width: 16 } })))));
};
export default ShowEntities;
//# sourceMappingURL=ShowEntities.js.map
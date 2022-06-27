import { Box, Tooltip, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
const Header = ({ tagName = '', xpath = '', tagMeta }) => {
    const [title, setTitle] = useState(tagName);
    const [fullName, setFullName] = useState();
    useEffect(() => {
        if (!tagMeta)
            return;
        if (!tagMeta.fullName)
            return;
        setFullName(tagMeta.fullName);
    }, [tagMeta]);
    return (React.createElement(Tooltip, { enterDelay: 2500, placement: "top", title: xpath },
        React.createElement(Box, { display: "flex", justifyContent: "center", mt: -0.5, mb: 0.5, sx: {
                cursor: 'default',
                background: ({ palette }) => palette.action.hover,
            } },
            React.createElement(Typography, { variant: "caption" },
                `<${title}>`,
                fullName && (React.createElement(Typography, { component: "span", sx: { textTransform: 'capitalize' }, variant: "caption" }, ` ${fullName}`))))));
};
export default Header;
//# sourceMappingURL=Header.js.map
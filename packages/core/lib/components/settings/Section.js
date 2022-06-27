import { Box, Stack, Typography } from '@mui/material';
import React from 'react';
const Section = ({ title, children }) => {
    return (React.createElement(Stack, { direction: "row" },
        React.createElement(Box, { display: "flex", width: "30%", justifyContent: "flex-end", px: 2, py: 0.5, borderRight: "1px solid" },
            React.createElement(Typography, null, title)),
        React.createElement(Stack, { width: "70%", px: 1, spacing: 1 }, children)));
};
export default Section;
//# sourceMappingURL=Section.js.map
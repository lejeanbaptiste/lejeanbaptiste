import { Box, Skeleton, Stack, Typography } from '@mui/material';
import React from 'react';
const Loader = () => (React.createElement(Box, { p: 4 },
    React.createElement(Stack, { direction: "row", justifyContent: "space-between" },
        React.createElement(Stack, { spacing: 1, gap: 1 }, [1, 2, 3, 4, 5].map((s) => (React.createElement(Box, { key: s, width: 350 },
            React.createElement(Typography, { variant: "h5" },
                React.createElement(Skeleton, null)),
            React.createElement(Typography, { variant: "body2" },
                React.createElement(Skeleton, null)))))),
        React.createElement(Stack, { spacing: 1, gap: 0 }, [1, 2, 3].map((s) => (React.createElement(Box, { key: s, width: 100 },
            React.createElement(Typography, { variant: "h6", sx: { height: 24 } },
                React.createElement(Skeleton, null)))))))));
export default Loader;
//# sourceMappingURL=Loader.js.map
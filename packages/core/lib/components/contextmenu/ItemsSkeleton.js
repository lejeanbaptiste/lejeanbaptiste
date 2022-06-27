import { Box, Skeleton, Stack, Typography } from '@mui/material';
import React from 'react';
const ItemsSkeleton = ({ minWidth = 250, skeletonCount = 5 }) => {
    if (skeletonCount < 1)
        skeletonCount = 1;
    if (minWidth < 100)
        skeletonCount = 100;
    const skeletons = Array(skeletonCount).fill(0, 0);
    return (React.createElement(Stack, { spacing: 1 }, skeletons.map((_skeleton, index) => (React.createElement(Box, { key: index, px: 1 },
        React.createElement(Typography, { variant: "body1" },
            React.createElement(Skeleton, { animation: "wave", variant: "text", width: 25 + Math.random() * (minWidth - 75) })),
        React.createElement(Typography, { variant: "caption" },
            React.createElement(Skeleton, { animation: "wave", variant: "text", width: 50 + Math.random() * (minWidth - 75) })))))));
};
export default ItemsSkeleton;
//# sourceMappingURL=ItemsSkeleton.js.map
import { Box, Button, ButtonGroup } from '@mui/material';
import React, { useRef } from 'react';
import { useAppState } from '../../../../overmind';
import Badge from './Badge';
const SideMenu = ({ authorityInView }) => {
    const { results } = useAppState().lookups;
    const refElemennt = useRef();
    const handleClick = (authority) => {
        refElemennt.current?.parentElement
            ?.querySelector?.(`#${authority}`)
            ?.scrollIntoView({ behavior: 'smooth' });
    };
    return (React.createElement(Box, { ref: refElemennt, minWidth: 120, mt: 2 }, results && (React.createElement(ButtonGroup, { "aria-label": "Side menu", orientation: "vertical", size: "small", sx: { alignItems: 'flex-end', gap: 0.5 } },
        [...results].map(([authority, candidates]) => (React.createElement(Button, { color: authorityInView.includes(authority) ? 'primary' : 'inherit', disabled: candidates.length === 0, key: authority, onClick: () => handleClick(authority), sx: { textTransform: 'uppecase' }, variant: "text" },
            authority,
            React.createElement(Badge, { count: candidates.length })))),
        React.createElement(Button, { color: authorityInView.includes('other') ? 'primary' : 'inherit', onClick: () => handleClick('other'), sx: { textTransform: 'uppecase' }, variant: "text" }, "Other")))));
};
export default SideMenu;
//# sourceMappingURL=index.js.map
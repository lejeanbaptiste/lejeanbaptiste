import SearchIcon from '@mui/icons-material/Search';
import { Box, InputBase } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useState } from 'react';
// Trap focus keys in Context menus
const trap = ['a', 'e', 'i', 'r', 's', 'c'];
const Search = ({ handleQuery }) => {
    const [query, setQuery] = useState('');
    const onChange = (event) => {
        setQuery(event.target.value);
        handleQuery(event.target.value);
    };
    const onKeyDown = (event) => {
        //avoid trap
        if (trap.includes(event.key.toLocaleLowerCase())) {
            event.preventDefault();
            event.stopPropagation();
            const newValue = `${query}${event.key}`;
            setQuery(newValue);
            handleQuery(newValue);
        }
    };
    return (React.createElement(Box, { sx: {
            position: 'relative',
            marginTop: ({ spacing }) => spacing(-0.5),
            backgroundColor: ({ palette }) => palette.mode === 'light'
                ? alpha(palette.common.white, 0.02)
                : alpha(palette.common.black, 0.15),
            borderBottom: 2,
            borderColor: ({ palette }) => palette.mode === 'light'
                ? alpha(palette.common.black, 0.02)
                : alpha(palette.common.black, 0.15),
            '&:hover': {
                borderColor: ({ palette }) => query === '' ? alpha(palette.primary.main, 0.5) : palette.primary.main,
            },
            transition: ({ transitions }) => transitions.create('border'),
        } },
        React.createElement(Box, { sx: {
                padding: ({ spacing }) => spacing(0, 1),
                height: '100%',
                position: 'absolute',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: ({ palette }) => (query === '' ? 'inherit' : palette.primary.main),
                transition: ({ transitions }) => transitions.create('color'),
            } },
            React.createElement(SearchIcon, { fontSize: "small" })),
        React.createElement(InputBase, { sx: {
                fontSize: '0.875rem',
                color: ({ palette }) => (query === '' ? 'inherit' : palette.primary.main),
                '& .MuiInputBase-input': {
                    padding: ({ spacing }) => spacing(0.75, 0.75, 0.75, 0),
                    // vertical padding + font size from searchIcon
                    paddingLeft: ({ spacing }) => `calc(1em + ${spacing(2)})`,
                    width: '100%',
                },
            }, placeholder: "Search\u2026", inputProps: { 'aria-label': 'search' }, value: query, onChange: onChange, onKeyDown: onKeyDown })));
};
export default Search;
//# sourceMappingURL=Search.js.map
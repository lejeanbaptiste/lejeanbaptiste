import SearchIcon from '@mui/icons-material/Search';
import { Box, IconButton, InputAdornment, OutlinedInput } from '@mui/material';
import React from 'react';
import { useActions, useAppState } from '../../overmind';
const QueryField = () => {
    const { query } = useAppState().lookups;
    const { search, setQuery } = useActions().lookups;
    const handleChange = (event) => {
        setQuery(event.target.value);
    };
    const handleClickSearch = () => {
        search(query);
    };
    const handleMouseDownSearch = (event) => {
        event.preventDefault();
    };
    const handleKeyPress = (event) => {
        if (event.code === 'Enter')
            search(query);
    };
    return (React.createElement(Box, { px: 6, pb: 3 },
        React.createElement(OutlinedInput, { endAdornment: React.createElement(InputAdornment, { position: "end" },
                React.createElement(IconButton, { "aria-label": "trigger-search", onClick: handleClickSearch, onMouseDown: handleMouseDownSearch, size: "small" },
                    React.createElement(SearchIcon, null))), fullWidth: true, id: "query", onChange: handleChange, onKeyPress: handleKeyPress, size: "small", value: query })));
};
export default QueryField;
//# sourceMappingURL=QueryField.js.map
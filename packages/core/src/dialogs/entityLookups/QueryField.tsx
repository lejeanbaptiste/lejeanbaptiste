import SearchIcon from '@mui/icons-material/Search';
import { Box, IconButton, InputAdornment, OutlinedInput } from '@mui/material';
import { type ChangeEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { useActions, useAppState } from '../../overmind';

const QueryField = () => {
  const { query } = useAppState().lookups;
  const { search, setQuery } = useActions().lookups;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  const handleClickSearch = () => {
    search(query);
  };

  const handleMouseDownSearch = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const handleKeyPress = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.code === 'Enter') search(query);
  };

  return (
    <Box px={6} pb={3}>
      <OutlinedInput
        endAdornment={
          <InputAdornment position="end">
            <IconButton
              aria-label="trigger-search"
              onClick={handleClickSearch}
              onMouseDown={handleMouseDownSearch}
              size="small"
            >
              <SearchIcon />
            </IconButton>
          </InputAdornment>
        }
        fullWidth
        id="query"
        onChange={handleChange}
        onKeyPress={handleKeyPress}
        size="small"
        value={query}
      />
    </Box>
  );
};

export default QueryField;

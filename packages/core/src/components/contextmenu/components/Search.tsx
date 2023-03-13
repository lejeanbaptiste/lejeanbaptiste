import SearchIcon from '@mui/icons-material/Search';
import { Box, InputBase, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useState, type ChangeEvent, type KeyboardEvent } from 'react';

interface SearchProps {
  handleQuery: (query: string) => void;
}

// Trap focus keys in Context menus
const trap = ['a', 'e', 'i', 'r', 's', 'c'];

export const Search = ({ handleQuery }: SearchProps) => {
  const { palette, spacing, transitions } = useTheme();
  const [query, setQuery] = useState('');

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    handleQuery(event.target.value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    //avoid trap
    if (trap.includes(event.key.toLocaleLowerCase())) {
      event.preventDefault();
      event.stopPropagation();
      const newValue = `${query}${event.key}`;
      setQuery(newValue);
      handleQuery(newValue);
    }
  };

  return (
    <Box
      position="relative"
      mt={spacing(-0.5)}
      bgcolor={
        palette.mode === 'light'
          ? alpha(palette.common.white, 0.02)
          : alpha(palette.common.black, 0.15)
      }
      borderBottom={2}
      borderColor={
        palette.mode === 'light'
          ? alpha(palette.common.black, 0.02)
          : alpha(palette.common.black, 0.15)
      }
      sx={{
        transition: transitions.create('border'),
        '&:hover': {
          borderColor: query === '' ? alpha(palette.primary.main, 0.5) : palette.primary.main,
        },
      }}
    >
      <Box
        position="absolute"
        display="flex"
        alignItems="center"
        justifyContent="center"
        height="100%"
        p={spacing(0, 1)}
        color={query === '' ? 'inherit' : palette.primary.main}
        sx={{ transition: transitions.create('color'), pointerEvents: 'none' }}
      >
        <SearchIcon fontSize="small" />
      </Box>
      <InputBase
        inputProps={{ 'aria-label': 'search' }}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder="Search…"
        sx={{
          width: '100%',
          color: query === '' ? 'inherit' : palette.primary.main,
          '& .MuiInputBase-input': {
            padding: spacing(0.75, 0.75, 0.75, 0),
            // vertical padding + font size from searchIcon
            paddingLeft: `calc(1em + ${spacing(2)})`,
          },
          fontSize: '0.875rem',
        }}
        value={query}
      />
    </Box>
  );
};

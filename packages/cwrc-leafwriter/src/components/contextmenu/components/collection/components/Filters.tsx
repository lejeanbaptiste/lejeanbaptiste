import SearchIcon from '@mui/icons-material/Search';
import { alpha, Box, Icon, InputBase, Stack, ToggleButton, Tooltip, useTheme } from '@mui/material';
import { useAtom } from 'jotai';
import { debounce } from 'lodash';
import { useMemo, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useContextmenu } from '../../../hooks';
import { showOnlyValidAtom } from '../../../store';

interface FilterProps {
  onQuery: (query: string) => void;
}

export const Filters = ({ onQuery }: FilterProps) => {
  const { palette, spacing, transitions } = useTheme();
  const { t } = useTranslation();

  const [onlyValid, setOnlyValid] = useAtom(showOnlyValidAtom);

  const { getIcon } = useContextmenu();

  const [query, setQuery] = useState('');

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    handleChangeDebounce(event.target.value);
  };

  const handleChangeDebounce = useMemo(
    () => debounce((_query: string) => onQuery(_query), 200, { trailing: true }),
    [],
  );

  const toggleInvalid = () => setOnlyValid(!onlyValid);

  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      position="relative"
      width="100%"
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
        autoFocus
        inputProps={{ 'aria-label': 'search' }}
        onChange={handleQueryChange}
        placeholder={t('LW.commons.search').toString()}
        sx={{
          width: '100%',
          color: query === '' ? 'inherit' : palette.primary.main,
          '& .MuiInputBase-input': {
            padding: spacing(0.75, 0.75, 0.75, 0),
            paddingLeft: `calc(1em + ${spacing(2)})`,
          },
          fontSize: '0.875rem',
        }}
        value={query}
      />

      <Tooltip
        componentsProps={{ tooltip: { sx: { textTransform: 'capitalize' } } }}
        title={t('LW.show only valid tags')}
      >
        <ToggleButton
          onChange={toggleInvalid}
          selected={onlyValid}
          size="small"
          sx={{
            width: 26,
            height: 26,
            margin: 0.375,
            borderRadius: 0.5,
            border: 'none',
            color: onlyValid ? palette.primary.main : palette.text.disabled,
          }}
          value={onlyValid}
        >
          <Icon component={getIcon('validate')} fontSize="inherit" />
        </ToggleButton>
      </Tooltip>
    </Stack>
  );
};

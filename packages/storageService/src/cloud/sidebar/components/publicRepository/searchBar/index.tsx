import useAutocomplete from '@mui/base/useAutocomplete';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import {
  alpha,
  Box,
  CircularProgress,
  ClickAwayListener,
  IconButton,
  InputAdornment,
  InputBase,
  Paper,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import debounce from 'lodash/debounce';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMeasure } from 'react-use';
import type { PublicRepository } from '../../../../../types';
import { Results } from './components/Results';

interface SearchBarProps {
  collapsible?: boolean;
  onClear?: () => void;
  onChange?: (query: string) => Promise<PublicRepository[] | null>;
  onSelect?: (publicRepository: PublicRepository) => void;
}

export const SearchBar = ({ collapsible = true, onClear, onChange, onSelect }: SearchBarProps) => {
  const { t } = useTranslation();

  const [options, setOptions] = useState<PublicRepository[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const [container, { width: containerWidth }] = useMeasure();

  const { breakpoints, palette } = useTheme();
  const isMD = useMediaQuery(breakpoints.down('md'));

  const variants: Variants = {
    initial: { height: 0 },
    visible: { height: 'auto' },
    exit: { height: 0, transition: { duration: 0.02 } },
  };

  const { getInputProps, getListboxProps, inputValue } = useAutocomplete({
    id: 'search-public-repository',
    options,
    getOptionLabel: (option) => option.username,
    onInputChange: async (_event, newInputValue) => fetch(newInputValue),
  });

  const fetch = useMemo(() => debounce((query: string) => updateList(query), 500), []);

  const updateList = async (query: string) => {
    if (query === '') {
      setOptions([]);
      return;
    }

    setIsLoading(true);
    const list = onChange ? (await onChange(query)) ?? [] : [];
    setOptions(list);
    setIsLoading(false);
  };

  const handleSelectOption = (publicRepository: PublicRepository) => {
    setOptions([]);
    setSearchFocused(false);
    if (onSelect) onSelect(publicRepository);
  };

  const handleClickAway = () => setSearchFocused(false);

  return (
    <Box ref={container} height={40} width="100%">
      <ClickAwayListener onClickAway={handleClickAway}>
        <Paper
          component={motion.div}
          variants={variants}
          initial="initial"
          animate="visible"
          exit="exit"
          elevation={searchFocused ? 3 : 0}
          sx={{
            position: 'absolute',
            zIndex: 100,
            width: containerWidth,
            px: 0.25,
            py: 0.5,
            bgcolor: searchFocused ? palette.background.paper : alpha(palette.grey[300], 0.2),
          }}
        >
          <InputBase
            endAdornment={
              <InputAdornment position="end">
                <>
                  {isLoading && <CircularProgress size={16} />}
                  {(inputValue.length > 0 || collapsible) && (
                    <IconButton
                      aria-label="close search public repositories"
                      onClick={onClear}
                      size="small"
                    >
                      <CloseIcon fontSize="inherit" />
                    </IconButton>
                  )}
                </>
              </InputAdornment>
            }
            fullWidth
            inputProps={{ ...getInputProps(), 'data-testid': 'search-user-input' }}
            onFocus={() => setSearchFocused(true)}
            placeholder={`${t('cloud:publicRepositories:user_or_organization')}`}
            startAdornment={
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ opacity: 0.5 }} />
              </InputAdornment>
            }
            sx={{ px: 1, flex: 1, fontSize: isMD ? '0.925rem' : '0.950rem' }}
          />
          <AnimatePresence>
            {searchFocused && options.length > 0 && (
              <Results
                listBoxProps={getListboxProps}
                onSelect={handleSelectOption}
                options={options}
              />
            )}
          </AnimatePresence>
        </Paper>
      </ClickAwayListener>
    </Box>
  );
};

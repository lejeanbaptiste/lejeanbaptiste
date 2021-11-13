import { useAutocomplete } from '@mui/core/AutocompleteUnstyled';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import {
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
import { alpha } from '@mui/material/styles';
import type { Content, SearchResults, SearchResultsBlobs } from '@src/@types/types';
import { AnimatePresence, motion } from 'framer-motion';
import debounce from 'lodash/debounce';
import React, { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMeasure } from 'react-use';
import ResultsCollection from './ResultsCollection';

interface SearchBarProps {
  onClear?: () => void;
  onClickAway?: () => void;
  onChange?: (value: any) => Promise<SearchResults[] | null>;
  onPrimaryAction?: (item: Content | SearchResultsBlobs) => void;
  onSecondaryAction?: (value: Content | SearchResultsBlobs) => void;
}

const SearchBar: FC<SearchBarProps> = ({
  onChange,
  onClear,
  onClickAway,
  onPrimaryAction,
  onSecondaryAction,
}) => {
  const { t } = useTranslation();
  const [options, setOptions] = useState<SearchResults[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [submitted, setStubmitted] = useState(false);

  const [container, { width: containerWidth }] = useMeasure();

  const theme = useTheme();
  const isSM = useMediaQuery(theme.breakpoints.down('sm'));

  const variants = {
    initial: { height: 0 },
    visible: { height: 40 },
    exit: { height: 0, transition: { duration: 0.02 } },
  };

  const {
    // getRootProps,
    // getInputLabelProps,
    getInputProps,
    getListboxProps,
    // getOptionProps,
    // groupedOptions,
    // value,
    inputValue,
  } = useAutocomplete({
    id: 'search',
    options,
    getOptionLabel: (option) => option.searchType,
    onInputChange: async (event, newInputValue) => fetch(newInputValue),
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

  const handlePrimaryAction = (item: Content | SearchResultsBlobs) => {
    setStubmitted(true);
    setOptions([]);
    setSearchFocused(false);
    if (onPrimaryAction) onPrimaryAction(item);
  };

  const handleSecondaryAction = (item: Content | SearchResultsBlobs) => {
    setSearchFocused(false);
    if (onSecondaryAction) onSecondaryAction(item);
  };

  const handleClickAway = () => {
    setOptions([]);
    setSearchFocused(false);
    if (onClickAway) onClickAway();
  };

  const clearField = () => {
    setOptions([]);
    setSearchFocused(false);
    if (onClear) onClear();
  };

  return (
    <Box
      ref={container}
      height={40}
      px={isSM ? 1 : 0}
      component={motion.div}
      variants={variants}
      initial="initial"
      animate="visible"
      exit="exit"
      sx={{ overflow: 'auto' }}
    >
      <ClickAwayListener onClickAway={handleClickAway}>
        <Paper
          elevation={searchFocused ? 3 : 0}
          sx={{
            position: 'absolute',
            zIndex: 1,
            width: containerWidth,
            minHeight: 40,
            px: 0.25,
            py: 0.5,
            backgroundColor: ({ palette }) =>
              searchFocused ? palette.background.paper : alpha(palette.grey[300], 0.2),
          }}
        >
          <InputBase
            endAdornment={
              <InputAdornment position="end">
                <>
                  {isLoading && <CircularProgress size={16} />}
                  {inputValue.length > 0 && (
                    <IconButton aria-label="clear" onMouseDown={clearField} size="small">
                      <CloseIcon fontSize="inherit" />
                    </IconButton>
                  )}
                </>
              </InputAdornment>
            }
            fullWidth
            inputProps={!submitted ? { ...getInputProps() } : { id: 'search', value: inputValue }}
            onClick={() => setSearchFocused(true)}
            placeholder={t('cloud:search:filename_or_content')}
            startAdornment={
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ opacity: 0.5 }} />
              </InputAdornment>
            }
            sx={{ px: 1.5, flex: 1 }}
          />
          <AnimatePresence>
            {searchFocused && options.length > 0 && (
              <ResultsCollection
                listBoxProps={getListboxProps()}
                onPrimaryAction={handlePrimaryAction}
                onSecondaryAction={handleSecondaryAction}
                options={options}
              />
            )}
          </AnimatePresence>
        </Paper>
      </ClickAwayListener>
    </Box>
  );
};

export default SearchBar;

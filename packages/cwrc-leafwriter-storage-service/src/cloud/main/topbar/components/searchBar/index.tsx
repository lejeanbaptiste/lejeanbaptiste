import { useAutocomplete } from '@mui/base/useAutocomplete';
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
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import debounce from 'lodash/debounce';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMeasure } from 'react-use';
import type { Content, SearchResults, SearchResultsBlobs } from '../../../../../types';
import { ResultsCollection } from './components/ResultsCollection';

interface SearchBarProps {
  onClear?: () => void;
  onClickAway?: () => void;
  onChange?: (value: string) => Promise<SearchResults[] | null>;
  onPrimaryAction?: (item: Content | SearchResultsBlobs) => void;
  onSecondaryAction?: (value: Content | SearchResultsBlobs) => void;
}

export const SearchBar = ({
  onChange,
  onClear,
  onClickAway,
  onPrimaryAction,
  onSecondaryAction,
}: SearchBarProps) => {
  const { t } = useTranslation('LWStorageService');

  const [options, setOptions] = useState<SearchResults[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [submitted, setStubmitted] = useState(false);

  const [container, { width: containerWidth }] = useMeasure();

  const { breakpoints, palette } = useTheme();
  const isSM = useMediaQuery(breakpoints.down('sm'));

  const variants: Variants = {
    initial: { height: 0 },
    visible: { height: 40 },
    exit: { height: 0, transition: { duration: 0.02 } },
  };

  const { getInputProps, getListboxProps, inputValue } = useAutocomplete({
    id: 'search',
    options,
    getOptionLabel: (option) => option.searchType,
    onInputChange: async (_event, newInputValue) => fetch(newInputValue),
  });

  const fetch = useMemo(() => debounce((query: string) => updateList(query), 500), []);

  const updateList = async (query: string) => {
    if (query === '') {
      setOptions([]);
      return;
    }

    setIsLoading(true);
    const list = onChange ? ((await onChange(query)) ?? []) : [];
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
      data-testid="search-bar"
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
            bgcolor: searchFocused ? palette.background.paper : alpha(palette.grey[300], 0.2),
          }}
        >
          <InputBase
            endAdornment={
              <InputAdornment position="end">
                <>
                  {isLoading && <CircularProgress size={16} />}
                  {inputValue.length > 0 && (
                    <IconButton
                      aria-label="clear"
                      onMouseDown={clearField}
                      data-testid="search-clear-field"
                      size="small"
                    >
                      <CloseIcon fontSize="inherit" />
                    </IconButton>
                  )}
                </>
              </InputAdornment>
            }
            fullWidth
            inputProps={
              !submitted
                ? { ...getInputProps(), title: 'search' }
                : { 'data-testid': 'search-file-input', id: 'search', value: inputValue }
            }
            onClick={() => setSearchFocused(true)}
            placeholder={`${t('cloud.search.filename_or_content')}`}
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

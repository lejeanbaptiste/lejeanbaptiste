import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Collapse,
  FormControlLabel,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import { clearFindHighlights } from '@src/desktop/find/findEditorHighlights';
import { DESKTOP_FIND_FOCUS_EVENT } from '@src/desktop/desktopLeftPanelBridge';
import { FindSnippetLine, formatSnippetLabel } from '@src/desktop/find/snippetDisplay';
import { searchText } from '@src/desktop/find/searchText';
import type { FindFileResult } from '@src/desktop/find/types';
import { useFindNavigation } from '@src/desktop/find/useFindNavigation';
import { ScopeFields } from '@src/desktop/shared/ScopeFields';
import type { SearchScope } from '@src/desktop/shared/searchScope';
import { useAppState } from '@src/overmind';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface FlatFindResult {
  column: number;
  end: number;
  filePath: string;
  key: string;
  label: string;
  line: number;
  matchIndexInFile: number;
  start: number;
}

const flattenResults = (
  results: FindFileResult[],
  collapsedFilePaths: Set<string>,
): FlatFindResult[] => {
  const flat: FlatFindResult[] = [];

  for (const fileResult of results) {
    if (collapsedFilePaths.has(fileResult.filePath)) continue;

    for (const match of fileResult.matches) {
      flat.push({
        filePath: fileResult.filePath,
        key: `${fileResult.filePath}-${match.start}-${match.end}`,
        label: `${match.line}:${match.column}  ${formatSnippetLabel(match.snippet)}`,
        line: match.line,
        column: match.column,
        matchIndexInFile: match.matchIndex,
        start: match.start,
        end: match.end,
      });
    }
  }

  return flat;
};

export const SidebarFindTab = () => {
  const { activeTabPath, openTabs, rootPath } = useAppState().project;

  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>('currentFile');
  const [customPath, setCustomPath] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [results, setResults] = useState<FindFileResult[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [collapsedFilePaths, setCollapsedFilePaths] = useState<Set<string>>(() => new Set());
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const keyboardNavRef = useRef(false);
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;

  const refocusSelectedItem = useCallback(() => {
    keyboardNavRef.current = true;
    requestAnimationFrame(() => {
      itemRefs.current.get(selectedIndexRef.current)?.focus({ preventScroll: true });
    });
  }, []);

  const { jumpToHit } = useFindNavigation(refocusSelectedItem);

  const flatResults = useMemo(
    () => flattenResults(results, collapsedFilePaths),
    [results, collapsedFilePaths],
  );

  const toggleFileCollapsed = useCallback(
    (filePath: string) => {
      setCollapsedFilePaths((prev) => {
        const next = new Set(prev);
        if (next.has(filePath)) {
          next.delete(filePath);
          return next;
        }

        next.add(filePath);
        if (flatResults[selectedIndex]?.filePath === filePath) {
          const remaining = flattenResults(results, next);
          setSelectedIndex(remaining.length > 0 ? 0 : -1);
        }
        return next;
      });
    },
    [flatResults, results, selectedIndex],
  );

  const jumpToFlatResult = useCallback(
    (index: number) => {
      const item = flatResults[index];
      if (!item) return;

      void jumpToHit({
        filePath: item.filePath,
        line: item.line,
        column: item.column,
        matchIndexInFile: item.matchIndexInFile,
        query: findQuery.trim(),
        start: item.start,
        end: item.end,
        useRegex,
      });
    },
    [flatResults, findQuery, jumpToHit, useRegex],
  );

  const navigateToIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= flatResults.length) return;
      keyboardNavRef.current = true;
      setSelectedIndex(index);
      jumpToFlatResult(index);
    },
    [flatResults.length, jumpToFlatResult],
  );

  useEffect(() => {
    const focusFindField = () => {
      requestAnimationFrame(() => {
        const input = findInputRef.current;
        if (!input) return;
        input.focus();
        input.select();
      });
    };

    window.addEventListener(DESKTOP_FIND_FOCUS_EVENT, focusFindField);
    return () => window.removeEventListener(DESKTOP_FIND_FOCUS_EVENT, focusFindField);
  }, []);

  useEffect(() => {
    itemRefs.current.clear();
    if (results.length > 0) {
      keyboardNavRef.current = true;
      setSelectedIndex(0);
    }
  }, [results]);

  useEffect(() => {
    itemRefs.current.clear();
    if (flatResults.length > 0) {
      setSelectedIndex((index) => {
        if (index < 0) return 0;
        if (index >= flatResults.length) return flatResults.length - 1;
        return index;
      });
    } else {
      setSelectedIndex(-1);
    }
  }, [flatResults]);

  useEffect(() => {
    if (selectedIndex < 0) return;
    const el = itemRefs.current.get(selectedIndex);
    el?.scrollIntoView({ block: 'nearest' });
    if (keyboardNavRef.current) {
      el?.focus({ preventScroll: true });
      keyboardNavRef.current = false;
    }
  }, [selectedIndex]);

  const handleResultsKeyDown = (event: React.KeyboardEvent) => {
    if (flatResults.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = selectedIndex < 0 ? 0 : Math.min(selectedIndex + 1, flatResults.length - 1);
      navigateToIndex(next);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const next = selectedIndex < 0 ? 0 : Math.max(selectedIndex - 1, 0);
      navigateToIndex(next);
      return;
    }

    if (event.key === 'Enter' && selectedIndex >= 0) {
      event.preventDefault();
      jumpToFlatResult(selectedIndex);
    }
  };

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResults([]);
    setTotalMatches(0);
    setCollapsedFilePaths(new Set());
    setSelectedIndex(-1);
    clearFindHighlights();

    try {
      const {
        results: nextResults,
        totalMatches: count,
        error: searchError,
      } = await searchText({
        activeTabPath,
        customPath,
        openTabs,
        query: findQuery,
        rootPath,
        scope,
        useRegex,
      });

      setResults(nextResults);
      setTotalMatches(count);

      if (searchError) {
        setError(searchError);
      } else if (count === 0) {
        setError('No results.');
      } else {
        const firstFile = nextResults[0];
        const firstMatch = firstFile?.matches[0];
        if (firstFile && firstMatch) {
          void jumpToHit({
            column: firstMatch.column,
            end: firstMatch.end,
            filePath: firstFile.filePath,
            line: firstMatch.line,
            matchIndexInFile: firstMatch.matchIndex,
            query: findQuery.trim(),
            start: firstMatch.start,
            useRegex,
          });
        }
      }
    } catch {
      setError('Search failed.');
    } finally {
      setLoading(false);
    }
  }, [activeTabPath, customPath, findQuery, jumpToHit, openTabs, rootPath, scope, useRegex]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box
        sx={{
          p: 1,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <TextField
          fullWidth
          size="small"
          label="Find"
          placeholder="Search text"
          value={findQuery}
          onChange={(event) => setFindQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void handleSearch();
              return;
            }
            if (event.key === 'ArrowDown' && flatResults.length > 0) {
              event.preventDefault();
              navigateToIndex(0);
              resultsContainerRef.current?.focus();
            }
          }}
          slotProps={{
            htmlInput: { ref: findInputRef },
            input: { sx: { fontSize: '0.8125rem' } },
          }}
        />
        <TextField
          fullWidth
          size="small"
          label="Replace"
          placeholder="Replacement text"
          value={replaceQuery}
          onChange={(event) => setReplaceQuery(event.target.value)}
          helperText="Replace buttons will be added in the next phase."
          slotProps={{ input: { sx: { fontSize: '0.8125rem' } } }}
        />
        <ScopeFields
          scope={scope}
          onScopeChange={setScope}
          customPath={customPath}
          onCustomPathChange={setCustomPath}
          onEnter={() => void handleSearch()}
          scopeLabelId="find-scope-label"
        />
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={useRegex}
              onChange={(event) => setUseRegex(event.target.checked)}
            />
          }
          label="Use regular expression"
          sx={{ ml: 0, '& .MuiFormControlLabel-label': { fontSize: '0.8125rem' } }}
        />
        <Button
          size="small"
          variant="outlined"
          startIcon={<SearchIcon fontSize="small" />}
          onClick={() => void handleSearch()}
          disabled={loading || !findQuery.trim()}
        >
          Find
        </Button>
      </Box>

      <Box
        ref={resultsContainerRef}
        tabIndex={flatResults.length > 0 ? 0 : -1}
        onKeyDown={handleResultsKeyDown}
        role="listbox"
        aria-activedescendant={selectedIndex >= 0 ? `find-result-${selectedIndex}` : undefined}
        sx={{
          flex: 1,
          overflow: 'auto',
          outline: 'none',
          '&:focus-visible': {
            boxShadow: (theme) => `inset 0 0 0 2px ${theme.palette.primary.main}`,
          },
        }}
      >
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={20} />
          </Box>
        )}

        {!loading && totalMatches > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ px: 1.5, py: 0.75, display: 'block' }}>
            {totalMatches} match{totalMatches === 1 ? '' : 'es'} in {results.length} file
            {results.length === 1 ? '' : 's'}
          </Typography>
        )}

        {!loading && error && (
          <Typography
            variant="body2"
            color={totalMatches === 0 ? 'error' : 'text.secondary'}
            sx={{ p: 1.5 }}
          >
            {error}
          </Typography>
        )}

        {!loading &&
          (() => {
            let flatIndex = 0;

            return results.map((fileResult) => {
              const isCollapsed = collapsedFilePaths.has(fileResult.filePath);

              return (
                <Box key={fileResult.filePath}>
                  <ListItemButton
                    dense
                    onClick={() => toggleFileCollapsed(fileResult.filePath)}
                    sx={{
                      py: 0.25,
                      minHeight: 24,
                      bgcolor: 'action.hover',
                      borderBottom: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 22 }}>
                      {isCollapsed ? (
                        <ChevronRightIcon sx={{ fontSize: 14 }} />
                      ) : (
                        <ExpandMoreIcon sx={{ fontSize: 14 }} />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={`${fileResult.filename} (${fileResult.matches.length})`}
                      sx={{ my: 0 }}
                      primaryTypographyProps={{
                        noWrap: true,
                        variant: 'caption',
                        fontWeight: 600,
                        color: 'text.secondary',
                      }}
                    />
                  </ListItemButton>
                  <Collapse in={!isCollapsed} timeout="auto" unmountOnExit>
                    <List dense disablePadding>
                      {fileResult.matches.map((match) => {
                        const currentIndex = flatIndex;
                        flatIndex += 1;

                        return (
                          <ListItemButton
                            key={`${fileResult.filePath}-${match.start}`}
                            id={`find-result-${currentIndex}`}
                            ref={(element) => {
                              if (element) {
                                itemRefs.current.set(currentIndex, element);
                              } else {
                                itemRefs.current.delete(currentIndex);
                              }
                            }}
                            dense
                            role="option"
                            aria-selected={currentIndex === selectedIndex}
                            selected={currentIndex === selectedIndex}
                            tabIndex={-1}
                            onClick={() => {
                              setSelectedIndex(currentIndex);
                              jumpToFlatResult(currentIndex);
                            }}
                            onFocus={() => setSelectedIndex(currentIndex)}
                            sx={{ py: 0.125, minHeight: 26 }}
                          >
                            <ListItemText
                              primary={<FindSnippetLine snippet={match.snippet} />}
                              secondary={`Line ${match.line}, column ${match.column}`}
                              sx={{ my: 0, minWidth: 0 }}
                              slotProps={{ primary: { sx: { minWidth: 0 } } }}
                              secondaryTypographyProps={{
                                variant: 'caption',
                                fontSize: '0.625rem',
                              }}
                            />
                          </ListItemButton>
                        );
                      })}
                    </List>
                  </Collapse>
                </Box>
              );
            });
          })()}
      </Box>
    </Box>
  );
};

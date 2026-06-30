import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
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
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { clearFindHighlights } from '@src/desktop/find/findEditorHighlights';
import { useFindPanelUndo } from '@src/desktop/find/findPanelUndo';
import { DESKTOP_EDITOR_VIEW_MODE_EVENT, DESKTOP_FIND_FOCUS_EVENT } from '@src/desktop/desktopLeftPanelBridge';
import { FindSnippetLine, formatSnippetLabel } from '@src/desktop/find/snippetDisplay';
import { searchText } from '@src/desktop/find/searchText';
import type { FindFileResult, FindHighlightMode } from '@src/desktop/find/types';
import { useFindNavigation } from '@src/desktop/find/useFindNavigation';
import { useFindReplace } from '@src/desktop/find/useFindReplace';
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
  replaceable?: boolean;
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
        replaceable: match.replaceable,
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
  const [searchBackwards, setSearchBackwards] = useState(false);
  const [results, setResults] = useState<FindFileResult[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [collapsedFilePaths, setCollapsedFilePaths] = useState<Set<string>>(() => new Set());
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [walkMode, setWalkMode] = useState<'find' | 'replace' | null>(null);

  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const walkOriginRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const keyboardNavRef = useRef(false);
  const selectedIndexRef = useRef(selectedIndex);
  const lastSearchKeyRef = useRef('');
  selectedIndexRef.current = selectedIndex;

  const refocusSelectedItem = useCallback(() => {
    keyboardNavRef.current = true;
    requestAnimationFrame(() => {
      itemRefs.current.get(selectedIndexRef.current)?.focus({ preventScroll: true });
    });
  }, []);

  const { jumpToHit } = useFindNavigation(refocusSelectedItem);
  const { handleFindPanelUndoKeyDown } = useFindPanelUndo();

  const flatResults = useMemo(
    () => flattenResults(results, collapsedFilePaths),
    [results, collapsedFilePaths],
  );

  const jumpToFlatResult = useCallback(
    (
      index: number,
      options?: { contentForJump?: string; highlightMode?: FindHighlightMode },
    ) => {
      const item = flatResults[index];
      if (!item) return;

      void jumpToHit({
        contentForJump: options?.contentForJump,
        filePath: item.filePath,
        highlightMode: options?.highlightMode ?? 'active-only',
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

  const buildSearchKey = useCallback(
    () =>
      JSON.stringify({
        customPath,
        findQuery: findQuery.trim(),
        scope,
        useRegex,
      }),
    [customPath, findQuery, scope, useRegex],
  );

  const handleSearchComplete = useCallback(
    ({
      contentForJump,
      error: searchError,
      jumpToSelection,
      refreshHighlight,
      results: nextResults,
      selectedIndex: nextSelectedIndex,
      totalMatches: count,
    }: {
      contentForJump?: string;
      error?: string | null;
      jumpToSelection?: boolean;
      refreshHighlight?: boolean;
      results: FindFileResult[];
      selectedIndex?: number;
      totalMatches: number;
    }) => {
      lastSearchKeyRef.current = buildSearchKey();
      setResults(nextResults);
      setTotalMatches(count);
      setError(searchError ?? (count === 0 ? 'No results.' : null));

      if (count === 0) {
        setSelectedIndex(-1);
        return;
      }

      const flat = flattenResults(nextResults, collapsedFilePaths);

      if (typeof nextSelectedIndex === 'number') {
        const idx = Math.min(Math.max(0, nextSelectedIndex), flat.length - 1);
        setSelectedIndex(idx);
        selectedIndexRef.current = idx;
        if (jumpToSelection || refreshHighlight) {
          const item = flat[idx];
          if (item) {
            const highlightMode: FindHighlightMode = 'active-only';
            void jumpToHit({
              column: item.column,
              contentForJump,
              end: item.end,
              filePath: item.filePath,
              highlightMode,
              line: item.line,
              matchIndexInFile: item.matchIndexInFile,
              query: findQuery.trim(),
              start: item.start,
              useRegex,
            });
          }
        }
        return;
      }

      setSelectedIndex(0);
      selectedIndexRef.current = 0;
      const first = flat[0];
      if (first) {
        void jumpToHit({
          column: first.column,
          end: first.end,
          filePath: first.filePath,
          highlightMode: 'active-only',
          line: first.line,
          matchIndexInFile: first.matchIndexInFile,
          query: findQuery.trim(),
          start: first.start,
          useRegex,
        });
      }
    },
    [buildSearchKey, collapsedFilePaths, findQuery, jumpToHit, useRegex],
  );

  const selectedHit = selectedIndex >= 0 ? flatResults[selectedIndex] ?? null : null;

  const { replaceAllInScope, replaceCurrentHit } = useFindReplace({
    activeTabPath,
    customPath,
    findQuery,
    onSearchComplete: handleSearchComplete,
    openTabs,
    replaceQuery,
    results,
    rootPath,
    scope,
    selectedHit,
    selectedIndex,
    useRegex,
  });

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

  const navigateToIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= flatResults.length) return;
      keyboardNavRef.current = true;
      setSelectedIndex(index);
      jumpToFlatResult(index);
    },
    [flatResults.length, jumpToFlatResult],
  );

  const resetFindOnEditorViewModeChange = useCallback(() => {
    clearFindHighlights();
    lastSearchKeyRef.current = '';
    setFindQuery('');
    setReplaceQuery('');
    setResults([]);
    setTotalMatches(0);
    setCollapsedFilePaths(new Set());
    setSelectedIndex(-1);
    selectedIndexRef.current = -1;
    setError(null);
  }, []);

  useEffect(() => {
    window.addEventListener(DESKTOP_EDITOR_VIEW_MODE_EVENT, resetFindOnEditorViewModeChange);
    return () => {
      window.removeEventListener(DESKTOP_EDITOR_VIEW_MODE_EVENT, resetFindOnEditorViewModeChange);
    };
  }, [resetFindOnEditorViewModeChange]);

  useEffect(() => {
    const focusFindField = () => {
      const tryFocus = (attempt = 0) => {
        const input = findInputRef.current;
        if (!input) {
          if (attempt < 20) {
            requestAnimationFrame(() => tryFocus(attempt + 1));
          }
          return;
        }

        input.focus({ preventScroll: true });
        input.select();

        if (document.activeElement !== input && attempt < 20) {
          requestAnimationFrame(() => tryFocus(attempt + 1));
        }
      };

      requestAnimationFrame(() => tryFocus());
    };

    window.addEventListener(DESKTOP_FIND_FOCUS_EVENT, focusFindField);
    return () => window.removeEventListener(DESKTOP_FIND_FOCUS_EVENT, focusFindField);
  }, []);

  useEffect(() => {
    itemRefs.current.clear();
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
    if (event.key === 'Escape') {
      event.preventDefault();
      setWalkMode(null);
      walkOriginRef.current?.focus();
      return;
    }

    if (flatResults.length === 0) return;

    if (event.key === 'ArrowDown' || (event.key === 'Tab' && !event.shiftKey)) {
      event.preventDefault();
      const next = selectedIndex < 0 ? 0 : (selectedIndex + 1) % flatResults.length;
      navigateToIndex(next);
      return;
    }

    if (event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey)) {
      event.preventDefault();
      const next = selectedIndex <= 0 ? flatResults.length - 1 : selectedIndex - 1;
      navigateToIndex(next);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey && walkMode === 'replace') {
        void handleReplaceAll();
      } else if (!event.shiftKey && walkMode === 'replace' && selectedIndex >= 0) {
        void handleReplace();
      }
      // In find walk mode, Enter is consumed (signals we are not in replace mode)
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

      handleSearchComplete({
        results: nextResults,
        totalMatches: count,
        error: searchError,
      });
    } catch {
      setError('Search failed.');
    } finally {
      setLoading(false);
    }
  }, [activeTabPath, customPath, findQuery, handleSearchComplete, openTabs, rootPath, scope, useRegex]);

  const cycleFind = useCallback(
    (backwards = searchBackwards) => {
      if (loading || replacing) return;

      if (flatResults.length === 0) {
        if (findQuery.trim()) void handleSearch();
        return;
      }

      const next =
        selectedIndex < 0
          ? 0
          : backwards
            ? selectedIndex <= 0
              ? flatResults.length - 1
              : selectedIndex - 1
            : (selectedIndex + 1) % flatResults.length;

      navigateToIndex(next);
    },
    [
      findQuery,
      flatResults.length,
      handleSearch,
      loading,
      navigateToIndex,
      replacing,
      searchBackwards,
      selectedIndex,
    ],
  );

  const enterWalkMode = useCallback(
    (mode: 'find' | 'replace', origin: HTMLInputElement | null) => {
      if (loading || replacing || !findQuery.trim()) return;
      walkOriginRef.current = origin;
      setWalkMode(mode);
      const searchKey = buildSearchKey();
      if (lastSearchKeyRef.current === searchKey && flatResults.length > 0) {
        cycleFind();
      } else {
        void handleSearch();
      }
    },
    [buildSearchKey, cycleFind, findQuery, flatResults.length, handleSearch, loading, replacing],
  );

  const runFindOrNext = useCallback(() => {
    if (loading || replacing || !findQuery.trim()) return;

    const searchKey = buildSearchKey();
    if (lastSearchKeyRef.current === searchKey && flatResults.length > 0) {
      cycleFind();
      return;
    }

    void handleSearch();
  }, [buildSearchKey, cycleFind, findQuery, flatResults.length, handleSearch, loading, replacing]);

  const handleReplace = useCallback(async () => {
    setReplacing(true);
    try {
      await replaceCurrentHit();
    } finally {
      setReplacing(false);
    }
  }, [replaceCurrentHit]);

  const handleReplaceAll = useCallback(async () => {
    setReplacing(true);
    try {
      await replaceAllInScope();
    } finally {
      setReplacing(false);
    }
  }, [replaceAllInScope]);

  const canReplace =
    !loading &&
    !replacing &&
    !!findQuery.trim() &&
    totalMatches > 0 &&
    selectedIndex >= 0 &&
    selectedHit?.replaceable !== false;

  const canReplaceAll = !loading && !replacing && !!findQuery.trim() && totalMatches > 0;

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
          inputRef={findInputRef}
          onChange={(event) => setFindQuery(event.target.value)}
          onKeyDown={(event) => {
            handleFindPanelUndoKeyDown(event);
            if (event.key === 'Enter') {
              event.preventDefault();
              if (!event.shiftKey && !event.altKey) {
                enterWalkMode('find', findInputRef.current);
              }
              // Shift+Enter, Alt+Enter: nothing
              return;
            }
            if (
              event.key === 'F3' ||
              (event.key === 'g' && (event.metaKey || event.ctrlKey) && !event.shiftKey)
            ) {
              event.preventDefault();
              cycleFind(false);
              return;
            }
            if (
              (event.key === 'F3' && event.shiftKey) ||
              (event.key === 'g' && (event.metaKey || event.ctrlKey) && event.shiftKey)
            ) {
              event.preventDefault();
              cycleFind(true);
              return;
            }
            if (event.key === 'ArrowDown' && flatResults.length > 0) {
              event.preventDefault();
              navigateToIndex(0);
              resultsContainerRef.current?.focus();
            }
          }}
          slotProps={{
            input: { sx: { fontSize: '0.8125rem' } },
          }}
        />
        <TextField
          fullWidth
          size="small"
          label="Replace"
          placeholder="Replacement text"
          value={replaceQuery}
          inputRef={replaceInputRef}
          onChange={(event) => setReplaceQuery(event.target.value)}
          onKeyDown={(event) => {
            handleFindPanelUndoKeyDown(event);
            if (event.key === 'Enter') {
              event.preventDefault();
              if (event.shiftKey) {
                if (canReplaceAll) void handleReplaceAll();
              } else if (!event.altKey) {
                enterWalkMode('replace', replaceInputRef.current);
              }
              // Alt+Enter: nothing
              return;
            }
          }}
          helperText={
            selectedHit?.replaceable === false
              ? 'This match crosses XML markup and cannot be replaced in Source mode.'
              : useRegex
                ? 'Capture groups: $1 or \\1'
                : undefined
          }
          slotProps={{ input: { sx: { fontSize: '0.8125rem' } } }}
        />
        <ScopeFields
          scope={scope}
          onScopeChange={setScope}
          customPath={customPath}
          onCustomPathChange={setCustomPath}
          onEnter={() => runFindOrNext()}
          scopeLabelId="find-scope-label"
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={useRegex}
                onChange={(event) => setUseRegex(event.target.checked)}
              />
            }
            label="Regex"
            sx={{ ml: 0, mr: 0, '& .MuiFormControlLabel-label': { fontSize: '0.8125rem' } }}
          />
          <ToggleButtonGroup
            size="small"
            exclusive
            value={searchBackwards ? 'back' : 'forward'}
            onChange={(_event, value: 'back' | 'forward' | null) => {
              if (value) setSearchBackwards(value === 'back');
            }}
          >
            <ToggleButton value="forward" aria-label="Search forward">
              <Tooltip title="Forward">
                <ArrowDownwardIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="back" aria-label="Search backward">
              <Tooltip title="Backward">
                <ArrowUpwardIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
          <Button
            size="small"
            variant="outlined"
            startIcon={<SearchIcon fontSize="small" />}
            onClick={runFindOrNext}
            disabled={loading || replacing || !findQuery.trim()}
          >
            Find
          </Button>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => void handleReplace()}
            disabled={!canReplace}
          >
            Replace
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => void handleReplaceAll()}
            disabled={!canReplaceAll}
          >
            Replace all
          </Button>
        </Box>
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

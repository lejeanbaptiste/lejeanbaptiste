import {
  Box,
  Checkbox,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { ColorSwatchPicker } from '@src/components/ColorSwatchPicker';
import { leafwriterAtom } from '@src/jotai';
import { useAppState } from '@src/overmind';
import { useAtomValue } from 'jotai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HighlighterIcon } from './HighlighterIcon';
import { getEditorTagContext } from './tagSuggestions';
import { clearTagStatsCache, loadTagStats, previewProjectTagStats } from './tagStats';
import type { TagUsageStats } from './tagStats';
import {
  isTagAppearanceCandidate,
  tagAppearanceSupportsHighlight,
} from './tagAppearanceExclusions';
import { loadTagColors, resolveTagColor, updateTagColor } from './tagColors';
import type { TagColorEntry, TagColorsFile } from './tagColors';

const emptyStats = (): TagUsageStats => ({
  version: 1,
  project: { tags: {}, attrs: {}, attrValues: {} },
  files: {},
});

const isVisualEditorActive = (): boolean =>
  Boolean(window.writer?.editor) &&
  window.writer?.overmindState?.ui?.editorViewMode !== 'source';

export const CssPanel = ({ visible = true }: { visible?: boolean }) => {
  const { activeTabPath, openTabs, rootPath } = useAppState().project;
  const { readonly } = useAppState().editor;
  const leafWriter = useAtomValue(leafwriterAtom);

  const [tagColors, setTagColors] = useState<TagColorsFile | null>(null);
  const [tagStats, setTagStats] = useState<TagUsageStats>(emptyStats);
  const [activeTagName, setActiveTagName] = useState('');

  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingEntryRef = useRef<{ tagName: string; colors: TagColorEntry | null } | null>(null);

  const refreshStats = useCallback(async () => {
    if (!rootPath) {
      setTagStats(emptyStats());
      return;
    }
    clearTagStatsCache();
    const persisted = await loadTagStats(rootPath);
    setTagStats(previewProjectTagStats(persisted, rootPath, openTabs));
  }, [openTabs, rootPath]);

  const refreshTagColors = useCallback(async () => {
    if (!rootPath) {
      setTagColors(null);
      return;
    }
    setTagColors(await loadTagColors(rootPath));
  }, [rootPath]);

  const syncActiveTag = useCallback(() => {
    if (!isVisualEditorActive()) {
      setActiveTagName('');
      return;
    }
    const name = getEditorTagContext()?.tagElement?.getAttribute('_tag') ?? '';
    setActiveTagName(name);
  }, []);

  const persistPendingChange = useCallback(async () => {
    const pending = pendingEntryRef.current;
    if (!pending || !rootPath) return;
    pendingEntryRef.current = null;
    const updated = await updateTagColor(rootPath, pending.tagName, pending.colors);
    setTagColors(updated);
  }, [rootPath]);

  const refreshPanel = useCallback(async () => {
    await Promise.all([refreshStats(), refreshTagColors()]);
    syncActiveTag();
  }, [refreshStats, refreshTagColors, syncActiveTag]);

  useEffect(() => {
    if (visible) {
      void refreshPanel();
      return;
    }

    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = null;
    }
    void persistPendingChange();
  }, [visible, refreshPanel, persistPendingChange]);

  useEffect(() => {
    if (!visible || !leafWriter) return;

    const writer = window.writer;
    if (!writer) return;

    const onEditorChange = () => {
      syncActiveTag();
      void refreshStats();
    };

    const events = [
      'documentLoaded',
      'selectionChanged',
      'tagEdited',
      'contentChanged',
      'entityAdded',
      'entityRemoved',
      'nodeChanged',
    ] as const;

    for (const eventName of events) {
      writer.event(eventName).subscribe(onEditorChange);
    }

    return () => {
      for (const eventName of events) {
        writer.event(eventName).unsubscribe(onEditorChange);
      }
    };
  }, [leafWriter, refreshStats, syncActiveTag, visible]);

  useEffect(
    () => () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      void persistPendingChange();
    },
    [persistPendingChange],
  );

  const scheduleSave = useCallback(
    (tagName: string, colors: TagColorEntry | null) => {
      pendingEntryRef.current = { tagName, colors };
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = setTimeout(() => {
        void persistPendingChange();
      }, 300);
    },
    [persistPendingChange],
  );

  const updateEntry = useCallback(
    (tagName: string, mutate: (current: TagColorEntry) => TagColorEntry | null) => {
      const current = resolveTagColor(tagColors ?? { version: 1, tags: {} }, tagName) ?? {};
      const next = mutate(current);
      setTagColors((prev) => {
        const base = prev ?? { version: 1, tags: {} };
        const tags = { ...base.tags };
        if (!next) delete tags[tagName];
        else tags[tagName] = next;
        return { version: 1, tags };
      });
      scheduleSave(tagName, next);
    },
    [scheduleSave, tagColors],
  );

  const orderedTags = useMemo(
    () =>
      Object.entries(tagStats.project.tags)
        .filter(([tagName, count]) => isTagAppearanceCandidate(tagName, count))
        .sort((left, right) => {
          if (right[1] !== left[1]) return right[1] - left[1];
          return left[0].localeCompare(right[0]);
        }),
    [tagStats.project.tags],
  );

  if (!activeTabPath) {
    return (
      <Paper elevation={0} square sx={{ height: '100%', p: 2 }}>
        <Typography color="text.secondary" variant="body2">
          Open a file to manage tag appearance.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      square
      sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
    >
      <Stack spacing={0.5} sx={{ borderBottom: 1, borderColor: 'divider', p: 1.5 }}>
        <Stack alignItems="center" direction="row" spacing={1}>
          <HighlighterIcon color="action" fontSize="small" />
          <Typography fontWeight={600} variant="subtitle2">
            Tag Appearance
          </Typography>
        </Stack>
        <Typography color="text.secondary" variant="caption">
          Body annotation tags only — not metadata or structure (div, p, …).
        </Typography>
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {orderedTags.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 2 }} variant="body2">
            No annotation tags in the document body yet.
          </Typography>
        ) : (
          <Stack spacing={0.5} sx={{ p: 1 }}>
            {orderedTags.map(([tagName, count]) => {
              const colors = resolveTagColor(tagColors ?? { version: 1, tags: {} }, tagName) ?? {};
              const supportsHighlight = tagAppearanceSupportsHighlight(tagName);
              const highlightOn = supportsHighlight && colors.highlightEnabled !== false;
              const textOn = colors.textEnabled !== false;
              return (
                <Stack
                  alignItems="center"
                  direction="row"
                  key={tagName}
                  sx={{
                    borderRadius: 2,
                    gap: 0.75,
                    minWidth: 0,
                    px: 0.75,
                    py: 0.5,
                    ...(activeTagName === tagName
                      ? { bgcolor: 'action.hover' }
                      : undefined),
                  }}
                >
                  <Chip
                    label={count}
                    size="medium"
                    sx={{
                      bgcolor: 'action.hover',
                      borderRadius: '18px',
                      flexShrink: 0,
                      fontSize: 12,
                      fontWeight: 700,
                      height: 24,
                      minWidth: 36,
                      '& .MuiChip-label': { px: 0.75 },
                    }}
                  />
                  <Typography
                    fontSize="0.875rem"
                    fontWeight={activeTagName === tagName ? 700 : 600}
                    lineHeight={1.2}
                    sx={{
                      flex: '1 1 auto',
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tagName}
                  </Typography>
                  {supportsHighlight ? (
                    <ColorSwatchPicker
                      ariaLabel={`${tagName} highlight color`}
                      disabled={readonly || !rootPath}
                      onChange={(hex) =>
                        updateEntry(tagName, (current) => ({ ...current, highlight: hex }))
                      }
                      swatchColor={colors.highlight && highlightOn ? colors.highlight : undefined}
                      value={colors.highlight ?? '#ffffff'}
                    />
                  ) : null}
                  <ColorSwatchPicker
                    ariaLabel={`${tagName} text color`}
                    disabled={readonly || !rootPath}
                    onChange={(hex) =>
                      updateEntry(tagName, (current) => ({ ...current, text: hex }))
                    }
                    swatchColor={colors.text ?? '#000000'}
                    sx={{ opacity: textOn ? 1 : 0.5 }}
                    value={colors.text ?? '#000000'}
                  />
                  {supportsHighlight ? (
                    <Checkbox
                      checked={highlightOn}
                      disabled={readonly || !rootPath}
                      inputProps={{ 'aria-label': `${tagName} show background` }}
                      onChange={(_event, checked) =>
                        updateEntry(tagName, (current) => ({
                          ...current,
                          highlightEnabled: checked,
                        }))
                      }
                      sx={{
                        color: 'text.primary',
                        flexShrink: 0,
                        height: 18,
                        ml: 'auto',
                        p: 0,
                        width: 18,
                        '& .MuiSvgIcon-root': { fontSize: 18 },
                      }}
                    />
                  ) : null}
                </Stack>
              );
            })}
          </Stack>
        )}
      </Box>
    </Paper>
  );
};

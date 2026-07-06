import CloseIcon from '@mui/icons-material/Close';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { leafwriterAtom } from '@src/jotai';
import { useActions, useAppState } from '@src/overmind';
import {
  EastAsianDateFields,
  isEastAsianCalendarLanguageCode,
  mergeEastAsianIntoAttributes,
  readEastAsianDateValues,
  useDateAuthority,
} from '@cwrc/leafwriter';
import { useAtomValue } from 'jotai';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyAttributeToTag,
  commitTagAttributes,
  readTagAttributes,
  removeAttributeFromTag,
} from './attributeCommand';
import { openEntityLookupForTag, getLookupEntityTypeForTag } from './attributeLookup';
import {
  fetchSchemaAttributes,
  type SchemaAttributeDetail,
} from './attributeSuggestions';
import { getEditorTagContext } from './tagSuggestions';
import {
  loadTagColors,
  resolveTagColor,
  updateTagColor,
  type TagColorEntry,
  type TagColorsFile,
} from './tagColors';

const isVisualEditorActive = (): boolean =>
  Boolean(window.writer?.editor) &&
  window.writer?.overmindState?.ui?.editorViewMode !== 'source';

const isFocusInAttributesPanel = (): boolean =>
  Boolean(document.activeElement?.closest('[data-attributes-panel]'));

export const AttributesPanel = ({ visible = true }: { visible?: boolean }) => {
  const { activeTabPath, rootPath } = useAppState().project;
  const { readonly } = useAppState().editor;
  const leafWriter = useAtomValue(leafwriterAtom);
  const { notifyViaSnackbar } = useActions().ui;

  const [tagElement, setTagElement] = useState<Element | null>(null);
  const [tagName, setTagName] = useState('');
  const [schemaAttributes, setSchemaAttributes] = useState<SchemaAttributeDetail[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [tagColors, setTagColors] = useState<TagColorsFile | null>(null);
  const [addAttrName, setAddAttrName] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState<string | null>(null);

  const eastAsianDates =
    tagName === 'date' && isEastAsianCalendarLanguageCode(sourceLanguage);
  const { authority, loading: authorityLoading, error: authorityError } = useDateAuthority(
    eastAsianDates,
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingColorRef = useRef<{ tagName: string; colors: TagColorEntry } | null>(null);
  const syncGenerationRef = useRef(0);
  const valuesRef = useRef(values);
  const tagElementRef = useRef(tagElement);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    tagElementRef.current = tagElement;
  }, [tagElement]);

  useEffect(() => {
    let cancelled = false;
    void window.__leafWriterProject?.getProjectSourceLanguage?.().then((language) => {
      if (!cancelled) setSourceLanguage(language ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [activeTabPath]);

  const persistPendingColorRef = useRef<() => Promise<void>>(async () => {});

  const syncFromEditor = useCallback(async () => {
    if (!isVisualEditorActive()) {
      setTagElement(null);
      setTagName('');
      setSchemaAttributes([]);
      setValues({});
      return;
    }

    const ctx = getEditorTagContext();
    const element = ctx?.tagElement ?? ctx?.element ?? null;
    const name = element?.getAttribute('_tag') ?? '';

    if (!element || !name) {
      if (isFocusInAttributesPanel() && tagElementRef.current?.isConnected) {
        return;
      }
      setTagElement(null);
      setTagName('');
      setSchemaAttributes([]);
      setValues({});
      return;
    }

    const generation = ++syncGenerationRef.current;
    setTagElement(element);
    setTagName(name);
    setValues(readTagAttributes(element));
    const attrs = await fetchSchemaAttributes(element);
    if (generation !== syncGenerationRef.current) return;
    setSchemaAttributes(attrs);
  }, []);

  const attachEditorSync = useCallback(() => {
    const writer = window.writer;
    if (!writer) return undefined;

    const events = ['selectionChanged', 'tagEdited', 'contentChanged', 'nodeChanged'] as const;
    const handler = () => void syncFromEditor();
    const onWriterKeyup = (event: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
        void syncFromEditor();
      }
    };

    for (const eventName of events) {
      writer.event(eventName).subscribe(handler);
    }
    writer.event('writerKeyup').subscribe(onWriterKeyup);
    void syncFromEditor();

    return () => {
      for (const eventName of events) {
        writer.event(eventName).unsubscribe(handler);
      }
      writer.event('writerKeyup').unsubscribe(onWriterKeyup);
    };
  }, [syncFromEditor]);

  useEffect(() => {
    if (!leafWriter) return;

    let detach = attachEditorSync();
    const onWriterReady = () => {
      detach?.();
      detach = attachEditorSync();
    };

    const subscribeReady = () => {
      window.writer?.event('tinymceInitialized').subscribe(onWriterReady);
      window.writer?.event('documentLoaded').subscribe(onWriterReady);
    };

    const unsubscribeReady = () => {
      window.writer?.event('tinymceInitialized').unsubscribe(onWriterReady);
      window.writer?.event('documentLoaded').unsubscribe(onWriterReady);
    };

    subscribeReady();

    if (!detach) {
      const retryId = window.setInterval(() => {
        if (!window.writer) return;
        detach = attachEditorSync();
        if (detach) {
          subscribeReady();
          window.clearInterval(retryId);
        }
      }, 100);
      return () => {
        window.clearInterval(retryId);
        detach?.();
        unsubscribeReady();
      };
    }

    return () => {
      detach?.();
      unsubscribeReady();
    };
  }, [activeTabPath, attachEditorSync, leafWriter]);

  useEffect(() => {
    if (!visible) return;
    void syncFromEditor();
  }, [visible, syncFromEditor]);

  useEffect(() => {
    if (!rootPath) {
      setTagColors(null);
      return;
    }
    void loadTagColors(rootPath).then(setTagColors);
  }, [rootPath]);

  const commitValues = useCallback(
    (nextValues: Record<string, string>) => {
      const element = tagElementRef.current;
      if (!element || readonly) return;
      const result = commitTagAttributes(element, nextValues);
      if (!result.applied && result.error) {
        notifyViaSnackbar({ message: result.error, options: { variant: 'warning' } });
      }
      setValues(readTagAttributes(element));
    },
    [notifyViaSnackbar, readonly],
  );

  const handleFieldChange = (attrName: string, value: string) => {
    const nextValues = { ...valuesRef.current, [attrName]: value };
    valuesRef.current = nextValues;
    setValues(nextValues);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => commitValues(nextValues), 300);
  };

  const handleRemoveAttribute = (attrName: string) => {
    const element = tagElementRef.current;
    if (!element || readonly) return;
    removeAttributeFromTag(element, attrName);
    setValues(readTagAttributes(element));
  };

  const handleAddAttribute = () => {
    const element = tagElementRef.current;
    if (!element || readonly || !addAttrName.trim()) return;
    applyAttributeToTag(element, addAttrName.trim(), '');
    setAddAttrName('');
    setValues(readTagAttributes(element));
  };

  const handleLookup = () => {
    const element = tagElementRef.current;
    if (!element || readonly) return;
    openEntityLookupForTag(element, () => {
      setValues(readTagAttributes(element));
    });
  };

  const persistPendingColor = useCallback(async () => {
    const pending = pendingColorRef.current;
    if (!pending || !rootPath) return;
    pendingColorRef.current = null;
    const updated = await updateTagColor(rootPath, pending.tagName, pending.colors);
    setTagColors(updated);
  }, [rootPath]);

  useEffect(() => {
    persistPendingColorRef.current = persistPendingColor;
  }, [persistPendingColor]);

  const handleColorChange = (field: keyof TagColorEntry, color: string) => {
    if (!rootPath || !tagName) return;
    const current = resolveTagColor(tagColors ?? { version: 1, tags: {} }, tagName) ?? {};
    const next: TagColorEntry = { ...current, [field]: color };

    setTagColors((prev) => {
      const base = prev ?? { version: 1, tags: {} };
      return { version: 1, tags: { ...base.tags, [tagName]: next } };
    });
    pendingColorRef.current = { tagName, colors: next };

    if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
    colorDebounceRef.current = setTimeout(() => {
      void persistPendingColor();
    }, 300);
  };

  const handleResetColors = async () => {
    if (!rootPath || !tagName) return;
    if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
    pendingColorRef.current = null;
    const updated = await updateTagColor(rootPath, tagName, null);
    setTagColors(updated);
  };

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
      void persistPendingColorRef.current();
    },
    [],
  );

  if (!activeTabPath) {
    return (
      <Paper data-attributes-panel elevation={0} square sx={{ height: '100%', p: 2 }}>
        <Typography color="text.secondary" variant="body2">
          Open a file to edit tag attributes.
        </Typography>
      </Paper>
    );
  }

  if (!tagElement || !tagName) {
    return (
      <Paper data-attributes-panel elevation={0} square sx={{ height: '100%', p: 2 }}>
        <Typography color="text.secondary" variant="body2">
          Place the caret inside a tag to view and edit its attributes.
        </Typography>
      </Paper>
    );
  }

  const handleEastAsianChange = (nextValues: ReturnType<typeof readEastAsianDateValues>) => {
    const merged = mergeEastAsianIntoAttributes(valuesRef.current, nextValues);
    valuesRef.current = merged;
    setValues(merged);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => commitValues(merged), 300);
  };

  const lookupAvailable = Boolean(getLookupEntityTypeForTag(tagName));
  const resolvedColors = resolveTagColor(tagColors ?? { version: 1, tags: {} }, tagName);
  const unsetSchemaAttrs = schemaAttributes.filter((attr) => !(attr.name in values));
  const eastAsianAttrNames = new Set([
    'dyn_id',
    'ruler_id',
    'era_id',
    'year',
    'month',
    'day',
    'sex_year',
    'gz',
    'nmd_gz',
  ]);
  const setAttributeEntries = Object.entries(values).filter(
    ([name]) => !(eastAsianDates && eastAsianAttrNames.has(name)),
  );

  return (
    <Paper
      data-attributes-panel
      elevation={0}
      square
      sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
    >
      <Stack spacing={1} sx={{ borderBottom: 1, borderColor: 'divider', p: 1.5 }}>
        <Stack alignItems="center" direction="row" spacing={1}>
          <LabelOutlinedIcon color="action" fontSize="small" />
          <Typography fontWeight={600} variant="subtitle2">
            &lt;{tagName}&gt;
          </Typography>
          <Typography color="text.secondary" variant="caption">
            F2 to rename
          </Typography>
        </Stack>

        {lookupAvailable ? (
          <Button
            disabled={readonly}
            onClick={handleLookup}
            size="small"
            startIcon={<SearchIcon />}
            variant="outlined"
          >
            Lookup…
          </Button>
        ) : null}
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 1.5 }}>
        <Stack spacing={1.5}>
          {eastAsianDates ? (
            <EastAsianDateFields
              authority={authority}
              disabled={readonly}
              error={authorityError}
              loading={authorityLoading}
              onChange={handleEastAsianChange}
              values={readEastAsianDateValues(values)}
            />
          ) : null}

          {setAttributeEntries.length === 0 && !eastAsianDates ? (
            <Typography color="text.secondary" variant="body2">
              No attributes set on this tag.
            </Typography>
          ) : null}

          {setAttributeEntries.map(([attrName, attrValue]) => {
            const attr =
              schemaAttributes.find((item) => item.name === attrName) ?? { name: attrName };

            return (
              <Stack alignItems="center" direction="row" key={attr.name} spacing={0.5}>
                {attr.choices && attr.choices.length > 0 ? (
                  <TextField
                    select
                    disabled={readonly}
                    fullWidth
                    label={attr.name}
                    size="small"
                    sx={{ flex: 1, minWidth: 0 }}
                    value={attrValue}
                    onChange={(event) => handleFieldChange(attr.name, event.target.value)}
                  >
                    <MenuItem value="">
                      <em>(none)</em>
                    </MenuItem>
                    {attr.choices.map((choice) => (
                      <MenuItem key={choice} value={choice}>
                        {choice}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : (
                  <TextField
                    disabled={readonly}
                    fullWidth
                    label={attr.name}
                    size="small"
                    sx={{ flex: 1, minWidth: 0 }}
                    value={attrValue}
                    onChange={(event) => handleFieldChange(attr.name, event.target.value)}
                  />
                )}
                {!readonly ? (
                  <Tooltip title={`Remove ${attr.name}`}>
                    <IconButton
                      aria-label={`Remove ${attr.name}`}
                      onClick={() => handleRemoveAttribute(attr.name)}
                      size="small"
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ) : null}
              </Stack>
            );
          })}

          {unsetSchemaAttrs.length > 0 ? (
            <Stack alignItems="flex-start" direction="row" spacing={1}>
              <TextField
                select
                disabled={readonly}
                label="Add attribute"
                size="small"
                sx={{ minWidth: 160 }}
                value={addAttrName}
                onChange={(event) => setAddAttrName(event.target.value)}
              >
                <MenuItem value="">
                  <em>Select…</em>
                </MenuItem>
                {unsetSchemaAttrs.map((attr) => (
                  <MenuItem key={attr.name} value={attr.name}>
                    {attr.name}
                  </MenuItem>
                ))}
              </TextField>
              <Button disabled={readonly || !addAttrName} onClick={handleAddAttribute} size="small" variant="outlined">
                Add
              </Button>
            </Stack>
          ) : null}
        </Stack>
      </Box>

      <Stack
        alignItems="center"
        direction="row"
        spacing={1}
        sx={{ borderTop: 1, borderColor: 'divider', flexShrink: 0, p: 1.5 }}
      >
        <Tooltip title="Highlight colour (all tags of this type)">
          <TextField
            disabled={readonly || !rootPath}
            label="Highlight"
            size="small"
            type="color"
            value={resolvedColors?.highlight ?? '#ffffff'}
            onChange={(event) => void handleColorChange('highlight', event.target.value)}
            sx={{ width: 120 }}
          />
        </Tooltip>
        <Tooltip title="Text colour (all tags of this type)">
          <TextField
            disabled={readonly || !rootPath}
            label="Text"
            size="small"
            type="color"
            value={resolvedColors?.text ?? '#000000'}
            onChange={(event) => void handleColorChange('text', event.target.value)}
            sx={{ width: 120 }}
          />
        </Tooltip>
        <Button disabled={readonly || !rootPath} onClick={() => void handleResetColors()} size="small">
          Reset
        </Button>
      </Stack>
    </Paper>
  );
};

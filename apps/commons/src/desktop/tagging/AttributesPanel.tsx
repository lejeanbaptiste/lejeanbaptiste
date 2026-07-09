import CloseIcon from '@mui/icons-material/Close';
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Box,
  Button,
  Chip,
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
import { CbdbIcon, DilaIcon, InitialsIcon } from '../../../../../packages/cwrc-leafwriter/src/icons/custom/AuthoritySource';
import { WikipediaIcon } from '../../../../../packages/cwrc-leafwriter/src/icons/custom/Wikipedia';
import {
  EntitySummary,
  listEntities,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityOps';
import { entityStoreFromDesktop } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityStore';
import { openExternalUrl } from '../../../../../packages/cwrc-leafwriter/src/utilities/DOM';
import {
  applyAttributeToTag,
  commitTagAttributes,
  readTagAttributes,
  removeAttributeFromTag,
} from './attributeCommand';
import {
  countExactUnkeyedTagMatches,
  listExactUnkeyedTagMatches,
  propagateAttributesToExactUnkeyedMatches,
} from './attributePropagate';
import { authorityLookupUrl } from '../entityDb/authorityLinks';
import { openEntityLookupForTag, getLookupEntityTypeForTag } from './attributeLookup';
import { fetchSchemaAttributes } from './attributeSuggestions';
import type { SchemaAttributeDetail } from './attributeSuggestions';
import { getEditorTagContext } from './tagSuggestions';
import {
  clearTagWalkHighlight,
  highlightTagWalkElement,
  scrollTagWalkTargetIntoView,
} from './tagWalkHighlight';

const isVisualEditorActive = (): boolean =>
  Boolean(window.writer?.editor) &&
  window.writer?.overmindState?.ui?.editorViewMode !== 'source';

const isFocusInAttributesPanel = (): boolean =>
  Boolean(document.activeElement?.closest('[data-attributes-panel]'));

interface LinkedEntityInfo {
  entity: EntitySummary;
  urls: { type: string; url: string }[];
}

const authorityIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'wikidata':
    case 'wikipedia':
      return <WikipediaIcon sx={{ fontSize: 14 }} />;
    case 'cbdb':
      return <CbdbIcon sx={{ fontSize: 14 }} />;
    case 'viaf':
      return <InitialsIcon top="VI" bottom="AF" sx={{ fontSize: 14 }} />;
    case 'dila':
      return <DilaIcon sx={{ fontSize: 14 }} />;
    default:
      return <OpenInNewIcon sx={{ fontSize: 12 }} />;
  }
};

export const AttributesPanel = ({ visible = true }: { visible?: boolean }) => {
  const { activeTabPath } = useAppState().project;
  const { readonly } = useAppState().editor;
  const leafWriter = useAtomValue(leafwriterAtom);
  const { notifyViaSnackbar } = useActions().ui;

  const [tagElement, setTagElement] = useState<Element | null>(null);
  const [tagName, setTagName] = useState('');
  const [schemaAttributes, setSchemaAttributes] = useState<SchemaAttributeDetail[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [addAttrName, setAddAttrName] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState<string | null>(null);
  const [linkedEntityInfo, setLinkedEntityInfo] = useState<LinkedEntityInfo | null>(null);
  const [propagatableMatchCount, setPropagatableMatchCount] = useState(0);
  const [walkMatches, setWalkMatches] = useState<Element[]>([]);
  const [walkIndex, setWalkIndex] = useState(0);
  const [walkActive, setWalkActive] = useState(false);

  const eastAsianDates =
    tagName === 'date' && isEastAsianCalendarLanguageCode(sourceLanguage);
  const { authority, loading: authorityLoading, error: authorityError } = useDateAuthority(
    eastAsianDates,
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const syncFromEditor = useCallback(async () => {
    if (!isVisualEditorActive()) {
      setTagElement(null);
      setTagName('');
      setSchemaAttributes([]);
      setValues({});
      setPropagatableMatchCount(0);
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
      setPropagatableMatchCount(0);
      return;
    }

    const generation = ++syncGenerationRef.current;
    setTagElement(element);
    setTagName(name);
    setValues(readTagAttributes(element));
    setPropagatableMatchCount(countExactUnkeyedTagMatches(element));
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
    if (!walkActive) {
      clearTagWalkHighlight();
      return;
    }
    const current = walkMatches[walkIndex];
    if (!current?.isConnected) return;
    highlightTagWalkElement(current);
    scrollTagWalkTargetIntoView(current);
  }, [walkActive, walkIndex, walkMatches]);

  useEffect(() => {
    let cancelled = false;

    const loadLinkedEntityInfo = async () => {
      const key = values.key?.trim();
      if (!key) {
        setLinkedEntityInfo(null);
        return;
      }

      const store = entityStoreFromDesktop();
      if (!store) {
        setLinkedEntityInfo(null);
        return;
      }

      try {
        const doc = await store.loadEntities();
        if (cancelled) return;
        const entity = listEntities(doc).find((item: EntitySummary) => item.id === key) ?? null;
        if (!entity) {
          setLinkedEntityInfo(null);
          return;
        }
        const urls = entity.authorities
          .map((authority: EntitySummary['authorities'][number]) => ({
            type: authority.type,
            url: authorityLookupUrl(authority),
          }))
          .filter(
            (authority: { type: string; url: string | null }): authority is { type: string; url: string } =>
              Boolean(authority.url),
          );
        setLinkedEntityInfo({ entity, urls });
      } catch {
        if (!cancelled) setLinkedEntityInfo(null);
      }
    };

    void loadLinkedEntityInfo();
    return () => {
      cancelled = true;
    };
  }, [values.key]);

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
      setPropagatableMatchCount(countExactUnkeyedTagMatches(element));
    });
  };

  const refreshWalkMatches = useCallback(() => {
    const element = tagElementRef.current;
    if (!element) {
      setWalkMatches([]);
      setWalkIndex(0);
      return [];
    }
    const matches = listExactUnkeyedTagMatches(element);
    setWalkMatches(matches);
    setWalkIndex((current) => Math.min(current, Math.max(matches.length - 1, 0)));
    return matches;
  }, []);

  const stopWalk = useCallback(() => {
    setWalkActive(false);
    setWalkMatches([]);
    setWalkIndex(0);
    clearTagWalkHighlight();
  }, []);

  const startWalk = useCallback(() => {
    const matches = refreshWalkMatches();
    if (matches.length === 0) {
      notifyViaSnackbar({
        message: 'No exact unkeyed matches were found for this tag.',
        options: { variant: 'info' },
      });
      return;
    }
    setWalkActive(true);
  }, [notifyViaSnackbar, refreshWalkMatches]);

  const applyToMatch = useCallback(
    (target: Element) => {
      const source = tagElementRef.current;
      if (!source || readonly) return false;
      const attrs = readTagAttributes(source);
      const result = commitTagAttributes(target, attrs);
      if (result.applied) {
        setValues(readTagAttributes(source));
      }
      return result.applied;
    },
    [readonly],
  );

  const handleWalkApply = useCallback(() => {
    const current = walkMatches[walkIndex];
    if (!current) {
      stopWalk();
      return;
    }
    const applied = applyToMatch(current);
    if (!applied) {
      notifyViaSnackbar({
        message: 'Could not apply attributes to the current match.',
        options: { variant: 'warning' },
      });
      return;
    }

    const nextMatches = refreshWalkMatches();
    if (nextMatches.length === 0) {
      notifyViaSnackbar({ message: 'Walk complete.', options: { variant: 'success' } });
      stopWalk();
      return;
    }
    setWalkIndex((currentIndex) => Math.min(currentIndex, nextMatches.length - 1));
  }, [applyToMatch, notifyViaSnackbar, refreshWalkMatches, stopWalk, walkIndex, walkMatches]);

  const handleWalkSkip = useCallback(() => {
    const nextIndex = walkIndex + 1;
    if (nextIndex >= walkMatches.length) {
      notifyViaSnackbar({
        message: 'No more matches to skip to.',
        options: { variant: 'info' },
      });
      return;
    }
    setWalkIndex(nextIndex);
  }, [notifyViaSnackbar, walkIndex, walkMatches.length]);

  const handlePropagateAttributes = () => {
    const element = tagElementRef.current;
    if (!element || readonly) return;
    const result = propagateAttributesToExactUnkeyedMatches(element);
    setValues(readTagAttributes(element));
    setPropagatableMatchCount(countExactUnkeyedTagMatches(element));
    if (result.applied > 0) {
      notifyViaSnackbar({
        message:
          result.skipped > 0
            ? `Propagated key and attributes to ${result.applied} exact matches (${result.skipped} skipped).`
            : `Propagated key and attributes to ${result.applied} exact matches.`,
        options: { variant: 'success' },
      });
      return;
    }
    notifyViaSnackbar({
      message: 'No exact unkeyed matches were updated.',
      options: { variant: 'info' },
    });
  };

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
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
          <Stack spacing={1}>
            <Button
              disabled={readonly}
              onClick={handleLookup}
              size="small"
              startIcon={<SearchIcon />}
              variant="outlined"
            >
              Lookup…
            </Button>
            {linkedEntityInfo ? (
              <Alert
                icon={false}
                severity="info"
                sx={{
                  py: 0.75,
                  px: 1,
                  '& .MuiAlert-message': { width: '100%' },
                }}
              >
                <Stack spacing={0.75}>
                  <Stack
                    alignItems="center"
                    direction="row"
                    flexWrap="wrap"
                    gap={0.75}
                    justifyContent="space-between"
                  >
                    <Stack alignItems="center" direction="row" flexWrap="wrap" gap={0.75}>
                      <Chip
                        label={linkedEntityInfo.entity.id}
                        size="small"
                        sx={{ fontFamily: 'monospace', height: 20 }}
                        variant="outlined"
                      />
                      <Typography variant="body2">
                        {linkedEntityInfo.entity.names[0] ?? linkedEntityInfo.entity.id}
                      </Typography>
                    </Stack>
                    {linkedEntityInfo.urls.length > 0 ? (
                      <Stack alignItems="center" direction="row" spacing={0.25}>
                        {linkedEntityInfo.urls.map((authority) => (
                          <Tooltip key={`${authority.type}:${authority.url}`} title={authority.type}>
                            <IconButton
                              aria-label={`Open ${authority.type}`}
                              onClick={() => openExternalUrl(authority.url)}
                              size="small"
                              sx={{ p: 0.25 }}
                            >
                              {authorityIcon(authority.type)}
                            </IconButton>
                          </Tooltip>
                        ))}
                      </Stack>
                    ) : null}
                  </Stack>
                  {linkedEntityInfo.entity.description ? (
                    <Typography color="text.secondary" variant="caption">
                      {linkedEntityInfo.entity.description}
                    </Typography>
                  ) : (
                    <Typography color="text.secondary" variant="caption">
                      This tag is already linked to an entity in the project database.
                    </Typography>
                  )}
                  {propagatableMatchCount > 0 ? (
                    <Stack
                      alignItems="center"
                      direction="row"
                      flexWrap="wrap"
                      gap={0.75}
                      justifyContent="space-between"
                    >
                      <Typography color="text.secondary" variant="caption">
                        {propagatableMatchCount} exact unkeyed{' '}
                        {propagatableMatchCount === 1 ? 'match' : 'matches'} found in this file.
                      </Typography>
                      <Stack direction="row" spacing={0.75}>
                        <Button disabled={readonly} onClick={startWalk} size="small" variant="outlined">
                          Walk
                        </Button>
                        <Button
                          disabled={readonly}
                          onClick={handlePropagateAttributes}
                          size="small"
                          variant="outlined"
                        >
                          Propagate all
                        </Button>
                      </Stack>
                    </Stack>
                  ) : null}
                </Stack>
              </Alert>
            ) : null}
            {walkActive ? (
              <Alert
                icon={false}
                severity="warning"
                sx={{
                  py: 0.75,
                  px: 1,
                  '& .MuiAlert-message': { width: '100%' },
                }}
              >
                <Stack spacing={0.75}>
                  <Typography variant="body2">
                    Walk {walkIndex + 1} of {walkMatches.length}
                  </Typography>
                  <Stack direction="row" spacing={0.75}>
                    <Button disabled={readonly} onClick={handleWalkApply} size="small" variant="contained">
                      Apply
                    </Button>
                    <Button disabled={readonly} onClick={handleWalkSkip} size="small" variant="outlined">
                      Skip
                    </Button>
                    <Button onClick={stopWalk} size="small" variant="text">
                      Exit
                    </Button>
                  </Stack>
                </Stack>
              </Alert>
            ) : null}
          </Stack>
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
    </Paper>
  );
};

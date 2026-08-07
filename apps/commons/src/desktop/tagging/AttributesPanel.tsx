import AddIcon from '@mui/icons-material/Add';
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
import { useAtomValue } from 'jotai';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isCjkDatesEnabled } from '../../../../../packages/cwrc-leafwriter/src/plugins/registry';
import { isEastAsianCalendarLanguageCode } from '../../../../../packages/cwrc-leafwriter/src/utilities/languageCodes';
import {
  mergeEastAsianIntoAttributes,
  readEastAsianDateValues,
} from '../../../../../packages/cwrc-leafwriter/src/dateAuthority/values';
import type { EastAsianDateValues } from '../../../../../packages/cwrc-leafwriter/src/dateAuthority/types';
import {
  CbdbIcon,
  DilaIcon,
  InitialsIcon,
} from '../../../../../packages/cwrc-leafwriter/src/icons/custom/AuthoritySource';
import { WikipediaIcon } from '../../../../../packages/cwrc-leafwriter/src/icons/custom/Wikipedia';
import { EntitySummary } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityOps';
import {
  ALL_NAME_TYPES,
  type NameTypeId,
} from '../../../../../packages/cwrc-leafwriter/src/autoTagging/nameTypes';
import { nameTypeLabel } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/nameTypeLabels';
import { entityStoreFromDesktop } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityStore';
import { entitySummaryFromSqlite } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/sqliteSummary';
import { SQLITE_REQUIRED_PANEL_MESSAGE } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/sqliteRequired';
import { foldForSearch } from '../../../../../packages/cwrc-leafwriter/src/utilities/romanize';

const LazyAttributesEastAsianSection = lazy(() =>
  import('../../../../../packages/cwrc-leafwriter/src/dateAuthority/AttributesEastAsianSection').then(
    (mod) => ({ default: mod.AttributesEastAsianSection }),
  ),
);
import { openExternalUrl } from '../../../../../packages/cwrc-leafwriter/src/utilities/DOM';
import {
  applyAttributeToTag,
  commitTagAttributes,
  readTagAttributes,
  removeAttributeFromTag,
} from './attributeCommand';
import {
  clearKeyFromExactMatches,
  countExactTagMatches,
  listExactUnkeyedTagMatches,
  propagateAttributesToExactUnkeyedMatches,
} from './attributePropagate';
import { authorityLookupUrl } from '../entityDb/authorityLinks';
import { openEntityLookupForTag, getLookupEntityTypeForTag } from './attributeLookup';
import { fetchSchemaAttributes, schemaAttributeContextKey } from './attributeSuggestions';
import type { SchemaAttributeDetail } from './attributeSuggestions';
import { getEditorTagContext } from './tagSuggestions';
import {
  clearTagWalkHighlight,
  highlightTagWalkElement,
  scrollTagWalkTargetIntoView,
} from './tagWalkHighlight';

const isVisualEditorActive = (): boolean =>
  Boolean(window.writer?.editor) && window.writer?.overmindState?.ui?.editorViewMode !== 'source';

const isFocusInAttributesPanel = (): boolean =>
  Boolean(document.activeElement?.closest('[data-attributes-panel]'));

const sameAttributeValues = (
  left: Record<string, string>,
  right: Record<string, string>,
): boolean => {
  const leftEntries = Object.entries(left);
  const rightKeys = Object.keys(right);
  return (
    leftEntries.length === rightKeys.length &&
    leftEntries.every(([name, value]) => right[name] === value)
  );
};

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
  const { t } = useTranslation();
  const { activeTabPath } = useAppState().project;
  const { readonly } = useAppState().editor;
  const leafWriter = useAtomValue(leafwriterAtom);
  const { notifyViaSnackbar } = useActions().ui;

  const [tagElement, setTagElement] = useState<Element | null>(null);
  const [tagName, setTagName] = useState('');
  const [schemaAttributes, setSchemaAttributes] = useState<SchemaAttributeDetail[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [addAttrName, setAddAttrName] = useState('');
  const [addAttrValue, setAddAttrValue] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState<string | null>(null);
  const [linkedEntityInfo, setLinkedEntityInfo] = useState<LinkedEntityInfo | null>(null);
  const [entityInfoRevision, setEntityInfoRevision] = useState(0);
  const [nameTypeBusy, setNameTypeBusy] = useState(false);
  const [propagatableMatchCount, setPropagatableMatchCount] = useState(0);
  const [keyedMatchCount, setKeyedMatchCount] = useState(0);
  const [walkMatches, setWalkMatches] = useState<Element[]>([]);
  const [walkIndex, setWalkIndex] = useState(0);
  const [walkActive, setWalkActive] = useState(false);

  const eastAsianDates =
    isCjkDatesEnabled() && tagName === 'date' && isEastAsianCalendarLanguageCode(sourceLanguage);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncGenerationRef = useRef(0);
  const syncFrameRef = useRef<number | null>(null);
  const forceScheduledSyncRef = useRef(false);
  const lastSyncedElementRef = useRef<Element | null>(null);
  const schemaAttributeCacheRef = useRef(
    new Map<string, Promise<SchemaAttributeDetail[]>>(),
  );
  const matchCountCacheRef = useRef(
    new Map<string, { keyed: number; unkeyed: number }>(),
  );
  const schemaAttributesRef = useRef(schemaAttributes);
  const valuesRef = useRef(values);
  const tagElementRef = useRef(tagElement);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    schemaAttributesRef.current = schemaAttributes;
  }, [schemaAttributes]);

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
  const clearEditorSelection = useCallback(() => {
    if (!tagElementRef.current && !lastSyncedElementRef.current) return;
    syncGenerationRef.current += 1;
    lastSyncedElementRef.current = null;
    tagElementRef.current = null;
    valuesRef.current = {};
    schemaAttributesRef.current = [];
    setTagElement(null);
    setTagName('');
    setSchemaAttributes([]);
    setValues({});
    setPropagatableMatchCount(0);
    setKeyedMatchCount(0);
  }, []);

  const loadSchemaAttributes = useCallback((element: Element) => {
    const writer = window.writer;
    const tag = element.getAttribute('_tag') ?? '';
    const xpath = writer?.utilities.getElementXPath(element);
    const cacheKey = schemaAttributeContextKey(tag, xpath);
    const cached = schemaAttributeCacheRef.current.get(cacheKey);
    if (cached) return cached;

    const request = fetchSchemaAttributes(element).catch((error) => {
      schemaAttributeCacheRef.current.delete(cacheKey);
      throw error;
    });
    schemaAttributeCacheRef.current.set(cacheKey, request);
    return request;
  }, []);

  const loadMatchCounts = useCallback(
    (element: Element, attrs: Record<string, string>) => {
      const matchKey = [
        element.getAttribute('_tag') ?? '',
        element.textContent?.trim() ?? '',
        attrs.key ?? '',
      ].join('\0');
      const cached = matchCountCacheRef.current.get(matchKey);
      if (cached) return cached;
      const counts = countExactTagMatches(element, attrs.key);
      matchCountCacheRef.current.set(matchKey, counts);
      return counts;
    },
    [],
  );

  const refreshMatchCounts = useCallback(
    (element: Element, attrs = readTagAttributes(element)) => {
      matchCountCacheRef.current.clear();
      const counts = loadMatchCounts(element, attrs);
      setPropagatableMatchCount(counts.unkeyed);
      setKeyedMatchCount(counts.keyed);
    },
    [loadMatchCounts],
  );

  const syncFromEditor = useCallback(async (force = false) => {
    if (!visible || !isVisualEditorActive()) {
      clearEditorSelection();
      return;
    }

    const ctx = getEditorTagContext();
    const element = ctx?.tagElement ?? ctx?.element ?? null;
    const name = element?.getAttribute('_tag') ?? '';

    if (!element || !name) {
      if (isFocusInAttributesPanel() && tagElementRef.current?.isConnected) {
        return;
      }
      clearEditorSelection();
      return;
    }

    const elementChanged = element !== lastSyncedElementRef.current;
    if (!force && !elementChanged) return;

    const generation = ++syncGenerationRef.current;
    lastSyncedElementRef.current = element;
    tagElementRef.current = element;
    setTagElement(element);
    setTagName(name);

    const attrs = readTagAttributes(element);
    if (elementChanged || !sameAttributeValues(valuesRef.current, attrs)) {
      valuesRef.current = attrs;
      setValues(attrs);
    }

    const counts = loadMatchCounts(element, attrs);
    setPropagatableMatchCount(counts.unkeyed);
    setKeyedMatchCount(counts.keyed);

    if (!elementChanged && schemaAttributesRef.current.length > 0) return;

    try {
      const schemaAttrs = await loadSchemaAttributes(element);
      if (generation !== syncGenerationRef.current) return;
      schemaAttributesRef.current = schemaAttrs;
      setSchemaAttributes(schemaAttrs);
    } catch {
      if (generation !== syncGenerationRef.current) return;
      schemaAttributesRef.current = [];
      setSchemaAttributes([]);
    }
  }, [clearEditorSelection, loadMatchCounts, loadSchemaAttributes, visible]);

  const scheduleEditorSync = useCallback(
    (force = false) => {
      forceScheduledSyncRef.current ||= force;
      if (syncFrameRef.current !== null) return;
      syncFrameRef.current = window.requestAnimationFrame(() => {
        syncFrameRef.current = null;
        const shouldForce = forceScheduledSyncRef.current;
        forceScheduledSyncRef.current = false;
        void syncFromEditor(shouldForce);
      });
    },
    [syncFromEditor],
  );

  const cancelScheduledEditorSync = useCallback(() => {
    if (syncFrameRef.current !== null) {
      window.cancelAnimationFrame(syncFrameRef.current);
      syncFrameRef.current = null;
    }
    forceScheduledSyncRef.current = false;
  }, []);

  const resetEditorSyncCaches = useCallback(() => {
    syncGenerationRef.current += 1;
    lastSyncedElementRef.current = null;
    schemaAttributeCacheRef.current.clear();
    matchCountCacheRef.current.clear();
    schemaAttributesRef.current = [];
  }, []);

  const attachEditorSync = useCallback(() => {
    const writer = window.writer;
    if (!writer || !visible) return undefined;

    const handleSelectionSignal = () => scheduleEditorSync();
    const handleContentChanged = () => {
      matchCountCacheRef.current.clear();
      scheduleEditorSync();
    };
    const handleTagEdited = () => {
      matchCountCacheRef.current.clear();
      scheduleEditorSync(true);
    };
    const handleSchemaChanged = () => {
      schemaAttributeCacheRef.current.clear();
      schemaAttributesRef.current = [];
      setSchemaAttributes([]);
      scheduleEditorSync(true);
    };
    const onWriterKeyup = (event: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
        scheduleEditorSync();
      }
    };

    writer.event('selectionChanged').subscribe(handleSelectionSignal);
    writer.event('nodeChanged').subscribe(handleSelectionSignal);
    writer.event('contentChanged').subscribe(handleContentChanged);
    writer.event('tagEdited').subscribe(handleTagEdited);
    writer.event('schemaChanged').subscribe(handleSchemaChanged);
    writer.event('writerKeyup').subscribe(onWriterKeyup);
    scheduleEditorSync(true);

    return () => {
      writer.event('selectionChanged').unsubscribe(handleSelectionSignal);
      writer.event('nodeChanged').unsubscribe(handleSelectionSignal);
      writer.event('contentChanged').unsubscribe(handleContentChanged);
      writer.event('tagEdited').unsubscribe(handleTagEdited);
      writer.event('schemaChanged').unsubscribe(handleSchemaChanged);
      writer.event('writerKeyup').unsubscribe(onWriterKeyup);
      cancelScheduledEditorSync();
    };
  }, [cancelScheduledEditorSync, scheduleEditorSync, visible]);

  useEffect(() => {
    if (!leafWriter || !visible) {
      cancelScheduledEditorSync();
      return;
    }

    let detach = attachEditorSync();
    const onWriterReady = () => {
      resetEditorSyncCaches();
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
  }, [
    activeTabPath,
    attachEditorSync,
    cancelScheduledEditorSync,
    leafWriter,
    resetEditorSyncCaches,
    visible,
  ]);

  useEffect(() => {
    if (!visible) return;
    resetEditorSyncCaches();
    scheduleEditorSync(true);
  }, [resetEditorSyncCaches, scheduleEditorSync, visible]);

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
        if (
          !(await store.hasSqliteDatabase()) ||
          !window.electronAPI?.entitySqliteGet ||
          !window.electronAPI?.entitySqliteUpdateNames
        ) {
          if (!cancelled) setLinkedEntityInfo(null);
          return;
        }
        const snapshot = await store.sqliteEntitySummary(key);
        if (cancelled) return;
        if (!snapshot) {
          setLinkedEntityInfo(null);
          return;
        }
        const entity = entitySummaryFromSqlite(
          snapshot as Parameters<typeof entitySummaryFromSqlite>[0],
        );
        const urls = entity.authorities
          .map((authority: EntitySummary['authorities'][number]) => ({
            type: authority.type,
            url: authorityLookupUrl(authority),
          }))
          .filter(
            (authority: {
              type: string;
              url: string | null;
            }): authority is { type: string; url: string } => Boolean(authority.url),
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
  }, [values.key, entityInfoRevision]);

  /** Mention surface text, matched against the linked entity's typed names. */
  const mentionSurface = tagElement?.textContent?.normalize('NFC').trim() ?? '';
  const matchedNameEntry = linkedEntityInfo
    ? (linkedEntityInfo.entity.nameEntries.find((entry) => entry.text === mentionSurface) ??
      linkedEntityInfo.entity.nameEntries.find(
        (entry) => mentionSurface && foldForSearch(entry.text) === foldForSearch(mentionSurface),
      ))
    : undefined;

  const currentNameType =
    linkedEntityInfo && mentionSurface
      ? linkedEntityInfo.entity.familyName === mentionSurface
        ? 'family'
        : linkedEntityInfo.entity.givenName === mentionSurface
          ? 'given'
          : (matchedNameEntry?.type ?? '')
      : '';

  const openLinkedEntity = () => {
    if (!linkedEntityInfo) return;
    const type = getLookupEntityTypeForTag(tagName);
    if (!type) return;

    window.dispatchEvent(
      new CustomEvent('desktop-database:show-entity', {
        detail: { id: linkedEntityInfo.entity.id, type },
      }),
    );
  };

  const nameTypeLabels: Record<NameTypeId, string> = Object.fromEntries(
    ALL_NAME_TYPES.map((type) => [type, nameTypeLabel(type, sourceLanguage)]),
  ) as Record<NameTypeId, string>;

  /** Write the chosen name type for this surface onto the linked entity (SQLite). */
  const commitNameType = async (raw: string) => {
    if (!linkedEntityInfo || !mentionSurface) return;
    const type = raw === '' ? null : (raw as NameTypeId);
    setNameTypeBusy(true);
    try {
      const store = entityStoreFromDesktop();
      if (!store) return;
      if (
        !(await store.hasSqliteDatabase()) ||
        !window.electronAPI?.entitySqliteUpdateNames
      ) {
        throw new Error(SQLITE_REQUIRED_PANEL_MESSAGE);
      }
      const changed = await store.sqliteUpdateNames({
        entityId: linkedEntityInfo.entity.id,
        text: mentionSurface,
        nameType: type,
        language: sourceLanguage ?? null,
      });
      if (type && changed === 0) {
        throw new Error(`Could not save name type for “${mentionSurface}”.`);
      }
      setEntityInfoRevision((revision) => revision + 1);
    } catch (error) {
      notifyViaSnackbar({
        message: error instanceof Error ? error.message : String(error),
        options: { variant: 'warning' },
      });
    } finally {
      setNameTypeBusy(false);
    }
  };

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
    const attrs = readTagAttributes(element);
    setValues(attrs);
    if (attrName === 'key') refreshMatchCounts(element, attrs);
  };

  const handleAddAttribute = () => {
    const element = tagElementRef.current;
    if (!element || readonly || !addAttrName.trim()) return;
    applyAttributeToTag(element, addAttrName.trim(), addAttrValue);
    setAddAttrName('');
    setAddAttrValue('');
    const attrs = readTagAttributes(element);
    setValues(attrs);
    if (addAttrName.trim() === 'key') {
      refreshMatchCounts(element, attrs);
    }
  };

  const handleLookup = () => {
    const element = tagElementRef.current;
    if (!element || readonly) return;
    openEntityLookupForTag(element, () => {
      const attrs = readTagAttributes(element);
      setValues(attrs);
      refreshMatchCounts(element, attrs);
    });
  };

  const handleClearKeyEverywhere = () => {
    const element = tagElementRef.current;
    const key = valuesRef.current.key?.trim();
    if (!element || readonly || !key) return;
    const { cleared } = clearKeyFromExactMatches(element, key);
    const attrs = readTagAttributes(element);
    setValues(attrs);
    refreshMatchCounts(element, attrs);
    if (cleared > 0) {
      notifyViaSnackbar({
        message: t('LWC.desktop.tagging.removed_key_from_matches', { count: cleared }),
        options: { variant: 'success' },
      });
    }
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
        message: t('LWC.desktop.tagging.no_exact_unkeyed_matches_found'),
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
        message: t('LWC.desktop.tagging.could_not_apply_attributes'),
        options: { variant: 'warning' },
      });
      return;
    }

    const nextMatches = refreshWalkMatches();
    if (nextMatches.length === 0) {
      notifyViaSnackbar({ message: t('LWC.desktop.tagging.walk_complete'), options: { variant: 'success' } });
      stopWalk();
      return;
    }
    setWalkIndex((currentIndex) => Math.min(currentIndex, nextMatches.length - 1));
  }, [applyToMatch, notifyViaSnackbar, refreshWalkMatches, stopWalk, walkIndex, walkMatches]);

  const handleWalkSkip = useCallback(() => {
    const nextIndex = walkIndex + 1;
    if (nextIndex >= walkMatches.length) {
      notifyViaSnackbar({
        message: t('LWC.desktop.tagging.no_more_matches_to_skip_to'),
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
    const attrs = readTagAttributes(element);
    setValues(attrs);
    refreshMatchCounts(element, attrs);
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
      message: t('LWC.desktop.tagging.no_exact_unkeyed_matches_updated'),
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

  const handleEastAsianChange = (nextValues: EastAsianDateValues) => {
    const merged = mergeEastAsianIntoAttributes(valuesRef.current, nextValues);
    valuesRef.current = merged;
    setValues(merged);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => commitValues(merged), 300);
  };

  const lookupAvailable = Boolean(getLookupEntityTypeForTag(tagName));
  const unsetSchemaAttrs = schemaAttributes.filter((attr) => !(attr.name in values));
  const addAttrSchema = unsetSchemaAttrs.find((attr) => attr.name === addAttrName);
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
            {t('LWC.desktop.tagging.f2_to_rename')}
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
              {t('LWC.desktop.tagging.lookup')}
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
                  <Chip
                    component="button"
                    label={linkedEntityInfo.entity.id}
                    onClick={openLinkedEntity}
                    size="small"
                    sx={{ alignSelf: 'flex-start', fontFamily: 'monospace', height: 20 }}
                    variant="outlined"
                  />
                  {mentionSurface && mentionSurface !== linkedEntityInfo.entity.names[0] ? (
                    <Stack alignItems="center" direction="row" gap={0.75}>
                      <Typography color="text.secondary" variant="caption" sx={{ flexShrink: 0 }}>
                        “{mentionSurface}” is this entity’s
                      </Typography>
                      <TextField
                        select
                        size="small"
                        value={currentNameType}
                        disabled={readonly || nameTypeBusy}
                        onChange={(event) => void commitNameType(event.target.value)}
                        sx={{ minWidth: 150, '& .MuiInputBase-input': { py: 0.25, fontSize: 12 } }}
                      >
                        <MenuItem value="">
                          <em>unclassified</em>
                        </MenuItem>
                        {ALL_NAME_TYPES.map((type) => (
                          <MenuItem key={type} value={type}>
                            {nameTypeLabels[type]}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Stack>
                  ) : null}
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
                        <Button
                          disabled={readonly}
                          onClick={startWalk}
                          size="small"
                          variant="outlined"
                        >
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
            {linkedEntityInfo && keyedMatchCount > 1 ? (
              <Button
                color="warning"
                disabled={readonly}
                onClick={handleClearKeyEverywhere}
                size="small"
                startIcon={<CloseIcon fontSize="small" />}
                variant="outlined"
              >
                Unlink key from all {keyedMatchCount} matches
              </Button>
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
                    <Button
                      disabled={readonly}
                      onClick={handleWalkApply}
                      size="small"
                      variant="contained"
                    >
                      Apply
                    </Button>
                    <Button
                      disabled={readonly}
                      onClick={handleWalkSkip}
                      size="small"
                      variant="outlined"
                    >
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
            <Suspense
              fallback={
                <Typography variant="body2">
                  {t('LWC.desktop.tagging.loading_calendar_fields')}
                </Typography>
              }
            >
              <LazyAttributesEastAsianSection
                disabled={readonly}
                onChange={handleEastAsianChange}
                values={readEastAsianDateValues(values)}
              />
            </Suspense>
          ) : null}

          {setAttributeEntries.length === 0 && !eastAsianDates ? (
            <Typography color="text.secondary" variant="body2">
              {t('LWC.desktop.tagging.no_attributes_set')}
            </Typography>
          ) : null}

          {setAttributeEntries.map(([attrName, attrValue]) => {
            const attr = schemaAttributes.find((item) => item.name === attrName) ?? {
              name: attrName,
            };

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
            <Stack alignItems="center" direction="row" spacing={0.5}>
              <TextField
                select
                disabled={readonly}
                label="Select"
                size="small"
                value={addAttrName}
                onChange={(event) => {
                  setAddAttrName(event.target.value);
                  setAddAttrValue('');
                }}
                sx={{
                  width: 96,
                  flexShrink: 0,
                  '& .MuiInputBase-input': { py: 0.75, fontSize: 12 },
                }}
              >
                <MenuItem value="">
                  <em>…</em>
                </MenuItem>
                {unsetSchemaAttrs.map((attr) => (
                  <MenuItem key={attr.name} value={attr.name}>
                    {attr.name}
                  </MenuItem>
                ))}
              </TextField>
              {addAttrSchema?.choices && addAttrSchema.choices.length > 0 ? (
                <TextField
                  select
                  disabled={readonly || !addAttrName}
                  fullWidth
                  label="Value"
                  size="small"
                  sx={{ flex: 1, minWidth: 0 }}
                  value={addAttrValue}
                  onChange={(event) => setAddAttrValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleAddAttribute();
                    }
                  }}
                >
                  <MenuItem value="">
                    <em>(none)</em>
                  </MenuItem>
                  {addAttrSchema.choices.map((choice) => (
                    <MenuItem key={choice} value={choice}>
                      {choice}
                    </MenuItem>
                  ))}
                </TextField>
              ) : (
                <TextField
                  disabled={readonly || !addAttrName}
                  fullWidth
                  label="Value"
                  size="small"
                  sx={{ flex: 1, minWidth: 0 }}
                  value={addAttrValue}
                  onChange={(event) => setAddAttrValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleAddAttribute();
                    }
                  }}
                />
              )}
              <Tooltip title="Add attribute">
                <span>
                  <IconButton
                    aria-label="Add attribute"
                    disabled={readonly || !addAttrName.trim() || !addAttrValue.trim()}
                    onClick={handleAddAttribute}
                    size="small"
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          ) : null}
        </Stack>
      </Box>
    </Paper>
  );
};

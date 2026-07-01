import { useActions, useAppState } from '@src/overmind';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { applyAttributeToTag } from './attributeCommand';
import { getCaretScreenPosition } from './editorAnchor';
import {
  fetchSchemaAttributes,
  filterAttributeSuggestions,
  orderAttributeSuggestions,
  resolveAttributeNameForApply,
  suggestAttributeValues,
  type SchemaAttributeDetail,
} from './attributeSuggestions';
import { matchesEditorAttribute } from './keybindings';
import { getEditorTagContext } from './tagSuggestions';
import { loadTagStats, updateTagStatsForFile } from './tagStats';

const isVisualEditorActive = (): boolean =>
  Boolean(window.writer?.editor) &&
  window.writer?.overmindState?.ui?.editorViewMode !== 'source';

export interface AttributeCommandController {
  anchor: { left: number; top: number } | null;
  closePopup: () => void;
  focusedField: 'name' | 'value';
  handleEditorKeyDown: (event: KeyboardEvent, options: { tagPopupOpen: boolean; walkMode: boolean }) => boolean;
  handlePopupKeyDown: (event: React.KeyboardEvent) => void;
  highlightedIndex: number;
  nameFilter: string;
  open: boolean;
  openPopup: (anchorOverride?: { left: number; top: number } | null) => Promise<boolean>;
  schemaAttributes: SchemaAttributeDetail[];
  setFocusedField: (field: 'name' | 'value') => void;
  setHighlightedIndex: (index: number) => void;
  setNameFilter: (value: string) => void;
  setValueFilter: (value: string) => void;
  tagElement: Element | null;
  tagName: string;
  valueFilter: string;
  valueSuggestions: string[];
}

export const useAttributeCommandController = (): AttributeCommandController => {
  const { rootPath, activeTabPath } = useAppState().project;
  const { notifyViaSnackbar } = useActions().ui;

  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null);
  const [tagElement, setTagElement] = useState<Element | null>(null);
  const [tagName, setTagName] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [valueFilter, setValueFilter] = useState('');
  const [focusedField, setFocusedField] = useState<'name' | 'value'>('name');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [schemaAttributes, setSchemaAttributes] = useState<SchemaAttributeDetail[]>([]);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof loadTagStats>> | null>(null);

  const applyingRef = useRef(false);

  useEffect(() => {
    if (!rootPath) return;
    void loadTagStats(rootPath).then(setStats);
  }, [rootPath]);

  const refreshStatsForActiveFile = useCallback(async () => {
    if (!rootPath || !activeTabPath || !window.writer?.getContent) return;
    const xml = await window.writer.getContent();
    if (!xml) return;
    const next = await updateTagStatsForFile(rootPath, activeTabPath, xml);
    setStats(next);
  }, [activeTabPath, rootPath]);

  const visibleAttributes = useMemo(
    () =>
      orderAttributeSuggestions(
        filterAttributeSuggestions(schemaAttributes, nameFilter),
        tagName,
        stats,
        nameFilter,
      ),
    [nameFilter, schemaAttributes, stats, tagName],
  );

  const highlightedAttribute = visibleAttributes[highlightedIndex] ?? null;

  const valueSuggestions = useMemo(() => {
    const attrName = resolveAttributeNameForApply(schemaAttributes, nameFilter, highlightedAttribute)?.name;
    if (!attrName || !stats || !tagName) return [];
    return suggestAttributeValues(tagName, attrName, stats, valueFilter);
  }, [highlightedAttribute, nameFilter, schemaAttributes, stats, tagName, valueFilter]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [nameFilter]);

  const closePopup = useCallback(() => {
    setOpen(false);
    setNameFilter('');
    setValueFilter('');
    setFocusedField('name');
    setHighlightedIndex(0);
    setTagElement(null);
    setTagName('');
  }, []);

  const loadSchemaForTag = useCallback(async (element: Element) => {
    const attrs = await fetchSchemaAttributes(element);
    const sorted = stats
      ? orderAttributeSuggestions(attrs, element.getAttribute('_tag') ?? '', stats, '')
      : attrs;
    setSchemaAttributes(sorted);
    setHighlightedIndex(0);
  }, [stats]);

  const openPopup = useCallback(async (anchorOverride?: { left: number; top: number } | null) => {
    if (!isVisualEditorActive()) return false;

    const ctx = getEditorTagContext();
    const element = ctx?.tagElement;
    if (!element) {
      notifyViaSnackbar({
        message: 'Place the caret inside a tag to add attributes.',
        options: { variant: 'info' },
      });
      return true;
    }

    const name = element.getAttribute('_tag') ?? '';
    setTagElement(element);
    setTagName(name);
    setNameFilter('');
    setValueFilter('');
    setFocusedField('name');
    setHighlightedIndex(0);
    setAnchor(getCaretScreenPosition(anchorOverride));
    setOpen(true);
    await loadSchemaForTag(element);
    window.writer?.layoutManager?.showModule('attributes');
    return true;
  }, [loadSchemaForTag, notifyViaSnackbar]);

  const commitAttribute = useCallback(async () => {
    if (applyingRef.current || !tagElement) return;

    const attr = resolveAttributeNameForApply(schemaAttributes, nameFilter, highlightedAttribute);
    if (!attr) {
      notifyViaSnackbar({
        message: nameFilter.trim() ? `Attribute "${nameFilter.trim()}" is not valid here.` : 'Enter an attribute name.',
        options: { variant: 'info' },
      });
      return;
    }

    applyingRef.current = true;
    try {
      const result = applyAttributeToTag(tagElement, attr.name, valueFilter);
      if (!result.applied) {
        if (result.error) {
          notifyViaSnackbar({ message: result.error, options: { variant: 'warning' } });
        }
        return;
      }
      await refreshStatsForActiveFile();
      closePopup();
    } finally {
      applyingRef.current = false;
    }
  }, [
    highlightedAttribute,
    nameFilter,
    notifyViaSnackbar,
    refreshStatsForActiveFile,
    schemaAttributes,
    tagElement,
    valueFilter,
    closePopup,
  ]);

  const handlePopupKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePopup();
        return;
      }

      if (event.key === 'Tab' && !event.shiftKey) {
        event.preventDefault();
        if (focusedField === 'name') {
          const attr = resolveAttributeNameForApply(schemaAttributes, nameFilter, highlightedAttribute);
          if (attr) setNameFilter(attr.name);
          setFocusedField('value');
        }
        return;
      }

      if (event.key === 'Tab' && event.shiftKey) {
        event.preventDefault();
        setFocusedField('name');
        return;
      }

      if (event.key === 'Enter' || event.key === 'NumpadEnter') {
        event.preventDefault();
        void commitAttribute();
        return;
      }

      if (focusedField === 'name') {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setHighlightedIndex((current) => Math.min(current + 1, visibleAttributes.length - 1));
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setHighlightedIndex((current) => Math.max(current - 1, 0));
        }
      }
    },
    [
      closePopup,
      commitAttribute,
      focusedField,
      highlightedAttribute,
      nameFilter,
      schemaAttributes,
      visibleAttributes.length,
    ],
  );

  const handleEditorKeyDown = useCallback(
    (event: KeyboardEvent, options: { tagPopupOpen: boolean; walkMode: boolean }): boolean => {
      if (event.isComposing || !isVisualEditorActive()) return false;
      if (options.tagPopupOpen || options.walkMode) return false;

      if (open) {
        return false;
      }

      if (matchesEditorAttribute(event)) {
        event.preventDefault();
        void openPopup();
        return true;
      }

      return false;
    },
    [open, openPopup],
  );

  return {
    anchor,
    closePopup,
    focusedField,
    handleEditorKeyDown,
    handlePopupKeyDown,
    highlightedIndex,
    nameFilter,
    open,
    openPopup,
    schemaAttributes: visibleAttributes,
    setFocusedField,
    setHighlightedIndex,
    setNameFilter,
    setValueFilter,
    tagElement,
    tagName,
    valueFilter,
    valueSuggestions,
  };
};

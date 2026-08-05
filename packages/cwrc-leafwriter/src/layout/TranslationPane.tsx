import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Popover,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatClearIcon from '@mui/icons-material/FormatClear';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import FormatStrikethroughIcon from '@mui/icons-material/FormatStrikethrough';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import LinkIcon from '@mui/icons-material/Link';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import SpellcheckIcon from '@mui/icons-material/Spellcheck';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import StickyNote2Icon from '@mui/icons-material/StickyNote2';
import SubscriptIcon from '@mui/icons-material/Subscript';
import SuperscriptIcon from '@mui/icons-material/Superscript';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { copyUnitsForExport } from '../js/conversion/copyForExport';
import { translationFontZoom } from '../js/fontSizeZoom';
import { useActions, useAppState } from '../overmind';
import { isMacOS } from '../utils/platform';
import { applyTextContentReplacement, shiftLanguageToolMatchViews, type LanguageToolMatchView } from './languageToolApply';
import { collectMatchOverlayRects, type TextRangeRect } from './languageToolOverlays';
import {
  FN_BODY_ATTR,
  FN_MARK_ATTR,
  flattenFootnoteNotesForPersist,
  footnoteBodyHtml,
  footnoteBodyOf,
  normalizeFootnoteNotes,
} from './translationFootnotes';
import { convertMarkdownInXmlFragment, looksLikeInlineMarkdown } from './markdownToTei';
import {
  collectSourceUnitEntities,
  fetchEntitySummary,
  searchEntitiesForPicker,
  type EntityPickerSearchHit,
  type SourceUnitEntityHit,
} from './entityFields/sourceUnitEntities';
import {
  buildSuggestionsAtCaret,
  candidateFromEntity,
  caretAnchorPosition,
  type EntityAutocompleteCandidate,
  type EntityAutocompleteSuggestion,
} from './entityFields/entityAutocomplete';
import {
  ENTITY_DISPLAY_FORMAT_ATTR,
  ENTITY_DISPLAY_SPEC_ATTR,
  ENTITY_FIELD_ATTR,
  ENTITY_REF_TYPE,
  createEntityFieldElement,
  prepareAtomicEntityFields,
  recalculateAllEntityFieldsInRoot,
  recalculateEntityFieldsInRoot,
  readDisplaySpecFromField,
  writeDisplaySpecToField,
} from './entityFields/translationEntityFields';
import { EMPTY_DISPLAY_SPEC, type EntityDisplaySpec } from './entityFields/entityDisplay';
import type { EntitySummary } from './entityFields/entitySummary';
import { EntityDisplayPopup } from './entityFields/EntityDisplayPopup';
import { TRANSLATION_POLICY_CHANGED_EVENT } from './entityFields/dateFormatSettings';
import { applyEditorialCleanupToRoot, applyEditorialCleanupToRootPreservingSelection } from './translationEditorialCleanup';
import { collectTranslationUnitCards } from './translationUnitCards';

const TEI_NS = 'http://www.tei-c.org/ns/1.0';
const DEFAULT_CITATION_STYLE_ID = 'chicago-note-bibliography';
const SPELLCHECK_STORAGE_KEY = 'leafWriterTranslationSpellcheck';

const readSpellcheckEnabled = (): boolean => {
  try {
    const stored = window.localStorage.getItem(SPELLCHECK_STORAGE_KEY);
    if (stored === null) return true;
    return stored === '1' || stored === 'true';
  } catch {
    return true;
  }
};

const writeSpellcheckEnabled = (enabled: boolean): void => {
  try {
    window.localStorage.setItem(SPELLCHECK_STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // Ignore quota / private-mode failures; the in-memory toggle still works.
  }
};

const getElementsByLocalName = (root: Document | Element, localName: string): Element[] => {
  const namespaced = Array.from(root.getElementsByTagNameNS(TEI_NS, localName));
  const plain = Array.from(root.getElementsByTagName(localName));
  const seen = new Set<Element>();
  const result: Element[] = [];
  for (const element of [...namespaced, ...plain]) {
    if (!seen.has(element)) {
      seen.add(element);
      result.push(element);
    }
  }
  return result;
};

const findUnitByCorrespId = (
  doc: Document,
  alignmentUnit: 'div' | 'p',
  sourceFileName: string,
  unitId: string,
): Element | null => {
  const expected = `${sourceFileName}#${unitId}`;
  return (
    getElementsByLocalName(doc, alignmentUnit).find(
      (element) => element.getAttribute('corresp') === expected,
    ) ?? null
  );
};

const fileNameOf = (filePath: string): string => {
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return idx === -1 ? filePath : filePath.slice(idx + 1);
};

const ACTIVE_SOURCE_UNIT_CLASS = 'ljb-translation-active-unit';

/** Looks up the tagger's schema id attribute name (xml:id or id), matching attributeIdHelpers.ts. */
const getSchemaIdAttributeName = (): string =>
  window.writer?.schemaManager?.getIdName?.() ?? 'xml:id';

/**
 * Find a source alignment unit in the TinyMCE body without XPath.
 * `@xml:id` in document.evaluate() throws NamespaceError in the HTML editor doc
 * (the `xml:` prefix is unresolvable), and CWRC's xpath rewriter also mangles `//*`.
 */
const findSourceUnitElement = (body: HTMLElement, unitId: string): Element | null => {
  const schemaId = getSchemaIdAttributeName();
  const fromTagger = Array.from(body.querySelectorAll('[_tag]')).find((el) => {
    const attrs = window.writer?.tagger?.getAttributesForTag?.(el as Element) ?? {};
    const id = attrs[schemaId] ?? (schemaId !== 'id' ? attrs.id : undefined);
    return id === unitId;
  });
  if (fromTagger) return fromTagger;

  return (
    (body.querySelector(`[xml\\:id="${CSS.escape(unitId)}"]`) as Element | null) ??
    (body.querySelector(`[id="${CSS.escape(unitId)}"]`) as Element | null) ??
    (body.querySelector(`#${CSS.escape(unitId)}`) as Element | null)
  );
};

/** Select the source alignment unit in TinyMCE and broadcast NodeChange (same as Find jump). */
const selectSourceUnitInEditor = (unitId: string): boolean => {
  const writer = window.writer as
    | {
        editor?: {
          getBody?: () => HTMLElement | null;
          nodeChanged?: () => void;
        };
        utilities?: {
          getElementXPath?: (element: Element) => string | null;
          selectNode?: (
            target: { xpath: string },
            scrollIntoView?: boolean,
            focusEditor?: boolean,
          ) => void;
        };
      }
    | undefined;
  if (!writer?.editor || !writer.utilities?.getElementXPath || !writer.utilities.selectNode) {
    return false;
  }

  const body = writer.editor.getBody?.();
  if (!body) return false;

  const node = findSourceUnitElement(body, unitId);
  if (!node) return false;

  const xpath = writer.utilities.getElementXPath(node);
  if (!xpath) return false;
  writer.utilities.selectNode({ xpath }, false, false);
  writer.editor.nodeChanged?.();
  return true;
};

const markActiveSourceUnit = (unitId: string | null): void => {
  const body = window.writer?.editor?.getBody?.();
  if (!body) return;
  for (const el of Array.from(body.querySelectorAll(`.${ACTIVE_SOURCE_UNIT_CLASS}`))) {
    el.classList.remove(ACTIVE_SOURCE_UNIT_CLASS);
  }
  if (!unitId) return;
  findSourceUnitElement(body, unitId)?.classList.add(ACTIVE_SOURCE_UNIT_CLASS);
};

interface DesktopElectronApi {
  generateAiTranslation?: (request: {
    alignmentUnit: 'div' | 'p';
    sourceUnitXml: string;
    targetLanguage: string;
  }) => Promise<{ error?: string; ok: boolean; translationXml?: string }>;
  readFile?: (filePath: string) => Promise<string>;
  writeFile?: (filePath: string, content: string) => Promise<void>;
}

interface TranslationLanguageState {
  indexing: boolean;
  languages: Array<{ code: string; label: string }>;
  selectedLang: string;
  setSelectedLang: (lang: string) => void;
}

interface CslJsonItem {
  id: string | number;
  type: string;
  title?: string;
  author?: { family?: string; given?: string; literal?: string }[];
  issued?: { 'date-parts'?: (string | number)[][]; literal?: string };
  [key: string]: unknown;
}

interface BiblEntry {
  id: string;
  uri: string;
  csl: CslJsonItem;
}

interface ZoteroCaywPick {
  uri: string;
  csl: CslJsonItem;
  locator?: string;
  label?: string;
  prefix?: string;
  suffix?: string;
}

type ZoteroCaywResult =
  | { ok: true; picks: ZoteroCaywPick[] }
  | { ok: false; cancelled: boolean; error?: string };

interface DesktopCitationBridge {
  chipLabel: (item: CslJsonItem) => string;
  renderCitation: (options: {
    item: CslJsonItem;
    styleId?: string;
    lang?: string;
    locator?: string;
    locatorType?: string;
    prefix?: string;
    suffix?: string;
  }) => string;
  upsertBiblEntry: (doc: Document, item: CslJsonItem, uri: string) => string;
  readBiblEntries: (doc: Document) => Map<string, BiblEntry>;
  garbageCollectBibl: (doc: Document) => void;
  pickZoteroCitation: () => Promise<ZoteroCaywResult>;
  getCitationStyleOptions: () => Promise<{
    defaultStyleId: string;
    options: Array<{ id: string; label: string }>;
  }>;
  setCitationStyle: (styleId: string) => Promise<boolean>;
}

declare global {
  interface Window {
    __leafWriterTranslationPane?: {
      filePath: string | null;
      isActive: () => boolean;
      redo: () => Promise<boolean>;
      replaceContent: (filePath: string, content: string) => boolean;
      undo: () => Promise<boolean>;
    };
  }
}

const getDesktopApi = (): DesktopElectronApi | undefined =>
  (window as Window & { electronAPI?: DesktopElectronApi }).electronAPI;

const getTranslationLanguageState = (): TranslationLanguageState | null =>
  (
    window as Window & {
      __desktopTranslationLanguageState?: TranslationLanguageState;
    }
  ).__desktopTranslationLanguageState ?? null;

const getCitationBridge = (): DesktopCitationBridge | null =>
  (window as Window & { __desktopCitationBridge?: DesktopCitationBridge })
    .__desktopCitationBridge ?? null;

const prepareAtomicCitationFields = (root: ParentNode, title: string): void => {
  for (const bibl of Array.from(root.querySelectorAll('bibl[type="zotero-ref"]'))) {
    bibl.setAttribute('contenteditable', 'false');
    bibl.setAttribute('data-leaf-citation-field', 'true');
    bibl.setAttribute('title', title);
  }
  prepareAtomicEntityFields(root);
};

const stripInvisibleCaretSpacers = (root: ParentNode): void => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const textNode = node as Text;
    if (textNode.textContent?.includes('\uFEFF') || textNode.textContent?.includes('\u200B')) {
      textNodes.push(textNode);
    }
  }

  for (const textNode of textNodes) {
    textNode.textContent =
      textNode.textContent?.replace(/\uFEFF/g, '').replace(/\u200B/g, '') ?? '';
  }
};

const EDITING_ONLY_ATTRIBUTES = new Set([
  'class',
  'contenteditable',
  'face',
  'size',
  'style',
  'title',
]);
const WRAPPER_ELEMENTS = new Set(['div', 'font', 'p', 'span']);
const TEI_INLINE_ELEMENTS = new Set([
  'b',
  'bibl',
  'br',
  'hi',
  'i',
  'lb',
  'note',
  'ref',
  's',
  'strike',
  'sub',
  'sup',
  'u',
]);

const sanitizeTranslationFragment = (root: ParentNode, title: string): void => {
  for (const element of Array.from(root.querySelectorAll('*'))) {
    for (const attr of Array.from(element.attributes)) {
      const attrName = attr.name.toLowerCase();
      if (
        EDITING_ONLY_ATTRIBUTES.has(attrName) ||
        (attrName.startsWith('data-') &&
          attrName !== 'data-locator' &&
          attrName !== 'data-locator-type' &&
          attrName !== 'data-prefix' &&
          attrName !== 'data-suffix' &&
          attrName !== ENTITY_DISPLAY_FORMAT_ATTR &&
          attrName !== ENTITY_DISPLAY_SPEC_ATTR)
      ) {
        element.removeAttribute(attr.name);
      }
    }

    const tagName = element.tagName.toLowerCase();
    if (WRAPPER_ELEMENTS.has(tagName) || !TEI_INLINE_ELEMENTS.has(tagName)) {
      const parent = element.parentNode;
      if (!parent) continue;
      while (element.firstChild) parent.insertBefore(element.firstChild, element);
      parent.removeChild(element);
    }
  }

  prepareAtomicCitationFields(root, title);
};

const unwrapElementsByTagName = (root: ParentNode, tagName: string): void => {
  for (const element of Array.from(root.querySelectorAll(tagName))) {
    const parent = element.parentNode;
    if (!parent) continue;
    while (element.firstChild) parent.insertBefore(element.firstChild, element);
    parent.removeChild(element);
  }
};

const findUnitById = (doc: Document, alignmentUnit: 'div' | 'p', unitId: string): Element | null =>
  getElementsByLocalName(doc, alignmentUnit).find((element) => {
    return element.getAttribute('xml:id') === unitId || element.getAttribute('id') === unitId;
  }) ?? null;

const getXmlParseError = (doc: Document): string | null => {
  const error = doc.getElementsByTagName('parsererror')[0];
  return error?.textContent?.trim() || null;
};

const parseTranslationDocument = (xml: string): Document | null => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return getXmlParseError(doc) ? null : doc;
};

const serializeSourceUnit = (
  sourceXml: string,
  alignmentUnit: 'div' | 'p',
  unitId: string,
): { error?: string; xml?: string } => {
  const doc = new DOMParser().parseFromString(sourceXml, 'application/xml');
  const parseError = getXmlParseError(doc);
  if (parseError) return { error: 'Source XML could not be parsed.' };

  const unit = findUnitById(doc, alignmentUnit, unitId);
  if (!unit) return { error: `Could not find source ${alignmentUnit} ${unitId}.` };

  return { xml: new XMLSerializer().serializeToString(unit) };
};

const ALLOWED_GENERATED_TAGS = new Set(['b', 'i', 'u', 's', 'strike', 'sup', 'sub', 'hi']);
const ALLOWED_HI_REND = new Set(['bold', 'italic', 'underline', 'strikethrough', 'small-caps']);

const validateGeneratedFragment = (fragmentXml: string): { error?: string; xml?: string } => {
  const wrapped = `<fragment>${fragmentXml}</fragment>`;
  const doc = new DOMParser().parseFromString(wrapped, 'application/xml');
  const parseError = getXmlParseError(doc);
  if (parseError) {
    console.error(
      '[translation] AI fragment failed XML parsing.\nParser error:',
      parseError,
      '\nFragment length:',
      fragmentXml.length,
      '\nFragment:',
      fragmentXml,
    );
    const firstLine = parseError.split('\n')[0] ?? parseError;
    return { error: `AI returned XML that is not well formed (${firstLine}).` };
  }

  const root = doc.documentElement;
  const elementChildren = Array.from(root.children);
  const contentRoot =
    elementChildren.length === 1 &&
    (elementChildren[0]!.tagName === 'p' || elementChildren[0]!.tagName === 'div')
      ? elementChildren[0]!
      : root;

  for (const element of Array.from(contentRoot.getElementsByTagName('*'))) {
    const tag = element.tagName;
    if (!ALLOWED_GENERATED_TAGS.has(tag)) {
      return { error: `AI returned unsupported tag <${tag}>.` };
    }
    for (const attr of Array.from(element.attributes)) {
      if (tag === 'hi' && attr.name === 'rend' && ALLOWED_HI_REND.has(attr.value)) continue;
      return { error: `AI returned unsupported attribute ${attr.name} on <${tag}>.` };
    }
  }

  return {
    xml: Array.from(contentRoot.childNodes)
      .map((node) => new XMLSerializer().serializeToString(node))
      .join(''),
  };
};

/** After schema validation, turn leftover **markdown** in text nodes into <hi>. */
const applyMarkdownCleanupToFragment = (fragmentXml: string): string => {
  const wrapped = `<fragment>${fragmentXml}</fragment>`;
  const doc = new DOMParser().parseFromString(wrapped, 'text/html');
  const root = doc.body.querySelector('fragment') ?? doc.body;
  convertMarkdownInXmlFragment(root as Element);
  // Prefer the fragment wrapper children when present.
  const fragment = doc.body.querySelector('fragment');
  const source = fragment ?? doc.body;
  return Array.from(source.childNodes)
    .map((node) => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
      if (node.nodeType === Node.ELEMENT_NODE) {
        return (node as Element).outerHTML;
      }
      return '';
    })
    .join('');
};

interface TextIndex {
  combined: string;
  textNodes: Text[];
  offsets: number[];
}

const buildTextIndex = (container: HTMLElement): TextIndex => {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  const offsets: number[] = [];
  let combined = '';
  let node: Node | null;
  while ((node = walker.nextNode())) {
    offsets.push(combined.length);
    textNodes.push(node as Text);
    combined += node.textContent ?? '';
  }
  return { combined, textNodes, offsets };
};

const locateInIndex = (
  index: TextIndex,
  globalOffset: number,
): { node: Text; offset: number } | null => {
  for (let i = 0; i < index.textNodes.length; i++) {
    const start = index.offsets[i]!;
    const length = index.textNodes[i]!.textContent?.length ?? 0;
    if (globalOffset <= start + length) {
      return { node: index.textNodes[i]!, offset: Math.max(0, globalOffset - start) };
    }
  }
  return null;
};

const selectRange = (index: TextIndex, start: number, end: number): boolean => {
  const startPos = locateInIndex(index, start);
  const endPos = locateInIndex(index, end);
  if (!startPos || !endPos) return false;

  const range = document.createRange();
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);

  startPos.node.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });

  return true;
};

/** Selects the exact match a Find hit pointed to, given its decoded-character offset within
 * the unit's own text — correctly distinguishes multiple occurrences of the same text, unlike
 * a plain substring search. Falls back to the first occurrence of `text` when no offset is
 * available (e.g. the match was inside a nested inline tag rather than the unit's own text). */
const selectHighlightedMatch = (
  container: HTMLElement,
  text: string,
  offset: { start: number; end: number } | null,
): boolean => {
  const index = buildTextIndex(container);

  if (offset) {
    if (selectRange(index, offset.start, offset.end)) return true;
    // Offset didn't line up with the currently rendered content (e.g. stale) — fall through.
  }

  if (!text) return false;
  const idx = index.combined.toLowerCase().indexOf(text.toLowerCase());
  if (idx === -1) return false;
  return selectRange(index, idx, idx + text.length);
};

export const TranslationPane = () => {
  const { t } = useTranslation('LW');
  const mac = isMacOS();
  // This is used by callbacks that also run while the pane is inactive. Keep it
  // initialized before those callbacks so a later active render cannot reuse a
  // closure with an uninitialized binding.
  const zoteroCitationLabel = t('LW.translationPane.formatItems.zoteroCitation');
  const { translationMode } = useAppState().ui;
  const { notifyViaSnackbar, setSelectedTranslationUnit } = useActions().ui;

  const [translationDoc, setTranslationDoc] = useState<Document | null>(null);
  const [unitHtml, setUnitHtml] = useState('');
  const [caretInUnindexedUnit, setCaretInUnindexedUnit] = useState(false);
  const [aiStatus, setAiStatus] = useState<{
    message: string;
    severity: 'error' | 'info' | 'success';
  } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [languageState, setLanguageState] = useState<TranslationLanguageState | null>(() =>
    getTranslationLanguageState(),
  );
  const selectedLanguage = languageState?.selectedLang || translationMode.lang || '';
  const [locked, setLocked] = useState(false);
  const [spellcheckEnabled, setSpellcheckEnabled] = useState(() => readSpellcheckEnabled());
  const [languageToolEnabled, setLanguageToolEnabled] = useState(false);
  const [languageToolLive, setLanguageToolLive] = useState(false);
  const [languageToolChecking, setLanguageToolChecking] = useState(false);
  const [languageToolMatches, setLanguageToolMatches] = useState<LanguageToolMatchView[]>([]);
  const [languageToolSnapshot, setLanguageToolSnapshot] = useState<string | null>(null);
  const [languageToolOverlays, setLanguageToolOverlays] = useState<TextRangeRect[]>([]);
  const [languageToolStatus, setLanguageToolStatus] = useState<{
    message: string;
    severity: 'error' | 'info' | 'success';
  } | null>(null);
  const languageToolSeqRef = useRef(0);
  const languageToolDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [formatAnchor, setFormatAnchor] = useState<HTMLElement | null>(null);
  const [entityMenuAnchor, setEntityMenuAnchor] = useState<HTMLElement | null>(null);
  const [sourceEntities, setSourceEntities] = useState<SourceUnitEntityHit[]>([]);
  const [entityPickerQuery, setEntityPickerQuery] = useState('');
  const [entityPickerResults, setEntityPickerResults] = useState<EntityPickerSearchHit[]>([]);
  const [entityPickerSearching, setEntityPickerSearching] = useState(false);
  const entityPickerSearchSeqRef = useRef(0);
  const [entityAcCandidates, setEntityAcCandidates] = useState<EntityAutocompleteCandidate[]>([]);
  const [entityAcSuggestions, setEntityAcSuggestions] = useState<EntityAutocompleteSuggestion[]>(
    [],
  );
  const [entityAcIndex, setEntityAcIndex] = useState(0);
  const [entityAcAnchor, setEntityAcAnchor] = useState<{ top: number; left: number } | null>(null);
  const entityAcCandidatesRef = useRef<EntityAutocompleteCandidate[]>([]);
  entityAcCandidatesRef.current = entityAcCandidates;
  const entityAcSuggestionsRef = useRef<EntityAutocompleteSuggestion[]>([]);
  entityAcSuggestionsRef.current = entityAcSuggestions;
  const entityAcIndexRef = useRef(0);
  entityAcIndexRef.current = entityAcIndex;
  const [entityFormatOpen, setEntityFormatOpen] = useState(false);
  const [entityFormatAnchor, setEntityFormatAnchor] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [entityFormatSpec, setEntityFormatSpec] = useState<EntityDisplaySpec>(EMPTY_DISPLAY_SPEC);
  const [entityFormatEntity, setEntityFormatEntity] = useState<EntitySummary | null>(null);
  const [entityFormatOccurrence, setEntityFormatOccurrence] = useState(1);
  const entityFormatFieldRef = useRef<Element | null>(null);
  const [paneFontSize, setPaneFontSize] = useState(() => translationFontZoom.get());
  const editableRef = useRef<HTMLDivElement>(null);
  const savedBodyRangeRef = useRef<Range | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const savedFootnoteRangeRef = useRef<{ index: number; range: Range } | null>(null);
  const zoteroStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCitationTargetRef = useRef<'body' | 'footnote'>('body');
  const focusFootnoteIndexRef = useRef<number | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [footnotes, setFootnotes] = useState<string[]>([]);
  const [citationStylePickerOpen, setCitationStylePickerOpen] = useState(false);
  const [citationStyleChoices, setCitationStyleChoices] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [pendingCitationStyle, setPendingCitationStyle] = useState('');
  const citationStyleResolveRef = useRef<((styleId: string | null) => void) | null>(null);
  const docRef = useRef<Document | null>(null);
  docRef.current = translationDoc;
  const pendingHighlightRef = useRef<{
    unitId: string;
    text: string;
    offset: { start: number; end: number } | null;
  } | null>(null);
  const { translationPath, alignmentUnit, sourcePath, selectedUnitId } = translationMode;
  const selectedUnitIdRef = useRef<string | null>(null);
  selectedUnitIdRef.current = selectedUnitId ?? null;
  const translationPathRef = useRef<string | null>(null);
  translationPathRef.current = translationPath ?? null;
  const focusedRef = useRef(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeCitationStyle = pendingCitationStyle || translationMode.citationStyle || undefined;
  const cardNodeRefs = useRef(new Map<string, HTMLElement>());
  const listScrollRef = useRef<HTMLDivElement>(null);
  const [cardsEpoch, setCardsEpoch] = useState(0);

  const unitCards = useMemo(() => {
    if (!translationDoc || !alignmentUnit || !sourcePath) return [];
    return collectTranslationUnitCards(translationDoc, alignmentUnit, fileNameOf(sourcePath));
  }, [translationDoc, alignmentUnit, sourcePath, cardsEpoch]);

  const selectedUnitIndex = selectedUnitId
    ? unitCards.findIndex((card) => card.unitId === selectedUnitId)
    : -1;

  const setTranslationDocument = useCallback((doc: Document) => {
    docRef.current = doc;
    setTranslationDoc(doc);
  }, []);

  useEffect(() => {
    const syncLanguageState = () => setLanguageState(getTranslationLanguageState());
    syncLanguageState();
    window.addEventListener('desktop:translation-language-state-changed', syncLanguageState);
    return () =>
      window.removeEventListener('desktop:translation-language-state-changed', syncLanguageState);
  }, []);

  // Chromium spellcheck: live LanguageTool mode turns it off to avoid double underlines.
  useEffect(() => {
    const setSpellcheck = window.electronAPI?.setTranslationSpellcheck;
    if (!setSpellcheck) return;
    const languageCodes = [
      languageState?.selectedLang || translationMode.lang || '',
    ].filter(Boolean);
    const enabled = spellcheckEnabled && !languageToolLive;
    void setSpellcheck({ enabled, languageCodes });
  }, [languageState?.selectedLang, languageToolLive, spellcheckEnabled, translationMode.lang]);

  useEffect(() => {
    const load = window.electronAPI?.getLanguageToolSettings;
    if (!load) return;
    const apply = (settings: {
      enabled?: boolean;
      checkMode?: 'onDemand' | 'live';
    } | null) => {
      setLanguageToolEnabled(settings?.enabled === true);
      setLanguageToolLive(settings?.enabled === true && settings?.checkMode === 'live');
    };
    void load().then(apply);
    const onPrefs = () => {
      void load().then(apply);
    };
    window.addEventListener('ljbCommonsUiChanged', onPrefs);
    return () => window.removeEventListener('ljbCommonsUiChanged', onPrefs);
  }, []);

  useEffect(() => {
    setLanguageToolMatches([]);
    setLanguageToolSnapshot(null);
    setLanguageToolStatus(null);
    setLanguageToolOverlays([]);
  }, [selectedUnitId]);

  // Pane text zoom (8–24px): keyboard Cmd/Ctrl +/-/0 while the pane has focus,
  // plus a window bridge so the desktop menu accelerators can drive it.
  useEffect(() => {
    const unsubscribe = translationFontZoom.subscribe(setPaneFontSize);
    const zoomBridge = {
      zoomIn: () => translationFontZoom.zoomIn(),
      zoomOut: () => translationFontZoom.zoomOut(),
      reset: () => translationFontZoom.reset(),
      get: () => translationFontZoom.get(),
    };
    window.__leafWriterTranslationZoom = zoomBridge;
    return () => {
      unsubscribe();
      if (window.__leafWriterTranslationZoom === zoomBridge) {
        delete window.__leafWriterTranslationZoom;
      }
    };
  }, []);

  useEffect(
    () => () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      if (zoteroStatusTimeoutRef.current) clearTimeout(zoteroStatusTimeoutRef.current);
    },
    [],
  );

  // A Find hit inside this unit's content requests a highlight. If the content is already
  // showing (rendered before this event arrives), apply it immediately; otherwise store it as
  // pending for the innerHTML-sync effect below to apply once the matching content renders.
  useEffect(() => {
    const onHighlightText = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          unitId?: string;
          text?: string;
          offset?: { start: number; end: number } | null;
        }>
      ).detail;
      if (!detail?.unitId || !detail.text) return;

      if (
        selectedUnitIdRef.current === detail.unitId &&
        editableRef.current &&
        selectHighlightedMatch(editableRef.current, detail.text, detail.offset ?? null)
      ) {
        return;
      }

      pendingHighlightRef.current = {
        unitId: detail.unitId,
        text: detail.text,
        offset: detail.offset ?? null,
      };
    };
    window.addEventListener('desktop:translation-highlight-text', onHighlightText);
    return () => window.removeEventListener('desktop:translation-highlight-text', onHighlightText);
  }, []);

  // Load the companion translation file whenever it changes, or after a reindex rewrote it
  // on disk (translationPath itself doesn't change, so the reindex event forces a reload).
  useEffect(() => {
    if (!translationPath) return;
    let cancelled = false;

    const load = async () => {
      const xml = await getDesktopApi()
        ?.readFile?.(translationPath)
        .catch(() => null);
      if (cancelled || !xml) return;
      const doc = parseTranslationDocument(xml);
      if (doc) setTranslationDocument(doc);
    };

    void load();
    window.addEventListener('desktop:translation-reindexed', load);
    return () => {
      cancelled = true;
      window.removeEventListener('desktop:translation-reindexed', load);
    };
  }, [setTranslationDocument, translationPath]);

  // Track the main editor's selection to figure out which alignment unit is active. Re-subscribes
  // whenever the active source file changes, since window.writer.editor may be a fresh
  // instance/body by then — keying only on alignmentUnit (a fixed per-project setting) would
  // leave a stale listener attached to the previous file's editor.
  useEffect(() => {
    if (!alignmentUnit) return;

    let cancelled = false;
    let detachEditorListener: (() => void) | null = null;
    let unsubscribeDocumentLoaded: (() => void) | null = null;
    let pollTimeout: ReturnType<typeof setTimeout> | null = null;

    const schemaId = getSchemaIdAttributeName();

    // Distinguishes "cursor not inside an alignment unit at all" from "inside one that has
    // no schema id yet" (e.g. a freshly split paragraph before the next save indexes it) —
    // the pane shows different guidance for each.
    const resolveUnit = (
      startNode: Element | null,
    ): { id: string | null; inUnindexedUnit: boolean } => {
      let node: Element | null = startNode;
      while (node && node.getAttribute?.('_tag') !== alignmentUnit) {
        node = node.parentElement;
      }
      if (!node) return { id: null, inUnindexedUnit: false };
      const attrs = window.writer?.tagger?.getAttributesForTag?.(node) ?? {};
      const id = attrs[schemaId] ?? (schemaId !== 'id' ? attrs.id : undefined);
      if (typeof id === 'string' && id) return { id, inUnindexedUnit: false };
      return { id: null, inUnindexedUnit: true };
    };

    const applyResolved = (resolved: { id: string | null; inUnindexedUnit: boolean }) => {
      setSelectedTranslationUnit(resolved.id);
      setCaretInUnindexedUnit(resolved.inUnindexedUnit);
    };

    // Attempts to attach the NodeChange listener; returns false if the editor for the current
    // source file isn't ready yet (e.g. right after opening a file the editor hasn't finished
    // initializing) so the caller can retry once it is.
    const attach = (): boolean => {
      const editor = window.writer?.editor;
      if (!editor?.on) return false;

      const handler = (event: { element: Element }) => {
        applyResolved(resolveUnit(event.element));
      };
      editor.on('NodeChange', handler);
      detachEditorListener = () => editor.off?.('NodeChange', handler);

      // Sync immediately using the current cursor position — otherwise, if the cursor was
      // already sitting in a paragraph before this effect (re-)attached (e.g. switching back
      // to this tab, or switching files, without moving the caret), no NodeChange event fires
      // and the pane is left showing nothing until the next click.
      const currentNode = editor.selection?.getNode?.();
      if (currentNode) applyResolved(resolveUnit(currentNode));

      return true;
    };

    const retryUntilAttached = () => {
      if (cancelled || attach()) return;

      if (window.writer) {
        const onDocumentLoaded = (success: boolean) => {
          if (!success || cancelled) return;
          if (attach()) unsubscribeDocumentLoaded?.();
        };
        window.writer.event('documentLoaded').subscribe(onDocumentLoaded);
        unsubscribeDocumentLoaded = () =>
          window.writer?.event('documentLoaded').unsubscribe(onDocumentLoaded);
      } else {
        // window.writer itself doesn't exist yet (very first load) — poll briefly.
        pollTimeout = setTimeout(retryUntilAttached, 200);
      }
    };

    retryUntilAttached();

    return () => {
      cancelled = true;
      detachEditorListener?.();
      unsubscribeDocumentLoaded?.();
      if (pollTimeout) clearTimeout(pollTimeout);
    };
  }, [alignmentUnit, sourcePath, setSelectedTranslationUnit]);

  // Reflect the selected unit's current content into the editable surface.
  useEffect(() => {
    if (!translationDoc || !alignmentUnit || !sourcePath || !selectedUnitId) {
      setUnitHtml('');
      return;
    }
    const unit = findUnitByCorrespId(
      translationDoc,
      alignmentUnit,
      fileNameOf(sourcePath),
      selectedUnitId,
    );
    let html = unit?.innerHTML ?? '';
    const plain = html.replace(/<[^>]+>/g, '');
    if (looksLikeInlineMarkdown(plain)) {
      html = applyMarkdownCleanupToFragment(html);
    }
    setUnitHtml(html);
    setLocked(unit?.getAttribute('data-leaf-locked') === 'true');
  }, [translationDoc, alignmentUnit, sourcePath, selectedUnitId]);

  /** Sync the numbered footnote list below the text from the inline <note> elements,
   * marking them non-editable so they behave as atomic anchors in the main text. */
  const refreshFootnotes = useCallback(() => {
    const editable = editableRef.current;
    if (!editable) {
      setFootnotes([]);
      return;
    }
    normalizeFootnoteNotes(editable);
    const notes = Array.from(editable.querySelectorAll('note'));
    for (const note of notes) {
      const body = footnoteBodyOf(note);
      if (body) prepareAtomicCitationFields(body, zoteroCitationLabel);
      else prepareAtomicCitationFields(note, zoteroCitationLabel);
    }
    setFootnotes(notes.map((note) => footnoteBodyHtml(note)));
  }, [zoteroCitationLabel]);

  const renderCitationRefs = useCallback(
    (doc: Document, styleId = activeCitationStyle) => {
      const bridge = getCitationBridge();
      if (!bridge) return;

      const entries = bridge.readBiblEntries(doc);
      for (const bibl of Array.from(doc.getElementsByTagName('bibl'))) {
        if (bibl.getAttribute('type') !== 'zotero-ref') continue;
        const corresp = bibl.getAttribute('corresp') ?? '';
        if (!corresp.startsWith('#')) continue;
        const entry = entries.get(corresp.slice(1));
        if (!entry) continue;
        bibl.innerHTML = bridge.renderCitation({
          item: entry.csl,
          styleId,
          lang: translationMode.lang ?? undefined,
          locator: bibl.getAttribute('data-locator') ?? undefined,
          locatorType: bibl.getAttribute('data-locator-type') ?? undefined,
          prefix: bibl.getAttribute('data-prefix') ?? undefined,
          suffix: bibl.getAttribute('data-suffix') ?? undefined,
        });
      }
    },
    [activeCitationStyle, translationMode.lang],
  );

  useEffect(() => {
    const editable = editableRef.current;
    if (editable && editable.innerHTML !== unitHtml) {
      editable.innerHTML = unitHtml;
    }
    if (editable) {
      prepareAtomicCitationFields(editable, zoteroCitationLabel);
      void recalculateAllEntityFieldsInRoot(editable, fetchEntitySummary, undefined, selectedLanguage)
        .then(() => {
          prepareAtomicEntityFields(editable);
        })
        .catch((error) => {
          console.warn('[translation] entity field refresh failed', error);
        });
    }
    refreshFootnotes();

    const pending = pendingHighlightRef.current;
    if (pending && selectedUnitId === pending.unitId && editable) {
      if (selectHighlightedMatch(editable, pending.text, pending.offset)) {
        pendingHighlightRef.current = null;
      }
    }
  }, [unitHtml, selectedUnitId, refreshFootnotes, zoteroCitationLabel, selectedLanguage]);

  useEffect(() => {
    const refreshFromPolicy = () => {
      const editable = editableRef.current;
      if (!editable) return;
      void recalculateAllEntityFieldsInRoot(editable, fetchEntitySummary, undefined, selectedLanguage)
        .then(() => {
          prepareAtomicEntityFields(editable);
        })
        .catch((error) => {
          console.warn('[translation] entity field policy refresh failed', error);
        });
    };
    window.addEventListener(TRANSLATION_POLICY_CHANGED_EVENT, refreshFromPolicy);
    return () => window.removeEventListener(TRANSLATION_POLICY_CHANGED_EVENT, refreshFromPolicy);
  }, [selectedLanguage]);

  const persist = useCallback(async () => {
    const doc = docRef.current;
    if (!doc || !alignmentUnit || !sourcePath || !selectedUnitId || !translationPath) return;

    const unit = findUnitByCorrespId(doc, alignmentUnit, fileNameOf(sourcePath), selectedUnitId);
    if (!unit || !editableRef.current) return;

    // Quiet house style before write: spaces, ellipsis, quotes, ranges, punctuation.
    applyEditorialCleanupToRoot(editableRef.current, selectedLanguage);

    // Strip the editing-only contenteditable markers before writing to disk.
    const clone = editableRef.current.cloneNode(true) as HTMLElement;
    for (const note of Array.from(clone.querySelectorAll('note'))) {
      note.removeAttribute('contenteditable');
    }
    for (const bibl of Array.from(clone.querySelectorAll('bibl[type="zotero-ref"]'))) {
      bibl.removeAttribute('contenteditable');
      bibl.removeAttribute('data-leaf-citation-field');
      bibl.removeAttribute('title');
    }
    for (const ref of Array.from(clone.querySelectorAll(`ref[type="${ENTITY_REF_TYPE}"]`))) {
      ref.removeAttribute('contenteditable');
      ref.removeAttribute(ENTITY_FIELD_ATTR);
      ref.removeAttribute('title');
    }
    stripInvisibleCaretSpacers(clone);
    flattenFootnoteNotesForPersist(clone);
    unit.innerHTML = clone.innerHTML;
    getCitationBridge()?.garbageCollectBibl(doc);
    const nextXml = new XMLSerializer().serializeToString(doc);
    await getDesktopApi()?.writeFile?.(translationPath, nextXml);
    setCardsEpoch((n) => n + 1);
  }, [alignmentUnit, sourcePath, selectedUnitId, selectedLanguage, translationPath]);

  const navigateToUnit = useCallback(
    async (nextUnitId: string, options?: { selectSource?: boolean }) => {
      if (!nextUnitId) return;
      const selectSource = options?.selectSource !== false;
      if (nextUnitId !== selectedUnitIdRef.current) {
        await persist();
        setSelectedTranslationUnit(nextUnitId);
      }
      if (selectSource) selectSourceUnitInEditor(nextUnitId);
    },
    [persist, setSelectedTranslationUnit],
  );

  const goToAdjacentUnit = useCallback(
    (delta: -1 | 1) => {
      if (unitCards.length === 0) return;
      const current =
        selectedUnitIndex >= 0
          ? selectedUnitIndex
          : delta > 0
            ? -1
            : unitCards.length;
      const nextIndex = Math.min(unitCards.length - 1, Math.max(0, current + delta));
      const next = unitCards[nextIndex];
      if (!next) return;
      void navigateToUnit(next.unitId);
    },
    [navigateToUnit, selectedUnitIndex, unitCards],
  );

  // Keep the active card visible when the source caret (or Find) changes the unit.
  useEffect(() => {
    if (!selectedUnitId) return;
    const node = cardNodeRefs.current.get(selectedUnitId);
    if (typeof node?.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedUnitId]);

  // Soft wash on the matching source unit while translation mode is active.
  useEffect(() => {
    markActiveSourceUnit(selectedUnitId);
    return () => markActiveSourceUnit(null);
  }, [selectedUnitId, sourcePath]);

  // Prefetch romanizations for this unit's entities so autocomplete can match while typing.
  useEffect(() => {
    if (!alignmentUnit || !selectedUnitId) {
      setEntityAcCandidates([]);
      setEntityAcSuggestions([]);
      setEntityAcAnchor(null);
      return;
    }
    const hits = collectSourceUnitEntities(alignmentUnit, selectedUnitId);
    let cancelled = false;
    void (async () => {
      const rows = await Promise.all(
        hits.map(async (hit) => {
          const entity = await fetchEntitySummary(hit.key);
          return entity ? { entity, sourceSurface: hit.surface } : null;
        }),
      );
      if (cancelled) return;
      setEntityAcCandidates(
        rows
          .filter((row): row is { entity: EntitySummary; sourceSurface: string } => Boolean(row))
          .map(({ entity, sourceSurface }) => candidateFromEntity(entity, sourceSurface)),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [alignmentUnit, selectedUnitId, sourcePath]);

  useEffect(() => {
    const doc = window.writer?.editor?.getDoc?.() ?? document;
    if (!doc || typeof doc.createElement !== 'function' || typeof doc.getElementById !== 'function') {
      return;
    }
    const styleId = 'ljb-translation-active-unit-style';
    if (doc.getElementById(styleId)) return;
    const parent = doc.head ?? doc.documentElement ?? doc.body;
    if (!parent) return;
    const style = doc.createElement('style');
    style.id = styleId;
    style.textContent = `
      .${ACTIVE_SOURCE_UNIT_CLASS} {
        background-color: rgba(25, 118, 210, 0.08) !important;
        box-shadow: inset 3px 0 0 rgba(25, 118, 210, 0.55);
      }
    `;
    parent.appendChild(style);
  }, [sourcePath]);

  const refreshCurrentCitationFields = useCallback(
    async (styleId = activeCitationStyle) => {
      const doc = docRef.current;
      if (!doc || !alignmentUnit || !sourcePath || !selectedUnitId || !translationPath) return;

      renderCitationRefs(doc, styleId);

      const unit = findUnitByCorrespId(doc, alignmentUnit, fileNameOf(sourcePath), selectedUnitId);
      const nextHtml = unit?.innerHTML ?? '';
      setUnitHtml(nextHtml);
      if (editableRef.current) editableRef.current.innerHTML = nextHtml;
      refreshFootnotes();
      await getDesktopApi()?.writeFile?.(
        translationPath,
        new XMLSerializer().serializeToString(doc),
      );
    },
    [
      activeCitationStyle,
      alignmentUnit,
      refreshFootnotes,
      renderCitationRefs,
      selectedUnitId,
      sourcePath,
      translationPath,
    ],
  );

  useEffect(() => {
    const onCitationStyleChanged = async (event: Event) => {
      const citationStyle = (event as CustomEvent<{ citationStyle?: string }>).detail
        ?.citationStyle;
      if (citationStyle) setPendingCitationStyle(citationStyle);
      await refreshCurrentCitationFields(citationStyle ?? activeCitationStyle);
    };

    const onZoteroRefresh = async () => {
      await refreshCurrentCitationFields();
    };

    const onZoteroOpenStylePicker = async () => {
      const bridge = getCitationBridge();
      if (!bridge) {
        setAiStatus({ severity: 'error', message: 'Zotero preferences are not available.' });
        return;
      }

      const styleId = await openCitationStylePicker(bridge);
      if (styleId) await refreshCurrentCitationFields(styleId);
    };

    window.addEventListener('desktop:translation-citation-style-changed', onCitationStyleChanged);
    window.addEventListener('desktop:zotero-refresh-citations', onZoteroRefresh);
    window.addEventListener('desktop:zotero-open-style-picker', onZoteroOpenStylePicker);
    return () => {
      window.removeEventListener(
        'desktop:translation-citation-style-changed',
        onCitationStyleChanged,
      );
      window.removeEventListener('desktop:zotero-refresh-citations', onZoteroRefresh);
      window.removeEventListener('desktop:zotero-open-style-picker', onZoteroOpenStylePicker);
    };
  }, [activeCitationStyle, refreshCurrentCitationFields]);

  useEffect(() => {
    const runHistoryCommand = async (command: 'redo' | 'undo'): Promise<boolean> => {
      const editable = editableRef.current;
      if (!editable || !translationPathRef.current) return false;

      editable.focus();
      if (
        typeof document.queryCommandEnabled === 'function' &&
        !document.queryCommandEnabled(command)
      ) {
        return false;
      }

      const before = editable.innerHTML;
      const ok = document.execCommand(command);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      if (editable.innerHTML !== before) {
        await persist();
        setUnitHtml(editable.innerHTML);
        return true;
      }

      return ok;
    };

    const bridge = {
      filePath: translationPath ?? null,
      isActive: () =>
        focusedRef.current ||
        (!!editableRef.current && document.activeElement === editableRef.current),
      redo: () => runHistoryCommand('redo'),
      replaceContent: (filePath: string, content: string) => {
        if (translationPathRef.current !== filePath) return false;

        const doc = parseTranslationDocument(content);
        if (!doc) return false;
        setTranslationDocument(doc);

        if (alignmentUnit && sourcePath && selectedUnitIdRef.current) {
          const unit = findUnitByCorrespId(
            doc,
            alignmentUnit,
            fileNameOf(sourcePath),
            selectedUnitIdRef.current,
          );
          const nextHtml = unit?.innerHTML ?? '';
          setUnitHtml(nextHtml);
          setLocked(unit?.getAttribute('data-leaf-locked') === 'true');
          if (editableRef.current) editableRef.current.innerHTML = nextHtml;
        }

        return true;
      },
      undo: () => runHistoryCommand('undo'),
    };
    window.__leafWriterTranslationPane = bridge;

    return () => {
      if (window.__leafWriterTranslationPane === bridge) {
        delete window.__leafWriterTranslationPane;
      }
    };
  }, [alignmentUnit, persist, setTranslationDocument, sourcePath, translationPath]);

  const toggleLock = useCallback(async () => {
    const doc = docRef.current;
    if (!doc || !alignmentUnit || !sourcePath || !selectedUnitId || !translationPath) return;

    const unit = findUnitByCorrespId(doc, alignmentUnit, fileNameOf(sourcePath), selectedUnitId);
    if (!unit) return;

    const next = unit.getAttribute('data-leaf-locked') !== 'true';
    if (next) unit.setAttribute('data-leaf-locked', 'true');
    else unit.removeAttribute('data-leaf-locked');
    setLocked(next);

    const nextXml = new XMLSerializer().serializeToString(doc);
    await getDesktopApi()?.writeFile?.(translationPath, nextXml);
  }, [alignmentUnit, sourcePath, selectedUnitId, translationPath]);

  const replaceCurrentUnit = useCallback(
    async (nextUnitXml: string) => {
      const doc = docRef.current;
      if (!doc || !alignmentUnit || !sourcePath || !selectedUnitId || !translationPath) {
        return { error: 'No translation unit is selected.' };
      }

      const unit = findUnitByCorrespId(doc, alignmentUnit, fileNameOf(sourcePath), selectedUnitId);
      if (!unit) return { error: 'Could not find the matching translation unit.' };

      unit.innerHTML = nextUnitXml;
      setUnitHtml(nextUnitXml);
      if (editableRef.current) editableRef.current.innerHTML = nextUnitXml;

      const nextXml = new XMLSerializer().serializeToString(doc);
      await getDesktopApi()?.writeFile?.(translationPath, nextXml);
      return {};
    },
    [alignmentUnit, sourcePath, selectedUnitId, translationPath],
  );

  const generateTranslation = useCallback(async () => {
    if (!alignmentUnit || !sourcePath || !selectedUnitId) {
      setAiStatus({ severity: 'error', message: 'Select a source unit first.' });
      return;
    }
    if (locked) {
      setAiStatus({ severity: 'error', message: 'This translation unit is locked.' });
      return;
    }

    const api = getDesktopApi();
    if (!api?.generateAiTranslation || !api.readFile) {
      setAiStatus({ severity: 'error', message: 'AI translation is not available.' });
      return;
    }

    setGenerating(true);
    setAiStatus({ severity: 'info', message: 'Generating translation...' });

    try {
      const sourceXml = await api.readFile(sourcePath);
      const sourceUnit = serializeSourceUnit(sourceXml, alignmentUnit, selectedUnitId);
      if (!sourceUnit.xml) {
        setAiStatus({
          severity: 'error',
          message: sourceUnit.error ?? 'Could not read source unit.',
        });
        return;
      }

      const result = await api.generateAiTranslation({
        alignmentUnit,
        sourceUnitXml: sourceUnit.xml,
        targetLanguage: translationMode.lang ?? '',
      });
      if (!result.ok || !result.translationXml) {
        setAiStatus({
          severity: 'error',
          message: result.error ?? 'AI did not return a translation.',
        });
        return;
      }

      const validated = validateGeneratedFragment(result.translationXml);
      if (!validated.xml) {
        setAiStatus({
          severity: 'error',
          message: validated.error ?? 'AI returned invalid translation XML.',
        });
        return;
      }

      const cleanedXml = applyMarkdownCleanupToFragment(validated.xml);
      const replaceResult = await replaceCurrentUnit(cleanedXml);
      if (replaceResult.error) {
        setAiStatus({ severity: 'error', message: replaceResult.error });
        return;
      }

      setAiStatus({ severity: 'success', message: 'Translation generated.' });
    } catch (error) {
      setAiStatus({
        severity: 'error',
        message: error instanceof Error ? error.message : 'AI translation failed.',
      });
    } finally {
      setGenerating(false);
    }
  }, [alignmentUnit, locked, replaceCurrentUnit, selectedUnitId, sourcePath, translationMode.lang]);

  const refreshLanguageToolOverlays = useCallback((matches: LanguageToolMatchView[]) => {
    const root = editableRef.current;
    if (!root || matches.length === 0) {
      setLanguageToolOverlays([]);
      return;
    }
    setLanguageToolOverlays(collectMatchOverlayRects(root, matches));
  }, []);

  const runLanguageToolCheck = useCallback(async (options?: { quiet?: boolean }) => {
    const check = window.electronAPI?.checkLanguageTool;
    if (!check) {
      if (!options?.quiet) {
        setLanguageToolStatus({
          severity: 'error',
          message: t('LW.translationPane.languageToolUnavailable'),
        });
      }
      return;
    }
    if (!languageToolEnabled) {
      if (!options?.quiet) {
        setLanguageToolStatus({
          severity: 'info',
          message: t('LW.translationPane.languageToolDisabled'),
        });
      }
      return;
    }
    if (!selectedUnitId || !editableRef.current || locked) return;

    const seq = ++languageToolSeqRef.current;
    const text = editableRef.current.textContent ?? '';
    setLanguageToolChecking(true);
    if (!options?.quiet) setLanguageToolStatus(null);
    try {
      const result = await check({
        text,
        language: languageState?.selectedLang || translationMode.lang || 'auto',
      });
      if (seq !== languageToolSeqRef.current) return;
      if (!result.ok) {
        setLanguageToolMatches([]);
        setLanguageToolSnapshot(null);
        setLanguageToolOverlays([]);
        if (!options?.quiet) {
          setLanguageToolStatus({
            severity: 'error',
            message: result.error ?? t('LW.settings.language_tool.connection_failed'),
          });
        }
        return;
      }
      const matches = (result.matches ?? []) as LanguageToolMatchView[];
      const liveText = editableRef.current?.textContent ?? '';
      if (liveText !== text) return;
      setLanguageToolSnapshot(text);
      setLanguageToolMatches(matches);
      refreshLanguageToolOverlays(matches);
      if (!options?.quiet || matches.length > 0) {
        setLanguageToolStatus({
          severity: matches.length === 0 ? 'success' : 'info',
          message:
            matches.length === 0
              ? t('LW.translationPane.languageToolNoMatches')
              : t('LW.translationPane.languageToolMatches', { count: matches.length }),
        });
      } else if (matches.length === 0) {
        setLanguageToolStatus(null);
      }
    } catch (error) {
      if (seq !== languageToolSeqRef.current) return;
      if (!options?.quiet) {
        setLanguageToolStatus({
          severity: 'error',
          message:
            error instanceof Error
              ? error.message
              : t('LW.settings.language_tool.connection_failed'),
        });
      }
    } finally {
      if (seq === languageToolSeqRef.current) setLanguageToolChecking(false);
    }
  }, [
    languageState?.selectedLang,
    languageToolEnabled,
    locked,
    refreshLanguageToolOverlays,
    selectedUnitId,
    t,
    translationMode.lang,
  ]);

  const scheduleLiveLanguageToolCheck = useCallback(() => {
    if (!languageToolLive || !languageToolEnabled || locked) return;
    if (languageToolDebounceRef.current) clearTimeout(languageToolDebounceRef.current);
    languageToolDebounceRef.current = setTimeout(() => {
      void runLanguageToolCheck({ quiet: true });
    }, 700);
  }, [languageToolEnabled, languageToolLive, locked, runLanguageToolCheck]);

  const dismissLanguageToolMatch = useCallback(
    (match: LanguageToolMatchView) => {
      setLanguageToolMatches((current) => {
        const next = current.filter(
          (item) => item.offset !== match.offset || item.length !== match.length,
        );
        refreshLanguageToolOverlays(next);
        return next;
      });
    },
    [refreshLanguageToolOverlays],
  );

  const applyLanguageToolReplacement = useCallback(
    async (match: LanguageToolMatchView, replacement: string) => {
      const root = editableRef.current;
      if (!root) return;
      const liveText = root.textContent ?? '';
      if (languageToolSnapshot !== null && liveText !== languageToolSnapshot) {
        setLanguageToolStatus({
          severity: 'error',
          message: t('LW.translationPane.languageToolTextChanged'),
        });
        setLanguageToolMatches([]);
        setLanguageToolSnapshot(null);
        setLanguageToolOverlays([]);
        return;
      }

      const ok = applyTextContentReplacement(root, match.offset, match.length, replacement);
      if (!ok) {
        setLanguageToolStatus({
          severity: 'error',
          message: t('LW.translationPane.languageToolApplyFailed'),
        });
        return;
      }

      const nextText = root.textContent ?? '';
      setLanguageToolSnapshot(nextText);
      setLanguageToolMatches((current) => {
        const next = shiftLanguageToolMatchViews(
          current,
          match.offset,
          match.length,
          replacement.length,
        );
        refreshLanguageToolOverlays(next);
        return next;
      });
      refreshFootnotes();
      await persist();
    },
    [languageToolSnapshot, persist, refreshFootnotes, refreshLanguageToolOverlays, t],
  );

  const getEditableRange = (): Range | null => {
    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    if (range) {
      const inFootnoteEditor = Array.from(
        document.querySelectorAll<HTMLElement>('[data-leaf-footnote-editor]'),
      ).some((element) => element.contains(range.commonAncestorContainer));
      if (inFootnoteEditor) return null;
    }
    if (range && editableRef.current?.contains(range.commonAncestorContainer)) {
      savedBodyRangeRef.current = range.cloneRange();
      lastCitationTargetRef.current = 'body';
      return range;
    }

    const saved = savedBodyRangeRef.current;
    if (
      saved &&
      editableRef.current?.contains(saved.startContainer) &&
      editableRef.current.contains(saved.endContainer)
    ) {
      editableRef.current.focus();
      selection?.removeAllRanges();
      selection?.addRange(saved);
      return saved.cloneRange();
    }

    return null;
  };

  const rememberBodyRange = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editableRef.current?.contains(range.commonAncestorContainer)) return;
    savedBodyRangeRef.current = range.cloneRange();
    lastCitationTargetRef.current = 'body';
  };

  const rememberFootnoteRange = (index: number, element: HTMLElement) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!element.contains(range.commonAncestorContainer)) return;
    savedFootnoteRangeRef.current = { index, range: range.cloneRange() };
    lastCitationTargetRef.current = 'footnote';
  };

  const restoreFootnoteRange = (index: number): Range | null => {
    const saved = savedFootnoteRangeRef.current;
    if (!saved || saved.index !== index) return null;
    const footnoteEditor = document.querySelector<HTMLElement>(
      `[data-leaf-footnote-editor="${index}"]`,
    );
    if (
      !footnoteEditor ||
      !footnoteEditor.contains(saved.range.startContainer) ||
      !footnoteEditor.contains(saved.range.endContainer)
    ) {
      return null;
    }

    footnoteEditor.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(saved.range);
    return saved.range.cloneRange();
  };

  const getCitationInsertionTarget = ():
    | { kind: 'body'; range: Range }
    | { element: HTMLElement; index: number; kind: 'footnote'; range: Range }
    | null => {
    const selection = window.getSelection();
    const liveRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    if (liveRange && editableRef.current?.contains(liveRange.commonAncestorContainer)) {
      savedBodyRangeRef.current = liveRange.cloneRange();
      lastCitationTargetRef.current = 'body';
      return { kind: 'body', range: liveRange.cloneRange() };
    }

    if (liveRange) {
      const footnoteEditor = Array.from(
        document.querySelectorAll<HTMLElement>('[data-leaf-footnote-editor]'),
      ).find((element) => element.contains(liveRange.commonAncestorContainer));
      if (footnoteEditor) {
        const index = Number(footnoteEditor.dataset.leafFootnoteEditor);
        lastCitationTargetRef.current = 'footnote';
        return { element: footnoteEditor, index, kind: 'footnote', range: liveRange.cloneRange() };
      }
    }

    const saved = savedFootnoteRangeRef.current;
    if (lastCitationTargetRef.current === 'footnote' && saved) {
      const footnoteEditor = document.querySelector<HTMLElement>(
        `[data-leaf-footnote-editor="${saved.index}"]`,
      );
      const range = restoreFootnoteRange(saved.index);
      if (footnoteEditor && range) {
        return { element: footnoteEditor, index: saved.index, kind: 'footnote', range };
      }
    }

    const savedBody = getEditableRange();
    if (savedBody) return { kind: 'body', range: savedBody };
    if (!saved) return null;
    const footnoteEditor = document.querySelector<HTMLElement>(
      `[data-leaf-footnote-editor="${saved.index}"]`,
    );
    const range = restoreFootnoteRange(saved.index);
    if (!footnoteEditor || !range) return null;
    return { element: footnoteEditor, index: saved.index, kind: 'footnote', range };
  };

  const unwrapElement = (element: Element) => {
    const parent = element.parentNode;
    if (!parent) return;
    const first = element.firstChild;
    const last = element.lastChild;
    while (element.firstChild) parent.insertBefore(element.firstChild, element);
    parent.removeChild(element);
    if (first && last) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.setStartBefore(first);
      range.setEndAfter(last);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  };

  const findSmallCapsAncestor = (range: Range): Element | null => {
    const start = range.commonAncestorContainer;
    let el = start.nodeType === Node.ELEMENT_NODE ? (start as Element) : start.parentElement;
    while (el && el !== editableRef.current) {
      if (el.tagName.toLowerCase() === 'hi' && el.getAttribute('rend') === 'small-caps') {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  };

  const toggleSmallCaps = () => {
    const range = getEditableRange();
    if (!range) return;

    // Already inside a small-caps <hi>: toggle it off by unwrapping.
    const ancestor = findSmallCapsAncestor(range);
    if (ancestor) {
      unwrapElement(ancestor);
      return;
    }

    // Selection contains small-caps <hi> elements: unwrap those.
    const contained = Array.from(
      editableRef.current?.querySelectorAll('hi[rend="small-caps"]') ?? [],
    ).filter((hi) => range.intersectsNode(hi));
    if (contained.length > 0) {
      for (const hi of contained) unwrapElement(hi);
      return;
    }

    if (range.collapsed) return;

    const wrapper = document.createElement('hi');
    wrapper.setAttribute('rend', 'small-caps');
    wrapper.appendChild(range.extractContents());
    range.insertNode(wrapper);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    const nextRange = document.createRange();
    nextRange.selectNodeContents(wrapper);
    selection?.addRange(nextRange);
  };

  const removeAllFormatting = () => {
    const range = getEditableRange();
    if (!range || range.collapsed) return;

    document.execCommand('removeFormat');

    // execCommand doesn't know TEI <hi>; unwrap any that intersect the selection.
    const selection = window.getSelection();
    const current = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    if (!current || !editableRef.current) return;
    for (const hi of Array.from(editableRef.current.querySelectorAll('hi'))) {
      if (current.intersectsNode(hi)) unwrapElement(hi);
    }
  };

  const findAncestorTag = (range: Range, tagName: string): Element | null => {
    const start = range.commonAncestorContainer;
    let el = start.nodeType === Node.ELEMENT_NODE ? (start as Element) : start.parentElement;
    while (el && el !== editableRef.current) {
      if (el.tagName.toLowerCase() === tagName) return el;
      el = el.parentElement;
    }
    return null;
  };

  const selectContents = (element: Node) => {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const openLinkDialog = () => {
    const range = getEditableRange();
    if (!range) return;
    savedRangeRef.current = range.cloneRange();
    // Editing an existing link: prefill its target.
    const existingRef = findAncestorTag(range, 'ref');
    setLinkUrl(existingRef?.getAttribute('target') ?? '');
    setLinkDialogOpen(true);
  };

  const applyLink = () => {
    setLinkDialogOpen(false);
    const url = linkUrl.trim();
    const saved = savedRangeRef.current;
    savedRangeRef.current = null;
    if (!saved || !editableRef.current) return;

    editableRef.current.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(saved);

    const existingRef = findAncestorTag(saved, 'ref');
    if (existingRef) {
      // Empty URL removes the link, otherwise update it.
      if (!url) unwrapElement(existingRef);
      else existingRef.setAttribute('target', url);
      return;
    }

    if (!url) return;

    const wrapper = document.createElement('ref');
    wrapper.setAttribute('target', url);
    if (saved.collapsed) {
      // No selection: insert the URL itself as the link text, like Word does.
      wrapper.textContent = url;
      saved.insertNode(wrapper);
    } else {
      wrapper.appendChild(saved.extractContents());
      saved.insertNode(wrapper);
    }
    selectContents(wrapper);
  };

  const insertFootnote = () => {
    const range = getEditableRange();
    if (!range) return;

    // Optional Word-like "footnote from selection": only when the selection is
    // short. A long selection usually means the caret accidentally selected the
    // rest of the paragraph — that used to swallow body text into the note.
    let initialHtml = '';
    if (!range.collapsed) {
      const selectedText = range.toString();
      if (selectedText.length > 0 && selectedText.length <= 80) {
        const extracted = range.extractContents();
        const holder = document.createElement('div');
        holder.appendChild(extracted);
        initialHtml = holder.innerHTML;
      } else {
        range.collapse(true);
      }
    }

    const note = document.createElement('note');
    note.setAttribute('place', 'foot');
    note.setAttribute('contenteditable', 'false');

    const mark = document.createElement('span');
    mark.setAttribute(FN_MARK_ATTR, 'true');
    mark.setAttribute('contenteditable', 'false');
    mark.textContent = '1';

    const body = document.createElement('span');
    body.setAttribute(FN_BODY_ATTR, 'true');
    if (initialHtml) body.innerHTML = initialHtml;

    note.appendChild(mark);
    note.appendChild(body);
    range.insertNode(note);

    // Guard node after the note so the next keystroke cannot be absorbed into it.
    const guard = document.createTextNode('\u200B');
    note.after(guard);
    const selection = window.getSelection();
    const after = document.createRange();
    after.setStartAfter(guard);
    after.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(after);

    const notes = Array.from(editableRef.current?.querySelectorAll('note') ?? []);
    focusFootnoteIndexRef.current = notes.indexOf(note);
    refreshFootnotes();
  };

  const chooseCitationStyleForFirstReference = async (
    bridge: DesktopCitationBridge,
  ): Promise<string | null> => {
    if (pendingCitationStyle) return pendingCitationStyle;
    if (translationMode.citationStyle) return translationMode.citationStyle;

    return openCitationStylePicker(bridge);
  };

  const openCitationStylePicker = async (
    bridge: DesktopCitationBridge,
    initialStyleId = pendingCitationStyle || translationMode.citationStyle || undefined,
  ): Promise<string | null> => {
    let defaultStyleId = DEFAULT_CITATION_STYLE_ID;
    let options: Awaited<ReturnType<DesktopCitationBridge['getCitationStyleOptions']>>['options'] =
      [];
    try {
      const result = await bridge.getCitationStyleOptions();
      defaultStyleId = result.defaultStyleId;
      options = result.options;
    } catch {
      setAiStatus({ severity: 'error', message: 'Zotero preferences failed to load.' });
      return null;
    }

    const fallbackStyleId = options[0]?.id ?? defaultStyleId;
    setCitationStyleChoices(options);
    setPendingCitationStyle(initialStyleId ?? fallbackStyleId);
    setCitationStylePickerOpen(true);

    const styleId = await new Promise<string | null>((resolve) => {
      citationStyleResolveRef.current = resolve;
    });
    citationStyleResolveRef.current = null;
    setCitationStylePickerOpen(false);

    if (!styleId) {
      setPendingCitationStyle('');
      return null;
    }

    const saved = await bridge.setCitationStyle(styleId);
    if (!saved) {
      setAiStatus({ severity: 'error', message: 'Could not save citation style.' });
      setPendingCitationStyle('');
      return null;
    }

    setPendingCitationStyle(styleId);
    return styleId;
  };

  const createRenderedCitation = (
    pick: ZoteroCaywPick,
    biblId: string,
    styleId: string | undefined,
  ): HTMLElement | null => {
    const bridge = getCitationBridge();
    if (!bridge) return null;

    const bibl = document.createElement('bibl');
    bibl.setAttribute('type', 'zotero-ref');
    bibl.setAttribute('contenteditable', 'false');
    bibl.setAttribute('data-leaf-citation-field', 'true');
    bibl.setAttribute('title', 'Zotero citation');
    bibl.setAttribute('corresp', `#${biblId}`);
    if (pick.locator) bibl.setAttribute('data-locator', pick.locator);
    if (pick.label) bibl.setAttribute('data-locator-type', pick.label);
    if (pick.prefix) bibl.setAttribute('data-prefix', pick.prefix);
    if (pick.suffix) bibl.setAttribute('data-suffix', pick.suffix);
    bibl.innerHTML = bridge.renderCitation({
      item: pick.csl,
      styleId,
      lang: translationMode.lang ?? undefined,
      locator: pick.locator,
      locatorType: pick.label,
      prefix: pick.prefix,
      suffix: pick.suffix,
    });
    return bibl;
  };

  const insertFragmentAtRange = (range: Range, fragment: DocumentFragment): ChildNode | null => {
    range.deleteContents();
    const lastInserted = fragment.lastChild;
    range.insertNode(fragment);

    if (lastInserted) {
      const selection = window.getSelection();
      const after = document.createRange();
      after.setStartAfter(lastInserted);
      after.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(after);
    }

    return lastInserted;
  };

  const insertZoteroCitation = async () => {
    const bridge = getCitationBridge();
    if (!bridge) {
      setAiStatus({ severity: 'error', message: 'Zotero citations are not available.' });
      return;
    }
    if (locked) {
      setAiStatus({ severity: 'error', message: 'This translation unit is locked.' });
      return;
    }

    const doc = docRef.current;
    if (!doc || !alignmentUnit || !sourcePath || !selectedUnitId || !translationPath) {
      setAiStatus({ severity: 'error', message: 'Select a translation unit first.' });
      return;
    }

    const insertionTarget = getCitationInsertionTarget();
    if (!insertionTarget) return;

    setAiStatus({ severity: 'info', message: t('LW.translationPane.waitingForZoteroCitation') });
    zoteroStatusTimeoutRef.current = setTimeout(() => {
      setAiStatus(null);
      zoteroStatusTimeoutRef.current = null;
    }, 30_000);
    const result = await bridge.pickZoteroCitation();
    if (zoteroStatusTimeoutRef.current) {
      clearTimeout(zoteroStatusTimeoutRef.current);
      zoteroStatusTimeoutRef.current = null;
    }
    if (!result.ok) {
      if (!result.cancelled) {
        setAiStatus({
          severity: 'error',
          message: result.error ?? t('LW.translationPane.zoteroCitationFailed'),
        });
      } else {
        setAiStatus(null);
      }
      return;
    }

    const styleId = await chooseCitationStyleForFirstReference(bridge);
    if (!styleId) {
      setAiStatus(null);
      return;
    }

    const fragment = document.createDocumentFragment();
    result.picks.forEach((pick, index) => {
      const biblId = bridge.upsertBiblEntry(doc, pick.csl, pick.uri);
      const bibl = createRenderedCitation(pick, biblId, styleId);
      if (!bibl) return;
      if (index > 0) fragment.appendChild(document.createTextNode('; '));
      fragment.appendChild(bibl);
    });

    if (insertionTarget.kind === 'footnote') {
      insertionTarget.element.focus();
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(insertionTarget.range);
      insertFragmentAtRange(insertionTarget.range, fragment);
      prepareAtomicCitationFields(insertionTarget.element, zoteroCitationLabel);
      updateFootnote(insertionTarget.index, insertionTarget.element.innerHTML);
      rememberFootnoteRange(insertionTarget.index, insertionTarget.element);
    } else {
      editableRef.current?.focus();
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(insertionTarget.range);
      insertFragmentAtRange(insertionTarget.range, fragment);
      rememberBodyRange();
    }

    renderCitationRefs(doc);
    refreshFootnotes();
    await persist();
    setAiStatus(null);
  };

  const insertEntityMention = async (
    entityId: string,
    options?: { replace?: { textNode: Text; start: number; end: number } },
  ) => {
    if (locked) {
      notifyViaSnackbar(t('LW.translationPane.entityInsertLocked'));
      return;
    }
    const editable = editableRef.current;
    if (!editable) return;

    try {
      const entity = await fetchEntitySummary(entityId);
      if (!entity) {
        notifyViaSnackbar(t('LW.translationPane.entityNotFound', { id: entityId }));
        return;
      }

      editable.focus();
      let range: Range | null = null;
      if (options?.replace) {
        const { textNode, start, end } = options.replace;
        const value = textNode.nodeValue ?? '';
        if (textNode.parentNode) {
          range = document.createRange();
          range.setStart(textNode, Math.max(0, Math.min(start, value.length)));
          range.setEnd(textNode, Math.max(0, Math.min(end, value.length)));
          range.deleteContents();
        }
      }
      if (!range) range = getEditableRange();
      if (!range) {
        range = document.createRange();
        range.selectNodeContents(editable);
        range.collapse(false);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }

      const existingCount = Array.from(
        editable.querySelectorAll(`ref[type="${ENTITY_REF_TYPE}"]`),
      ).filter((node) => node.getAttribute('key') === entityId).length;
      const field = createEntityFieldElement(
        entity,
        existingCount + 1,
        EMPTY_DISPLAY_SPEC,
        undefined,
        selectedLanguage,
      );
      range.insertNode(field);
      const guard = document.createTextNode('\u200B');
      field.after(guard);
      const after = document.createRange();
      after.setStartAfter(guard);
      after.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(after);

      recalculateEntityFieldsInRoot(editable, entity.id, entity, undefined, selectedLanguage);
      prepareAtomicEntityFields(editable);
      rememberBodyRange();
      setEntityAcSuggestions([]);
      setEntityAcAnchor(null);
      await persist();
    } catch (error) {
      console.warn('[translation] entity insert failed', error);
      notifyViaSnackbar(
        error instanceof Error
          ? error.message
          : t('LW.translationPane.entityNotFound', { id: entityId }),
      );
    }
  };

  const dismissEntityAutocomplete = useCallback(() => {
    setEntityAcSuggestions([]);
    setEntityAcAnchor(null);
    setEntityAcIndex(0);
  }, []);

  const refreshEntityAutocomplete = useCallback(() => {
    if (locked) {
      dismissEntityAutocomplete();
      return;
    }
    const selection = window.getSelection();
    const range =
      selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    if (!range || !editableRef.current?.contains(range.commonAncestorContainer)) {
      dismissEntityAutocomplete();
      return;
    }
    const suggestions = buildSuggestionsAtCaret(range, entityAcCandidatesRef.current);
    setEntityAcSuggestions(suggestions);
    setEntityAcIndex(0);
    const place = () => {
      const live = window.getSelection();
      const liveRange = live && live.rangeCount > 0 ? live.getRangeAt(0) : range;
      setEntityAcAnchor(
        suggestions[0] ? caretAnchorPosition(suggestions[0], liveRange) : null,
      );
    };
    place();
    // Collapsed carets sometimes report empty rects until the next frame.
    window.requestAnimationFrame(place);
  }, [dismissEntityAutocomplete, locked]);

  const acceptEntityAutocomplete = async (index?: number) => {
    const suggestion = entityAcSuggestionsRef.current[index ?? entityAcIndexRef.current];
    if (!suggestion) return;
    dismissEntityAutocomplete();
    await insertEntityMention(suggestion.candidate.id, {
      replace: {
        textNode: suggestion.textNode,
        start: suggestion.replaceStart,
        end: suggestion.replaceEnd,
      },
    });
  };

  const openEntityMenu = (anchor: HTMLElement) => {
    if (!alignmentUnit || !selectedUnitId) {
      notifyViaSnackbar(t('LW.translationPane.entityNeedUnit'));
      return;
    }
    setSourceEntities(collectSourceUnitEntities(alignmentUnit, selectedUnitId));
    setEntityPickerQuery('');
    setEntityPickerResults([]);
    setEntityPickerSearching(false);
    setEntityMenuAnchor(anchor);
  };

  useEffect(() => {
    if (!entityMenuAnchor) return;
    const query = entityPickerQuery.trim();
    if (query.length < 1) {
      setEntityPickerResults([]);
      setEntityPickerSearching(false);
      return;
    }
    const seq = ++entityPickerSearchSeqRef.current;
    setEntityPickerSearching(true);
    const handle = window.setTimeout(() => {
      void searchEntitiesForPicker(query)
        .then((hits) => {
          if (seq !== entityPickerSearchSeqRef.current) return;
          setEntityPickerResults(hits);
        })
        .catch((error) => {
          console.warn('[translation] entity picker search failed', error);
          if (seq !== entityPickerSearchSeqRef.current) return;
          setEntityPickerResults([]);
        })
        .finally(() => {
          if (seq === entityPickerSearchSeqRef.current) setEntityPickerSearching(false);
        });
    }, 200);
    return () => window.clearTimeout(handle);
  }, [entityMenuAnchor, entityPickerQuery]);

  const resolveEntityFieldTarget = (clicked: Element): Element | null => {
    const editable = editableRef.current;
    if (!editable) return null;
    if (editable.contains(clicked)) return clicked;

    const footnoteEditor = clicked.closest('[data-leaf-footnote-editor]');
    if (!(footnoteEditor instanceof HTMLElement)) return null;
    const index = Number(footnoteEditor.getAttribute('data-leaf-footnote-editor'));
    if (!Number.isFinite(index)) return null;
    const note = editable.querySelectorAll('note')[index];
    if (!note) return null;
    const key = clicked.getAttribute('key');
    if (!key) return null;
    const editorRefs = Array.from(
      footnoteEditor.querySelectorAll(`ref[type="${ENTITY_REF_TYPE}"]`),
    ).filter((node) => node.getAttribute('key') === key);
    const noteRefs = Array.from(note.querySelectorAll(`ref[type="${ENTITY_REF_TYPE}"]`)).filter(
      (node) => node.getAttribute('key') === key,
    );
    const localIndex = editorRefs.indexOf(clicked);
    return noteRefs[localIndex] ?? noteRefs[0] ?? null;
  };

  const occurrenceIndexForField = (field: Element): number => {
    const editable = editableRef.current;
    const key = field.getAttribute('key');
    if (!editable || !key) return 1;
    const fields = Array.from(editable.querySelectorAll(`ref[type="${ENTITY_REF_TYPE}"]`)).filter(
      (node) => node.getAttribute('key') === key,
    );
    const index = fields.indexOf(field);
    return index >= 0 ? index + 1 : 1;
  };

  const openEntityFormatPopup = async (event: ReactMouseEvent, clicked: Element) => {
    if (locked) return;
    const field = resolveEntityFieldTarget(clicked);
    const key = field?.getAttribute('key');
    if (!field || !key) return;

    event.preventDefault();
    event.stopPropagation();

    const entity = await fetchEntitySummary(key);
    if (!entity) {
      notifyViaSnackbar(t('LW.translationPane.entityNotFound', { id: key }));
      return;
    }

    entityFormatFieldRef.current = field;
    setEntityFormatEntity(entity);
    setEntityFormatSpec(readDisplaySpecFromField(field));
    setEntityFormatOccurrence(occurrenceIndexForField(field));
    setEntityFormatAnchor({ top: event.clientY, left: event.clientX });
    setEntityFormatOpen(true);
  };

  const handleEntityFieldContextMenu = (event: ReactMouseEvent<HTMLElement>) => {
    const target = event.target as Node | null;
    const element =
      target?.nodeType === Node.ELEMENT_NODE ? (target as Element) : target?.parentElement;
    const ref = element?.closest?.(`ref[${ENTITY_FIELD_ATTR}="true"]`);
    if (!ref) return;
    void openEntityFormatPopup(event, ref);
  };

  const applyEntityDisplaySpec = async (spec: EntityDisplaySpec) => {
    const field = entityFormatFieldRef.current;
    const entity = entityFormatEntity;
    const editable = editableRef.current;
    if (!field || !entity || !editable) return;

    writeDisplaySpecToField(field, spec);
    setEntityFormatSpec(spec);
    recalculateEntityFieldsInRoot(editable, entity.id, entity, undefined, selectedLanguage);
    prepareAtomicEntityFields(editable);
    refreshFootnotes();
    setEntityFormatOccurrence(occurrenceIndexForField(field));
    await persist();
  };

  const resetEntityDisplaySpec = async () => {
    await applyEntityDisplaySpec({ ...EMPTY_DISPLAY_SPEC });
  };

  const closeEntityFormatPopup = () => {
    setEntityFormatOpen(false);
    entityFormatFieldRef.current = null;
  };

  const handleTranslationPaste = (
    event: ClipboardEvent<HTMLElement>,
    options: { target: 'body' | 'footnote' } = { target: 'body' },
  ) => {
    const range = window.getSelection()?.rangeCount ? window.getSelection()?.getRangeAt(0) : null;
    if (!range || !event.currentTarget.contains(range.commonAncestorContainer)) return;

    event.preventDefault();
    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');
    const container = document.createElement('div');
    if (html) container.innerHTML = html;
    else container.textContent = text;

    sanitizeTranslationFragment(container, zoteroCitationLabel);
    if (options.target === 'footnote') {
      unwrapElementsByTagName(container, 'note');
    }

    const fragment = document.createDocumentFragment();
    while (container.firstChild) fragment.appendChild(container.firstChild);
    insertFragmentAtRange(range, fragment);
    sanitizeTranslationFragment(event.currentTarget, zoteroCitationLabel);
    applyEditorialCleanupToRootPreservingSelection(event.currentTarget, selectedLanguage);
    refreshFootnotes();
  };

  const protectCitationField = (event: SyntheticEvent<HTMLElement>) => {
    const target = event.target as Node | null;
    const element =
      target?.nodeType === Node.ELEMENT_NODE ? (target as Element) : target?.parentElement;
    if (
      element?.closest?.('bibl[data-leaf-citation-field="true"]') ||
      element?.closest?.(`ref[${ENTITY_FIELD_ATTR}="true"]`)
    ) {
      event.preventDefault();
    }
  };

  const updateFootnote = (index: number, html: string) => {
    const note = editableRef.current?.querySelectorAll('note')[index];
    if (!note || !editableRef.current) return;
    normalizeFootnoteNotes(editableRef.current);
    const body = footnoteBodyOf(note);
    if (!body) return;
    body.innerHTML = html;
    prepareAtomicCitationFields(body, zoteroCitationLabel);
  };

  const removeFootnote = (index: number) => {
    const note = editableRef.current?.querySelectorAll('note')[index];
    if (!note) return;
    note.remove();
    refreshFootnotes();
    void persist();
  };

  const applyFormat = (
    command:
      | 'bold'
      | 'italic'
      | 'underline'
      | 'strikeThrough'
      | 'superscript'
      | 'subscript'
      | 'smallCaps'
      | 'removeFormat'
      | 'link'
      | 'footnote'
      | 'citation',
  ) => {
    if (command === 'smallCaps') {
      toggleSmallCaps();
      return;
    }
    if (command === 'removeFormat') {
      removeAllFormatting();
      return;
    }
    if (command === 'link') {
      openLinkDialog();
      return;
    }
    if (command === 'footnote') {
      insertFootnote();
      return;
    }
    if (command === 'citation') {
      void insertZoteroCitation();
      return;
    }
    editableRef.current?.focus();
    document.execCommand(command);
  };

  if (!translationMode.active) return null;

  const languageOptions = languageState?.languages ?? [];
  const spellcheckLang = selectedLanguage || undefined;

  const toggleSpellcheck = () => {
    setSpellcheckEnabled((previous) => {
      const next = !previous;
      writeSpellcheckEnabled(next);
      return next;
    });
  };
  const shortcut = (macShortcut: string, otherShortcut: string) => (mac ? macShortcut : otherShortcut);
  const formatItems: Array<{
    command:
      | 'bold'
      | 'italic'
      | 'underline'
      | 'strikeThrough'
      | 'smallCaps'
      | 'superscript'
      | 'subscript'
      | 'removeFormat'
      | 'link'
      | 'footnote'
      | 'citation';
    icon: ReactNode;
    label: string;
    shortcut: string;
  }> = [
    {
      command: 'bold',
      icon: <FormatBoldIcon fontSize="small" />,
      label: t('LW.translationPane.formatItems.bold'),
      shortcut: shortcut('⌘B', 'Ctrl+B'),
    },
    {
      command: 'italic',
      icon: <FormatItalicIcon fontSize="small" />,
      label: t('LW.translationPane.formatItems.italic'),
      shortcut: shortcut('⌘I', 'Ctrl+I'),
    },
    {
      command: 'underline',
      icon: <FormatUnderlinedIcon fontSize="small" />,
      label: t('LW.translationPane.formatItems.underline'),
      shortcut: shortcut('⌘U', 'Ctrl+U'),
    },
    {
      command: 'strikeThrough',
      icon: <FormatStrikethroughIcon fontSize="small" />,
      label: t('LW.translationPane.formatItems.strikethrough'),
      shortcut: shortcut('⌥⇧5', 'Alt+Shift+5'),
    },
    {
      command: 'smallCaps',
      icon: <TextFieldsIcon fontSize="small" />,
      label: t('LW.translationPane.formatItems.smallCaps'),
      shortcut: shortcut('⌘⇧K', 'Ctrl+Shift+K'),
    },
    {
      command: 'superscript',
      icon: <SuperscriptIcon fontSize="small" />,
      label: t('LW.translationPane.formatItems.superscript'),
      shortcut: shortcut('⌘.', 'Ctrl+.'),
    },
    {
      command: 'subscript',
      icon: <SubscriptIcon fontSize="small" />,
      label: t('LW.translationPane.formatItems.subscript'),
      shortcut: shortcut('⌘,', 'Ctrl+,'),
    },
    {
      command: 'link',
      icon: <LinkIcon fontSize="small" />,
      label: t('LW.translationPane.formatItems.link'),
      shortcut: shortcut('⌘K', 'Ctrl+K'),
    },
    {
      command: 'footnote',
      icon: <StickyNote2Icon fontSize="small" />,
      label: t('LW.translationPane.formatItems.footnote'),
      shortcut: shortcut('⌘⌥F', 'Ctrl+Alt+F'),
    },
    {
      command: 'citation',
      icon: <FormatQuoteIcon fontSize="small" />,
      label: t('LW.translationPane.formatItems.zoteroCitation'),
      shortcut: t('LW.translationPane.formatItems.shortcuts.zoteroPicker'),
    },
    {
      command: 'removeFormat',
      icon: <FormatClearIcon fontSize="small" />,
      label: t('LW.translationPane.formatItems.clearFormatting'),
      shortcut: shortcut('⌘M', 'Ctrl+M'),
    },
  ];

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        borderLeft: 1,
        borderColor: 'divider',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        sx={{ p: 0.5, borderBottom: 1, borderColor: 'divider', minWidth: 0 }}
      >
        {languageOptions.length > 0 ? (
          <Select
            disabled={languageState?.indexing}
            onChange={(event) => languageState?.setSelectedLang(String(event.target.value))}
            size="small"
            sx={{
              flex: '0 0 auto',
              minWidth: 72,
              '& .MuiSelect-select': { px: 1, py: 0.5 },
            }}
            value={
              languageOptions.some((lang) => lang.code === selectedLanguage)
                ? selectedLanguage
                : languageOptions[0]!.code
            }
          >
            {languageOptions.map((lang) => (
              <MenuItem key={lang.code} value={lang.code}>
                {lang.code}
              </MenuItem>
            ))}
          </Select>
        ) : (
          <Typography
            noWrap
            variant="caption"
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              flex: '0 0 auto',
              minWidth: 48,
              px: 1,
              py: 0.5,
              textAlign: 'center',
            }}
          >
            {selectedLanguage || '--'}
          </Typography>
        )}

        <Tooltip title={t('LW.translationPane.generateTranslation')}>
          <span>
            <IconButton
              disabled={!selectedUnitId || generating || locked}
              onClick={() => void generateTranslation()}
              size="small"
            >
              {generating ? <CircularProgress size={18} /> : <AutoAwesomeIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title={t('LW.translationPane.copyForExport')}>
          <span>
            <IconButton
              disabled={!selectedUnitId}
              onClick={() => {
                if (!selectedUnitId) return;
                void copyUnitsForExport({
                  translationMode: { alignmentUnit, sourcePath, translationPath },
                  unitIds: [selectedUnitId],
                  translationDoc,
                  notify: (message) => notifyViaSnackbar(message),
                }).catch((error) => {
                  notifyViaSnackbar(
                    t('LW.translationPane.copyFailed', {
                      error: error instanceof Error ? error.message : String(error),
                    }),
                  );
                });
              }}
              size="small"
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip
          title={
            locked
              ? t('LW.translationPane.unlockTranslationUnit')
              : t('LW.translationPane.lockTranslationUnit')
          }
        >
          <span>
            <IconButton disabled={!selectedUnitId} onClick={() => void toggleLock()} size="small">
              {locked ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip
          title={
            languageToolLive
              ? t('LW.translationPane.spellcheckOffForLiveLt')
              : spellcheckEnabled
                ? t('LW.translationPane.disableSpellcheck')
                : t('LW.translationPane.enableSpellcheck')
          }
        >
          <span>
            <IconButton
              aria-pressed={spellcheckEnabled && !languageToolLive}
              color={spellcheckEnabled && !languageToolLive ? 'primary' : 'default'}
              disabled={languageToolLive}
              onClick={toggleSpellcheck}
              size="small"
            >
              <SpellcheckIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip
          title={
            languageToolEnabled
              ? t('LW.translationPane.languageToolCheck')
              : t('LW.translationPane.languageToolDisabled')
          }
        >
          <span>
            <IconButton
              aria-label={t('LW.translationPane.languageToolCheck')}
              color={languageToolMatches.length > 0 ? 'primary' : 'default'}
              disabled={!selectedUnitId || locked || languageToolChecking}
              onClick={() => void runLanguageToolCheck()}
              size="small"
            >
              {languageToolChecking ? (
                <CircularProgress size={18} />
              ) : (
                <FactCheckIcon fontSize="small" />
              )}
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title={t('LW.translationPane.insertEntity')}>
          <span>
            <IconButton
              aria-controls={entityMenuAnchor ? 'translation-entity-menu' : undefined}
              aria-haspopup="menu"
              disabled={!selectedUnitId || locked}
              onClick={(event) => openEntityMenu(event.currentTarget)}
              size="small"
            >
              <PersonOutlineIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Menu
          anchorEl={entityMenuAnchor}
          id="translation-entity-menu"
          onClose={() => setEntityMenuAnchor(null)}
          open={Boolean(entityMenuAnchor)}
          slotProps={{
            paper: { sx: { width: 360, maxHeight: 420 } },
            list: { sx: { py: 0 } },
          }}
        >
          <Box
            onKeyDown={(event) => event.stopPropagation()}
            sx={{ px: 1.5, pt: 1.25, pb: 1 }}
          >
            <TextField
              autoFocus
              fullWidth
              placeholder={t('LW.translationPane.entityPickerSearch')}
              size="small"
              value={entityPickerQuery}
              onChange={(event) => setEntityPickerQuery(event.target.value)}
            />
          </Box>

          {sourceEntities.length > 0 && (
            <ListSubheader disableSticky sx={{ lineHeight: 2 }}>
              {t('LW.translationPane.entityPickerFromUnit')}
            </ListSubheader>
          )}
          {sourceEntities.map((hit) => (
            <MenuItem
              key={`unit-${hit.key}`}
              onClick={() => {
                setEntityMenuAnchor(null);
                void insertEntityMention(hit.key);
              }}
            >
              <ListItemText
                primary={hit.surface || hit.key}
                secondary={`${hit.kind} · ${hit.key}`}
              />
            </MenuItem>
          ))}

          {entityPickerQuery.trim().length > 0 && (
            <ListSubheader disableSticky sx={{ lineHeight: 2 }}>
              {entityPickerSearching
                ? t('LW.translationPane.entityPickerSearching')
                : t('LW.translationPane.entityPickerAllEntities')}
            </ListSubheader>
          )}
          {entityPickerQuery.trim().length > 0 &&
            !entityPickerSearching &&
            entityPickerResults.length === 0 && (
              <MenuItem disabled>{t('LW.translationPane.entityPickerNoResults')}</MenuItem>
            )}
          {entityPickerResults.map((hit) => (
            <MenuItem
              key={`${hit.source}-${hit.id}`}
              onClick={() => {
                setEntityMenuAnchor(null);
                void insertEntityMention(hit.id);
              }}
            >
              <ListItemText
                primary={hit.label || hit.id}
                secondary={
                  hit.description
                    ? `${hit.kind} · ${hit.source} · ${hit.description}`
                    : `${hit.kind} · ${hit.source} · ${hit.id}`
                }
              />
            </MenuItem>
          ))}

          {sourceEntities.length === 0 && entityPickerQuery.trim().length === 0 && (
            <MenuItem disabled>{t('LW.translationPane.entityPickerTypeToSearch')}</MenuItem>
          )}
        </Menu>

        <Tooltip title={t('LW.translationPane.formatting')}>
          <span>
            <IconButton
              aria-controls={formatAnchor ? 'translation-format-menu' : undefined}
              aria-haspopup="menu"
              disabled={!selectedUnitId}
              onClick={(event) => setFormatAnchor(event.currentTarget)}
              size="small"
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Menu
          anchorEl={formatAnchor}
          id="translation-format-menu"
          onClose={() => setFormatAnchor(null)}
          open={Boolean(formatAnchor)}
        >
          {formatItems.map((item) => (
            <MenuItem
              key={item.command}
              onClick={() => {
                applyFormat(item.command);
                setFormatAnchor(null);
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
              <Typography color="text.secondary" sx={{ ml: 3 }} variant="caption">
                {item.shortcut}
              </Typography>
            </MenuItem>
          ))}
        </Menu>

        <Dialog
          fullWidth
          maxWidth="xs"
          onClose={() => {
            setLinkDialogOpen(false);
            savedRangeRef.current = null;
          }}
          open={linkDialogOpen}
        >
          <DialogTitle>{t('LW.translationPane.linkDialogTitle')}</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              fullWidth
              label={t('LW.translationPane.linkTargetLabel')}
              margin="dense"
              onChange={(event) => setLinkUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  applyLink();
                }
              }}
              placeholder={t('LW.translationPane.linkUrlPlaceholder')}
              size="small"
              value={linkUrl}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setLinkDialogOpen(false);
                savedRangeRef.current = null;
              }}
            >
              {t('LW.commons.cancel')}
            </Button>
            <Button onClick={applyLink} variant="contained">
              {t('LW.commons.update')}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          fullWidth
          maxWidth="xs"
          onClose={() => citationStyleResolveRef.current?.(null)}
          open={citationStylePickerOpen}
        >
          <DialogTitle>{t('LW.translationPane.citationStyleDialogTitle')}</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              fullWidth
              margin="dense"
              onChange={(event) => setPendingCitationStyle(event.target.value)}
              select
              SelectProps={{ native: true }}
              size="small"
              value={pendingCitationStyle}
            >
              {citationStyleChoices.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => citationStyleResolveRef.current?.(null)}>
              {t('LW.commons.cancel')}
            </Button>
            <Button
              onClick={() => citationStyleResolveRef.current?.(pendingCitationStyle)}
              variant="contained"
            >
              {t('LW.translationPane.useStyle')}
            </Button>
          </DialogActions>
        </Dialog>

        <Tooltip title={t('LW.translationPane.previousUnit')}>
          <span>
            <IconButton
              aria-label={t('LW.translationPane.previousUnit')}
              disabled={unitCards.length === 0 || selectedUnitIndex <= 0}
              onClick={() => goToAdjacentUnit(-1)}
              size="small"
            >
              <NavigateBeforeIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title={t('LW.translationPane.nextUnit')}>
          <span>
            <IconButton
              aria-label={t('LW.translationPane.nextUnit')}
              disabled={
                unitCards.length === 0 ||
                selectedUnitIndex < 0 ||
                selectedUnitIndex >= unitCards.length - 1
              }
              onClick={() => goToAdjacentUnit(1)}
              size="small"
            >
              <NavigateNextIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Typography
          color="text.secondary"
          noWrap
          variant="caption"
          sx={{ flex: 1, minWidth: 0, textAlign: 'right' }}
        >
          {selectedUnitId
            ? selectedUnitIndex >= 0
              ? t('LW.translationPane.unitPosition', {
                  current: selectedUnitIndex + 1,
                  total: unitCards.length,
                })
              : t('LW.translationPane.unitPosition', {
                  current: '?',
                  total: unitCards.length || '?',
                })
            : t('LW.translationPane.noUnit')}
        </Typography>
      </Stack>

      {aiStatus ? (
        <Alert severity={aiStatus.severity} sx={{ borderRadius: 0 }}>
          {aiStatus.message}
        </Alert>
      ) : null}

      {languageToolStatus ? (
        <Alert
          action={
            languageToolMatches.length > 0 ? (
              <Button
                color="inherit"
                onClick={() => {
                  setLanguageToolMatches([]);
                  setLanguageToolSnapshot(null);
                  setLanguageToolStatus(null);
                }}
                size="small"
              >
                {t('LW.translationPane.languageToolCloseResults')}
              </Button>
            ) : undefined
          }
          severity={languageToolStatus.severity}
          sx={{ borderRadius: 0 }}
        >
          {languageToolStatus.message}
        </Alert>
      ) : null}

      {languageToolMatches.length > 0 ? (
        <Box
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            maxHeight: 180,
            overflow: 'auto',
            px: 1,
            py: 0.5,
          }}
        >
          <List dense disablePadding>
            {languageToolMatches.map((match) => (
              <ListItem
                alignItems="flex-start"
                disableGutters
                key={`${match.offset}-${match.length}-${match.ruleId ?? match.message}`}
                sx={{ flexDirection: 'column', py: 0.5 }}
              >
                <Typography variant="body2">{match.message}</Typography>
                <Typography color="text.secondary" variant="caption">
                  “{(languageToolSnapshot ?? '').slice(match.offset, match.offset + match.length)}”
                </Typography>
                <Stack direction="row" flexWrap="wrap" spacing={0.5} sx={{ mt: 0.5 }}>
                  {match.replacements.map((replacement) => (
                    <Chip
                      key={`${match.offset}-${replacement}`}
                      label={replacement === ' ' ? '␣' : replacement || '∅'}
                      onClick={() => void applyLanguageToolReplacement(match, replacement)}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                  <Button
                    onClick={() => dismissLanguageToolMatch(match)}
                    size="small"
                    sx={{ minWidth: 0 }}
                  >
                    {t('LW.translationPane.languageToolDismiss')}
                  </Button>
                </Stack>
              </ListItem>
            ))}
          </List>
        </Box>
      ) : null}

      {unitCards.length > 0 || selectedUnitId ? (
        <Box
          ref={listScrollRef}
          onKeyDown={(event) => {
            if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
            if (event.key === '=' || event.key === '+') translationFontZoom.zoomIn();
            else if (event.key === '-') translationFontZoom.zoomOut();
            else if (event.key === '0') translationFontZoom.reset();
            else return;
            event.preventDefault();
            event.stopPropagation();
          }}
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            fontSize: `${paneFontSize}px`,
          }}
        >
          {caretInUnindexedUnit && !selectedUnitId ? (
            <Alert severity="info" sx={{ borderRadius: 0 }}>
              {t('LW.translationPane.unindexedUnitMessage')}
            </Alert>
          ) : null}
          {(unitCards.length > 0
            ? unitCards
            : selectedUnitId
              ? [{ unitId: selectedUnitId, previewText: '', previewHtml: '', noteCount: 0 }]
              : []
          ).map((card) => {
            const isActive = card.unitId === selectedUnitId;
            const unitBodySx = {
              p: 1.5,
              outline: 'none',
              textAlign: 'justify' as const,
              counterReset: 'footnote',
              '& hi[rend="small-caps"]': { fontVariant: 'small-caps' },
              '& hi[rend="bold"]': { fontWeight: 'bold' },
              '& hi[rend="italic"]': { fontStyle: 'italic' },
              '& hi[rend="underline"]': { textDecoration: 'underline' },
              '& hi[rend="strikethrough"]': { textDecoration: 'line-through' },
              '& ref': { color: 'primary.main', textDecoration: 'underline' },
              '& note': {
                // Wrapper only when structured; flat TEI notes (read-only cards) get a pill via ::after.
                counterIncrement: 'footnote',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                verticalAlign: 'super',
                position: 'relative',
                // Fixed rem box — never grow with hidden/transparent footnote text.
                boxSizing: 'border-box',
                width: '1.15rem',
                height: '1.15rem',
                minWidth: '1.15rem',
                maxWidth: '1.15rem',
                flexShrink: 0,
                mx: '0.15rem',
                p: 0,
                borderRadius: '999px',
                bgcolor: 'primary.main',
                color: 'transparent',
                fontSize: 0,
                lineHeight: 0,
                overflow: 'hidden',
                cursor: 'default',
                userSelect: 'none',
                whiteSpace: 'nowrap',
                [`& [${FN_MARK_ATTR}]`]: {
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                  width: '1.15rem',
                  height: '1.15rem',
                  minWidth: '1.15rem',
                  maxWidth: '1.15rem',
                  flexShrink: 0,
                  p: 0,
                  borderRadius: '999px',
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  lineHeight: 1,
                  overflow: 'hidden',
                },
                [`& [${FN_BODY_ATTR}]`]: {
                  display: 'none',
                },
              },
              // Structured notes: the mark span is the pill; clear the wrapper chrome.
              [`& note:has([${FN_MARK_ATTR}])`]: {
                width: 'auto',
                height: 'auto',
                minWidth: 0,
                maxWidth: 'none',
                bgcolor: 'transparent',
                overflow: 'visible',
                color: 'inherit',
                fontSize: 'inherit',
                lineHeight: 'inherit',
              },
              // Flat notes (inactive card HTML from TEI): paint the number with ::after.
              [`& note:not(:has([${FN_MARK_ATTR}]))::after`]: {
                content: 'counter(footnote)',
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'primary.contrastText',
                fontSize: '0.65rem',
                fontWeight: 700,
                lineHeight: 1,
              },
              // Hide raw footnote children inside flat notes.
              [`& note:not(:has([${FN_MARK_ATTR}])) > *`]: {
                display: 'none',
              },
            };
            return (
              <Box
                key={card.unitId}
                data-unit-id={card.unitId}
                data-active={isActive ? 'true' : undefined}
                ref={(el: HTMLDivElement | null) => {
                  if (el) cardNodeRefs.current.set(card.unitId, el);
                  else cardNodeRefs.current.delete(card.unitId);
                }}
                onClick={() => {
                  if (!isActive) void navigateToUnit(card.unitId);
                }}
                sx={{
                  borderBottom: 1,
                  borderColor: 'divider',
                  borderLeft: 3,
                  borderLeftColor: isActive ? 'error.main' : 'transparent',
                  bgcolor: isActive ? 'background.paper' : 'transparent',
                  cursor: isActive ? 'text' : 'pointer',
                  '&:hover': isActive ? undefined : { bgcolor: 'action.hover' },
                }}
              >
                {!isActive ? (
                  card.previewHtml.trim() || card.previewText ? (
                    <Box
                      dangerouslySetInnerHTML={{
                        __html: looksLikeInlineMarkdown(card.previewText)
                          ? applyMarkdownCleanupToFragment(card.previewHtml)
                          : card.previewHtml,
                      }}
                      sx={unitBodySx}
                    />
                  ) : (
                    <Typography
                      color="text.disabled"
                      sx={{ px: 1.5, py: 1.5 }}
                      variant="body2"
                    >
                      {t('LW.translationPane.emptyUnitPreview')}
                    </Typography>
                  )
                ) : (
                  <>
                    <Box sx={{ position: 'relative', flex: '0 0 auto' }}>
          <Box
            ref={editableRef}
            contentEditable={!locked}
            lang={spellcheckLang}
            spellCheck={spellcheckEnabled && !languageToolLive}
            suppressContentEditableWarning
            onBlur={() => {
              void persist();
              dismissEntityAutocomplete();
              blurTimeoutRef.current = setTimeout(() => {
                focusedRef.current = false;
              }, 200);
            }}
            onBeforeInput={protectCitationField}
            onFocus={() => {
              if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
              focusedRef.current = true;
              rememberBodyRange();
            }}
            onInput={() => {
              if (editableRef.current) {
                applyEditorialCleanupToRootPreservingSelection(
                  editableRef.current,
                  selectedLanguage,
                );
              }
              refreshFootnotes();
              rememberBodyRange();
              refreshEntityAutocomplete();
              scheduleLiveLanguageToolCheck();
            }}
            onScroll={() => refreshLanguageToolOverlays(languageToolMatches)}
            onKeyUp={rememberBodyRange}
            onMouseUp={() => {
              rememberBodyRange();
              refreshEntityAutocomplete();
            }}
            onContextMenu={handleEntityFieldContextMenu}
            onKeyDown={(event) => {
              protectCitationField(event);
              if (event.defaultPrevented) return;

              const acCount = entityAcSuggestionsRef.current.length;
              if (acCount > 0) {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  dismissEntityAutocomplete();
                  return;
                }
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setEntityAcIndex((index) => (index + 1) % acCount);
                  return;
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setEntityAcIndex((index) => (index - 1 + acCount) % acCount);
                  return;
                }
                if (event.key === 'Tab' || event.key === 'Enter') {
                  event.preventDefault();
                  void acceptEntityAutocomplete();
                  return;
                }
              }

              if (!(event.metaKey || event.ctrlKey)) return;
              const key = event.key.toLowerCase();
              let command:
                | 'smallCaps'
                | 'superscript'
                | 'subscript'
                | 'removeFormat'
                | 'link'
                | 'footnote'
                | null = null;
              if (event.shiftKey && key === 'k') command = 'smallCaps';
              else if (!event.shiftKey && !event.altKey && key === 'k') command = 'link';
              else if (
                event.altKey &&
                !event.shiftKey &&
                (key === 'f' || key === 'ƒ' || event.code === 'KeyF')
              )
                command = 'footnote';
              else if (key === '.') command = 'superscript';
              else if (key === ',') command = 'subscript';
              else if (key === 'm') command = 'removeFormat';
              if (!command) return;
              event.preventDefault();
              event.stopPropagation();
              applyFormat(command);
            }}
            onPaste={(event) => {
              handleTranslationPaste(event);
              rememberBodyRange();
            }}
            sx={{
              ...unitBodySx,
              flex: '1 0 auto',
              '&:empty::before': {
                content: `"${t('LW.translationPane.startTypingPlaceholder')}"`,
                color: 'text.disabled',
              },
            }}
          />
          <Popover
            anchorReference="anchorPosition"
            anchorPosition={
              entityAcAnchor
                ? { top: entityAcAnchor.top, left: entityAcAnchor.left }
                : undefined
            }
            disableAutoFocus
            disableEnforceFocus
            disableRestoreFocus
            onClose={dismissEntityAutocomplete}
            open={entityAcSuggestions.length > 0 && Boolean(entityAcAnchor)}
            slotProps={{
              paper: {
                sx: { minWidth: 240, maxWidth: 360 },
              },
            }}
            sx={{ pointerEvents: 'none' }}
          >
            <Box sx={{ pointerEvents: 'auto' }}>
              <List dense disablePadding>
                {entityAcSuggestions.map((suggestion, index) => (
                  <ListItemButton
                    key={suggestion.candidate.id}
                    selected={index === entityAcIndex}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => void acceptEntityAutocomplete(index)}
                  >
                    <ListItemText
                      primary={suggestion.candidate.label}
                      secondary={suggestion.candidate.detail}
                    />
                  </ListItemButton>
                ))}
              </List>
              <Typography
                color="text.secondary"
                sx={{ display: 'block', px: 1.5, py: 0.75 }}
                variant="caption"
              >
                {t('LW.translationPane.entityAutocompleteHint')}
              </Typography>
            </Box>
          </Popover>
          {languageToolOverlays.map((rect, index) => (
            <Box
              key={`lt-overlay-${rect.matchIndex}-${index}`}
              onClick={() => {
                const match = languageToolMatches[rect.matchIndex];
                if (!match) return;
                setLanguageToolStatus({
                  severity: 'info',
                  message: match.message,
                });
              }}
              sx={{
                position: 'absolute',
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                bgcolor: 'error.main',
                opacity: 0.85,
                borderRadius: 1,
                pointerEvents: 'auto',
                cursor: 'pointer',
                zIndex: 1,
              }}
              title={languageToolMatches[rect.matchIndex]?.shortMessage}
            />
          ))}
                    </Box>

          {footnotes.length > 0 && (
            <Box sx={{ px: 1.5, pb: 1.5 }}>
              <Divider sx={{ width: 120, mb: 1 }} />
              <Stack spacing={0.5}>
                {footnotes.map((text, index) => (
                  <Stack alignItems="baseline" direction="row" key={index} spacing={1}>
                    <Typography
                      color="text.secondary"
                      sx={{ minWidth: 16, textAlign: 'right', flexShrink: 0 }}
                      variant="caption"
                    >
                      {index + 1}.
                    </Typography>
                    <Box
                      contentEditable
                      data-leaf-footnote-editor={index}
                      dangerouslySetInnerHTML={{ __html: text }}
                      lang={spellcheckLang}
                      spellCheck={spellcheckEnabled && !languageToolLive}
                      onBlur={(event) => {
                        rememberFootnoteRange(index, event.currentTarget);
                        updateFootnote(index, event.currentTarget.innerHTML);
                        void persist();
                      }}
                      onBeforeInput={protectCitationField}
                      onFocus={(event) => rememberFootnoteRange(index, event.currentTarget)}
                      onInput={(event) => {
                        applyEditorialCleanupToRootPreservingSelection(
                          event.currentTarget,
                          selectedLanguage,
                        );
                        prepareAtomicCitationFields(event.currentTarget, zoteroCitationLabel);
                        updateFootnote(index, event.currentTarget.innerHTML);
                        rememberFootnoteRange(index, event.currentTarget);
                      }}
                      onKeyDown={(event) => {
                        protectCitationField(event);
                      }}
                      onKeyUp={(event) => rememberFootnoteRange(index, event.currentTarget)}
                      onMouseUp={(event) => rememberFootnoteRange(index, event.currentTarget)}
                      onContextMenu={handleEntityFieldContextMenu}
                      onPaste={(event) => {
                        handleTranslationPaste(event, { target: 'footnote' });
                        updateFootnote(index, event.currentTarget.innerHTML);
                        rememberFootnoteRange(index, event.currentTarget);
                      }}
                      ref={(el: HTMLDivElement | null) => {
                        if (el) prepareAtomicCitationFields(el, zoteroCitationLabel);
                        if (el && focusFootnoteIndexRef.current === index) {
                          focusFootnoteIndexRef.current = null;
                          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
                          el.focus();
                        }
                      }}
                      suppressContentEditableWarning
                      sx={{
                        flex: 1,
                        fontSize: '0.85em',
                        lineHeight: 1.4,
                        minHeight: 22,
                        outline: 'none',
                        py: 0.25,
                        '&:empty::before': {
                          content: `"${t('LW.translationPane.footnotePlaceholder')}"`,
                          color: 'text.disabled',
                        },
                        '& bibl[data-leaf-citation-field="true"]': {
                          bgcolor: 'action.hover',
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 0.75,
                          cursor: 'default',
                          px: 0.5,
                          userSelect: 'all',
                          whiteSpace: 'break-spaces',
                        },
                        [`& ref[${ENTITY_FIELD_ATTR}="true"]`]: {
                          bgcolor: 'action.hover',
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 0.75,
                          cursor: 'default',
                          px: 0.5,
                          userSelect: 'all',
                          whiteSpace: 'break-spaces',
                        },
                      }}
                    />
                    <Tooltip title={t('LW.translationPane.removeFootnote')}>
                      <IconButton
                        aria-label={t('LW.translationPane.removeFootnote')}
                        onClick={() => removeFootnote(index)}
                        size="small"
                        sx={{ flexShrink: 0, alignSelf: 'center' }}
                      >
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}
                  </>
                )}
              </Box>
            );
          })}
        </Box>
      ) : (
        <Box sx={{ flex: 1, p: 1.5 }}>
          <Typography color="text.secondary" variant="body2">
            {caretInUnindexedUnit
              ? t('LW.translationPane.unindexedUnitMessage')
              : t('LW.translationPane.selectUnitMessage', {
                  unit: alignmentUnit ?? t('LW.translationPane.defaultUnitLabel'),
                })}
          </Typography>
        </Box>
      )}

      {entityFormatEntity ? (
        <EntityDisplayPopup
          anchorPosition={entityFormatAnchor}
          entity={entityFormatEntity}
          lang={selectedLanguage}
          occurrenceIndex={entityFormatOccurrence}
          onChange={(spec) => {
            void applyEntityDisplaySpec(spec);
          }}
          onClose={closeEntityFormatPopup}
          onReset={() => {
            void resetEntityDisplaySpec();
          }}
          open={entityFormatOpen}
          spec={entityFormatSpec}
        />
      ) : null}
    </Box>
  );
};

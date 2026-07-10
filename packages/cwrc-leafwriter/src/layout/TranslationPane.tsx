import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
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
import StickyNote2Icon from '@mui/icons-material/StickyNote2';
import SubscriptIcon from '@mui/icons-material/Subscript';
import SuperscriptIcon from '@mui/icons-material/Superscript';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { copyUnitsForExport } from '../js/conversion/copyForExport';
import { translationFontZoom } from '../js/fontSizeZoom';
import { useActions, useAppState } from '../overmind';
import { isMacOS } from '../utils/platform';

const TEI_NS = 'http://www.tei-c.org/ns/1.0';
const DEFAULT_CITATION_STYLE_ID = 'chicago-note-bibliography';

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

/** Looks up the tagger's schema id attribute name (xml:id or id), matching attributeIdHelpers.ts. */
const getSchemaIdAttributeName = (): string =>
  window.writer?.schemaManager?.getIdName?.() ?? 'xml:id';

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
};

const stripInvisibleCaretSpacers = (root: ParentNode): void => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const textNode = node as Text;
    if (textNode.textContent?.includes('\uFEFF')) textNodes.push(textNode);
  }

  for (const textNode of textNodes) {
    textNode.textContent = textNode.textContent?.replace(/\uFEFF/g, '') ?? '';
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
          attrName !== 'data-locator-type')
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
  const [locked, setLocked] = useState(false);
  const [formatAnchor, setFormatAnchor] = useState<HTMLElement | null>(null);
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
    setUnitHtml(unit?.innerHTML ?? '');
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
    const notes = Array.from(editable.querySelectorAll('note'));
    for (const note of notes) {
      note.setAttribute('contenteditable', 'false');
      prepareAtomicCitationFields(note, zoteroCitationLabel);
    }
    setFootnotes(notes.map((note) => note.innerHTML));
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
    if (editableRef.current && editableRef.current.innerHTML !== unitHtml) {
      editableRef.current.innerHTML = unitHtml;
    }
    refreshFootnotes();

    const pending = pendingHighlightRef.current;
    if (pending && selectedUnitId === pending.unitId && editableRef.current) {
      if (selectHighlightedMatch(editableRef.current, pending.text, pending.offset)) {
        pendingHighlightRef.current = null;
      }
    }
  }, [unitHtml, selectedUnitId, refreshFootnotes]);

  const persist = useCallback(async () => {
    const doc = docRef.current;
    if (!doc || !alignmentUnit || !sourcePath || !selectedUnitId || !translationPath) return;

    const unit = findUnitByCorrespId(doc, alignmentUnit, fileNameOf(sourcePath), selectedUnitId);
    if (!unit || !editableRef.current) return;

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
    stripInvisibleCaretSpacers(clone);
    unit.innerHTML = clone.innerHTML;
    getCitationBridge()?.garbageCollectBibl(doc);
    const nextXml = new XMLSerializer().serializeToString(doc);
    await getDesktopApi()?.writeFile?.(translationPath, nextXml);
  }, [alignmentUnit, sourcePath, selectedUnitId, translationPath]);

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

      const replaceResult = await replaceCurrentUnit(validated.xml);
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

    const note = document.createElement('note');
    note.setAttribute('place', 'foot');
    note.setAttribute('contenteditable', 'false');
    // A selection becomes the footnote text, like Word's "insert from selection".
    if (!range.collapsed) note.appendChild(range.extractContents());
    range.insertNode(note);

    // Leave the caret right after the new anchor.
    const selection = window.getSelection();
    const after = document.createRange();
    after.setStartAfter(note);
    after.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(after);

    // Give the browser a real text node to anchor the next keystroke outside the note.
    note.after(document.createTextNode('\uFEFF'));
    const spacer = note.nextSibling;
    if (spacer?.nodeType === Node.TEXT_NODE) {
      const spacerRange = document.createRange();
      spacerRange.setStartAfter(spacer);
      spacerRange.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(spacerRange);
    }

    // Focus the new footnote's text field so the user can type its content.
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
    refreshFootnotes();
  };

  const protectCitationField = (event: SyntheticEvent<HTMLElement>) => {
    const target = event.target as Node | null;
    const element =
      target?.nodeType === Node.ELEMENT_NODE ? (target as Element) : target?.parentElement;
    if (element?.closest?.('bibl[data-leaf-citation-field="true"]')) {
      event.preventDefault();
    }
  };

  const updateFootnote = (index: number, html: string) => {
    const note = editableRef.current?.querySelectorAll('note')[index];
    if (note) {
      note.innerHTML = html;
      prepareAtomicCitationFields(note, zoteroCitationLabel);
    }
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
  const selectedLanguage = languageState?.selectedLang || translationMode.lang || '';
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

        <Typography
          color="text.secondary"
          noWrap
          variant="caption"
          sx={{ flex: 1, minWidth: 0, textAlign: 'right' }}
        >
          {selectedUnitId ? selectedUnitId : t('LW.translationPane.noUnit')}
        </Typography>
      </Stack>

      {aiStatus ? (
        <Alert severity={aiStatus.severity} sx={{ borderRadius: 0 }}>
          {aiStatus.message}
        </Alert>
      ) : null}

      {selectedUnitId ? (
        <Box
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
            display: 'flex',
            flexDirection: 'column',
            fontSize: `${paneFontSize}px`,
          }}
        >
          <Box
            ref={editableRef}
            contentEditable
            suppressContentEditableWarning
            onBlur={() => {
              void persist();
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
              refreshFootnotes();
              rememberBodyRange();
            }}
            onKeyUp={rememberBodyRange}
            onMouseUp={rememberBodyRange}
            onKeyDown={(event) => {
              protectCitationField(event);
              if (event.defaultPrevented) return;
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
              // With Alt held, macOS reports the Option-layer character in `key`
              // (Option+F = 'ƒ' on any layout, since the Option layer follows the
              // logical letter). Match it too, plus a physical-key fallback.
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
              flex: '1 0 auto',
              p: 1.5,
              outline: 'none',
              textAlign: 'justify',
              counterReset: 'footnote',
              // <hi> is a TEI element unknown to HTML, so its rend values need
              // explicit styling to be visible while editing.
              '& hi[rend="small-caps"]': { fontVariant: 'small-caps' },
              '& hi[rend="bold"]': { fontWeight: 'bold' },
              '& hi[rend="italic"]': { fontStyle: 'italic' },
              '& hi[rend="underline"]': { textDecoration: 'underline' },
              '& hi[rend="strikethrough"]': { textDecoration: 'line-through' },
              '& ref': { color: 'primary.main', textDecoration: 'underline' },
              // Footnotes render as numbered superscript anchors; their text is
              // collapsed here and edited in the numbered list below the text.
              '& note': {
                counterIncrement: 'footnote',
                display: 'inline-block',
                fontSize: '0px',
                position: 'relative',
                userSelect: 'none',
                width: 0,
              },
              '& note::after': {
                content: 'counter(footnote)',
                fontSize: '0.7rem',
                lineHeight: 0,
                // vertical-align: super is relative to the parent's font metrics,
                // which are 0px here (the note text is collapsed) — raise manually.
                position: 'absolute',
                left: 0,
                top: '-0.5em',
                fontWeight: 600,
                color: 'primary.main',
                px: '1px',
              },
              '&:empty::before': {
                content: `"${t('LW.translationPane.startTypingPlaceholder')}"`,
                color: 'text.disabled',
              },
            }}
          />

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
                      onBlur={(event) => {
                        rememberFootnoteRange(index, event.currentTarget);
                        updateFootnote(index, event.currentTarget.innerHTML);
                        void persist();
                      }}
                      onBeforeInput={protectCitationField}
                      onFocus={(event) => rememberFootnoteRange(index, event.currentTarget)}
                      onInput={(event) => {
                        prepareAtomicCitationFields(event.currentTarget, zoteroCitationLabel);
                        updateFootnote(index, event.currentTarget.innerHTML);
                        rememberFootnoteRange(index, event.currentTarget);
                      }}
                      onKeyDown={(event) => {
                        protectCitationField(event);
                      }}
                      onKeyUp={(event) => rememberFootnoteRange(index, event.currentTarget)}
                      onMouseUp={(event) => rememberFootnoteRange(index, event.currentTarget)}
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
                        // em, not rem — footnotes scale with the pane's text zoom.
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
    </Box>
  );
};

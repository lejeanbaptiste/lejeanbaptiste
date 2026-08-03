import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import LinkIcon from '@mui/icons-material/Link';
import StickyNote2Icon from '@mui/icons-material/StickyNote2';
import {
  Box,
  Divider,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { EntityStore } from '../../../../../packages/cwrc-leafwriter/src/autoTagging/entityStore';
import { installCitationBridge } from '../citations/citationBridge';

interface LanguageState {
  indexing: boolean;
  languages: Array<{ code: string; label: string }>;
  selectedLang: string;
  setSelectedLang: (lang: string) => void;
}

interface CitationPick {
  uri: string;
  csl: Record<string, unknown>;
  locator?: string;
  label?: string;
  prefix?: string;
  suffix?: string;
}

interface CitationBridge {
  pickZoteroCitation: () => Promise<
    { ok: true; picks: CitationPick[] } | { ok: false; error?: string }
  >;
  upsertBiblEntry: (doc: Document, item: Record<string, unknown>, uri: string) => string;
  renderCitation: (options: {
    item: Record<string, unknown>;
    lang?: string;
    locator?: string;
    locatorType?: string;
  }) => string;
}

const languageState = (): LanguageState | null =>
  (window as Window & { __desktopTranslationLanguageState?: LanguageState })
    .__desktopTranslationLanguageState ?? null;

const citationBridge = (): CitationBridge | null =>
  (window as Window & { __desktopCitationBridge?: CitationBridge }).__desktopCitationBridge ?? null;

const emptyNoteDocument = (): Document => document.implementation.createDocument(null, 'div');

const parseNoteDocument = (xml: string | null): Document => {
  if (!xml) return emptyNoteDocument();
  const parsed = new DOMParser().parseFromString(xml, 'application/xml');
  return parsed.documentElement?.localName === 'parsererror' ? emptyNoteDocument() : parsed;
};

const noteBody = (doc: Document): Element => {
  const existing = doc.documentElement.querySelector('note[type="body"]');
  if (existing) return existing;
  const body = doc.createElement('note');
  body.setAttribute('type', 'body');
  doc.documentElement.insertBefore(body, doc.documentElement.firstChild);
  return body;
};

const prepareCitations = (root: ParentNode): void => {
  for (const bibl of Array.from(root.querySelectorAll('bibl[type="zotero-ref"]'))) {
    bibl.setAttribute('contenteditable', 'false');
    bibl.setAttribute('data-leaf-citation-field', 'true');
    bibl.setAttribute('title', 'Zotero citation');
  }
};

const serializeCurrentNote = (
  editor: HTMLDivElement,
  doc: Document,
  language: string,
): string => {
  const body = noteBody(doc);
  body.setAttribute('xml:lang', language);
  body.innerHTML = editor.innerHTML;
  prepareCitations(body);
  return new XMLSerializer().serializeToString(doc.documentElement);
};

export const EntityNoteEditor = ({
  store,
  entityId,
}: {
  store: EntityStore | null;
  entityId: string | null;
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const noteDocRef = useRef<Document>(emptyNoteDocument());
  const rangeRef = useRef<Range | null>(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const loadedEntityIdRef = useRef<string | null>(null);
  const entityIdRef = useRef(entityId);
  const languageRef = useRef('');
  const saveGenerationRef = useRef(0);
  const [language, setLanguage] = useState(() => languageState()?.selectedLang ?? '');
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  entityIdRef.current = entityId;
  languageRef.current = language;
  dirtyRef.current = dirty;

  useEffect(() => installCitationBridge(), []);

  useEffect(() => {
    const sync = () => setLanguage(languageState()?.selectedLang ?? '');
    window.addEventListener('desktop:translation-language-state-changed', sync);
    sync();
    return () => window.removeEventListener('desktop:translation-language-state-changed', sync);
  }, []);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setDirty(true);
    setMessage(null);
  }, []);

  const save = useCallback(
    async (reason: 'autosave' | 'flush' = 'autosave') => {
      const targetId = entityIdRef.current;
      if (!store || !targetId || !editorRef.current || loading) return false;
      if (!dirtyRef.current) return true;
      if (savingRef.current && reason === 'autosave') return false;

      savingRef.current = true;
      setSaving(true);
      const generation = ++saveGenerationRef.current;
      try {
        const xml = serializeCurrentNote(
          editorRef.current,
          noteDocRef.current,
          languageRef.current,
        );
        await store.sqliteSetNote(targetId, xml);
        // Ignore stale completions after a newer save or entity switch.
        if (generation !== saveGenerationRef.current || entityIdRef.current !== targetId) {
          return false;
        }
        dirtyRef.current = false;
        setDirty(false);
        setMessage('Autosaved');
        return true;
      } catch (error) {
        if (generation === saveGenerationRef.current) {
          setMessage(error instanceof Error ? error.message : String(error));
        }
        return false;
      } finally {
        if (generation === saveGenerationRef.current) {
          savingRef.current = false;
          setSaving(false);
        }
      }
    },
    [loading, store],
  );

  // Debounced autosave while editing.
  useEffect(() => {
    if (!dirty || loading || !store || !entityId) return;
    const timer = window.setTimeout(() => {
      void save('autosave');
    }, 900);
    return () => window.clearTimeout(timer);
  }, [dirty, entityId, loading, save, store]);

  useEffect(() => {
    let cancelled = false;
    const previousId = loadedEntityIdRef.current;

    setMessage(null);
    saveGenerationRef.current += 1;

    if (!store || !entityId) {
      if (dirtyRef.current && store && previousId && editorRef.current) {
        void store.sqliteSetNote(
          previousId,
          serializeCurrentNote(editorRef.current, noteDocRef.current, languageRef.current),
        );
      }
      dirtyRef.current = false;
      setDirty(false);
      loadedEntityIdRef.current = null;
      if (editorRef.current) editorRef.current.innerHTML = '';
      return;
    }

    setLoading(true);
    void (async () => {
      if (dirtyRef.current && previousId && previousId !== entityId && editorRef.current) {
        try {
          await store.sqliteSetNote(
            previousId,
            serializeCurrentNote(editorRef.current, noteDocRef.current, languageRef.current),
          );
        } catch {
          // Keep the editor usable; the next autosave/manual save will surface errors.
        }
      }
      if (cancelled) return;

      dirtyRef.current = false;
      setDirty(false);

      try {
        const xml = await store.sqliteGetNote(entityId);
        if (cancelled) return;
        const doc = parseNoteDocument(xml);
        noteDocRef.current = doc;
        const body = noteBody(doc);
        if (body.getAttribute('xml:lang')) setLanguage(body.getAttribute('xml:lang') ?? '');
        if (editorRef.current) editorRef.current.innerHTML = body.innerHTML;
        prepareCitations(editorRef.current ?? body);
        loadedEntityIdRef.current = entityId;
      } catch (error: unknown) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : String(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entityId, store]);

  // Flush on unmount if still dirty.
  useEffect(() => {
    return () => {
      if (!dirtyRef.current || !store || !loadedEntityIdRef.current || !editorRef.current) return;
      void store.sqliteSetNote(
        loadedEntityIdRef.current,
        serializeCurrentNote(editorRef.current, noteDocRef.current, languageRef.current),
      );
    };
  }, [store]);

  const rememberRange = useCallback(() => {
    const selection = window.getSelection();
    if (selection?.rangeCount) rangeRef.current = selection.getRangeAt(0).cloneRange();
  }, []);

  const format = (command: string) => {
    editorRef.current?.focus();
    document.execCommand(command);
    markDirty();
  };

  const insertFootnote = () => {
    editorRef.current?.focus();
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const note = document.createElement('note');
    note.setAttribute('place', 'foot');
    note.textContent = 'Footnote';
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(note);
    selection.collapseToEnd();
    markDirty();
  };

  const insertLink = () => {
    const url = window.prompt('Link URL');
    if (!url) return;
    editorRef.current?.focus();
    document.execCommand('createLink', false, url);
    markDirty();
  };

  const insertCitation = async () => {
    const bridge = citationBridge();
    if (!bridge || !editorRef.current) return;
    rememberRange();
    const result = await bridge.pickZoteroCitation();
    if (!result.ok || result.picks.length === 0) return;
    const doc = noteDocRef.current;
    const fragment = document.createDocumentFragment();
    result.picks.forEach((pick, index) => {
      const id = bridge.upsertBiblEntry(doc, pick.csl, pick.uri);
      const bibl = document.createElement('bibl');
      bibl.setAttribute('type', 'zotero-ref');
      bibl.setAttribute('corresp', `#${id}`);
      bibl.setAttribute('contenteditable', 'false');
      bibl.setAttribute('data-leaf-citation-field', 'true');
      bibl.setAttribute('title', 'Zotero citation');
      if (pick.locator) bibl.setAttribute('data-locator', pick.locator);
      if (pick.label) bibl.setAttribute('data-locator-type', pick.label);
      bibl.innerHTML = bridge.renderCitation({
        item: pick.csl,
        lang: language || undefined,
        locator: pick.locator,
        locatorType: pick.label,
      });
      if (index > 0) fragment.appendChild(document.createTextNode('; '));
      fragment.appendChild(bibl);
    });
    const range = rangeRef.current;
    if (range) {
      range.deleteContents();
      range.insertNode(fragment);
      range.collapse(false);
    } else {
      editorRef.current.appendChild(fragment);
    }
    markDirty();
  };

  if (!entityId) {
    return <Typography color="text.secondary">Select an entity to edit its notes.</Typography>;
  }

  const languages = languageState()?.languages ?? [];
  const statusColor =
    message && message !== 'Autosaved'
      ? 'error'
      : dirty
        ? 'warning.main'
        : 'text.secondary';
  const statusText = saving
    ? 'Saving…'
    : dirty
      ? 'Unsaved…'
      : message ?? null;

  return (
    <Stack spacing={1} sx={{ height: '100%', minHeight: 0 }}>
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
        {languages.length > 0 ? (
          <Select
            size="small"
            value={language || languages[0]?.code || ''}
            disabled={languageState()?.indexing}
            onChange={(event) => {
              const next = String(event.target.value);
              setLanguage(next);
              languageState()?.setSelectedLang(next);
              markDirty();
            }}
            sx={{ minWidth: 84 }}
          >
            {languages.map((item) => (
              <MenuItem key={item.code} value={item.code}>
                {item.code}
              </MenuItem>
            ))}
          </Select>
        ) : (
          <TextField
            size="small"
            label="Language"
            value={language}
            onChange={(event) => {
              setLanguage(event.target.value);
              markDirty();
            }}
            sx={{ width: 110 }}
          />
        )}
        <Tooltip title="Bold">
          <IconButton size="small" onClick={() => format('bold')}>
            <FormatBoldIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Italic">
          <IconButton size="small" onClick={() => format('italic')}>
            <FormatItalicIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Insert footnote">
          <IconButton size="small" onClick={insertFootnote}>
            <StickyNote2Icon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Insert Zotero citation">
          <IconButton size="small" onClick={() => void insertCitation()}>
            <FormatQuoteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Insert link">
          <IconButton size="small" onClick={insertLink}>
            <LinkIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        {statusText && (
          <Typography variant="caption" color={statusColor}>
            {statusText}
          </Typography>
        )}
      </Stack>
      <Divider />
      <Box
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        lang={language || undefined}
        onInput={() => markDirty()}
        onBlur={() => {
          if (dirtyRef.current) void save('flush');
        }}
        onKeyUp={rememberRange}
        onMouseUp={rememberRange}
        sx={{
          flex: 1,
          minHeight: 160,
          overflow: 'auto',
          p: 1,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          '&:focus': { outline: '2px solid', outlineColor: 'primary.main' },
          '& bibl[data-leaf-citation-field="true"]': {
            bgcolor: 'action.hover',
            borderRadius: 0.5,
            px: 0.25,
          },
          '& note[place="foot"]': {
            display: 'inline',
            color: 'text.secondary',
            fontSize: '0.85em',
          },
        }}
      />
    </Stack>
  );
};

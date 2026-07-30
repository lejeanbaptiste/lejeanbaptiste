/**
 * Wires the noble-title span parser/applier to the live editor selection —
 * the "Tag noble title…" menu action.
 */

import { applyNobleTitleSpanToEditor } from './nobleTitleSpanEditorApply';
import { buildNobleTitleVocabulary, type NobleTitleVocabulary } from './nobleTitleSpanParser';
import { iterateAuthorityNdjson } from './packLoader';
import { cachedPackReader } from '../services/authority-pack-lookup';

let cachedVocabulary: NobleTitleVocabulary | null = null;

/** Reset the cached vocabulary — call after the Norbert pack is (re)installed. */
export function clearNobleTitleVocabularyCache(): void {
  cachedVocabulary = null;
}

async function getVocabulary(): Promise<NobleTitleVocabulary> {
  if (cachedVocabulary) return cachedVocabulary;
  const readPack = cachedPackReader();
  if (!readPack) return buildNobleTitleVocabulary(); // seed ranks/dynasties only
  try {
    const content = await readPack('norbert-wiki-nt');
    cachedVocabulary = buildNobleTitleVocabulary(iterateAuthorityNdjson(content));
  } catch {
    cachedVocabulary = buildNobleTitleVocabulary();
  }
  return cachedVocabulary;
}

/**
 * Parse the current editor selection as a noble title and, if recognised,
 * tag it — via `tagger.addStructureTag`, so the result lands in the
 * document's undo history like any other tag (Ctrl+Z reverts it).
 */
export async function applyNobleTitleForSelection(): Promise<void> {
  const writer = window.writer;
  const editor = writer?.editor;
  const dialogManager = writer?.dialogManager;
  if (!writer || !editor || !dialogManager) return;

  //@ts-ignore — TinyMCE's real getRng(normalized?: boolean) isn't in this codebase's Editor type (see tagger.ts).
  const range: Range | undefined = editor.selection?.getRng(true);
  if (!range || range.collapsed) {
    dialogManager.show('message', {
      title: 'Norbert',
      msg: 'Select some text before tagging a noble title.',
      type: 'error',
    });
    return;
  }

  const vocabulary = await getVocabulary();
  const result = applyNobleTitleSpanToEditor(writer, range, vocabulary);

  if (!result.applied) {
    dialogManager.show('message', {
      title: 'Norbert — no noble title recognised',
      msg:
        result.conflicts.join('\n') ||
        'The selection does not contain a recognised noble-title rank.',
      type: 'error',
    });
    return;
  }

  if (result.conflicts.length > 0) {
    dialogManager.show('message', {
      title: 'Norbert — noble title tagged, with a note',
      msg: result.conflicts.join('\n'),
      type: 'warning',
    });
  }
}

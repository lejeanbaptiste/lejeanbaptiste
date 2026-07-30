/**
 * Wires the "Group and clean" cleanup pass to the Norbert toolbar menu.
 *
 * Unlike "Tag noble title…" (which commits through TinyMCE's
 * `tagger.addStructureTag`), this operates on the plain XML `Document` via
 * `AutoTaggingSession` — the same document model the auto-tagging review
 * pane's suggestion-apply/wrapper-concatenation passes use — and persists
 * the result by reloading the editor from the mutated document.
 */

import { AutoTaggingSession } from './integration';
import { cachedPackReader } from '../services/authority-pack-lookup';

/** Run Group and clean over the whole document and report the outcome. */
export async function applyGroupAndClean(): Promise<void> {
  const writer = window.writer;
  const dialogManager = writer?.dialogManager;
  if (!writer || !dialogManager) return;

  const readPack = cachedPackReader();
  if (!readPack) {
    dialogManager.show('message', {
      title: 'Norbert',
      msg: 'Norbert packs are not installed — nothing to group and clean.',
      type: 'error',
    });
    return;
  }

  try {
    const session = new AutoTaggingSession(writer);
    const result = await session.runGroupAndClean(readPack);

    const parts: string[] = [];
    if (result.mergedRoleNames > 0) {
      parts.push(`${result.mergedRoleNames} roleName merge${result.mergedRoleNames === 1 ? '' : 's'}`);
    }
    if (result.rolledPlaceNames > 0) {
      parts.push(
        `${result.rolledPlaceNames} placeName roll-in${result.rolledPlaceNames === 1 ? '' : 's'}`,
      );
    }
    if (result.parsedNobleTitles > 0) {
      parts.push(
        `${result.parsedNobleTitles} nobleTitle${result.parsedNobleTitles === 1 ? '' : 's'} parsed`,
      );
    }
    if (result.createdWrappers > 0) {
      parts.push(
        `${result.createdWrappers} person wrapper${result.createdWrappers === 1 ? '' : 's'} created`,
      );
    }
    if (result.assignedKeys > 0) {
      parts.push(`${result.assignedKeys} key${result.assignedKeys === 1 ? '' : 's'} assigned`);
    }

    const summary = parts.length > 0 ? parts.join(', ') : 'nothing to do';
    const validationNote =
      result.validation.errors.length > 0
        ? `\n\nPerson-wrapper validation:\n${result.validation.errors.slice(0, 5).join('\n')}`
        : '';

    dialogManager.show('message', {
      title: 'Norbert — Group and clean',
      msg: `${summary}.${validationNote}`,
      type: result.validation.errors.length > 0 ? 'warning' : 'info',
    });
  } catch (error) {
    dialogManager.show('message', {
      title: 'Norbert — Group and clean failed',
      msg: error instanceof Error ? error.message : String(error),
      type: 'error',
    });
  }
}

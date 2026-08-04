import { getInnermostOpenTagName } from './closingTagParser';

export interface ClosingTagAutoInsert {
  /** Text to insert at the cursor (after `</`). */
  insertText: string;
  /** Where the cursor should land after the insert (absolute offset). */
  cursorOffset: number;
}

/**
 * After the user types `/` so the text before the cursor ends in `</`, compute
 * the Oxygen-style auto-insert: the innermost still-open tag name, plus `>` if
 * a closing bracket is not already waiting after the cursor (Monaco angle-bracket
 * auto-close often leaves `</|>`).
 *
 * Returns null when there is nothing to insert (no `</`, no open tag, or a name
 * has already been started).
 */
export const getClosingTagAutoInsert = (
  content: string,
  offset: number,
): ClosingTagAutoInsert | null => {
  if (offset < 2) return null;
  if (content.slice(offset - 2, offset) !== '</') return null;

  // Already typing a name or attributes — don't stomp on the user.
  const next = content[offset];
  if (next && /[\w:.-]/.test(next)) return null;

  const tagName = getInnermostOpenTagName(content, offset);
  if (!tagName) return null;

  if (next === '>') {
    return {
      insertText: tagName,
      cursorOffset: offset + tagName.length + 1,
    };
  }

  return {
    insertText: `${tagName}>`,
    cursorOffset: offset + tagName.length + 1,
  };
};

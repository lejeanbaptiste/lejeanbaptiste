interface OpenTag {
  name: string;
  start: number;
}

export interface TagNameRange {
  start: number;
  end: number;
}

interface StackEntry {
  name: string;
  openNameStart: number;
  openNameEnd: number;
}

interface UnwrapStackEntry extends StackEntry {
  openTagStart: number;
  openTagEnd: number;
}

export interface TagDelimiterRange {
  start: number;
  end: number;
}

export interface UnwrapTagPair {
  openDelimiter: TagDelimiterRange;
  closeDelimiter: TagDelimiterRange;
  openName: TagNameRange;
  closeName: TagNameRange;
}

export interface TextDeleteRange {
  start: number;
  end: number;
}

const TAG_NAME_PATTERN = /^([\w:.-]+)/;

const parseOpeningTagName = (
  tagStart: number,
  inner: string,
): { name: string; nameStart: number; nameEnd: number } | null => {
  const nameMatch = inner.match(TAG_NAME_PATTERN);
  if (!nameMatch) return null;

  const name = nameMatch[1];
  const nameStart = tagStart + 1;
  return { name, nameStart, nameEnd: nameStart + name.length };
};

const parseClosingTagName = (
  tagStart: number,
  inner: string,
): { name: string; nameStart: number; nameEnd: number } | null => {
  const slashIndex = inner.indexOf('/');
  if (slashIndex === -1) return null;

  const afterSlash = inner.slice(slashIndex + 1);
  const nameMatch = afterSlash.match(/^\s*([\w:.-]+)/);
  if (!nameMatch) return null;

  const name = nameMatch[1];
  const leadingWhitespace = afterSlash.length - afterSlash.trimStart().length;
  const nameStart = tagStart + 1 + slashIndex + 1 + leadingWhitespace;
  return { name, nameStart, nameEnd: nameStart + name.length };
};

const offsetInTagName = (offset: number, nameStart: number, nameEndExclusive: number) =>
  offset >= nameStart && offset <= nameEndExclusive;

const isIgnorableTagInner = (inner: string) =>
  inner.startsWith('?') || inner.startsWith('!--') || inner.startsWith('!');

/** Find the closing `>` of a tag without crossing a nested `<`. */
const findTagEnd = (content: string, tagStart: number): number | null => {
  for (let i = tagStart + 1; i < content.length; i += 1) {
    const ch = content[i];
    if (ch === '>') return i;
    if (ch === '<') return null;
  }
  return null;
};

const getTagNameText = (content: string, range: TagNameRange) =>
  content.slice(range.start, range.end);

/** Allow rename-in-progress when one tag name is a prefix of the other. */
export const tagsAreLinkedRenameCandidates = (openName: string, closeName: string) =>
  openName === closeName ||
  openName.startsWith(closeName) ||
  closeName.startsWith(openName);

const canLinkTagNames = (content: string, openName: TagNameRange, closeName: TagNameRange) =>
  tagsAreLinkedRenameCandidates(
    getTagNameText(content, openName),
    getTagNameText(content, closeName),
  );

const canUnwrapTagNames = (content: string, openName: TagNameRange, closeName: TagNameRange) =>
  getTagNameText(content, openName) === getTagNameText(content, closeName);

const offsetInDelimiter = (offset: number, delimiterStart: number, tagEnd: number) =>
  offset >= delimiterStart && offset <= tagEnd;

const buildUnwrapPair = (
  content: string,
  open: UnwrapStackEntry,
  openTagStart: number,
  openTagEnd: number,
  closeTagStart: number,
  closeTagEnd: number,
  closeName: TagNameRange,
): UnwrapTagPair | null => {
  const openName = { start: open.openNameStart, end: open.openNameEnd };
  if (!canUnwrapTagNames(content, openName, closeName)) return null;

  return {
    openDelimiter: { start: openTagStart, end: openTagEnd },
    closeDelimiter: { start: closeTagStart, end: closeTagEnd },
    openName,
    closeName,
  };
};

const findStructuralCloseDelimiter = (
  content: string,
  fromOffset: number,
): { delimiter: TagDelimiterRange; name: TagNameRange } | null => {
  let depth = 1;
  let i = fromOffset;

  while (i < content.length) {
    if (content[i] !== '<') {
      i += 1;
      continue;
    }

    const tagStart = i;
    const tagEnd = findTagEnd(content, tagStart);
    if (tagEnd === null) {
      i += 1;
      continue;
    }

    const inner = content.slice(i + 1, tagEnd);

    if (inner.startsWith('![CDATA[')) {
      const cdataEnd = content.indexOf(']]>', i);
      i = cdataEnd === -1 ? content.length : cdataEnd + 3;
      continue;
    }

    if (isIgnorableTagInner(inner)) {
      i = tagEnd + 1;
      continue;
    }

    if (inner.startsWith('/')) {
      depth -= 1;
      if (depth === 0) {
        const closing = parseClosingTagName(tagStart, inner);
        if (!closing) return null;
        return {
          delimiter: { start: tagStart, end: tagEnd + 1 },
          name: { start: closing.nameStart, end: closing.nameEnd },
        };
      }
    } else {
      const selfClosing = inner.trimEnd().endsWith('/');
      if (!selfClosing && parseOpeningTagName(tagStart, inner)) {
        depth += 1;
      }
    }

    i = tagEnd + 1;
  }

  return null;
};

/** Return paired tag delimiters when the cursor is inside either full delimiter. */
export const findUnwrapTagPair = (content: string, offset: number): UnwrapTagPair | null => {
  if (offset < 0 || offset > content.length) return null;

  const stack: UnwrapStackEntry[] = [];
  let i = 0;

  while (i < content.length) {
    if (content[i] !== '<') {
      i += 1;
      continue;
    }

    const tagStart = i;
    const tagEnd = findTagEnd(content, tagStart);
    if (tagEnd === null) {
      i += 1;
      continue;
    }

    const inner = content.slice(i + 1, tagEnd);

    if (inner.startsWith('![CDATA[')) {
      const cdataEnd = content.indexOf(']]>', i);
      i = cdataEnd === -1 ? content.length : cdataEnd + 3;
      continue;
    }

    if (isIgnorableTagInner(inner)) {
      i = tagEnd + 1;
      continue;
    }

    if (inner.startsWith('/')) {
      const closing = parseClosingTagName(tagStart, inner);
      if (closing && stack.length > 0) {
        const open = stack[stack.length - 1]!;
        const closeName = { start: closing.nameStart, end: closing.nameEnd };

        if (offsetInDelimiter(offset, tagStart, tagEnd)) {
          const pair = buildUnwrapPair(
            content,
            open,
            open.openTagStart,
            open.openTagEnd,
            tagStart,
            tagEnd + 1,
            closeName,
          );
          if (pair) return pair;
        }

        stack.pop();
      }
      i = tagEnd + 1;
      continue;
    }

    const selfClosing = inner.trimEnd().endsWith('/');
    const opening = parseOpeningTagName(tagStart, inner);
    if (opening) {
      if (!selfClosing && offsetInDelimiter(offset, tagStart, tagEnd)) {
        const close = findStructuralCloseDelimiter(content, tagEnd + 1);
        if (close) {
          const pair = buildUnwrapPair(
            content,
            {
              name: opening.name,
              openTagStart: tagStart,
              openTagEnd: tagEnd + 1,
              openNameStart: opening.nameStart,
              openNameEnd: opening.nameEnd,
            },
            tagStart,
            tagEnd + 1,
            close.delimiter.start,
            close.delimiter.end,
            close.name,
          );
          if (pair) return pair;
        }
      }

      if (!selfClosing) {
        stack.push({
          name: opening.name,
          openTagStart: tagStart,
          openTagEnd: tagEnd + 1,
          openNameStart: opening.nameStart,
          openNameEnd: opening.nameEnd,
        });
      }
    }

    i = tagEnd + 1;
  }

  return null;
};

/**
 * Return the innermost tag whose full span (open delimiter through close delimiter, or the
 * whole self-closing delimiter) contains offset — unlike findUnwrapTagPair, offset does not
 * need to sit directly on a delimiter; it can be anywhere in the tag's content or attributes.
 * Used for "delete current tag" (shift+Backspace/shift+Delete), not incidental unwrap-on-delete.
 */
export const findEnclosingTagPair = (content: string, offset: number): UnwrapTagPair | null => {
  if (offset < 0 || offset > content.length) return null;

  const stack: UnwrapStackEntry[] = [];
  let i = 0;

  while (i < content.length) {
    if (content[i] !== '<') {
      i += 1;
      continue;
    }

    const tagStart = i;
    const tagEnd = findTagEnd(content, tagStart);
    if (tagEnd === null) {
      i += 1;
      continue;
    }

    const inner = content.slice(i + 1, tagEnd);

    if (inner.startsWith('![CDATA[')) {
      const cdataEnd = content.indexOf(']]>', i);
      i = cdataEnd === -1 ? content.length : cdataEnd + 3;
      continue;
    }

    if (isIgnorableTagInner(inner)) {
      i = tagEnd + 1;
      continue;
    }

    if (inner.startsWith('/')) {
      const closing = parseClosingTagName(tagStart, inner);
      if (closing && stack.length > 0) {
        const open = stack[stack.length - 1]!;
        const closeName = { start: closing.nameStart, end: closing.nameEnd };

        if (offset >= open.openTagStart && offset <= tagEnd + 1) {
          const pair = buildUnwrapPair(
            content,
            open,
            open.openTagStart,
            open.openTagEnd,
            tagStart,
            tagEnd + 1,
            closeName,
          );
          if (pair) return pair;
        }

        stack.pop();
      }
      i = tagEnd + 1;
      continue;
    }

    const selfClosing = inner.trimEnd().endsWith('/');
    const opening = parseOpeningTagName(tagStart, inner);
    if (opening) {
      if (selfClosing && offsetInDelimiter(offset, tagStart, tagEnd)) {
        const openName = { start: opening.nameStart, end: opening.nameEnd };
        return {
          openDelimiter: { start: tagStart, end: tagEnd + 1 },
          closeDelimiter: { start: tagEnd + 1, end: tagEnd + 1 },
          openName,
          closeName: openName,
        };
      }

      if (!selfClosing) {
        stack.push({
          name: opening.name,
          openTagStart: tagStart,
          openTagEnd: tagEnd + 1,
          openNameStart: opening.nameStart,
          openNameEnd: opening.nameEnd,
        });
      }
    }

    i = tagEnd + 1;
  }

  return null;
};

export const getUnwrapEdits = (pair: UnwrapTagPair): TextDeleteRange[] =>
  [pair.openDelimiter, pair.closeDelimiter].sort((a, b) => b.start - a.start);

export const applyDeleteRanges = (content: string, ranges: TextDeleteRange[]): string => {
  let result = content;
  for (const range of ranges) {
    result = result.slice(0, range.start) + result.slice(range.end);
  }
  return result;
};

export const unwrapTagPair = (content: string, pair: UnwrapTagPair): string =>
  applyDeleteRanges(content, getUnwrapEdits(pair));

export const getInnerContentStart = (pair: UnwrapTagPair): number => pair.openDelimiter.end;

/** Mirror a single-character delete inside matched tag names; unwrap when name would become empty. */
export const getMirroredNameDeleteEdits = (
  content: string,
  pair: UnwrapTagPair,
  offset: number,
  isBackspace: boolean,
): TextDeleteRange[] | 'unwrap' | null => {
  if (!canUnwrapTagNames(content, pair.openName, pair.closeName)) return null;

  const inOpen = offsetInTagName(offset, pair.openName.start, pair.openName.end);
  const inClose = offsetInTagName(offset, pair.closeName.start, pair.closeName.end);
  if (!inOpen && !inClose) return null;

  const activeName = inOpen ? pair.openName : pair.closeName;
  const mirrorName = inOpen ? pair.closeName : pair.openName;

  let deleteStart: number;
  let deleteEnd: number;

  if (isBackspace) {
    if (offset <= activeName.start) return null;
    deleteStart = offset - 1;
    deleteEnd = offset;
  } else {
    if (offset >= activeName.end) return null;
    deleteStart = offset;
    deleteEnd = offset + 1;
  }

  if (deleteStart < activeName.start || deleteEnd > activeName.end) return null;

  const indexInActive = deleteStart - activeName.start;
  const mirrorDeleteStart = mirrorName.start + indexInActive;
  const mirrorDeleteEnd = mirrorDeleteStart + (deleteEnd - deleteStart);

  if (mirrorDeleteStart < mirrorName.start || mirrorDeleteEnd > mirrorName.end) return null;

  const openNameLength = pair.openName.end - pair.openName.start;
  const deleteLength = deleteEnd - deleteStart;
  const openDeleteLength =
    activeName.start === pair.openName.start ? deleteLength : mirrorDeleteEnd - mirrorDeleteStart;

  if (openNameLength - openDeleteLength <= 0) return 'unwrap';

  return [
    { start: deleteStart, end: deleteEnd },
    { start: mirrorDeleteStart, end: mirrorDeleteEnd },
  ].sort((a, b) => b.start - a.start);
};

const findStructuralCloseNameRange = (
  content: string,
  fromOffset: number,
): TagNameRange | null => {
  let depth = 1;
  let i = fromOffset;

  while (i < content.length) {
    if (content[i] !== '<') {
      i += 1;
      continue;
    }

    const tagStart = i;
    const tagEnd = findTagEnd(content, tagStart);
    if (tagEnd === null) {
      i += 1;
      continue;
    }

    const inner = content.slice(i + 1, tagEnd);

    if (inner.startsWith('![CDATA[')) {
      const cdataEnd = content.indexOf(']]>', i);
      i = cdataEnd === -1 ? content.length : cdataEnd + 3;
      continue;
    }

    if (isIgnorableTagInner(inner)) {
      i = tagEnd + 1;
      continue;
    }

    if (inner.startsWith('/')) {
      depth -= 1;
      if (depth === 0) {
        const closing = parseClosingTagName(tagStart, inner);
        return closing ? { start: closing.nameStart, end: closing.nameEnd } : null;
      }
    } else {
      const selfClosing = inner.trimEnd().endsWith('/');
      if (!selfClosing && parseOpeningTagName(tagStart, inner)) {
        depth += 1;
      }
    }

    i = tagEnd + 1;
  }

  return null;
};

/** Return opening and closing tag name ranges when the cursor is inside either name. */
export const findLinkedTagNameRanges = (
  content: string,
  offset: number,
): TagNameRange[] | null => {
  if (offset < 0 || offset > content.length) return null;

  const stack: StackEntry[] = [];
  let i = 0;

  while (i < content.length) {
    if (content[i] !== '<') {
      i += 1;
      continue;
    }

    const tagStart = i;
    const tagEnd = findTagEnd(content, tagStart);
    if (tagEnd === null) {
      i += 1;
      continue;
    }

    const inner = content.slice(i + 1, tagEnd);

    if (inner.startsWith('![CDATA[')) {
      const cdataEnd = content.indexOf(']]>', i);
      i = cdataEnd === -1 ? content.length : cdataEnd + 3;
      continue;
    }

    if (isIgnorableTagInner(inner)) {
      i = tagEnd + 1;
      continue;
    }

    if (inner.startsWith('/')) {
      const closing = parseClosingTagName(tagStart, inner);
      if (closing && stack.length > 0) {
        const open = stack[stack.length - 1]!;
        const openName = { start: open.openNameStart, end: open.openNameEnd };
        const closeName = { start: closing.nameStart, end: closing.nameEnd };

        if (offsetInTagName(offset, closeName.start, closeName.end)) {
          if (canLinkTagNames(content, openName, closeName)) {
            return [openName, closeName];
          }
        }

        stack.pop();
      }
      i = tagEnd + 1;
      continue;
    }

    const selfClosing = inner.trimEnd().endsWith('/');
    const opening = parseOpeningTagName(tagStart, inner);
    if (opening) {
      const openName = { start: opening.nameStart, end: opening.nameEnd };

      if (!selfClosing && offsetInTagName(offset, openName.start, openName.end)) {
        const closeName = findStructuralCloseNameRange(content, tagEnd + 1);
        if (closeName && canLinkTagNames(content, openName, closeName)) {
          return [openName, closeName];
        }
      }

      if (!selfClosing) {
        stack.push({
          name: opening.name,
          openNameStart: opening.nameStart,
          openNameEnd: opening.nameEnd,
        });
      } else if (offsetInTagName(offset, openName.start, openName.end)) {
        return null;
      }
    }

    i = tagEnd + 1;
  }

  return null;
};

/** Scan XML source before cursor and return open tag stack (innermost last). */
export const getOpenTagStackBeforeCursor = (content: string, offset: number): OpenTag[] => {
  const stack: OpenTag[] = [];
  let i = 0;
  const limit = Math.min(offset, content.length);

  while (i < limit) {
    if (content[i] !== '<') {
      i += 1;
      continue;
    }

    const tagEnd = content.indexOf('>', i + 1);
    if (tagEnd === -1 || tagEnd >= limit) break;

    const inner = content.slice(i + 1, tagEnd);

    if (inner.startsWith('?') || inner.startsWith('!--') || inner.startsWith('!')) {
      i = tagEnd + 1;
      continue;
    }

    if (inner.startsWith('![CDATA[')) {
      const cdataEnd = content.indexOf(']]>', i);
      i = cdataEnd === -1 ? limit : cdataEnd + 3;
      continue;
    }

    if (inner.startsWith('/')) {
      const nameMatch = inner.slice(1).trim().match(/^([\w:.-]+)/);
      if (nameMatch) {
        const name = nameMatch[1];
        if (stack.length > 0 && stack[stack.length - 1].name === name) {
          stack.pop();
        }
      }
      i = tagEnd + 1;
      continue;
    }

    const selfClosing = inner.trimEnd().endsWith('/');
    const nameMatch = inner.match(/^([\w:.-]+)/);
    if (nameMatch) {
      stack.push({ name: nameMatch[1], start: i });
      if (selfClosing) stack.pop();
    }

    i = tagEnd + 1;
  }

  return stack;
};

export const getInnermostOpenTagName = (content: string, offset: number): string | null => {
  const stack = getOpenTagStackBeforeCursor(content, offset);
  return stack.length > 0 ? stack[stack.length - 1].name : null;
};

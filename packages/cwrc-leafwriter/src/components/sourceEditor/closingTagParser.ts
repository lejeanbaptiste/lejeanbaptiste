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

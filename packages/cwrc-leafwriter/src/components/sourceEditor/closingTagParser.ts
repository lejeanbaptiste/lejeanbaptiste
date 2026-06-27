interface OpenTag {
  name: string;
  start: number;
}

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

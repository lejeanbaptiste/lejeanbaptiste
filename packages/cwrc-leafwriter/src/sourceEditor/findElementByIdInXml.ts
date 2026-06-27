const findTagEnd = (content: string, tagStart: number) => {
  let quote: '"' | "'" | null = null;

  for (let j = tagStart + 1; j < content.length; j++) {
    const ch = content[j];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '>') return j;
  }

  return -1;
};

const tagHasId = (tagInner: string, id: string) => {
  const idPattern = new RegExp(`(?:^|\\s)(?:xml:id|id)\\s*=\\s*(["'])${id}\\1`);
  return idPattern.test(tagInner);
};

/** Find the opening tag of an element with matching id or xml:id in raw XML source. */
export const findElementOpenTagByIdInXml = (
  content: string,
  id: string,
): { end: number; start: number } | null => {
  if (!id) return null;

  let i = 0;
  while (i < content.length) {
    if (content[i] !== '<') {
      i += 1;
      continue;
    }

    const tagEnd = findTagEnd(content, i);
    if (tagEnd === -1) break;

    const inner = content.slice(i + 1, tagEnd);
    if (
      !inner.startsWith('?') &&
      !inner.startsWith('!--') &&
      !inner.startsWith('!') &&
      !inner.startsWith('/') &&
      tagHasId(inner, id)
    ) {
      return { start: i, end: tagEnd + 1 };
    }

    i = tagEnd + 1;
  }

  return null;
};

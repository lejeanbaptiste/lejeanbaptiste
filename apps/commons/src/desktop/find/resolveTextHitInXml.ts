export interface ResolvedTextHit {
  endInElementText: number;
  startInElementText: number;
  teiXPath: string;
}

const parseOpenTag = (tagInner: string): { name: string; selfClosing: boolean } | null => {
  const trimmed = tagInner.trim();
  if (trimmed.startsWith('/')) return null;

  const selfClosing = trimmed.endsWith('/');
  const withoutSlash = selfClosing ? trimmed.slice(0, -1).trim() : trimmed;
  const nameMatch = withoutSlash.match(/^([\w:-]+)/);
  if (!nameMatch) return null;

  return { name: nameMatch[1], selfClosing };
};

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

/**
 * Count decoded Unicode characters in content[from..to).
 * Each XML entity reference (e.g. &ndash; &#8211;) counts as 1 character,
 * matching how the browser DOM presents the text.
 */
const decodedCharCount = (content: string, from: number, to: number): number => {
  let count = 0;
  let i = from;
  while (i < to) {
    if (content[i] === '&') {
      const semi = content.indexOf(';', i + 1);
      if (semi !== -1 && semi < to && semi - i <= 12) {
        count += 1;
        i = semi + 1;
        continue;
      }
    }
    count += 1;
    i += 1;
  }
  return count;
};

/** Map a character offset in raw XML source to a TEI xpath + offsets within that element's text. */
export const resolveTextHitInXml = (
  content: string,
  start: number,
  end: number,
): ResolvedTextHit | null => {
  if (start < 0 || end <= start || end > content.length) return null;

  interface StackEntry {
    index: number;
    name: string;
  }
  const stack: StackEntry[] = [];
  const siblingCounts = new Map<string, number>();

  /**
   * Accumulated decoded-character count for each level in the stack.
   * Index 0 = text accumulated in the root element (stack[0]).
   * When a child is popped, its total is added to the parent's entry,
   * so the parent's offset correctly reflects all preceding text (including
   * text inside child elements).
   */
  const textOffsetAtLevel: number[] = [];

  const currentOffset = () => textOffsetAtLevel[textOffsetAtLevel.length - 1] ?? 0;
  const addToCurrentOffset = (n: number) => {
    if (textOffsetAtLevel.length > 0) {
      textOffsetAtLevel[textOffsetAtLevel.length - 1] += n;
    }
  };

  const xpathForStack = () => `/${stack.map((entry) => `${entry.name}[${entry.index + 1}]`).join('/')}`;

  const parentPathKey = () =>
    stack.length === 0 ? '' : stack.map((entry) => `${entry.name}[${entry.index + 1}]`).join('/');

  const pushTag = (name: string) => {
    const key = `${parentPathKey()}/${name}`;
    const index = siblingCounts.get(key) ?? 0;
    siblingCounts.set(key, index + 1);
    stack.push({ name, index });
    textOffsetAtLevel.push(0);
  };

  const popTag = (name: string) => {
    const top = stack[stack.length - 1];
    if (top?.name === name) {
      stack.pop();
      const childTotal = textOffsetAtLevel.pop() ?? 0;
      // Merge child's decoded-text count into the parent's running total so
      // subsequent text in the parent element is offset correctly.
      if (textOffsetAtLevel.length > 0) {
        textOffsetAtLevel[textOffsetAtLevel.length - 1] += childTotal;
      }
    }
  };

  const hitInTextRun = (textStart: number, textEnd: number): ResolvedTextHit | null => {
    if (stack.length === 0 || start < textStart || end > textEnd) return null;

    const startInElementText = currentOffset() + decodedCharCount(content, textStart, start);
    const endInElementText = currentOffset() + decodedCharCount(content, textStart, end);

    return {
      teiXPath: xpathForStack(),
      startInElementText,
      endInElementText,
    };
  };

  let i = 0;
  while (i < content.length) {
    if (content[i] !== '<') {
      const nextTag = content.indexOf('<', i);
      const textEnd = nextTag === -1 ? content.length : nextTag;
      const hit = hitInTextRun(i, textEnd);
      if (hit) return hit;

      addToCurrentOffset(decodedCharCount(content, i, textEnd));
      i = textEnd;
      continue;
    }

    const tagEnd = findTagEnd(content, i);
    if (tagEnd === -1) break;

    const inner = content.slice(i + 1, tagEnd);

    if (inner.startsWith('?') || inner.startsWith('!--')) {
      i = tagEnd + 1;
      continue;
    }

    if (inner.startsWith('![CDATA[')) {
      const cdataContentStart = i + '<![CDATA['.length;
      const cdataEnd = content.indexOf(']]>', cdataContentStart);
      if (cdataEnd === -1) break;

      const hit = hitInTextRun(cdataContentStart, cdataEnd);
      if (hit) return hit;

      // CDATA content is literal — no entity encoding, count raw chars
      addToCurrentOffset(cdataEnd - cdataContentStart);
      i = cdataEnd + 3;
      continue;
    }

    if (inner.startsWith('!')) {
      i = tagEnd + 1;
      continue;
    }

    if (inner.startsWith('/')) {
      const nameMatch = inner.slice(1).trim().match(/^([\w:-]+)/);
      if (nameMatch) popTag(nameMatch[1]);
      i = tagEnd + 1;
      continue;
    }

    const parsed = parseOpenTag(inner);
    if (parsed && !parsed.selfClosing) {
      pushTag(parsed.name);
    }

    i = tagEnd + 1;
  }

  return null;
};

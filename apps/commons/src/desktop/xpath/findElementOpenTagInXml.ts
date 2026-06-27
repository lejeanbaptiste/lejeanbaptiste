import { offsetToLineColumn } from '../find/textSearchUtils';
import { parseTeiXPathSegments } from './teiXPathWalker';

export interface ElementOpenTagPosition {
  column: number;
  end: number;
  line: number;
  start: number;
}

const parseOpenTag = (tagInner: string): { name: string; selfClosing: boolean } | null => {
  const trimmed = tagInner.trim();
  if (trimmed.startsWith('/')) return null;

  const selfClosing = trimmed.endsWith('/');
  const withoutSlash = selfClosing ? trimmed.slice(0, -1).trim() : trimmed;
  const nameMatch = withoutSlash.match(/^([\w:-]+)/);
  if (!nameMatch) return null;

  const rawName = nameMatch[1];
  const name = rawName.includes(':') ? rawName.split(':').pop()! : rawName;

  return { name, selfClosing };
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

const localTagName = (name: string) => (name.includes(':') ? name.split(':').pop()! : name);

/** Find the opening tag of an element identified by TEI-style xpath in raw XML source. */
export const findElementOpenTagInXml = (
  content: string,
  teiXpath: string,
): ElementOpenTagPosition | null => {
  const target = parseTeiXPathSegments(teiXpath);
  if (target.length === 0) return null;

  interface StackEntry {
    index: number;
    name: string;
  }

  const stack: StackEntry[] = [];
  const siblingCounts = new Map<string, number>();

  const parentPathKey = () =>
    stack.length === 0 ? '' : stack.map((entry) => `${entry.name}[${entry.index + 1}]`).join('/');

  const pushTag = (name: string) => {
    const key = `${parentPathKey()}/${name}`;
    const index = siblingCounts.get(key) ?? 0;
    siblingCounts.set(key, index + 1);
    stack.push({ name, index });
  };

  const popTag = (name: string) => {
    const top = stack[stack.length - 1];
    if (top && localTagName(top.name) === localTagName(name)) {
      stack.pop();
    }
  };

  const stackMatchesTarget = () =>
    stack.length === target.length &&
    stack.every(
      (entry, index) =>
        localTagName(entry.name).toLowerCase() === localTagName(target[index].tag).toLowerCase() &&
        entry.index === target[index].index,
    );

  const positionAt = (start: number, end: number): ElementOpenTagPosition => {
    const { line, column } = offsetToLineColumn(content, start);
    return { start, end, line, column };
  };

  let i = 0;
  while (i < content.length) {
    if (content[i] !== '<') {
      i += 1;
      continue;
    }

    const tagEnd = findTagEnd(content, i);
    if (tagEnd === -1) break;

    const inner = content.slice(i + 1, tagEnd);

    if (inner.startsWith('?') || inner.startsWith('!--') || inner.startsWith('!')) {
      i = tagEnd + 1;
      continue;
    }

    if (inner.startsWith('![CDATA[')) {
      const cdataEnd = content.indexOf(']]>', i + '<![CDATA['.length);
      i = cdataEnd === -1 ? content.length : cdataEnd + 3;
      continue;
    }

    if (inner.startsWith('/')) {
      const nameMatch = inner.slice(1).trim().match(/^([\w:-]+)/);
      if (nameMatch) popTag(nameMatch[1]);
      i = tagEnd + 1;
      continue;
    }

    const parsed = parseOpenTag(inner);
    if (parsed) {
      pushTag(parsed.name);
      if (stackMatchesTarget()) {
        return positionAt(i, tagEnd + 1);
      }
      if (parsed.selfClosing) {
        stack.pop();
      }
    }

    i = tagEnd + 1;
  }

  return null;
};

const isElement = (node: Node): node is Element => node.nodeType === Node.ELEMENT_NODE;

const localTagName = (tag: string) => (tag.includes(':') ? tag.split(':').pop()! : tag);

export interface TeiXPathSegment {
  label: string;
  xpath: string;
}

export interface TeiSegment {
  index: number;
  tag: string;
}

const matchesTeiTag = (a: string | null, b: string | null) => {
  if (!a || !b) return false;
  const wantedLocal = localTagName(b).toLowerCase();
  const attrLocal = localTagName(a).toLowerCase();
  return attrLocal === wantedLocal || a.toLowerCase() === b.toLowerCase();
};

const formatSegment = (tag: string, index: number) =>
  index === 0 ? tag : `${tag}[${index + 1}]`;

/** Build `/TEI/text/body/p[3]` from a WYSIWYG editor element (_tag attributes). */
export const getTeiXPathFromEditorElement = (
  element: Element,
  body: HTMLElement,
): string => {
  const segments: string[] = [];
  let current: Element | null = element;

  while (current && current !== body) {
    const tag = current.getAttribute('_tag');
    if (!tag) break;

    const parent: Element | null = current.parentElement;
    if (!parent) break;

    const siblings: Element[] = Array.from(parent.children).filter(
      (el: Element) =>
        el.nodeType === Node.ELEMENT_NODE && matchesTeiTag(el.getAttribute('_tag'), tag),
    );
    const index = siblings.indexOf(current);
    segments.unshift(formatSegment(tag, index >= 0 ? index : 0));
    current = parent;
  }

  return segments.length > 0 ? `/${segments.join('/')}` : '';
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

const parseOpenTag = (tagInner: string): { name: string; selfClosing: boolean } | null => {
  const trimmed = tagInner.trim();
  if (trimmed.startsWith('/')) return null;

  const selfClosing = trimmed.endsWith('/');
  const withoutSlash = selfClosing ? trimmed.slice(0, -1).trim() : trimmed;
  const nameMatch = withoutSlash.match(/^([\w:.-]+)/);
  if (!nameMatch) return null;

  return { name: nameMatch[1], selfClosing };
};

/** Indexed TEI xpath at a character offset in raw XML (Source mode). */
export const getTeiXPathAtOffset = (content: string, offset: number): string | null => {
  if (offset < 0 || offset > content.length) return null;

  interface StackEntry {
    index: number;
    name: string;
  }

  const stack: StackEntry[] = [];
  const siblingCounts = new Map<string, number>();

  const xpathForStack = () =>
    stack.length > 0
      ? `/${stack.map((entry) => formatSegment(entry.name, entry.index)).join('/')}`
      : null;

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
    if (top?.name === name) stack.pop();
  };

  let lastXPath: string | null = null;
  let i = 0;

  while (i < content.length) {
    if (offset < i) break;

    if (content[i] !== '<') {
      const nextTag = content.indexOf('<', i);
      const textEnd = nextTag === -1 ? content.length : nextTag;
      lastXPath = xpathForStack();

      if (offset >= i && offset <= textEnd) {
        return lastXPath;
      }

      i = textEnd;
      continue;
    }

    if (offset === i) {
      return xpathForStack();
    }

    const tagEnd = findTagEnd(content, i);
    if (tagEnd === -1) break;

    const inner = content.slice(i + 1, tagEnd);

    if (inner.startsWith('?') || inner.startsWith('!--') || inner.startsWith('!')) {
      i = tagEnd + 1;
      continue;
    }

    if (inner.startsWith('![CDATA[')) {
      const cdataStart = i + '<![CDATA['.length;
      const cdataEnd = content.indexOf(']]>', cdataStart);
      if (cdataEnd === -1) break;

      lastXPath = xpathForStack();
      if (offset >= cdataStart && offset <= cdataEnd) {
        return lastXPath;
      }

      i = cdataEnd + 3;
      continue;
    }

    if (inner.startsWith('/')) {
      const nameMatch = inner.slice(1).trim().match(/^([\w:.-]+)/);
      if (nameMatch) popTag(nameMatch[1]);
      i = tagEnd + 1;
      continue;
    }

    const parsed = parseOpenTag(inner);
    if (parsed && !parsed.selfClosing) {
      pushTag(parsed.name);
      lastXPath = xpathForStack();
    }

    if (offset > i && offset <= tagEnd + 1) {
      return xpathForStack();
    }

    i = tagEnd + 1;
  }

  return lastXPath ?? xpathForStack();
};

/** Parse TEI-style xpath segments (1-based indices in xpath become 0-based here). */
export const parseTeiXPathSegments = (xpath: string): TeiSegment[] =>
  xpath
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      const match = segment.match(/^(?:[\w.-]+:)*([\w.-]+)(?:\[(\d+)\])?$/);
      if (!match) {
        const bare = segment.replace(/\[.*\]/, '');
        return { tag: localTagName(bare), index: 0 };
      }
      return {
        tag: match[1],
        index: match[2] ? parseInt(match[2], 10) - 1 : 0,
      };
    });

/** Split a TEI xpath into clickable breadcrumb segments. */
export const parseTeiXPathToBreadcrumbSegments = (xpath: string): TeiXPathSegment[] => {
  const parts = xpath.replace(/^\/+/, '').split('/').filter(Boolean);
  if (parts.length === 0) return [];

  const segments: TeiXPathSegment[] = [];
  let cumulative = '';
  for (const part of parts) {
    cumulative = `${cumulative}/${part}`;
    segments.push({ label: part, xpath: cumulative });
  }
  return segments;
};

const tagChildren = (parent: Element, tag: string): Element[] =>
  Array.from(parent.children).filter(
    (el): el is Element =>
      el.nodeType === Node.ELEMENT_NODE && matchesTeiTag(el.getAttribute('_tag'), tag),
  );

const findRootCandidate = (body: HTMLElement, tag: string, index: number): Element | null => {
  let candidates = tagChildren(body, tag);
  if (candidates.length > 0) {
    return candidates[index] ?? candidates[0] ?? null;
  }

  const all = Array.from(body.querySelectorAll('*')).filter((el) =>
    matchesTeiTag(el.getAttribute('_tag'), tag),
  );
  if (all.length === 0) return null;

  const depthOf = (el: Element) => {
    let depth = 0;
    let node: Element | null = el;
    while (node && node !== body) {
      depth += 1;
      node = node.parentElement;
    }
    return depth;
  };

  const minDepth = Math.min(...all.map(depthOf));
  candidates = all.filter((el) => depthOf(el) === minDepth);
  return candidates[index] ?? candidates[0] ?? null;
};

/** Walk the WYSIWYG editor DOM using TEI-style xpath segments (_tag names). */
export const findEditorNodeByTeiXPath = (
  body: HTMLElement,
  teiXpath: string,
): Element | null => {
  const segments = parseTeiXPathSegments(teiXpath);
  if (segments.length === 0) return null;

  let current = findRootCandidate(body, segments[0].tag, segments[0].index);
  if (!current) return null;

  for (let i = 1; i < segments.length; i++) {
    const candidates = tagChildren(current, segments[i].tag);
    current = candidates[segments[i].index] ?? null;
    if (!current) return null;
  }

  return current;
};

export const getTeiXPathForEditorNode = (node: Node | null | undefined): string => {
  const editor = window.writer?.editor;
  const body = editor?.getBody();
  if (!body || !node) return '';

  let element: Element | null = null;
  if (isElement(node)) {
    element = node.getAttribute('_tag') ? node : node.closest('[_tag]');
  } else {
    element = node.parentElement?.closest('[_tag]') ?? null;
  }

  if (!element) return '';
  return getTeiXPathFromEditorElement(element, body);
};

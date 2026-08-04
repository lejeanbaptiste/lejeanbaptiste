/**
 * Convert common inline markdown (as LLMs love to emit) into TEI <hi> markup
 * used by the translation pane. Operates on plain text / XML text nodes only —
 * do not run this on a full document string that already contains tags.
 */

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** True when the string still looks like it contains markdown emphasis markers. */
export const looksLikeInlineMarkdown = (text: string): boolean =>
  /\*\*\*|\*\*|__|~~|(^|[^*])\*[^*]|(^|[^_])_[^_]|___/.test(text);

type Part = { kind: 'text'; value: string } | { kind: 'html'; value: string };

const replaceInTextParts = (
  parts: Part[],
  pattern: RegExp,
  toHtml: (inner: string) => string,
): Part[] => {
  const next: Part[] = [];
  for (const part of parts) {
    if (part.kind === 'html') {
      next.push(part);
      continue;
    }
    const source = part.value;
    let last = 0;
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source))) {
      if (match.index > last) {
        next.push({ kind: 'text', value: source.slice(last, match.index) });
      }
      next.push({ kind: 'html', value: toHtml(match[1] ?? '') });
      last = match.index + match[0].length;
    }
    if (last < source.length) next.push({ kind: 'text', value: source.slice(last) });
  }
  return next;
};

/**
 * Replace **bold**, *italic*, ***bold italic***, __bold__, _italic_, ~~strike~~
 * with TEI <hi rend="…">. Unmatched markers are left as literal text (escaped).
 *
 * Order is deliberate: triple markers first, then double, then strike, then single.
 */
export const markdownInlineToTei = (text: string): string => {
  if (!text || !/[*_~]/.test(text)) return text;

  let parts: Part[] = [{ kind: 'text', value: text }];

  parts = replaceInTextParts(parts, /\*\*\*(.+?)\*\*\*/g, (inner) =>
    `<hi rend="bold"><hi rend="italic">${escapeXml(inner)}</hi></hi>`,
  );
  parts = replaceInTextParts(parts, /___(.+?)___/g, (inner) =>
    `<hi rend="bold"><hi rend="italic">${escapeXml(inner)}</hi></hi>`,
  );
  parts = replaceInTextParts(
    parts,
    /\*\*(.+?)\*\*/g,
    (inner) => `<hi rend="bold">${escapeXml(inner)}</hi>`,
  );
  parts = replaceInTextParts(
    parts,
    /__(.+?)__/g,
    (inner) => `<hi rend="bold">${escapeXml(inner)}</hi>`,
  );
  parts = replaceInTextParts(
    parts,
    /~~(.+?)~~/g,
    (inner) => `<hi rend="strikethrough">${escapeXml(inner)}</hi>`,
  );
  parts = replaceInTextParts(
    parts,
    /\*([^*]+?)\*/g,
    (inner) => `<hi rend="italic">${escapeXml(inner)}</hi>`,
  );
  parts = replaceInTextParts(
    parts,
    /_([^_]+?)_/g,
    (inner) => `<hi rend="italic">${escapeXml(inner)}</hi>`,
  );

  return parts
    .map((part) => (part.kind === 'html' ? part.value : escapeXml(part.value)))
    .join('');
};

/**
 * Walk an XML/HTML fragment root and rewrite markdown in text nodes to <hi>.
 * Mutates the tree in place. Safe for AI translation fragments.
 */
export const convertMarkdownInXmlFragment = (root: Element): void => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node as Text;
    const parent = text.parentElement;
    if (!parent) continue;
    const parentTag = parent.tagName.toLowerCase();
    if (parentTag === 'hi' || parentTag === 'note' || parentTag === 'ref' || parentTag === 'bibl') {
      continue;
    }
    if (!looksLikeInlineMarkdown(text.data)) continue;
    textNodes.push(text);
  }

  for (const text of textNodes) {
    const converted = markdownInlineToTei(text.data);
    if (converted === escapeXml(text.data)) continue;
    const holder = document.createElement('span');
    holder.innerHTML = converted;
    const parent = text.parentNode;
    if (!parent) continue;
    while (holder.firstChild) parent.insertBefore(holder.firstChild, text);
    parent.removeChild(text);
  }
};

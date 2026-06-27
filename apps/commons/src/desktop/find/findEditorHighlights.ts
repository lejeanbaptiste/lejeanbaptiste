const FIND_HIT_CLASS = 'lw-find-hit';
const FIND_HIT_ACTIVE_CLASS = 'lw-find-hit-active';
const STYLE_ELEMENT_ID = 'lw-find-highlight-styles';

const ensureHighlightStyles = (doc: Document) => {
  if (doc.getElementById(STYLE_ELEMENT_ID)) return;

  const style = doc.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = `
    .${FIND_HIT_CLASS} {
      background-color: #fff176;
      border-radius: 1px;
    }
    .${FIND_HIT_ACTIVE_CLASS} {
      background-color: #ffb74d;
      box-shadow: 0 0 0 1px #f57c00;
      border-radius: 1px;
    }
  `;
  doc.head.appendChild(style);
};

const collectTextNodes = (root: Node): Text[] => {
  const nodes: Text[] = [];
  const walker = root.ownerDocument?.createTreeWalker(root, NodeFilter.SHOW_TEXT) ?? null;
  if (!walker) return nodes;

  let node = walker.nextNode();
  while (node) {
    const parent = node.parentElement;
    const isInsideHighlight = parent?.closest(`.${FIND_HIT_CLASS}, .${FIND_HIT_ACTIVE_CLASS}`);

    if (node.nodeValue && node.nodeValue.length > 0 && !isInsideHighlight) {
      nodes.push(node as Text);
    }
    node = walker.nextNode();
  }

  return nodes;
};

const buildSearchRegex = (query: string, useRegex: boolean) => {
  if (useRegex) {
    try {
      return new RegExp(query, 'gu');
    } catch {
      return null;
    }
  }

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped, 'gu');
};

interface HighlightSpan {
  element: HTMLSpanElement;
}

export const clearFindHighlights = () => {
  const body = window.writer?.editor?.getBody();
  if (!body) return;

  body.querySelectorAll(`.${FIND_HIT_CLASS}, .${FIND_HIT_ACTIVE_CLASS}`).forEach((element) => {
    const parent = element.parentNode;
    if (!parent) return;
    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }
    parent.removeChild(element);
  });

  body.normalize();
};

const wrapMatchesInTextNode = (textNode: Text, regex: RegExp, spans: HighlightSpan[]) => {
  const text = textNode.nodeValue ?? '';
  const parent = textNode.parentNode;
  if (!parent || !text) return;

  regex.lastIndex = 0;
  const matches = [...text.matchAll(regex)];
  if (matches.length === 0) return;

  const fragment = textNode.ownerDocument.createDocumentFragment();
  let lastIndex = 0;

  for (const match of matches) {
    if (match.index === undefined) continue;

    if (match.index > lastIndex) {
      fragment.appendChild(textNode.ownerDocument.createTextNode(text.slice(lastIndex, match.index)));
    }

    const span = textNode.ownerDocument.createElement('span');
    span.className = FIND_HIT_CLASS;
    span.setAttribute('data-lw-find', '1');
    span.textContent = match[0];
    fragment.appendChild(span);
    spans.push({ element: span });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    fragment.appendChild(textNode.ownerDocument.createTextNode(text.slice(lastIndex)));
  }

  parent.replaceChild(fragment, textNode);
};

export const applyFindHighlightsInEditor = (
  query: string,
  useRegex: boolean,
  activeMatchIndex = 0,
): boolean => {
  const editor = window.writer?.editor;
  const body = editor?.getBody();
  if (!editor || !body || !query.trim()) return false;

  clearFindHighlights();

  const regex = buildSearchRegex(query.trim(), useRegex);
  if (!regex) return false;

  ensureHighlightStyles(editor.getDoc());

  const textNodes = collectTextNodes(body);
  const spans: HighlightSpan[] = [];

  for (const textNode of textNodes) {
    wrapMatchesInTextNode(textNode, regex, spans);
  }

  if (spans.length === 0) return false;

  const activeIndex = Math.min(Math.max(activeMatchIndex, 0), spans.length - 1);
  const activeSpan = spans[activeIndex];
  activeSpan.element.classList.remove(FIND_HIT_CLASS);
  activeSpan.element.classList.add(FIND_HIT_ACTIVE_CLASS);
  activeSpan.element.scrollIntoView({ block: 'center', behavior: 'smooth' });
  return true;
};

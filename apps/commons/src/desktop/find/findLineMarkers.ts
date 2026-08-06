/** Block-level line markers so find hits stay visible over entity/tag highlighting. */

export const FIND_LINE_CLASS = 'lw-find-hit-line';
export const FIND_LINE_ACTIVE_CLASS = 'lw-find-hit-line-active';

const BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'LI',
  'TD',
  'TH',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'BLOCKQUOTE',
]);

export const findLineMarkerCss = `
  .${FIND_LINE_CLASS} {
    box-shadow: inset 4px 0 0 #e53935, inset -4px 0 0 #e53935;
  }
  .${FIND_LINE_ACTIVE_CLASS} {
    box-shadow: inset 5px 0 0 #c62828, inset -5px 0 0 #c62828;
  }
`;

/** Nearest block row in the WYSIWYG body that contains this node. */
export const getWysiwygLineBlock = (node: Node, body: HTMLElement): HTMLElement | null => {
  let element: HTMLElement | null = node instanceof HTMLElement ? node : node.parentElement;
  while (element && element !== body) {
    if (element.parentElement === body || BLOCK_TAGS.has(element.tagName)) {
      return element;
    }
    element = element.parentElement;
  }
  return null;
};

export const clearWysiwygFindLineMarkers = (body: HTMLElement) => {
  body.querySelectorAll(`.${FIND_LINE_CLASS}, .${FIND_LINE_ACTIVE_CLASS}`).forEach((element) => {
    element.classList.remove(FIND_LINE_CLASS, FIND_LINE_ACTIVE_CLASS);
  });
};

export const markWysiwygFindLineBlocks = (
  body: HTMLElement,
  blocks: Iterable<HTMLElement>,
  activeBlock: HTMLElement | null,
) => {
  clearWysiwygFindLineMarkers(body);
  for (const block of blocks) {
    block.classList.add(
      block === activeBlock ? FIND_LINE_ACTIVE_CLASS : FIND_LINE_CLASS,
    );
  }
};

export const markWysiwygActiveFindLine = (body: HTMLElement, node: Node) => {
  clearWysiwygFindLineMarkers(body);
  const block = getWysiwygLineBlock(node, body);
  if (block) block.classList.add(FIND_LINE_ACTIVE_CLASS);
};

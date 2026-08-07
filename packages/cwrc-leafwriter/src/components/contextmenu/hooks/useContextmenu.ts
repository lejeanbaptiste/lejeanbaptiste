import { useSetAtom } from 'jotai';
import { getIcon } from '../../../icons';
import { useActions, useAppState } from '../../../overmind';
import { isElement } from '../../../utilities';
import { tagMetaAtom, tagNameAtom, xpathAtom } from '../store';
import { useItems } from './useItems';

export interface State {
  allowsTagAround?: boolean;
  allowsMerge?: boolean;
  element?: Element | null;
  eventSource?: 'editor' | 'ribbon' | 'markupPanel';
  hasContentSelection?: boolean;
  isEntity?: boolean;
  isHeader?: boolean;
  isMultiple?: boolean;
  isRoot?: boolean;
  nodeType?: 'tag' | 'text';
  rng?: Range;
  tagId?: string | string[];
  useSelection?: boolean;
  xpath?: string;
}

export const useContextmenu = () => {
  const { writer } = window;

  const { contextMenu } = useAppState().ui;
  const { getTagAt } = useActions().validator;

  const setTagMeta = useSetAtom(tagMetaAtom);
  const setTagName = useSetAtom(tagNameAtom);
  const setXpath = useSetAtom(xpathAtom);

  const ctx: State = { ...contextMenu };

  const { getItems } = useItems(ctx);

  const selectionOverlapNodes = (rng: Range) => {
    const { startContainer, endContainer } = rng;

    if (startContainer.nodeType !== Node.TEXT_NODE || endContainer.nodeType !== Node.TEXT_NODE) {
      return false;
    }

    //? Doublecheck
    if (isElement(startContainer.parentNode) && isElement(endContainer.parentNode)) {
      if (startContainer.parentNode?.id !== endContainer.parentNode?.id) return false;
    }

    return true;
  };

  const resolveTaggedElement = (node: Node | null | undefined): Element | null => {
    if (!node) return null;
    let el: Element | null = isElement(node) ? node : node.parentElement;
    while (el && !el.getAttribute('_tag')) {
      el = el.parentElement;
    }
    return el;
  };

  const initialize = async () => {
    if (!writer || !ctx) return false;

    const bookmark = writer.editor?.currentBookmark;
    if (!bookmark) return null;

    ctx.rng = 'rng' in bookmark ? bookmark.rng : undefined;
    if (!ctx.rng) return null;

    // Prefer an explicit tagId (editor right-click on a tag pill, markup panel).
    // Falling back to the selection alone often resolves the parent <p> when the
    // user right-clicked an inner phrase tag such as <date>.
    if (typeof ctx.tagId === 'string' && ctx.tagId && ctx.nodeType !== 'text') {
      const byId = writer.editor?.getBody()?.querySelector(`#${CSS.escape(ctx.tagId)}`);
      if (byId) ctx.element = byId;
    }

    if (!ctx.element?.getAttribute('_tag')) {
      ctx.element = resolveTaggedElement(ctx.rng.commonAncestorContainer);
    }

    //? double check
    if (!ctx.element) return null;

    const tagName = ctx.element.getAttribute('_tag');
    if (!tagName) return null;

    if (tagName === writer.schemaManager.getHeader()) ctx.isHeader = true;

    if (typeof ctx.tagId === 'string' && tagName === writer.schemaManager.getRoot()) {
      ctx.isRoot = true;
      setTagName(tagName);
      return true;
    }

    ctx.hasContentSelection = !ctx.rng.collapsed;

    ctx.allowsTagAround = ctx.hasContentSelection ? selectionOverlapNodes(ctx.rng) : true;

    ctx.tagId = ctx.tagId ? ctx.tagId : ctx.element.id;

    if (ctx.tagId !== undefined && Array.isArray(ctx.tagId)) {
      ctx.isMultiple = true;
      ctx.isEntity = false;
      ctx.useSelection = false;
    } else {
      ctx.isMultiple = false;
      ctx.isEntity = ctx.element.getAttribute('_entity') !== null;
      ctx.useSelection = ctx.useSelection ?? false;
    }

    if (ctx.nodeType === 'text') ctx.useSelection = false;

    const elementXpath = writer.utilities.getElementXPath(ctx.element);
    if (!elementXpath) return false;

    if (!ctx.element.parentElement) return false;
    const parentXpath = writer.utilities.getElementXPath(ctx.element.parentElement);
    if (!parentXpath) return false;

    //This is an async function that fetch tag metadata, such as the full name.
    // The context menu does not need to "await" for it to complete to initialize
    void getTagAt({ tagName, parentXpath, index: 0 }).then((tag) => {
      if (tag) setTagMeta(tag);
    });

    setXpath(ctx.nodeType === 'text' && ctx.xpath ? ctx.xpath : elementXpath);
    setTagName(tagName);

    return true;
  };

  return {
    context: ctx,
    getIcon,
    getItems,
    initialize,
  };
};

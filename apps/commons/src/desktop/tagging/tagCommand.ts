import type { NodeDetail } from '@cwrc/leafwriter-validator';
import { DEFAULT_INSERT_TAG } from './keybindings';
import {
  buildInsertAfterTarget,
  buildValidatorTarget,
  fetchTagSuggestions,
  getEditorTagContext,
} from './tagSuggestions';
import {
  getBookmark,
  getRuntimeTagger,
  getSelectionRange,
  moveToBookmark,
  type RuntimeBookmark,
} from './taggerRuntime';

export type TagCommandMode = 'wrap' | 'insert' | 'rename' | 'lineBreak';

type StructureAction = 'add' | 'before' | 'after' | 'around' | 'inside';

export interface ApplyTagResult {
  applied: boolean;
  error?: string;
  tagName?: string;
}

const getWriter = () => window.writer;

const restoreBookmark = (bookmark: RuntimeBookmark | null | undefined) => {
  const writer = getWriter();
  if (!writer?.editor || !bookmark) return;
  moveToBookmark(writer.editor, bookmark);
  writer.editor.currentBookmark = bookmark as never;
};

/**
 * Default attributes to stamp on a freshly-inserted tag, keyed by tag name.
 * `rs` is the schema's sole "Thing" entity mapping (packages/cwrc-leafwriter
 * schema/mappings/tei.ts, `parentTag: 'rs'`) — nothing else in the schema
 * uses it — so every `<rs>` insertion gets `@type="thing"` up front, rather
 * than relying on the user to add it by hand in the Attributes panel.
 */
const DEFAULT_TAG_ATTRIBUTES: Record<string, Record<string, string>> = {
  rs: { type: 'thing' },
};

const defaultAttributesForTag = (tagName: string): Record<string, string> =>
  DEFAULT_TAG_ATTRIBUTES[tagName] ?? {};

const isEntityTag = (element: Element | null): boolean =>
  Boolean(element?.getAttribute('_entity') === 'true');

const confirmEntityRename = (): Promise<boolean> =>
  new Promise((resolve) => {
    const writer = getWriter();
    if (!writer?.dialogManager) {
      resolve(true);
      return;
    }
    writer.dialogManager.confirm({
      title: 'Remove entity link?',
      msg: 'Renaming this tag will remove the associated entity annotation. Continue?',
      showConfirmKey: 'confirm-ljb-rename-entity-tag',
      type: 'info',
      callback: (confirmed: boolean) => resolve(confirmed),
    });
  });

const stripEntityWrapper = (tagElement: Element): Element => {
  const writer = getWriter();
  if (!writer?.tagger || !tagElement.getAttribute('_entity')) return tagElement;

  const id = tagElement.getAttribute('id');
  if (!id) return tagElement;

  const newTag = writer.tagger.removeEntity(id);
  return (newTag as Element | undefined) ?? tagElement;
};

const expandSelectionToElementBoundaries = (
  editor: NonNullable<ReturnType<typeof getWriter>>['editor'],
): boolean => {
  if (!editor) return false;
  const rng = getSelectionRange(editor);

  // Note contents are rendered through a presentation-only wrapper. When a
  // selection inside one note crosses an inline boundary, the DOM range can
  // report the surrounding paragraph as its common ancestor. Expanding that
  // range to paragraph-level children would unexpectedly tag the whole
  // paragraph, so use the note's own tag as the expansion boundary.
  const noteWrapperFor = (node: Node): Element | null => {
    const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    return element?.closest('.noteWrapper') ?? null;
  };
  const startNoteWrapper = noteWrapperFor(rng.startContainer);
  const endNoteWrapper = noteWrapperFor(rng.endContainer);
  const noteWrapper =
    startNoteWrapper && startNoteWrapper === endNoteWrapper ? startNoteWrapper : null;

  const noteContentRoot = (node: Node, wrapper: Element): Element => {
    let current: Node | null = node;
    while (current && current !== wrapper) {
      if (current.nodeType === Node.ELEMENT_NODE && (current as Element).hasAttribute('_tag')) {
        return current as Element;
      }
      current = current.parentNode;
    }
    return wrapper;
  };

  // Must start from the range's actual common ancestor, not startContainer alone —
  // if the selection's end sits in a different inline sub-element of the note (e.g.
  // start is in plain note text, end is inside a nested <hi>/entity span), a root
  // found from startContainer alone may not be an ancestor of endContainer. The walk
  // below that clamps endChild to lca then never finds a match and climbs all the way
  // to a top-level block ancestor — silently reproducing the paragraph-wide expansion
  // this function exists to prevent.
  const lca = noteWrapper
    ? noteContentRoot(rng.commonAncestorContainer, noteWrapper)
    : rng.commonAncestorContainer;

  // Walk up from startContainer to find its topmost child under lca
  let startChild: Node = rng.startContainer;
  while (startChild.parentNode && startChild.parentNode !== lca) startChild = startChild.parentNode;

  // Walk up from endContainer to find its topmost child under lca
  let endChild: Node = rng.endContainer;
  while (endChild.parentNode && endChild.parentNode !== lca) endChild = endChild.parentNode;

  if (startChild === endChild) return false;

  const expanded = editor.getDoc().createRange();
  expanded.setStartBefore(startChild);
  expanded.setEndAfter(endChild);
  editor.selection.setRng(expanded);
  return true;
};

export const applyWrapTag = (
  tagName: string,
  bookmark: RuntimeBookmark | null | undefined,
  action: StructureAction = 'add',
  inTransaction = false,
  attributeOverrides?: Record<string, string>,
): ApplyTagResult => {
  const writer = getWriter();
  if (!writer?.editor || !writer.tagger) return { applied: false, error: 'Editor not ready' };

  restoreBookmark(bookmark);
  // Check validity without cleanRange — we handle expansion ourselves.
  // cleanRange distorts the selection in the wrong direction when the user's
  // range crosses element boundaries, causing incorrect wraps.
  const tagger = getRuntimeTagger(writer.tagger);
  let valid = tagger.isSelectionValid({ isStructTag: true, cleanRange: false });
  if (valid !== tagger.VALID) {
    if (!expandSelectionToElementBoundaries(writer.editor)) {
      return { applied: false, error: 'Selection must stay within a single parent tag.' };
    }
    valid = tagger.isSelectionValid({ isStructTag: true, cleanRange: false });
    if (valid !== tagger.VALID) {
      return { applied: false, error: 'Selection must stay within a single parent tag.' };
    }
  }

  writer.editor.currentBookmark = getBookmark(writer.editor) as never;
  const bm = writer.editor.currentBookmark;
  if (!bm) return { applied: false, error: 'Could not save selection' };

  const apply = () => {
    writer.tagger.addStructureTag({
      action,
      attributes: { ...defaultAttributesForTag(tagName), ...attributeOverrides },
      bookmark: bm as never,
      tagName,
    });
  };

  if (inTransaction) {
    writer.editor.undoManager.transact(apply);
  } else {
    apply();
  }

  writer.event('contentChanged').publish();
  return { applied: true, tagName };
};

export const applyRenameTag = async (
  tagName: string,
  tagElement: Element,
): Promise<ApplyTagResult> => {
  const writer = getWriter();
  if (!writer?.tagger) return { applied: false, error: 'Editor not ready' };

  let target = tagElement;
  if (isEntityTag(target)) {
    const confirmed = await confirmEntityRename();
    if (!confirmed) return { applied: false, error: 'Cancelled' };
    target = stripEntityWrapper(target);
  }

  const currentName = target.getAttribute('_tag');
  if (!currentName) return { applied: false, error: 'No tag at caret' };
  if (currentName === tagName) return { applied: true, tagName };

  const attributes = writer.tagger.getAttributesForTag(target);
  const $tag = writer.tagger.getCurrentTag(target.getAttribute('id') ?? undefined);
  if (!$tag) return { applied: false, error: 'Tag not found' };

  writer.editor?.undoManager.transact(() => {
    writer.tagger.editStructureTag($tag, attributes, tagName);
  });

  writer.event('contentChanged').publish();
  return { applied: true, tagName };
};

export const resolveInsertAction = async (
  tagName: string,
  ctx: ReturnType<typeof getEditorTagContext>,
): Promise<StructureAction | null> => {
  if (!ctx) return null;

  const insideTarget = buildValidatorTarget('insert', ctx);
  const insideTags = await fetchTagSuggestions(insideTarget);
  if (insideTags.some((tag) => tag.name === tagName && !tag.invalid)) return 'inside';

  const afterTarget = buildInsertAfterTarget(ctx);
  const afterTags = await fetchTagSuggestions(afterTarget);
  if (afterTags.some((tag) => tag.name === tagName && !tag.invalid)) return 'after';

  const wrapTarget = buildValidatorTarget('wrap', { ...ctx, hasContentSelection: false });
  const wrapTags = await fetchTagSuggestions(wrapTarget);
  if (wrapTags.some((tag) => tag.name === tagName && !tag.invalid)) return 'add';

  return null;
};

const insertEmptyTagAtCaret = (
  tagName: string,
  attributeOverrides?: Record<string, string>,
): ApplyTagResult => {
  const writer = getWriter();
  if (!writer?.editor || !writer.schemaManager)
    return { applied: false, error: 'Editor not ready' };

  const id = writer.getUniqueId('dom_');
  const editorEl = writer.schemaManager.isTagBlockLevel(tagName) ? 'div' : 'span';
  const defaultAttrs = { ...defaultAttributesForTag(tagName), ...attributeOverrides };
  const jsonAttrs = JSON.stringify(defaultAttrs).replace(/"/g, '&quot;');
  const attrsHtml = Object.entries(defaultAttrs)
    .map(([key, value]) => ` ${key}="${value}"`)
    .join('');
  // U+FEFF keeps the empty element from collapsing so it stays clickable/editable.
  // eslint-disable-next-line no-irregular-whitespace
  const content = `<${editorEl} id="${id}" _tag="${tagName}"${attrsHtml} _attributes="${jsonAttrs}">﻿</${editorEl}>`;

  writer.editor.undoManager.transact(() => {
    writer.editor!.insertContent(content);
  });
  writer.utilities?.selectElementById(id, true);
  writer.event('contentChanged').publish();
  return { applied: true, tagName };
};

export const applyInsertTag = async (
  tagName: string,
  attributeOverrides?: Record<string, string>,
): Promise<ApplyTagResult> => {
  const writer = getWriter();
  const ctx = getEditorTagContext();
  if (!writer?.editor || !writer.tagger || !ctx)
    return { applied: false, error: 'Editor not ready' };

  const { trySplitAtCaretForInsert, splitParagraphAtCaret, findParagraphAncestor } =
    await import('./tagInsert');

  if (tagName === DEFAULT_INSERT_TAG) {
    const body = writer.editor.getBody();
    if (findParagraphAncestor(ctx.rng.startContainer, body)) {
      const splitAttempt = trySplitAtCaretForInsert(tagName);
      if (splitAttempt.kind === 'applied') return splitAttempt.result;
      const forced = splitParagraphAtCaret();
      if (forced.applied) return forced;
      return { applied: false, error: forced.error ?? 'Could not split paragraph at caret.' };
    }
  }

  const splitAttempt = trySplitAtCaretForInsert(tagName);
  if (splitAttempt.kind === 'applied') return splitAttempt.result;

  // With no selection, never wrap existing content — insert an empty tag at caret instead.
  // Let the schema's action resolution decide placement: 'inside'/'add' → at caret,
  // 'after' → as sibling (tag genuinely can't go inline here).
  if (ctx.rng.collapsed) {
    const action = await resolveInsertAction(tagName, getEditorTagContext() ?? ctx);

    if (action === 'inside' || action === 'add') {
      return insertEmptyTagAtCaret(tagName, attributeOverrides);
    }

    if (action === 'after') {
      const targetElement =
        (getEditorTagContext() ?? ctx).tagElement ?? (getEditorTagContext() ?? ctx).element;
      const tagId = targetElement?.getAttribute('id');
      if (!tagId) return { applied: false, error: `Cannot insert <${tagName}> here.` };
      writer.tagger.addStructureTag({
        action: 'after',
        attributes: { ...defaultAttributesForTag(tagName), ...attributeOverrides },
        bookmark: { tagId } as never,
        tagName,
      });
      writer.event('contentChanged').publish();
      return { applied: true, tagName };
    }

    const { insertTagWithSplit } = await import('./tagInsert');
    const splitResult = insertTagWithSplit(tagName);
    if (splitResult.applied) return splitResult;
    return { applied: false, error: `Cannot insert <${tagName}> here.` };
  }

  const action = await resolveInsertAction(tagName, getEditorTagContext() ?? ctx);
  if (!action) {
    const { insertTagWithSplit } = await import('./tagInsert');
    const splitResult = insertTagWithSplit(tagName);
    if (splitResult.applied) return splitResult;
    return { applied: false, error: `Cannot insert <${tagName}> here.` };
  }

  if (action === 'add') {
    const freshCtx = getEditorTagContext();
    const parent = freshCtx?.rng.startContainer.parentNode as Element | null;
    const parentTag = parent?.getAttribute('_tag') ?? null;
    if (
      freshCtx?.rng.collapsed &&
      parentTag === tagName &&
      freshCtx.rng.startContainer.nodeType === Node.TEXT_NODE
    ) {
      const retrySplit = trySplitAtCaretForInsert(tagName);
      if (retrySplit.kind === 'applied') return retrySplit.result;
    }
    writer.editor.selection.collapse(true);
    writer.editor.currentBookmark = getBookmark(writer.editor) as never;
    const bm = writer.editor.currentBookmark;
    if (!bm) return { applied: false, error: 'Could not save caret' };

    writer.tagger.addStructureTag({
      action: 'add',
      attributes: { ...defaultAttributesForTag(tagName), ...attributeOverrides },
      bookmark: bm as never,
      tagName,
    });
    writer.event('contentChanged').publish();
    return { applied: true, tagName };
  }

  const targetElement = ctx.tagElement ?? ctx.element;
  const tagId = targetElement.getAttribute('id');
  if (!tagId) return { applied: false, error: 'No target element' };

  writer.editor.currentBookmark = { tagId } as never;
  const bm = writer.editor.currentBookmark;

  writer.tagger.addStructureTag({
    action,
    attributes: { ...defaultAttributesForTag(tagName), ...attributeOverrides },
    bookmark: bm as never,
    tagName,
  });

  writer.event('contentChanged').publish();
  return { applied: true, tagName };
};

export const applyTagFromPopup = async (
  mode: TagCommandMode,
  tag: NodeDetail,
  bookmark: RuntimeBookmark | null | undefined,
  tagElement: Element | null,
): Promise<ApplyTagResult> => {
  if (tag.invalid) return { applied: false, error: `Tag <${tag.name}> is not valid here.` };

  if (mode === 'rename') {
    if (!tagElement) return { applied: false, error: 'No tag to rename' };
    return applyRenameTag(tag.name, tagElement);
  }

  if (mode === 'insert' || mode === 'lineBreak') {
    return applyInsertTag(tag.name, tag.attributeOverrides);
  }

  return applyWrapTag(tag.name, bookmark, 'add', false, tag.attributeOverrides);
};

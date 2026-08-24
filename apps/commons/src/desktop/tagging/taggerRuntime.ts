interface BookmarkLike {
  rng?: Range;
  tagId?: string | string[];
}

interface SelectionWithBookmarks {
  getBookmark: (type?: number) => BookmarkLike;
  moveToBookmark: (bookmark: BookmarkLike) => void;
}

export type RuntimeBookmark = unknown;

export interface RuntimeTagger {
  VALID: number;
  isSelectionValid: (options: { cleanRange: boolean; isStructTag: boolean }) => number;
  splitTag: () => void;
}

export const getBookmark = (editor: { selection: unknown }): RuntimeBookmark => {
  const bookmark = (editor.selection as SelectionWithBookmarks).getBookmark(1) as BookmarkLike;
  // TinyMCE type-1 bookmarks keep the live Selection Range. Clone it so a later
  // selection.collapse() (e.g. wrap popup IME guard) cannot shrink the saved range.
  if (bookmark?.rng) {
    return { ...bookmark, rng: bookmark.rng.cloneRange() };
  }
  return bookmark;
};

export const moveToBookmark = (editor: { selection: unknown }, bookmark: RuntimeBookmark): void => {
  (editor.selection as SelectionWithBookmarks).moveToBookmark(bookmark as BookmarkLike);
};

export const getRuntimeTagger = (tagger: unknown): RuntimeTagger => tagger as RuntimeTagger;

export const getSelectionRange = (editor: { selection: unknown }): Range =>
  (editor.selection as { getRng: (forward?: boolean) => Range }).getRng(true);

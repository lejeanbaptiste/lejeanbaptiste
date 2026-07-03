type BookmarkLike = {
  rng?: Range;
  tagId?: string | string[];
};

type SelectionWithBookmarks = {
  getBookmark: (type?: number) => BookmarkLike;
  moveToBookmark: (bookmark: BookmarkLike) => void;
};

export type RuntimeBookmark = unknown;

export interface RuntimeTagger {
  VALID: number;
  isSelectionValid: (options: { cleanRange: boolean; isStructTag: boolean }) => number;
  splitTag: () => void;
}

export const getBookmark = (editor: { selection: unknown }): RuntimeBookmark =>
  (editor.selection as SelectionWithBookmarks).getBookmark(1);

export const moveToBookmark = (
  editor: { selection: unknown },
  bookmark: RuntimeBookmark,
): void => {
  (editor.selection as SelectionWithBookmarks).moveToBookmark(bookmark as BookmarkLike);
};

export const getRuntimeTagger = (tagger: unknown): RuntimeTagger => tagger as RuntimeTagger;

export const getSelectionRange = (editor: { selection: unknown }): Range =>
  (editor.selection as { getRng: (forward?: boolean) => Range }).getRng(true);

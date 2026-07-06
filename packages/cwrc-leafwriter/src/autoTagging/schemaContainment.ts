export interface SchemaContainmentChecker {
  isTagValidChildOfParent: (child: string, parent: string) => boolean;
}

const localTagName = (tag: string): string =>
  tag.includes(':') ? tag.split(':').pop()! : tag;

/**
 * Parent/child check for auto-tagging apply. TEI inline `<date>` is
 * `model.phrase` like `<persName>`; after the sanmiao schema patch the
 * RelaxNG parent map sometimes omits phrase-level hosts (e.g. `<p>`) for
 * `<date>` even though the merged schema still validates the markup.
 */
export const canContainForAutoTagging = (
  schemaManager: SchemaContainmentChecker,
  parentTag: string,
  childTag: string,
): boolean => {
  const parent = localTagName(parentTag);
  const child = localTagName(childTag);

  if (schemaManager.isTagValidChildOfParent(child, parent)) return true;

  if (child === 'date' && schemaManager.isTagValidChildOfParent('persName', parent)) {
    return true;
  }

  return false;
};

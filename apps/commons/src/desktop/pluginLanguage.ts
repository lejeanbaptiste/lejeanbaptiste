/** Primary subtag of a BCP-47 tag: zh-Hant → zh, ja-JP → ja, lzh → lzh. */
const primarySubtag = (tag: string): string => tag.toLowerCase().split('-')[0];

/**
 * True when a project source language matches a plugin language tag.
 *
 * Compared on the primary subtag, so a plugin declaring `zh-hant`/`zh-hans` is
 * offered for `zh`, `zh-Hant`, `zh-TW`, and `zh-CN` alike — script and region
 * do not narrow it. `lzh` (literary Chinese) is its own primary subtag and must
 * be declared explicitly.
 */
export const documentLanguageMatchesPlugin = (
  documentLanguage: string,
  pluginLanguages: string[],
): boolean => {
  const documentBase = primarySubtag(documentLanguage);
  return pluginLanguages.some((language) => primarySubtag(language) === documentBase);
};

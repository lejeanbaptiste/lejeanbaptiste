import apa from './styles/apa.csl';
import chicagoAuthorDate from './styles/chicago-author-date.csl';
import chicagoNoteBibliography from './styles/chicago-note-bibliography.csl';
import localeEnUs from './styles/locales-en-US.xml';
import localeFrFr from './styles/locales-fr-FR.xml';
import mla from './styles/modern-language-association.csl';
import { DEFAULT_CITATION_STYLE_ID } from './styleOptions';

/**
 * CSL styles and locales bundled with the app (webpack asset/source). Kept separate from
 * the citeproc engine module so the engine stays importable in jest without asset loaders,
 * and from styleOptions.ts so UI can list styles without pulling in the XML.
 * `resolveStyle` is the seam where a later version could fetch further styles from the
 * Zotero styles repository.
 */

const STYLE_XML: Record<string, string> = {
  'chicago-note-bibliography': chicagoNoteBibliography,
  'chicago-author-date': chicagoAuthorDate,
  'modern-language-association': mla,
  apa,
};

export const resolveStyle = (styleId: string | undefined, dynamicStyleXml?: string): string =>
  dynamicStyleXml ??
  STYLE_XML[styleId ?? DEFAULT_CITATION_STYLE_ID] ??
  STYLE_XML[DEFAULT_CITATION_STYLE_ID]!;

const LOCALES: Record<string, string> = {
  'en-US': localeEnUs,
  'fr-FR': localeFrFr,
};

/** Returns the bundled locale closest to the requested language, defaulting to en-US. */
export const resolveLocale = (lang: string | undefined): string => {
  if (!lang) return LOCALES['en-US']!;
  const exact = LOCALES[lang];
  if (exact) return exact;
  const prefix = lang.split('-')[0];
  const match = Object.entries(LOCALES).find(([key]) => key.split('-')[0] === prefix);
  return match?.[1] ?? LOCALES['en-US']!;
};

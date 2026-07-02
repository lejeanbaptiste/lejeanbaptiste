/** Ids and labels of the bundled CSL styles, importable without the style XML assets
 * (see styleAssets.ts for the actual stylesheets). */

export const DEFAULT_CITATION_STYLE_ID = 'chicago-note-bibliography';

export interface CitationStyleOption {
  id: string;
  label: string;
}

export const CITATION_STYLE_OPTIONS: CitationStyleOption[] = [
  { id: 'chicago-note-bibliography', label: 'Chicago (notes and bibliography)' },
  { id: 'chicago-author-date', label: 'Chicago (author-date)' },
  { id: 'modern-language-association', label: 'MLA' },
  { id: 'apa', label: 'APA' },
];

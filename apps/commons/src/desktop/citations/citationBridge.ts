import { citationChipLabel, createCitationRenderer, type CitationRenderer } from './citeproc';
import { getActiveProjectBundle } from '../activeProjectBundle';
import { resolveLocale, resolveStyle } from './styleAssets';
import {
  CITATION_STYLE_OPTIONS,
  DEFAULT_CITATION_STYLE_ID,
  type CitationStyleOption,
} from './styleOptions';
import type { BiblEntry, CslJsonItem } from './types';
import { setCitationStyle } from '../translationSettings';
import {
  cancelZoteroPick,
  checkZoteroAvailability,
  pickZoteroCitation,
  searchZoteroItems,
  zoteroStatusMessage,
  type ZoteroAvailability,
  type ZoteroCaywResult,
  type ZoteroSearchResult,
} from './zoteroApi';
import { garbageCollectBibl, readBiblEntries, upsertBiblEntry } from './zoteroBibliography';

/**
 * Citation services for the translation pane. The pane lives in packages/cwrc-leafwriter,
 * which cannot import from apps/commons, so — like __desktopTranslationLanguageState — the
 * desktop app exposes these on window while the translation tab is mounted.
 */

export interface RenderCitationOptions {
  item: CslJsonItem;
  /** CSL style id; undefined → project/app default. */
  styleId?: string;
  /** Target language of the translation, used to pick the CSL locale. */
  lang?: string;
  locator?: string;
  locatorType?: string;
  prefix?: string;
  suffix?: string;
}

export interface DesktopCitationBridge {
  chipLabel: (item: CslJsonItem) => string;
  /** Renders a citation to the pane's inline TEI vocabulary (<hi rend>, <sup>, <sub>). */
  renderCitation: (options: RenderCitationOptions) => string;
  upsertBiblEntry: (doc: Document, item: CslJsonItem, uri: string) => string;
  readBiblEntries: (doc: Document) => Map<string, BiblEntry>;
  garbageCollectBibl: (doc: Document) => void;
  checkZoteroAvailability: () => Promise<ZoteroAvailability>;
  searchZoteroItems: (query: string) => Promise<ZoteroSearchResult[]>;
  pickZoteroCitation: () => Promise<ZoteroCaywResult>;
  cancelZoteroPick: () => Promise<void>;
  zoteroStatusMessage: (availability: ZoteroAvailability) => string | undefined;
  getCitationStyleOptions: () => Promise<{
    defaultStyleId: string;
    options: CitationStyleOption[];
  }>;
  setCitationStyle: (styleId: string) => Promise<boolean>;
}

declare global {
  interface Window {
    __desktopCitationBridge?: DesktopCitationBridge;
  }
}

const renderers = new Map<string, CitationRenderer>();
const dynamicStyleXml = new Map<string, string>();
let styleOptionsCache: CitationStyleOption[] | null = null;
let styleOptionsPromise: Promise<CitationStyleOption[]> | null = null;

interface ZoteroStyleBridge {
  zoteroListStyles?: () => Promise<Array<CitationStyleOption & { xml: string }>>;
}

const loadStyleOptions = async (): Promise<CitationStyleOption[]> => {
  if (styleOptionsCache) return styleOptionsCache;
  if (styleOptionsPromise) return styleOptionsPromise;

  styleOptionsPromise = (async () => {
    const byId = new Map<string, CitationStyleOption>();
    for (const option of CITATION_STYLE_OPTIONS) byId.set(option.id, option);

    try {
      const styles =
        (await (window as { electronAPI?: ZoteroStyleBridge }).electronAPI?.zoteroListStyles?.()) ??
        [];
      for (const style of styles) {
        dynamicStyleXml.set(style.id, style.xml);
        byId.set(style.id, { id: style.id, label: style.label });
      }
    } catch {
      // Fall back to bundled styles when Zotero's local style directory is unavailable.
    }

    styleOptionsCache = Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label));
    return styleOptionsCache;
  })();

  return styleOptionsPromise;
};

const getRenderer = (styleId: string | undefined, lang: string | undefined): CitationRenderer => {
  const key = `${styleId ?? ''}|${lang ?? ''}`;
  let renderer = renderers.get(key);
  if (!renderer) {
    renderer = createCitationRenderer(
      resolveStyle(styleId, dynamicStyleXml.get(styleId ?? '')),
      resolveLocale(lang),
    );
    renderers.set(key, renderer);
  }
  return renderer;
};

export const installCitationBridge = (): (() => void) => {
  void loadStyleOptions();

  const bridge: DesktopCitationBridge = {
    chipLabel: citationChipLabel,
    renderCitation: ({ item, styleId, lang, locator, locatorType, prefix, suffix }) =>
      getRenderer(styleId, lang).render({ item, locator, locatorType, prefix, suffix }),
    upsertBiblEntry,
    readBiblEntries,
    garbageCollectBibl,
    checkZoteroAvailability,
    searchZoteroItems,
    pickZoteroCitation,
    cancelZoteroPick,
    zoteroStatusMessage,
    getCitationStyleOptions: async () => ({
      defaultStyleId: DEFAULT_CITATION_STYLE_ID,
      options: await loadStyleOptions(),
    }),
    setCitationStyle: async (styleId: string) => {
      const bundle = getActiveProjectBundle();
      if (!bundle) return false;
      const next = await setCitationStyle(bundle, styleId);
      if (!next) return false;
      window.dispatchEvent(
        new CustomEvent('desktop:translation-citation-style-changed', {
          detail: { citationStyle: styleId },
        }),
      );
      return true;
    },
  };
  window.__desktopCitationBridge = bridge;
  return () => {
    if (window.__desktopCitationBridge === bridge) delete window.__desktopCitationBridge;
  };
};

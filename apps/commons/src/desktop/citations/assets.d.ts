declare module '*.csl' {
  const content: string;
  export default content;
}

declare module '*/locales-en-US.xml' {
  const content: string;
  export default content;
}

declare module '*/locales-fr-FR.xml' {
  const content: string;
  export default content;
}

declare module 'citeproc' {
  interface CiteprocSys {
    retrieveLocale: (lang: string) => string;
    retrieveItem: (id: string) => Record<string, unknown>;
  }
  interface CitationCluster {
    citationItems: {
      id: string;
      locator?: string;
      label?: string;
      prefix?: string;
      suffix?: string;
    }[];
    properties: { noteIndex: number };
  }
  interface BibliographyMeta {
    entry_ids: string[][];
  }
  class Engine {
    constructor(sys: CiteprocSys, style: string, lang?: string, forceLang?: boolean);
    opt: { development_extensions: Record<string, boolean> };
    updateItems(ids: string[]): void;
    previewCitationCluster(
      citation: CitationCluster,
      citationsPre: [string, number][],
      citationsPost: [string, number][],
      format: 'html' | 'text' | 'rtf',
    ): string;
    makeBibliography(): [BibliographyMeta, string[]];
  }
  const CSL: { Engine: typeof Engine };
  export default CSL;
}

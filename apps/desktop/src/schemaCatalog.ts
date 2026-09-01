/** Catalog entries for main-process schema install (mirrors cwrc-leafwriter config/schemas.ts). */
export interface SchemaCatalogEntry {
  id: string;
  name: string;
  mapping: string;
  rngUrls: string[];
  cssUrls: string[];
  localRngName: string;
  localCssName: string;
  /**
   * When set, the schema ships inside the app instead of being downloaded.
   * `installCatalogSchema` reads `<name>` from the bundled `schema-catalog`
   * resources directory rather than fetching `rngUrls` / `cssUrls`.
   */
  bundled?: {
    rng: string;
    css: string;
    /** Optional extra files copied alongside (e.g. Schematron). */
    extra?: string[];
  };
}

export const PRIMARY_CATALOG_IDS = ['teiAll', 'teiLite'] as const;
export const MORE_CATALOG_IDS = ['teiSimplePrint', 'jTei', 'orlando', 'cbeta'] as const;
export const ENABLED_CATALOG_IDS = [...PRIMARY_CATALOG_IDS, ...MORE_CATALOG_IDS] as const;

/** @deprecated Use ENABLED_CATALOG_IDS */
export const V1_ENABLED_CATALOG_IDS = PRIMARY_CATALOG_IDS;

export const SCHEMA_CATALOG: Record<string, SchemaCatalogEntry> = {
  teiAll: {
    id: 'teiAll',
    name: 'TEI All',
    mapping: 'tei',
    rngUrls: [
      'https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng',
      'https://jenkins.tei-c.org/job/TEIP5/lastSuccessfulBuild/artifact/P5/release/xml/tei/custom/schema/relaxng/tei_all.rng',
    ],
    cssUrls: ['https://cwrc.ca/templates/css/tei.css'],
    localRngName: 'tei_all.rng',
    localCssName: 'tei.css',
  },
  teiLite: {
    id: 'teiLite',
    name: 'TEI Lite',
    mapping: 'teiLite',
    rngUrls: [
      'https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_lite.rng',
      'https://jenkins.tei-c.org/job/TEIP5/lastSuccessfulBuild/artifact/P5/release/xml/tei/custom/schema/relaxng/tei_lite.rng',
    ],
    cssUrls: ['https://cwrc.ca/templates/css/tei.css'],
    localRngName: 'tei_lite.rng',
    localCssName: 'tei.css',
  },
  teiSimplePrint: {
    id: 'teiSimplePrint',
    name: 'TEI Simple Print',
    mapping: 'tei',
    rngUrls: [
      'https://tei-c.org/release/xml/tei/custom/schema/relaxng/tei_simplePrint.rng',
      'https://jenkins.tei-c.org/job/TEIP5/lastSuccessfulBuild/artifact/P5/release/xml/tei/custom/schema/relaxng/tei_simplePrint.rng',
    ],
    cssUrls: ['https://cwrc.ca/templates/css/tei.css'],
    localRngName: 'tei_simplePrint.rng',
    localCssName: 'tei.css',
  },
  jTei: {
    id: 'jTei',
    name: 'jTEI Article',
    mapping: 'tei',
    rngUrls: ['https://tei-c.org/release/xml/tei/custom/schema/relaxng/tei_jtei.rng'],
    cssUrls: ['https://cwrc.ca/templates/css/tei.css'],
    localRngName: 'tei_jtei.rng',
    localCssName: 'tei.css',
  },
  orlando: {
    id: 'orlando',
    name: 'Orlando',
    mapping: 'orlando',
    rngUrls: [
      'https://cwrc.ca/schemas/orlando_entry.rng',
      'https://raw.githubusercontent.com/cwrc/CWRC-Schema/master/schemas/orlando_entry.rng',
    ],
    cssUrls: [
      'https://cwrc.ca/templates/css/orlando.css',
      'https://raw.githubusercontent.com/cwrc/CWRC-Schema/master/templates/css/orlando.css',
    ],
    localRngName: 'orlando_entry.rng',
    localCssName: 'orlando.css',
  },
  cbeta: {
    id: 'cbeta',
    name: 'CBETA P5',
    mapping: 'tei',
    // Fallback only (web build / manual re-download); the desktop app installs
    // the bundled copy below. Kept pointing at the committed plugin artifact.
    rngUrls: [
      'https://raw.githubusercontent.com/lejeanbaptiste/plugins/main/packages/plugin-cbeta-import/data/schema/cbeta_p5.rng',
    ],
    cssUrls: [
      'https://raw.githubusercontent.com/lejeanbaptiste/leaf-writer/main/apps/desktop/resources/schema/cbeta.css',
    ],
    localRngName: 'cbeta_p5.rng',
    localCssName: 'cbeta.css',
    bundled: {
      rng: 'cbeta_p5.rng',
      css: 'cbeta.css',
      extra: ['cbeta_p5.sch'],
    },
  },
};

export const getCatalogEntry = (catalogId: string): SchemaCatalogEntry | undefined =>
  SCHEMA_CATALOG[catalogId];

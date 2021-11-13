export interface Schema {
  id: string;
  name: string;
  mapId: string;
  xml: string;
  css: string;
}

export interface SupportedSchemas {
  [key: string]: Schema;
}

export const supportedSchemas: SupportedSchemas = {
  cwrcTeiLite: {
    id: 'cwrcTeiLite',
    name: 'CWRC TEI Lite',
    mapId: 'tei',
    xml: 'https://cwrc.ca/schemas/cwrc_tei_lite.rng',
    css: 'https://cwrc.ca/templates/css/tei.css',
  },
  orlando: {
    id: 'orlando',
    name: 'Orlando',
    mapId: 'orlando',
    xml: 'https://cwrc.ca/schemas/orlando_entry.rng',
    css: 'https://cwrc.ca/templates/css/tei.css',
  },
  event: {
    id: 'event',
    name: 'Orlando Events',
    mapId: 'orlando',
    xml: 'https://cwrc.ca/schemas/orlando_event.rng',
    css: 'https://cwrc.ca/templates/css/orlando_v2_cwrc-writer.css',
  },
  cwrcEntry: {
    id: 'cwrcEntry',
    name: 'CWRC Entry',
    mapId: 'cwrcEntry',
    xml: 'https://cwrc.ca/schemas/cwrc_entry.rng',
    css: 'https://cwrc.ca/templates/css/cwrc.css',
  },
  epidoc: {
    id: 'epidoc',
    name: 'EpiDoc',
    mapId: 'tei',
    xml: 'http://www.stoa.org/epidoc/schema/latest/tei-epidoc.rng',
    css: 'https://cwrc.ca/templates/css/tei.css',
  },
  teiAll: {
    id: 'teiAll',
    name: 'TEI All',
    mapId: 'tei',
    xml: 'https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng',
    css: 'https://cwrc.ca/templates/css/tei.css',
  },
  teiDrama: {
    id: 'teiDrama',
    name: 'TEI Drama',
    mapId: 'tei',
    xml: 'https://tei-c.org/release/xml/tei/custom/schema/relaxng/tei_drama.rng',
    css: 'https://cwrc.ca/templates/css/tei.css',
  },
  teiCorpus: {
    id: 'teiCorpus',
    name: 'TEI Corpus',
    mapId: 'tei',
    xml: 'https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_corpus.rng',
    css: 'https://cwrc.ca/templates/css/tei.css',
  },
  teiMs: {
    id: 'teiMs',
    name: 'TEI Manuscript',
    mapId: 'tei',
    xml: 'https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_ms.rng',
    css: 'https://cwrc.ca/templates/css/tei.css',
  },
  teiSpeech: {
    id: 'teiSpeech',
    name: 'TEI teiSpeech',
    mapId: 'tei',
    xml: 'https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_speech.rng',
    css: 'https://cwrc.ca/templates/css/tei.css',
  },
  teiLite: {
    id: 'teiLite',
    name: 'TEI Lite',
    mapId: 'teiLite',
    xml: 'https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_lite.rng',
    css: 'https://cwrc.ca/templates/css/tei.css',
  },
  reed: {
    id: 'reed',
    name: 'Reed',
    mapId: 'tei',
    xml: 'https://cwrc.ca/islandora/object/cwrc%3A5d5159ce-8710-4717-b977-cc528dedc25e/datastream/SCHEMA/view',
    css: 'https://cwrc.ca/templates/css/tei.css',
  },
};

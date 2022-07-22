import type { Schema } from '../types';

export const schemas: Schema[] = [
  {
    id: 'cwrcTeiLite',
    name: 'CWRC TEI Lite',
    mapping: 'tei',
    rng: [
      'https://cwrc.ca/schemas/cwrc_tei_lite.rng',
      'https://raw.githubusercontent.com/cwrc/CWRC-Schema/master/schemas/cwrc_tei_lite.rng',
    ],
    css: [
      'https://cwrc.ca/templates/css/tei.css',
      'https://raw.githubusercontent.com/cwrc/CWRC-Schema/master/templates/css/tei.css',
    ],
  },
  {
    id: 'orlando',
    name: 'Orlando Schema',
    mapping: 'orlando',
    rng: [
      'https://cwrc.ca/schemas/orlando_entry.rng',
      'https://raw.githubusercontent.com/cwrc/CWRC-Schema/master/schemas/orlando_entry.rng',
    ],
    css: [
      'https://cwrc.ca/templates/css/orlando_v2_cwrc-writer.css',
      'https://raw.githubusercontent.com/cwrc/CWRC-Schema/master/templates/css/orlando_v2_cwrc-writer.css',
    ],
  },
  {
    id: 'event',
    name: 'Events Schema',
    mapping: 'orlando',
    rng: [
      'https://cwrc.ca/schemas/orlando_event.rng',
      'https://raw.githubusercontent.com/cwrc/CWRC-Schema/master/schemas/orlando_event.rng',
    ],
    css: [
      'https://cwrc.ca/templates/css/orlando_v2_cwrc-writer.css',
      'https://raw.githubusercontent.com/cwrc/CWRC-Schema/master/templates/css/orlando_v2_cwrc-writer.css',
    ],
  },
  {
    id: 'cwrcEntry',
    name: 'CWRC Entry Schema',
    mapping: 'cwrcEntry',
    rng: [
      'https://cwrc.ca/schemas/cwrc_entry.rng',
      'https://raw.githubusercontent.com/cwrc/CWRC-Schema/master/schemas/cwrc_entry.rng',
    ],
    css: [
      'https://cwrc.ca/templates/css/cwrc.css',
      'https://raw.githubusercontent.com/cwrc/CWRC-Schema/master/templates/css/cwrc.css',
    ],
  },
  {
    id: 'epidoc',
    name: 'EpiDoc Schema',
    mapping: 'tei',
    rng: [
      'https://www.stoa.org/epidoc/schema/latest/tei-epidoc.rng',
      'https://cwrc.ca/epidoc/schema/latest/tei-epidoc.rng',
    ],
    css: ['https://cwrc.ca/templates/css/tei.css'],
  },
  {
    id: 'teiAll',
    name: 'TEI All Schema',
    mapping: 'tei',
    rng: [
      'https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng',
      'https://jenkins.tei-c.org/job/TEIP5/lastSuccessfulBuild/artifact/P5/release/xml/tei/custom/schema/relaxng/tei_all.rng',
    ],
    css: ['https://cwrc.ca/templates/css/tei.css'],
  },
  {
    id: 'teiDrama',
    name: 'TEI Drama Schema',
    mapping: 'tei',
    rng: [
      'https://tei-c.org/release/xml/tei/custom/schema/relaxng/tei_drama.rng',
      'https://jenkins.tei-c.org/job/TEIP5/lastSuccessfulBuild/artifact/P5/release/xml/tei/custom/schema/relaxng/tei_drama.rng',
    ],
    css: ['https://cwrc.ca/templates/css/tei.css'],
  },
  {
    id: 'teiCorpus',
    name: 'TEI Corpus Schema',
    mapping: 'tei',
    rng: [
      'https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_corpus.rng',
      'https://jenkins.tei-c.org/job/TEIP5/lastSuccessfulBuild/artifact/P5/release/xml/tei/custom/schema/relaxng/tei_corpus.rng',
    ],
    css: ['https://cwrc.ca/templates/css/tei.css'],
  },
  {
    id: 'teiMs',
    name: 'TEI Manuscript Schema',
    mapping: 'tei',
    rng: [
      'https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_ms.rng',
      'https://jenkins.tei-c.org/job/TEIP5/lastSuccessfulBuild/artifact/P5/release/xml/tei/custom/schema/relaxng/tei_ms.rng',
    ],
    css: ['https://cwrc.ca/templates/css/tei.css'],
  },
  {
    id: 'teiSpeech',
    name: 'TEI Speech Schema',
    mapping: 'tei',
    rng: [
      'https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_speech.rng',
      'https://jenkins.tei-c.org/job/TEIP5/lastSuccessfulBuild/artifact/P5/release/xml/tei/custom/schema/relaxng/tei_speech.rng',
    ],
    css: ['https://cwrc.ca/templates/css/tei.css'],
  },
  {
    id: 'teiLite',
    name: 'TEI Lite Schema',
    mapping: 'teiLite',
    rng: [
      'https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_lite.rng',
      'https://jenkins.tei-c.org/job/TEIP5/lastSuccessfulBuild/artifact/P5/release/xml/tei/custom/schema/relaxng/tei_lite.rng',
    ],
    css: ['https://cwrc.ca/templates/css/tei.css'],
  },
  {
    id: 'moravian',
    name: 'Moravian Lives (TEI)',
    mapping: 'tei',
    rng: [
      'https://raw.githubusercontent.com/moravianlives/ML/master/Projects/TEI_Memoirs/out/MoravianMemoirs.rng',
    ],
    css: ['https://cwrc.ca/templates/css/tei.css'],
  },
  {
    id: 'reed',
    name: 'Reed',
    mapping: 'tei',
    rng: [
      'https://cwrc.ca/islandora/object/cwrc%3A5d5159ce-8710-4717-b977-cc528dedc25e/datastream/SCHEMA/view',
    ],
    css: ['https://cwrc.ca/templates/css/tei.css'],
  },
];

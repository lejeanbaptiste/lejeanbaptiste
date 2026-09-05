import type { Schema } from '../types';

export const schemas: Schema[] = [
  {
    id: 'orlando',
    name: 'Orlando',
    mapping: 'orlando',
    rng: [
      'https://cwrc.ca/schemas/orlando_entry.rng',
      'https://raw.githubusercontent.com/cwrc/CWRC-Schema/master/schemas/orlando_entry.rng',
    ],
    css: [
      'https://cwrc.ca/templates/css/orlando.css',
      'https://raw.githubusercontent.com/cwrc/CWRC-Schema/master/templates/css/orlando.css',
    ],
  },
  // {
  //   id: 'epidoc',
  //   name: 'EpiDoc',
  //   mapping: 'tei',
  //   rng: [
  //     'https://www.stoa.org/epidoc/schema/latest/tei-epidoc.rng',
  //     'https://cwrc.ca/epidoc/schema/latest/tei-epidoc.rng',
  //   ],
  //   css: ['https://cwrc.ca/templates/css/tei.css'],
  // },
  {
    id: 'teiAll',
    name: 'TEI All',
    mapping: 'tei',
    rng: [
      'https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng',
      'https://jenkins.tei-c.org/job/TEIP5/lastSuccessfulBuild/artifact/P5/release/xml/tei/custom/schema/relaxng/tei_all.rng',
    ],
    css: ['https://cwrc.ca/templates/css/tei.css'],
  },
  {
    id: 'teiLite',
    name: 'TEI Lite',
    mapping: 'teiLite',
    rng: [
      'https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_lite.rng',
      'https://jenkins.tei-c.org/job/TEIP5/lastSuccessfulBuild/artifact/P5/release/xml/tei/custom/schema/relaxng/tei_lite.rng',
    ],
    css: ['https://cwrc.ca/templates/css/tei.css'],
  },
  {
    id: 'teiSimplePrint',
    name: 'TEI Simple Print',
    mapping: 'tei',
    rng: [
      'https://tei-c.org/release/xml/tei/custom/schema/relaxng/tei_simplePrint.rng',
      'https://jenkins.tei-c.org/job/TEIP5/lastSuccessfulBuild/artifact/P5/release/xml/tei/custom/schema/relaxng/tei_simplePrint.rng',
    ],
    css: ['https://cwrc.ca/templates/css/tei.css'],
  },
  {
    id: 'jTei',
    name: 'jTEI Article',
    mapping: 'tei',
    rng: ['https://tei-c.org/release/xml/tei/custom/schema/relaxng/tei_jtei.rng'],
    css: ['https://cwrc.ca/templates/css/tei.css'],
  },
  {
    id: 'cbeta',
    name: 'CBETA P5',
    mapping: 'tei',
    // Desktop projects install a bundled, Grognard-loosened copy into the project's
    // schema/ folder (see apps/desktop schemaCatalog `cbeta`); this URL is only
    // a web/manual fallback pointing at the committed plugin artifact.
    rng: [
      'https://raw.githubusercontent.com/grognard/plugins/main/packages/plugin-cbeta-import/data/schema/cbeta_p5.rng',
    ],
    css: [
      'https://raw.githubusercontent.com/grognard/leaf-writer/main/apps/desktop/resources/schema/cbeta.css',
    ],
  },
];

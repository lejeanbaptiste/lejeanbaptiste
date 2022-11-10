import type { Types } from '@cwrc/leafwriter';

const isLocalDev = window.location.origin === 'https://localhost';

export const schemas: Types.Schema[] = isLocalDev
  ? [
      {
        id: 'event',
        name: 'Orlando Events',
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
        id: 'cwrcEntry',
        name: 'CWRC Entry',
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
        id: 'reed',
        name: 'REED',
        mapping: 'tei',
        rng: [
          'https://cwrc.ca/islandora/object/cwrc%3A5d5159ce-8710-4717-b977-cc528dedc25e/datastream/SCHEMA/view',
          'https://raw.githubusercontent.com/LEAF-VRE/schemas/main/reed/out/reed.rng',
        ],
        css: ['https://cwrc.ca/templates/css/tei.css'],
      },
    ]
  : [];

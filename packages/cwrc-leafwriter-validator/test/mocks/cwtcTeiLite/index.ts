import { documentValid } from './documentValid';
import { documentWithError } from './documentWithError';
import { gramarJsonStringfied } from './gramarJsonStringfied';
import { schemaXML } from './schemaXML';

const id = 'cwrcTeiLite';
const url = 'https://cwrc.ca/schemas/cwrc_tei_lite.rng';

export const cachedSchema = {
  createdAt: '2023-04-07T16:39:12.819Z',
  gramarJson: gramarJsonStringfied,
  hash: 'SHA-256-c4259bd3a1ef89df3efbc92fb7f5a71bc05e041d43ad2d9d3617a19eed44fa57',
  id: 'cwrcTeiLite',
  url: 'https://cwrc.ca/schemas/cwrc_tei_lite.rng',
  warnings: [],
};

export const cwrcTeiLite = {
  cachedSchema,
  documentValid,
  documentWithError,
  id,
  schemaXML,
  url,
};

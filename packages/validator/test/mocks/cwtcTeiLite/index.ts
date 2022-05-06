import { documentValid } from './documentValid';
import { documentWithError } from './documentWithError';
import { schemaXML } from './schemaXML';
import { stringfyParsedSchema } from './stringfyParsedSchema';
import LZUTF8 from 'lzutf8';

const id = 'cwrcTeiLite';
const url = 'https://cwrc.ca/schemas/cwrc_tei_lite.rng';

const copressedSchema = LZUTF8.compress(stringfyParsedSchema, {
  outputEncoding: 'StorageBinaryString',
});

const cached = JSON.stringify({
  json: copressedSchema,
  manifest: {
    filePath: './schema/xml/https%3A%2F%2Fcwrc.ca%2Fschemas%2Fcwrc_tei_lite.rng',
    hash: 'SHA-1-f7a0c83ed61bb4bf2bd9241e2c4b0a579b993a04',
  },
});

export default {
  id,
  url,
  schemaXML,
  cached,
  documentWithError,
  documentValid,
};

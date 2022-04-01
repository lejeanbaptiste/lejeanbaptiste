import {
  ConversionResult,
  convertRNGToPattern,
  Grammar,
  readTreeFromJSON,
  writeTreeToJSON,
} from '@cwrc/salve-leafwriter';
import { virtualEditor } from './virtualEditor';
export interface SchemaRequest {
  id: string;
  url: string;
  localData?: string;
}
export interface SchemaResponse {
  status: string;
  remoteData?: {
    json: string;
  };
  grammar?: Grammar;
}

export const loadSchema = async ({
  id,
  url,
  localData,
}: SchemaRequest): Promise<SchemaResponse> => {
  if (virtualEditor.schemaId === id) {
    return { status: 'Schema already loaded' };
  }

  if (!localData && !url) {
    const errorMessage = 'Schema not loaded: No reference provided';
    console.warn(errorMessage);
    return { status: errorMessage };
  }

  const { status, grammar, remoteData } = localData
    ? readSchema(localData)
    : await convertSchema(url);

  if (!grammar) throw new Error('Schema not set');
  virtualEditor.setSchema({ id, grammar });

  return { status, remoteData };
};

const readSchema = (schemaData: string): SchemaResponse => {
  const { json } = JSON.parse(schemaData);
  const grammar = readTreeFromJSON(json);

  return {
    grammar,
    status: 'Schema Loaded from cache.',
  };
};

const convertSchema = async (url: string): Promise<SchemaResponse> => {
  //@ts-ignore
  const convertedSchema = await convertRNGToPattern(url);

  // const convertedSchema = await self.salve.convertRNGToPattern(url, {
  //   createManifest: true,
  //   manifestHashAlgorithm: 'SHA-1',
  // });

  const grammar = convertedSchema.pattern;

  //@ts-ignore
  const json = writeTreeToJSON(convertedSchema.simplified, 3);

  return {
    grammar,
    remoteData: { json },
    status: 'Schema Loaded from file.',
  };
};

// eslint-disable-next-line no-unused-vars
export const extractElementsDefinitions = (convertedSchema: ConversionResult) => {
  const schemaDocumentation = new Set();

  //@ts-ignore
  for (const definition of convertedSchema.pattern.definitions.values()) {
    const { name, documentation } = definition.pat.name;
    schemaDocumentation.add({ name, documentation });
  }
  return schemaDocumentation;
};

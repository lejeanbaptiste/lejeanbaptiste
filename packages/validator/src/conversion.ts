import {
  ConversionResult,
  convertRNGToPattern,
  Grammar,
  readTreeFromJSON,
  writeTreeToJSON,
} from '@cwrc/salve-leafwriter';
import LZUTF8 from 'lzutf8';
import VirtualEditor from './virtualEditor';

export interface InitializeOptions {
  id: string;
  url: string;
  cachedSchema?: string;
  createManifest?: boolean;
}

export interface InitializeResponse {
  parsedSchema?: string;
  status: string;
}

interface SchemaParse extends InitializeResponse {
  grammar: Grammar;
}

export const initialize = async (
  virtualEditor: VirtualEditor,
  { id, url, cachedSchema, createManifest = true }: InitializeOptions
) => {
  const { manifest } = cachedSchema ? JSON.parse(cachedSchema) : { manifest: null };

  //@ts-ignore
  const convertedSchema = await convertSchema(url, createManifest);

  const newVersion =
    convertedSchema.manifest?.[0]?.filePath === manifest?.filePath &&
    convertedSchema.manifest?.[0]?.hash !== manifest?.hash;

  const { grammar, parsedSchema, status } =
    cachedSchema && !newVersion ? readSchema(cachedSchema) : writeSchema(convertedSchema);

  virtualEditor.schemaId = id;
  virtualEditor.schema = grammar;

  const response: InitializeResponse = { parsedSchema, status };

  return response;
};

const convertSchema = async (url: string, createManifest = false) => {
  //@ts-ignore
  return await convertRNGToPattern(url, { createManifest, manifestHashAlgorithm: 'SHA-1' });
};

const readSchema = (schemaData: string): SchemaParse => {
  const { json } = JSON.parse(schemaData);
  const decompressedJson = LZUTF8.decompress(json, { inputEncoding: 'StorageBinaryString' });
  const grammar = readTreeFromJSON(decompressedJson);

  return {
    grammar,
    status: 'Loaded from cache',
  };
};

const writeSchema = (convertedSchema: ConversionResult): SchemaParse => {
  const grammar = convertedSchema.pattern;
  const json = writeTreeToJSON(convertedSchema.simplified, 3);

  const compressedJson = LZUTF8.compress(json, { outputEncoding: 'StorageBinaryString' });
  const manifest = convertedSchema.manifest[0];

  const parsedSchema = JSON.stringify({
    json: compressedJson,
    manifest,
  });

  return {
    grammar,
    parsedSchema,
    status: 'Loaded from file',
  };
};

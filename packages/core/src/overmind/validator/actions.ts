import type {
  GetValidTagsAtParameters,
  ValidationResponse,
  Validator,
} from '@cwrc/leafwriter-validator';
import * as Comlink from 'comlink';
import { Context } from '../';
import Writer from '../../js/Writer';
import { webpackEnv } from '../../types';
import { log } from './../../utilities';

declare global {
  interface Window {
    leafwriterValidator: Comlink.Remote<Validator>;
    writer: Writer;
  }
}

export const loadValidator = async ({ state }: Context) => {
  const baseUrl = state.editor.baseUrl;
  const validator = await loadWebworker(baseUrl);
  if (!validator) return;

  window.leafwriterValidator = validator;
  state.validator.hasWorkerValidator = true;
};

const loadWebworker = async (baseUrl = ''): Promise<Comlink.Remote<Validator>> => {
  return await new Promise((resolve) => {
    // TODO: Improve the way to load webworkers for dev
    // * Check ThreadsJS once again.
    // * Or maybe experiment with ESBUILD

    console.log(baseUrl)

    const worker =
      webpackEnv.WORKER_ENV === 'development'
        ? new Worker(new URL('@cwrc/leafwriter-validator', import.meta.url))
        : new Worker(`${baseUrl}/leafwriter-validator.worker.js`);

    const validator: Comlink.Remote<Validator> = Comlink.wrap(worker);

    resolve(validator);
  });
};

export const initialize = async ({ state }: Context) => {
  const writer = window.writer;
  if (!writer) return;

  if (!state.validator.hasWorkerValidator) return;

  const workerValidator = window.leafwriterValidator;
  state.validator.hasWorkerValidator = !!workerValidator;

  const id = writer.schemaManager.getCurrentSchema()?.id;
  const schemaURI = writer.schemaManager.getXMLUrl();
  if (!id || !schemaURI) return;

  const cachedSchema = localStorage.getItem(`schema_${id}`) ?? undefined;

  // * CORS: Some of the schemas might have blocke by CORS
  //If provide, we wrap the schema URL in a requeste to the proxy server
  const url = state.editor.proxyLoaderXmlEndpoint
    ? `${state.editor.proxyLoaderXmlEndpoint}${encodeURIComponent(schemaURI)}`
    : schemaURI;

  const { parsedSchema, status } = await workerValidator.initialize({ id, cachedSchema, url });
  log.info(status);

  if (parsedSchema) {
    localStorage.setItem(`schema_${id}`, parsedSchema);
    log.info('Schema cached.');
  }

  state.validator.hasSchema = true;

  window.writer?.event('workerValidatorLoaded').publish();
};

export const validate = async ({ state }: Context) => {
  const writer = window.writer;
  if (!writer || !state.validator.hasWorkerValidator) return;

  const workerValidator = window.leafwriterValidator;
  if (!workerValidator.hasValidator()) return;

  const documentString = await writer.converter.getDocumentContent(false);

  const validationProgress = ({ partDone, state, valid, errors }: ValidationResponse) => {
    if (state <= 2) {
      writer.event('documentValidating').publish(partDone);
      return;
    }

    writer.event('documentValidated').publish(valid, { valid, errors }, documentString);
  };

  if (documentString) workerValidator.validate(documentString, Comlink.proxy(validationProgress));
};

type GetAtAction =
  | 'TagAt'
  | 'ElementsForTagAt'
  | 'AttributesForTagAt'
  | 'AttributeAt'
  | 'ValuesForTagAttributeAt';

export const getAt = async (
  { actions }: Context,
  {
    action,
    attributeName,
    index,
    parentXpath,
    tagName,
    xpath,
  }: {
    action: GetAtAction;
    attributeName?: string;
    index?: number;
    parentXpath?: string;
    tagName?: string;
    xpath?: string;
  }
) => {
  const {
    getTagAt,
    getElementsForTagAt,
    getAttributesForTagAt,
    getTagAttributeAt,
    getValuesForTagAttributeAt,
  } = actions.validator;

  switch (action) {
    case 'TagAt':
      if (!tagName || !parentXpath) return;
      return await getTagAt({ tagName, parentXpath, index });

    case 'ElementsForTagAt':
      if (!xpath) return;
      return await getElementsForTagAt({ xpath, index });

    case 'AttributesForTagAt':
      if (!xpath) return;
      return await getAttributesForTagAt({ xpath, index });

    case 'AttributeAt':
      if (!attributeName || !parentXpath) return;
      return await getTagAttributeAt({ attributeName, parentXpath });

    case 'ValuesForTagAttributeAt':
      if (!xpath) return;
      return await getValuesForTagAttributeAt({ xpath });

    default:
      return;
  }
};

export const getTagAt = async (
  { state }: Context,
  { tagName, parentXpath, index }: { tagName: string; parentXpath: string; index?: number }
) => {
  if (!state.validator.hasWorkerValidator) return;
  const workerValidator = window.leafwriterValidator;

  const tag = await workerValidator.getTagAt(tagName, parentXpath, index);
  return tag;
};

export const getElementsForTagAt = async (
  { state }: Context,
  { xpath, index }: { xpath: string; index?: number }
) => {
  if (!state.validator.hasWorkerValidator) return;
  const workerValidator = window.leafwriterValidator;

  const tags = await workerValidator.getElementsForTagAt(xpath, index);
  return tags;
};

export const getAttributesForTagAt = async (
  { state }: Context,
  { xpath, index }: { xpath: string; index?: number }
) => {
  if (!state.validator.hasWorkerValidator) return;
  const workerValidator = window.leafwriterValidator;

  const attributes = await workerValidator.getAttributesForTagAt(xpath, index);
  return attributes;
};

export const getTagAttributeAt = async (
  { state }: Context,
  { attributeName, parentXpath }: { attributeName: string; parentXpath: string }
) => {
  if (!state.validator.hasWorkerValidator) return;
  const workerValidator = window.leafwriterValidator;

  const attribute = await workerValidator.getTagAttributeAt(attributeName, parentXpath);
  return attribute;
};

export const getValuesForTagAttributeAt = async (
  { state }: Context,
  { xpath }: { xpath: string }
) => {
  if (!state.validator.hasWorkerValidator) return;
  const workerValidator = window.leafwriterValidator;

  const values = await workerValidator.getValuesForTagAttributeAt(xpath);
  return values;
};

export const getValidTagsAt = async ({ state }: Context, params: GetValidTagsAtParameters) => {
  if (!state.validator.hasWorkerValidator) return;
  const workerValidator = window.leafwriterValidator;

  const response = await workerValidator.getValidTagsAt(params);
  const tags = response.speculative || response.possible;
  return tags;
};

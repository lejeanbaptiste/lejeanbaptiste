import type {
  CwrcWorkerValidator,
  PossibleRequest,
  Tag,
  TagRequest,
  ValidationNodeElement,
  ValidationNodeTarget,
  ValidationResponse
} from '@cwrc/leafwriter-validator-worker';
import * as Comlink from 'comlink';
import { Context } from '../';

declare global {
  interface Window {
    workerValidator: Comlink.Remote<CwrcWorkerValidator>;
  }
}

export const onInitializeOvermind = async ({ state }: Context, overmind: any) => {
  const validator = await loadWorkerValidator();
  if (!validator) return;

  window.workerValidator = validator;
  state.validator.hasValidator = true;
};

const loadWorkerValidator = async (): Promise<Comlink.Remote<CwrcWorkerValidator>> => {
  return await new Promise((resolve) => {
    // TODO: Improve the way to load webworkers for dev
    // * Check ThreadsJS once again.
    // * Or maybe experiment with ESBUILD

    //@ts-ignore
    if (WORKER_ENV === 'development') {
      //? WORKER DEV:
      const worker = new Worker(new URL('@cwrc/leafwriter-validator-worker', import.meta.url));
      const validator: Comlink.Remote<CwrcWorkerValidator> = Comlink.wrap(worker);
      resolve(validator);
    } else {
      //? WORKER PRODUCTION:
      const worker = new Worker('leaf-writer-validator.worker.js');
      const validator: Comlink.Remote<CwrcWorkerValidator> = Comlink.wrap(worker);
      resolve(validator);
    }
  });
};

export const workerLoadSchema = async ({ state }: Context) => {
  const writer = window.writer;
  if (!writer) return;

  if (!state.validator.hasValidator) return;

  const workerValidator = window.workerValidator;

  const id = writer.schemaManager.getCurrentSchema()?.id;
  const schemaURI = writer.schemaManager.getXMLUrl();
  if (!id || !schemaURI) return;

  const localData = localStorage.getItem(`schema_${id}`) ?? undefined;

  //CORS: Some of the schemas might have blocke by CORS
  //If provide, we wrap the schema URL in a requeste to the proxy server
  const url = state.editor.schemaProxyXmlEndpoint
    ? `${state.editor.schemaProxyXmlEndpoint}${encodeURIComponent(schemaURI)}`
    : schemaURI;

  const { status, remoteData } = await workerValidator.loadSchema({ id, localData, url });
  console.info(status);

  if (remoteData) {
    localStorage.setItem(`schema_${id}`, JSON.stringify(remoteData));
    console.info('Schema cached.');
  }
};

export const workerValidate = async ({ state }: Context) => {
  const writer = window.writer;
  if (!writer || !state.validator.hasValidator) return;

  const workerValidator = window.workerValidator;
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

export const workerGetPossibleFromError = async (
  { state }: Context,
  {
    type,
    target,
    element,
  }: { type: string; target: ValidationNodeTarget; element: ValidationNodeElement }
) => {
  if (!state.validator.hasValidator) return;
  const workerValidator = window.workerValidator;

  let xpath = target.xpath;
  let index = target.index;

  if (type === 'ElementNameError') xpath = element.xpath;

  if (type === 'AttributeNameError') {
    xpath = element.parentElementXpath;
    index = element.parentElementIndex;
  }

  if (type === 'ValidationError') {
    xpath = element.xpath;
    //@ts-ignore
    index = element.index;
  }

  //@ts-ignore
  const response = await workerValidator.validatePossible(xpath, index, type);
  return response;
};

export const workerPossibleAtContextMenu = async ({ state }: Context, params: PossibleRequest) => {
  if (!state.validator.hasValidator) return;
  const workerValidator = window.workerValidator;

  const response = await workerValidator.possibleAtContextMenu(params);
  const tags: Tag[] = response.tags.speculative || response.tags.possible;
  return tags;
};

export const workerTagAt = async ({ state }: Context, params: TagRequest) => {
  if (!state.validator.hasValidator) return;
  const workerValidator = window.workerValidator;

  const tag = await workerValidator.tagAt(params);
  return tag;
};

export const workerAttributesForTag = async ({ state }: Context, xpath: string) => {
  if (!state.validator.hasValidator) return;
  const workerValidator = window.workerValidator;

  const tagAttributes = await workerValidator.attributesForTag(xpath);
  return tagAttributes;
};

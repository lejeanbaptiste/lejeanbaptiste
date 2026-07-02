import type {
  Target as PossibleNodesAtTarget,
  ValidationResponse,
  ValidatorType,
} from '@cwrc/leafwriter-validator';
import * as Comlink from 'comlink';
import { Context } from '../';
import Writer from '../../js/Writer';
import { webpackEnv } from '../../types';
import { checkWellFormedness } from '../../utilities/checkWellFormedness';
import { isLocalFileUrl, localSchemaToBlobUrl } from '../../utilities/fetchResource';

const getValidatorInstrumentation = () => {
  if (!window.__desktopValidatorInstrumentation) {
    window.__desktopValidatorInstrumentation = {
      workerLoading: false,
      workerLoaded: false,
      schemaLoading: false,
      schemaLoaded: false,
      validationRunning: false,
      validationPanelRequested: false,
      validationPanelMounted: false,
    };
  }
  return window.__desktopValidatorInstrumentation;
};

const logValidatorInstrumentation = (tag: string) => {
  console.debug?.('[ValidatorInstrumentation]', tag, window.__desktopValidatorInstrumentation);
};

export type SourceValidationResult = ValidationResponse & {
  parseError?: Extract<ReturnType<typeof checkWellFormedness>, { valid: false }>['error'];
};

declare global {
  interface Window {
    leafwriterValidator: Comlink.Remote<ValidatorType>;
    writer: Writer;
  }
}

export const loadValidator = async ({ state }: Context) => {
  const instrumentation = getValidatorInstrumentation();
  instrumentation.workerLoading = true;
  instrumentation.workerLoaded = false;
  logValidatorInstrumentation('loadValidator started');

  const baseUrl = state.editor.baseUrl;
  const validator = await loadWebworker(baseUrl);
  if (!validator) {
    instrumentation.workerLoading = false;
    instrumentation.workerLoaded = false;
    logValidatorInstrumentation('loadValidator failed');
    return;
  }

  window.leafwriterValidator = validator;
  state.validator.hasWorkerValidator = true;
  instrumentation.workerLoading = false;
  instrumentation.workerLoaded = true;
  logValidatorInstrumentation('loadValidator completed');
};

const loadWebworker = async (baseUrl = ''): Promise<Comlink.Remote<ValidatorType>> => {
  return await new Promise((resolve) => {
    // TODO: Improve the way to load webworkers for dev
    // * Check ThreadsJS once again.
    // * Or maybe experiment with ESBUILD

    const worker =
      webpackEnv.WORKER_ENV === 'development'
        ? new Worker(new URL('@cwrc/leafwriter-validator', import.meta.url))
        : new Worker(`${baseUrl}/leafwriter-validator.worker.js`);

    const validator: Comlink.Remote<ValidatorType> = Comlink.wrap(worker);

    resolve(validator);
  });
};

const resolveSchemaUrlForWorker = async (schemaURL: string): Promise<string> => {
  if (isLocalFileUrl(schemaURL)) {
    const blobUrl = await localSchemaToBlobUrl(schemaURL);
    if (blobUrl) return blobUrl;
  }
  return schemaURL;
};

export const initialize = async ({ state }: Context) => {
  const instrumentation = getValidatorInstrumentation();
  instrumentation.schemaLoading = true;
  instrumentation.schemaLoaded = false;
  logValidatorInstrumentation('initialize started');

  const writer = window.writer;
  if (!writer) {
    instrumentation.schemaLoading = false;
    logValidatorInstrumentation('initialize aborted: no writer');
    return;
  }

  if (!state.validator.hasWorkerValidator) {
    instrumentation.schemaLoading = false;
    return;
  }

  const workerValidator = window.leafwriterValidator;
  state.validator.hasWorkerValidator = !!workerValidator;

  const schemaId = writer.schemaManager.getCurrentSchema()?.id;
  const schemaURL = writer.schemaManager.getRng();
  if (!schemaId || !schemaURL) {
    instrumentation.schemaLoading = false;
    return;
  }

  const workerUrl = await resolveSchemaUrlForWorker(schemaURL);
  let schemaWorker = { success: false };
  try {
    schemaWorker = await workerValidator.initialize({ id: schemaId, url: workerUrl });
  } catch {
    schemaWorker = { success: false };
  }

  instrumentation.schemaLoading = false;
  instrumentation.schemaLoaded = !!schemaWorker.success;
  logValidatorInstrumentation(
    schemaWorker.success ? 'initialize completed' : 'initialize failed',
  );

  if (schemaWorker.success) state.validator.hasSchema = true;

  window.writer?.event('workerValidatorLoaded').publish(schemaWorker);
};

export const validate = async ({ state, actions }: Context) => {
  const instrumentation = getValidatorInstrumentation();
  instrumentation.validationRunning = true;

  const writer = window.writer;
  if (!writer) {
    instrumentation.validationRunning = false;
    return;
  }

  const documentString =
    state.ui.editorViewMode === 'source'
      ? state.ui.sourceCurrentContent
      : await writer.converter.getDocumentContent(false);

  const mergeForValidation = window.__desktopMergeHeaderForValidation;
  const validationString =
    typeof mergeForValidation === 'function'
      ? mergeForValidation(documentString ?? '')
      : documentString;

  if (!validationString) {
    instrumentation.validationRunning = false;
    return;
  }

  const wellFormed = checkWellFormedness(validationString);
  if (!wellFormed.valid) {
    const parseErrorCount = wellFormed.error.positions?.length ?? 1;
    await actions.validator.updateValidationError(parseErrorCount);
    writer.event('documentValidated').publish(
      false,
      { valid: false, errors: [], parseError: wellFormed.error } satisfies SourceValidationResult,
      validationString,
    );
    instrumentation.validationRunning = false;
    return;
  }

  if (!state.validator.hasWorkerValidator || !state.validator.hasSchema) {
    await actions.validator.updateValidationError(0);
    writer.event('documentValidated').publish(true, { valid: true }, validationString);
    instrumentation.validationRunning = false;
    logValidatorInstrumentation('validate skipped: no worker or schema');
    return;
  }

  const workerValidator = window.leafwriterValidator;

  const validationProgress = async ({ partDone, state, valid, errors }: ValidationResponse) => {
    if (state.valueOf() <= 2) {
      writer.event('documentValidating').publish(partDone);
      return;
    }

    const totalError = valid ? 0 : (errors?.length ?? 0);
    await actions.validator.updateValidationError(totalError);

    writer.event('documentValidated').publish(valid, { valid, errors }, validationString);
  };

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  await workerValidator.validate(validationString, Comlink.proxy(validationProgress));
  instrumentation.validationRunning = false;
};

export const updateValidationError = async ({ state }: Context, value: number) => {
  state.validator.validationErrors = value;
};

type GetAtAction =
  | 'AttributeAt'
  | 'AttributesForTagAt'
  | 'NodesForTagAt'
  | 'TagAt'
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
  },
) => {
  const {
    getTagAt,
    getNodesForTagAt,
    getAttributesForTagAt,
    getTagAttributeAt,
    getValuesForTagAttributeAt,
  } = actions.validator;

  switch (action) {
    case 'TagAt':
      if (!tagName || !parentXpath) return;
      return await getTagAt({ tagName, parentXpath, index });

    case 'NodesForTagAt':
      if (!xpath) return;
      return await getNodesForTagAt({ xpath, index });

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
  { tagName, parentXpath, index }: { tagName: string; parentXpath: string; index?: number },
) => {
  if (!state.validator.hasWorkerValidator) return;
  const workerValidator = window.leafwriterValidator;

  const tag = await workerValidator.getTagAt(tagName, parentXpath, index);
  return tag;
};

export const getNodesForTagAt = async (
  { state }: Context,
  { xpath, index }: { xpath: string; index?: number },
) => {
  if (!state.validator.hasWorkerValidator) return;
  const workerValidator = window.leafwriterValidator;

  const tags = await workerValidator.getNodesForTagAt(xpath, index);
  return tags;
};

export const getAttributesForTagAt = async (
  { state }: Context,
  { xpath, index }: { xpath: string; index?: number },
) => {
  if (!state.validator.hasWorkerValidator) return;
  const workerValidator = window.leafwriterValidator;

  const attributes = await workerValidator.getAttributesForTagAt(xpath, index);
  return attributes;
};

export const getTagAttributeAt = async (
  { state }: Context,
  { attributeName, parentXpath }: { attributeName: string; parentXpath: string },
) => {
  if (!state.validator.hasWorkerValidator) return;
  const workerValidator = window.leafwriterValidator;

  const attribute = await workerValidator.getTagAttributeAt(attributeName, parentXpath);
  return attribute;
};

export const getValuesForTagAttributeAt = async (
  { state }: Context,
  { xpath }: { xpath: string },
) => {
  if (!state.validator.hasWorkerValidator) return;
  const workerValidator = window.leafwriterValidator;

  const values = await workerValidator.getValuesForTagAttributeAt(xpath);
  return values;
};

export const getPossibleNodesAt = async ({ state }: Context, params: PossibleNodesAtTarget) => {
  if (!state.validator.hasWorkerValidator) return;
  const workerValidator = window.leafwriterValidator;

  const response = await workerValidator.getPossibleNodesAt(params, { speculativeValidate: true });

  //? filter text nodes until we have a beter support for it
  const nodes = response?.nodes.filter((node) => node.type !== 'text');
  return nodes;
};

export const clear = ({ state }: Context) => {
  state.validator.hasSchema = false;
  state.validator.hasWorkerValidator = false;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const clearCache = async (_props: Context) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  await window.leafwriterValidator.clearCache();
};

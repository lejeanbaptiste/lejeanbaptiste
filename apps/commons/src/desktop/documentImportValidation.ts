import type { ValidationResponse, ValidatorType } from '@cwrc/leafwriter-validator';
import * as Comlink from 'comlink';
import { fetchResourceText } from '../../../../packages/cwrc-leafwriter/src/utilities/fetchResource';
import { devValidatorWorkerUrl } from '../../../../packages/cwrc-leafwriter/src/overmind/validator/devWorkerUrl';
import { inspectImportedXml } from './documentImport';
import { buildProjectSchemas, type ProjectFileConfig } from './projectFile';

export type ImportRelaxNgValidation =
  | { status: 'valid' }
  | { errorCount: number; firstMessage: string; status: 'invalid' }
  | { reason: 'not-well-formed'; status: 'skipped' }
  | {
      reason: 'no-schema' | 'worker-unavailable' | 'schema-read-failed' | 'schema-compile-failed';
      status: 'unavailable';
    };

declare global {
  interface Window {
    leafwriterValidator: Comlink.Remote<ValidatorType>;
  }
}

let validatorSpawnInFlight: Promise<Comlink.Remote<ValidatorType> | null> | null = null;

const isValidationComplete = (response: ValidationResponse): boolean =>
  response.state.valueOf() > 2;

const spawnValidatorWorker = async (
  baseUrl: string,
): Promise<Comlink.Remote<ValidatorType> | null> => {
  try {
    const devUrl = devValidatorWorkerUrl();
    const worker = devUrl
      ? new Worker(devUrl)
      : new Worker(`${baseUrl.replace(/\/$/, '')}/leafwriter-validator.worker.js`);
    return Comlink.wrap(worker);
  } catch {
    return null;
  }
};

const ensureValidatorWorker = async (
  baseUrl: string,
): Promise<Comlink.Remote<ValidatorType> | null> => {
  if (window.leafwriterValidator) return window.leafwriterValidator;

  if (!validatorSpawnInFlight) {
    validatorSpawnInFlight = spawnValidatorWorker(baseUrl).then((worker) => {
      if (worker) window.leafwriterValidator = worker;
      return worker;
    });
  }

  try {
    return await validatorSpawnInFlight;
  } finally {
    validatorSpawnInFlight = null;
  }
};

/** RelaxNG validation for a freshly imported document against the project schema. */
export const validateImportedXmlRelaxNg = async (
  xml: string,
  options: {
    baseUrl?: string;
    config: ProjectFileConfig;
    rootPath: string;
  },
): Promise<ImportRelaxNgValidation> => {
  const wellFormed = inspectImportedXml(xml);
  if (!wellFormed.ok) {
    return { status: 'skipped', reason: 'not-well-formed' };
  }

  const [schemaEntry] = buildProjectSchemas(options.rootPath, options.config);
  const schemaURL = schemaEntry?.rng[0];
  if (!schemaEntry || !schemaURL) {
    return { status: 'unavailable', reason: 'no-schema' };
  }

  const baseUrl =
    options.baseUrl ??
    window.writer?.overmindState?.editor?.baseUrl ??
    (typeof window !== 'undefined' ? window.location.origin : '');

  const worker = await ensureValidatorWorker(baseUrl);
  if (!worker) {
    return { status: 'unavailable', reason: 'worker-unavailable' };
  }

  const schemaText = await fetchResourceText(schemaURL);
  if (!schemaText) {
    return { status: 'unavailable', reason: 'schema-read-failed' };
  }

  let initResult: { error?: Error; success: boolean };
  try {
    initResult = await worker.initialize({
      id: schemaEntry.id,
      schemaText,
      shouldCache: false,
      url: schemaURL,
    });
  } catch (error) {
    initResult = {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  if (!initResult.success) {
    return { status: 'unavailable', reason: 'schema-compile-failed' };
  }

  const response = await new Promise<ValidationResponse>((resolve, reject) => {
    void worker
      .validate(
        xml,
        Comlink.proxy((partial: ValidationResponse) => {
          if (isValidationComplete(partial)) resolve(partial);
        }),
      )
      .catch(reject);
  }).catch(() => null);

  if (!response) {
    return { status: 'unavailable', reason: 'worker-unavailable' };
  }

  if (response.valid) {
    return { status: 'valid' };
  }

  const firstMessage = response.errors?.[0]?.msg?.trim() || 'Schema validation failed';
  return {
    status: 'invalid',
    errorCount: response.errors?.length ?? 1,
    firstMessage,
  };
};

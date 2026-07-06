import { fromLocalFileUrl, fetchResourceText } from '../../utilities/fetchResource';

export type ValidatorDebugReport = {
  editorSchema: {
    schemaId: string | null;
    rng: string | null;
    documentSchemaUrl: string | null;
    revision: string | null;
    elementCount: number;
    inCatalog: boolean;
  };
  validator: {
    hasWorkerValidator: boolean;
    hasSchema: boolean;
    instrumentation: Window['__desktopValidatorInstrumentation'];
  };
  schemaFile?: {
    localPath: string | null;
    readable: boolean;
    byteLength?: number;
    hasInclude?: boolean;
    mergeMarker?: string | null;
    blobUrlCreated?: boolean;
    blobError?: string;
    workerPayload?: string | null;
    error?: string;
  };
  workerInit?: { success: boolean; error?: string };
  validate?: { valid: boolean; errorCount: number; schemaUnavailable?: boolean };
};

/** Console-friendly validator/schema snapshot. Attached to `window.__ljbDebugValidator`. */
export async function debugValidator(options?: {
  /** After printing, try loadValidator + validate. */
  runValidation?: boolean;
}): Promise<ValidatorDebugReport> {
  const writer = window.writer;
  const report: ValidatorDebugReport = {
    editorSchema: {
      schemaId: null,
      rng: null,
      documentSchemaUrl: null,
      revision: null,
      elementCount: 0,
      inCatalog: false,
    },
    validator: {
      hasWorkerValidator: false,
      hasSchema: false,
      instrumentation: window.__desktopValidatorInstrumentation,
    },
  };

  if (!writer) {
    console.warn('[ljbDebugValidator] window.writer is not set yet.');
    console.log(report);
    return report;
  }

  const sm = writer.schemaManager;
  const vs = writer.overmindState?.validator;

  report.editorSchema = {
    schemaId: sm.schemaId,
    rng: sm.getRng(),
    documentSchemaUrl: sm.getCurrentDocumentSchemaUrl(),
    revision: sm.getSchemaRevision(),
    elementCount: sm.schema?.elements?.length ?? 0,
    inCatalog: Boolean(sm.getCurrentSchema()),
  };

  report.validator = {
    hasWorkerValidator: Boolean(vs?.hasWorkerValidator && window.leafwriterValidator),
    hasSchema: Boolean(vs?.hasSchema),
    instrumentation: window.__desktopValidatorInstrumentation,
  };

  const schemaURL = sm.getRng() ?? sm.getCurrentDocumentSchemaUrl();
  if (schemaURL) {
    const localPath = fromLocalFileUrl(schemaURL);
    report.schemaFile = { localPath, readable: false };

    if (localPath && window.electronAPI?.readFile) {
      try {
        const text = await window.electronAPI.readFile(localPath);
        report.schemaFile.readable = true;
        report.schemaFile.byteLength = text.length;
        report.schemaFile.hasInclude = /<include[\s>]/i.test(text);
        report.schemaFile.mergeMarker =
          text.match(/ljb-sanmiao-merge v\d+/i)?.[0] ?? null;
      } catch (error) {
        report.schemaFile.readable = false;
        report.schemaFile.error = String(error);
      }
    }

    try {
      const blobUrl = await (async () => {
        if (!schemaURL.startsWith('crcao://')) return null;
        const text = await fetchResourceText(schemaURL);
        return text ? `[${text.length} chars ready for worker]` : null;
      })();
      report.schemaFile.workerPayload = blobUrl;
    } catch (error) {
      report.schemaFile.workerPayload = null;
      report.schemaFile.blobError = String(error);
    }
  }

  console.group('[ljbDebugValidator] schema / validator state');
  console.table(report.editorSchema);
  console.table(report.validator);
  if (report.schemaFile) console.log('schema file', report.schemaFile);

  if (options?.runValidation !== false) {
    const actions = writer.overmindActions?.validator;
    if (actions) {
      console.log('→ loadValidator()…');
      await actions.loadValidator({ silent: true });
      report.validator.hasWorkerValidator = Boolean(
        writer.overmindState?.validator?.hasWorkerValidator,
      );
      report.validator.hasSchema = Boolean(writer.overmindState?.validator?.hasSchema);

      if (window.leafwriterValidator) {
        console.log('→ worker initialize()…');
        try {
          const schemaId =
            sm.schemaId ??
            sm.getCurrentSchema()?.id ??
            (schemaURL ? sm.getSchemaIdFromUrl(schemaURL) : undefined);
          const schemaRevision = sm.getSchemaRevision();
          const schemaText = schemaURL.startsWith('crcao://')
            ? await fetchResourceText(schemaURL)
            : undefined;
          if (schemaId && (schemaText || !schemaURL.startsWith('crcao://'))) {
            const init = await window.leafwriterValidator.initialize({
              id: schemaId,
              url: schemaURL,
              schemaRevision,
              schemaText: schemaText ?? undefined,
              shouldCache: !schemaURL.startsWith('crcao://'),
            });
            report.workerInit = {
              success: init.success,
              error: init.error?.message,
            };
            console.log('worker initialize', report.workerInit);
          }
        } catch (error) {
          report.workerInit = { success: false, error: String(error) };
          console.warn('worker initialize threw', error);
        }
      }

      console.log('→ validate()…');
      await actions.validate();
      const last = writer.overmindState?.validator?.validationErrors;
      report.validate = {
        valid: last === 0,
        errorCount: last ?? -1,
      };
      console.log('validation error count', last);
    }
  }

  console.groupEnd();
  console.log('Full report object:', report);
  return report;
}

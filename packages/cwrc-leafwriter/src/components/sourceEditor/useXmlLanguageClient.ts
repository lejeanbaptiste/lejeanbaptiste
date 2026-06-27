import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { useEffect, useRef } from 'react';
import {
  disposeLspClient,
  ensureLspInitialized,
  notifyDocumentChange,
  notifyDocumentClose,
  notifyDocumentOpen,
  pathToFileUri,
  requestCompletion,
  requestHover,
  type LspStartOptions,
} from './lsp/ipcLspClient';
import { toMonacoCompletionItems, toMonacoHover } from './lsp/lspMonacoConverters';

export interface UseXmlLanguageClientOptions {
  documentPath?: string | null;
  editor: monaco.editor.IStandaloneCodeEditor | null;
  lspOptions?: LspStartOptions;
  value: string;
}

const isDesktopLsp = () =>
  typeof window !== 'undefined' &&
  !!(window as Window & { electronAPI?: { lspSend?: unknown } }).electronAPI?.lspSend;

let providersRegistered = false;
let providerDisposables: monaco.IDisposable[] = [];
let activeDocumentUri: string | null = null;

const registerGlobalProviders = () => {
  if (providersRegistered) return;
  providersRegistered = true;

  providerDisposables.push(
    monaco.languages.registerCompletionItemProvider('xml', {
      triggerCharacters: ['<', '/', ' ', '"', "'", '='],
      provideCompletionItems: async (model, position) => {
        if (!activeDocumentUri) return { suggestions: [] };

        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        try {
          const result = await requestCompletion(
            activeDocumentUri,
            position.lineNumber - 1,
            position.column - 1,
          );
          return { suggestions: toMonacoCompletionItems(result, range) };
        } catch {
          return { suggestions: [] };
        }
      },
    }),
    monaco.languages.registerHoverProvider('xml', {
      provideHover: async (_model, position) => {
        if (!activeDocumentUri) return null;

        try {
          const hover = await requestHover(
            activeDocumentUri,
            position.lineNumber - 1,
            position.column - 1,
          );
          return toMonacoHover(hover);
        } catch {
          return null;
        }
      },
    }),
  );
};

export const useXmlLanguageClient = ({
  documentPath,
  editor,
  lspOptions,
  value,
}: UseXmlLanguageClientOptions) => {
  const versionRef = useRef(1);
  const documentUriRef = useRef<string | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (!isDesktopLsp() || !editor || !documentPath) return;

    const documentUri = pathToFileUri(documentPath);
    documentUriRef.current = documentUri;
    activeDocumentUri = documentUri;
    const model = editor.getModel();
    if (!model) return;

    let disposed = false;
    const disposables: monaco.IDisposable[] = [];

    const setup = async () => {
      try {
        const rootUri = lspOptions?.projectRoot
          ? pathToFileUri(lspOptions.projectRoot)
          : null;

        await ensureLspInitialized(lspOptions ?? {}, rootUri);
        if (disposed) return;

        registerGlobalProviders();

        notifyDocumentOpen({
          uri: documentUri,
          languageId: 'xml',
          version: versionRef.current,
          text: valueRef.current,
        });

        const changeDisposable = model.onDidChangeContent(() => {
          versionRef.current += 1;
          notifyDocumentChange(documentUri, versionRef.current, model.getValue());
        });
        disposables.push(changeDisposable);
      } catch (error) {
        console.warn('[LSP] XML language client setup failed:', error);
      }
    };

    void setup();

    return () => {
      disposed = true;
      if (documentUriRef.current) {
        notifyDocumentClose(documentUriRef.current);
      }
      if (activeDocumentUri === documentUriRef.current) {
        activeDocumentUri = null;
      }
      disposables.forEach((d) => d.dispose());
    };
  }, [documentPath, editor, lspOptions?.defaultSchemaRng, lspOptions?.projectRoot]);

  useEffect(() => {
    if (!isDesktopLsp() || !documentUriRef.current || !editor) return;
    const model = editor.getModel();
    if (!model) return;

    versionRef.current += 1;
    notifyDocumentChange(documentUriRef.current, versionRef.current, value);
  }, [editor, value]);
};

export const teardownXmlLanguageProviders = () => {
  providerDisposables.forEach((d) => d.dispose());
  providerDisposables = [];
  providersRegistered = false;
  disposeLspClient();
};

import type {
  CompletionItem,
  CompletionList,
  Hover,
  InitializeParams,
  TextDocumentItem,
} from 'vscode-languageserver-protocol';

export interface LspStartOptions {
  defaultSchemaRng?: string;
  projectRoot?: string;
}

type PendingRequest = {
  reject: (error: Error) => void;
  resolve: (value: unknown) => void;
};

let nextRequestId = 1;
const pendingRequests = new Map<number, PendingRequest>();
let messageUnsubscribe: (() => void) | null = null;
let initializePromise: Promise<void> | null = null;
let initialized = false;

const isDesktopLsp = () =>
  typeof window !== 'undefined' &&
  !!(window as Window & { electronAPI?: { lspSend?: unknown } }).electronAPI?.lspSend;

const handleLspMessage = (message: unknown) => {
  if (!message || typeof message !== 'object') return;

  const payload = message as Record<string, unknown>;
  if (!('id' in payload) || payload.id === null || payload.id === undefined) return;
  if (!('result' in payload) && !('error' in payload)) return;

  const id = payload.id as number;
  const pending = pendingRequests.get(id);
  if (!pending) return;

  pendingRequests.delete(id);

  if ('error' in payload && payload.error) {
    const error = payload.error as { message?: string };
    pending.reject(new Error(error.message ?? 'LSP request failed'));
    return;
  }

  pending.resolve(payload.result);
};

export const pathToFileUri = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.startsWith('/')) return `file://${encodeURI(normalized)}`;
  return `file:///${encodeURI(normalized)}`;
};

export const sendLspRequest = (method: string, params?: unknown): Promise<unknown> => {
  if (!isDesktopLsp()) {
    return Promise.reject(new Error('LSP is only available in the desktop app'));
  }

  const id = nextRequestId++;
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    void window.electronAPI!.lspSend({ jsonrpc: '2.0', id, method, params });
  });
};

export const sendLspNotification = (method: string, params?: unknown): void => {
  if (!isDesktopLsp()) return;
  void window.electronAPI!.lspSend({ jsonrpc: '2.0', method, params });
};

export const ensureLspInitialized = async (
  options: LspStartOptions = {},
  rootUri?: string | null,
): Promise<void> => {
  if (!isDesktopLsp()) return;
  if (initialized) return;
  if (initializePromise) return initializePromise;

  initializePromise = (async () => {
    if (!messageUnsubscribe) {
      messageUnsubscribe = window.electronAPI!.onLspMessage(handleLspMessage);
    }

    const start = await window.electronAPI!.lspStart(options);
    if (!start.ok) {
      throw new Error(start.error ?? 'Failed to start LemMinX');
    }

    const initParams: InitializeParams = {
      processId: null,
      rootUri: rootUri ?? undefined,
      capabilities: {
        textDocument: {
          completion: {
            completionItem: {
              snippetSupport: true,
              documentationFormat: ['markdown', 'plaintext'],
            },
          },
          hover: {
            contentFormat: ['markdown', 'plaintext'],
          },
          synchronization: {
            dynamicRegistration: false,
            willSave: false,
            didSave: false,
            willSaveWaitUntil: false,
          },
        },
      },
      initializationOptions: start.initializationOptions,
    };

    await sendLspRequest('initialize', initParams);
    sendLspNotification('initialized', {});
    initialized = true;
  })();

  try {
    await initializePromise;
  } catch (error) {
    initializePromise = null;
    throw error;
  }
};

export const notifyDocumentOpen = (item: TextDocumentItem) => {
  sendLspNotification('textDocument/didOpen', { textDocument: item });
};

export const notifyDocumentChange = (
  uri: string,
  version: number,
  text: string,
) => {
  sendLspNotification('textDocument/didChange', {
    textDocument: { uri, version },
    contentChanges: [{ text }],
  });
};

export const notifyDocumentClose = (uri: string) => {
  sendLspNotification('textDocument/didClose', {
    textDocument: { uri, version: 0 },
  });
};

export const requestCompletion = async (
  uri: string,
  line: number,
  character: number,
): Promise<CompletionItem[] | CompletionList | null> => {
  const result = await sendLspRequest('textDocument/completion', {
    textDocument: { uri },
    position: { line, character },
  });

  if (!result) return null;
  if (Array.isArray(result)) return result as CompletionItem[];
  return result as CompletionList;
};

export const requestHover = async (
  uri: string,
  line: number,
  character: number,
): Promise<Hover | null> => {
  const result = await sendLspRequest('textDocument/hover', {
    textDocument: { uri },
    position: { line, character },
  });
  return (result as Hover | null) ?? null;
};

export const disposeLspClient = () => {
  messageUnsubscribe?.();
  messageUnsubscribe = null;
  pendingRequests.clear();
  initializePromise = null;
  initialized = false;
};
